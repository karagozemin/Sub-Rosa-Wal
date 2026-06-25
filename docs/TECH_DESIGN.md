# Sub Rosa — Technical Design

## Architecture

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the system overview. This document covers cryptography, storage, and settlement detail.

## Overview

Sub Rosa is a **sealed commit–reveal coordination primitive** on Stellar Soroban. Participants lock escrow and submit timelock-encrypted bids; a public Drand round R forces simultaneous decryption; the contract clears and settles deterministically.

The Walrus layer does not replace Stellar. Before important round/submission
actions, the app encrypts heavier metadata client-side and stores it through the
configured Walrus route. Soroban receives only compact proof/reference fields.

## Architecture

```
┌─────────────┐     encrypt metadata     ┌──────────────────┐
│ Operator /  │ ───────────────────────► │ Walrus storage   │
│ App         │     store, receipt       │ route            │
└──────┬──────┘                          └────────┬─────────┘
       │ create_round + attach_storage_ref         │ blobId / intentId
       ▼                                           │
┌─────────────┐     sealBid (tlock)      ┌────────▼─────────┐
│ Bidder /    │ ───────────────────────► │ Round contract   │
│ Agent       │     commit(H,C,blob)     │ (Soroban)        │
└─────────────┘                          └────────┬─────────┘
       │ x402 appraisal                           │
       ▼                                          │ open_reveal(BLS sig)
┌─────────────┐                          ┌────────▼─────────┐
│ Appraisal   │                          │ Keeper (anyone)  │
│ API         │                          │ reveal -> clear  │
└─────────────┘                          │ -> settle        │
                                           └──────────────────┘
```

### Packages

| Package | Role |
| --- | --- |
| `contracts/round` | Soroban Round — storage refs, BLS verify, SAC settle |
| `packages/tlock` | Off-chain seal: `sealBid` / `openBid`, auditor blob |
| `packages/sdk` | `SubRosaClient` — bindings + direct RPC or optional OZ Channels submit |
| `services/keeper` | Permissionless open/reveal/clear/settle (+ watch mode) |
| `services/appraisal-api` | x402-gated appraisal (SEP-41 USDC) |
| `services/agent` | Multi-agent bidders with session mandates |
| `apps/web` | Jury demo UI, wallet routes, client encryption, Walrus receipt status |

## Cryptography

### Timelock seal (bid values)

- Scheme: Drand quicknet `bls-unchained-g1-rfc9380` via `tlock-js`
- Preimage: `be16(value) ‖ nonce` (32 bytes)
- Commitment: `H = sha256(preimage)` verified in-contract at reveal
- Unlock: round-R threshold signature verified on-chain (BLS12-381 host fns)

### Auditor blob (bidder identity)

- X25519 ECDH + HKDF-SHA256 + XChaCha20-Poly1305
- Stored in temporary contract storage alongside ciphertext
- Only the round's designated auditor secret can decrypt

### Walrus metadata payloads

- AES-GCM encryption happens in the browser before storage.
- The app computes `content_hash` over the encrypted payload bytes.
- The app computes `commitment_hash` from the content hash plus route metadata.
- The encrypted payload is stored through one configured route:
  - **Stellar route:** direct Walrus publisher, with Freighter signing Soroban.
  - **EVM route:** RainbowKit/wagmi signs a Bosphor storage intent, then Soroban
    still needs a Stellar signer for proof recording.
- The app must not generate fake blob ids, fake intent ids, or use localStorage
  as a Walrus substitute.

### On-chain BLS

Deploy constants validated via `services/drand-tools` against live quicknet. Contract rejects wrong-round signatures and malformed G1 points.

## Storage model

| Tier | Contents | Rationale |
| --- | --- | --- |
| Instance | Drand pubkey, DST, genesis, period, USDC SAC | Global config |
| Persistent | Round record, storage reference, per-bidder state (escrow, revealed value) | Survives until settle/void |
| Temporary | Ciphertext + auditor blob | Auto-expire after reveal window |

### Storage reference record

Walrus-backed rounds require a contract build that exposes:

```rust
attach_storage_ref(
  round_id,
  operator,
  content_hash,
  commitment_hash,
  storage_provider,
  intent_id,
  blob_id,
  end_epoch,
)
```

The receipt is intentionally compact. The encrypted bytes remain on Walrus; the
Soroban contract stores only the provider/reference fields needed to bind the
round to that external storage object.

Older deployed contracts that do not expose `attach_storage_ref` can still run
the base Sub Rosa lifecycle, but they cannot bind a Walrus receipt on-chain.

## Settlement rails

Two **SEP-41 token** paths on testnet (USDC SAC):

1. **x402** — agent → appraisal server micro-payment (HTTP 402, signed auth entry, facilitator settles on RPC). Used for **appraisal only**. Testnet-only in automated e2e.
2. **SAC `settle()`** — contract transfers winner escrow → operator; refunds losers. Used for **prize settlement**. Not x402.

Same asset rail on a given network (USDC on testnet); authorization differs. Mainnet smoke uses **native XLM SAC**, not USDC — see `docs/LIMITATIONS.md`.

## Agent authorization

- **Off-chain mandate**: principal signs caps (maxBid, maxEscrow, maxAppraisalSpend) for a session Ed25519 key
- **On-chain cap**: `valid = value > 0 && value ≤ escrow` at reveal
- **Production path**: Passkey / OpenZeppelin Smart Account with policy signers (see `docs/ECOSYSTEM.md`)

## Relayer Strategy

Critical path uses **direct Soroban RPC** (proven live). The SDK also exposes an optional OpenZeppelin Relayer Channels submitter:

```ts
import { SubRosaClient, createOzChannelsSubmitterFromEnv } from "@sub-rosa/sdk";

const sdk = new SubRosaClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
  submitter: createOzChannelsSubmitterFromEnv(),
});
```

If the submitter is absent, the SDK signs and submits exactly as before. If present, it signs locally, sends signed XDR through Channels, then reads finality/result over Soroban RPC.

## Live proof commands

```bash
pnpm lifecycle:e2e    # full round, 2 bidders, USDC SAC
pnpm agents:e2e       # multi-agent + x402 + keeper → single UI trace
pnpm appraisal:e2e    # x402 appraisal settle
pnpm keeper:e2e       # permissionless reveal
pnpm sdk:smoke        # deploy + commit smoke
pnpm mainnet:deploy   # mainnet wasm + round
pnpm mainnet:settle   # mainnet keeper close
pnpm keeper:watch     # polling keeper daemon
```

## Mainnet artifacts

- Contract: `CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX`
- Round 1: committed, revealed, cleared, settled (native XLM SAC smoke)
