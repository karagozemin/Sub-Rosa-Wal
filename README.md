<p align="center">
  <img src="./assets/sub-rosa-readme.png" width="250" alt="Sub Rosa logo" />
</p>

# Sub Rosa Walrus Storage Layer

**Encrypted Walrus storage for Sub Rosa sealed submissions.**

This repo extends Sub Rosa with a real Walrus-backed storage layer for sealed
round metadata, encrypted submissions, scoring JSON, appraisal reports, judge
notes, and evidence files. The product is deliberately not a generic upload app:
the full payload is encrypted client-side and stored on Walrus, while compact
proof/reference fields remain attached to the Sub Rosa protocol flow.

> Heavy data on Walrus. Fairness and settlement stay on Sub Rosa.

The separation is the point:

- **Walrus** stores encrypted heavy payloads.
- **Bosphor** provides the EVM-to-Walrus storage intent route.
- **Stellar/Soroban** remains the commitment, reveal, proof reference, escrow,
  clearing, and settlement layer for the canonical Sub Rosa flow.
- **Freighter and RainbowKit are separate wallet routes.** Freighter signs
  Stellar/Soroban actions. RainbowKit/MetaMask signs Bosphor storage intents.

Licensed under [MIT](./LICENSE).

---

## What this repo demonstrates

```text
Browser
  encrypts sealed Sub Rosa metadata
      │
      ├─ Freighter route
      │    -> Walrus publisher returns blobId / endEpoch
      │    -> Soroban create_round + attach_storage_ref
      │    -> commit / reveal / settle stay on Stellar
      │
      └─ RainbowKit route
           -> Bosphor submitIntent on EVM
           -> IntentSubmitted(intentId)
           -> intentId is the shareable storage-backed round id
           -> later sealed score/reveal metadata use more Bosphor intents
```

The app does not generate fake Walrus blob ids, fake Bosphor intent ids, fake
Stellar transaction ids, or use `localStorage` as a storage backend. Missing
Walrus/Bosphor/Soroban configuration blocks the relevant action instead of
pretending a storage proof exists.

---

## Underlying Sub Rosa proofs

| Layer | Command | Network | What it proves |
| --- | --- | --- | --- |
| **Full product** | `pnpm lifecycle:e2e` | Testnet | 2 bidders, USDC SAC, keeper settle → contract **0** |
| **Multi-agent** | `pnpm agents:e2e` | Testnet | Mandate + x402 + keeper reveal + settle → **single UI trace** |
| **x402 appraisal** | `pnpm appraisal:e2e` | Testnet | HTTP 402 → on-chain USDC settle |
| **Mainnet smoke** | `pnpm mainnet:deploy` + `pnpm mainnet:settle` | Mainnet | Deploy, BLS, settle on **real XLM** |
| **Mainnet verify** | `pnpm mainnet:verify` | Mainnet | Read-only check of settled round 1 |

See [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) for honest scope (mainnet ≠ full USDC product).

---

## Where this plugs in

Sub Rosa can sit under allocation, judging, scoring, sealed-bid, appraisal, or
evidence-heavy workflows. This Walrus layer gives those workflows a place to
put encrypted payloads that are too large or too sensitive for contract state,
without moving fairness or settlement away from Sub Rosa.

The original hackathon-winning Sub Rosa protocol proof is still present in this
monorepo: Soroban contracts, TypeScript SDK, keeper service, tlock encryption,
x402 appraisal proof, and mainnet/testnet proof commands.

---

## Protocol integration model

Other applications can embed the Sub Rosa primitive directly and add Walrus
storage at the application layer:

```bash
npm install @sub-rosa/sdk
```

```ts
import { SubRosaClient } from "@sub-rosa/sdk";
import { sealBid, quicknet } from "@sub-rosa/tlock";

const client = new SubRosaClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
});

const sealed = await sealBid({
  value,
  nonce,
  round: revealRound,
  client: quicknet(),
  identity,
  auditorPublicKey,
});

await client.commit({ roundId, sealed, escrow });
```

The application can be a DAO tool, judging panel, sealed auction, RFP workflow,
or evidence-heavy review system. Sub Rosa supplies the sealed round state
machine; Walrus supplies encrypted payload availability.

---

## Deployed artifacts

### Mainnet (settlement smoke)

| Field | Value |
| --- | --- |
| Contract | [`CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX`](https://stellar.expert/explorer/public/contract/CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX) |
| WASM hash | `353915ad440965ea5f8d92fdb8d93cb2e309fb365e68e6762bca7fd6762b30c7` |
| Round | 1 · **Settled** |
| Drand R | 29,174,905 |
| Token | Native XLM SAC |
| Bid / escrow | **1 XLM / 5 XLM** (not testnet 700 USDC demo) |

```bash
pnpm mainnet:verify          # read-only — no secrets
pnpm mainnet:micro           # dry-run checklist; --execute needs MAINNET_CONFIRM
```

### Testnet (full product + UI trace)

| Field | Value |
| --- | --- |
| Contract (UI / agents:e2e) | [`CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y`](https://stellar.expert/explorer/testnet/contract/CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y) |
| Drand R | 29,176,840 |
| Canonical trace | `apps/web/src/demo/demo-trace.generated.ts` (from `pnpm agents:e2e`) |

---

## The idea

Public ledgers are transparent by default, but sealed coordination needs two
things at once: compact on-chain proof and private heavy data. The usual "fix"
puts payloads in a centralized database and asks users to trust the operator.
This repo replaces that storage assumption with encrypted Walrus payloads while
leaving Sub Rosa's settlement and reveal logic on Stellar/Soroban:

- **Seal** each bid with Drand timelock encryption (`tlock`) to a future round R.
- **Force-open** at R: BLS12-381 verified **on-chain** — simultaneous reveal.
- **Settle** deterministically. Identities disclosed only to the auditor.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the system map, lifecycle, trust boundaries, and monorepo layout.

## Bosphor / Walrus storage layer

Sub Rosa now has a real Walrus-backed storage layer for sealed round metadata,
judge notes, scoring JSON, appraisal reports, evidence files, and other heavy
payloads that do not belong in Soroban state. The core rule is unchanged:
**Stellar/Soroban remains the fairness, reveal, escrow, clearing, and settlement
layer. Walrus is encrypted storage.**

The live app uses one active wallet route at a time:

| Route | Wallet | What the wallet signs | Shareable round identifier | Settlement layer |
| --- | --- | --- | --- | --- |
| **Stellar route** | Freighter | Soroban `create_round`, `attach_storage_ref`, commit, reveal, clear, settle | Numeric Soroban `round_id` | Stellar/Soroban |
| **EVM route** | RainbowKit / MetaMask | Bosphor `submitIntent` calls for round metadata, sealed entry, and reveal metadata | Bosphor `intentId` for the round metadata intent | Storage-only demo route; Stellar settlement remains separate |

No runtime mock storage is used. The app does not treat `localStorage` as
Walrus and does not generate fake Bosphor intent IDs, fake Walrus blob IDs, or
fake Stellar tx IDs. Missing storage configuration blocks the action.

### Current live behavior

```text
Freighter route
  Browser encrypts round metadata
      -> Walrus publisher returns blobId / endEpoch
      -> Freighter signs Soroban create_round
      -> Freighter signs attach_storage_ref(...)
      -> participants commit / reveal / settle on Stellar

EVM route
  Browser encrypts round metadata
      -> MetaMask signs Bosphor submitIntent
      -> Bosphor emits IntentSubmitted(intentId)
      -> intentId becomes the shareable Bosphor round id
      -> participants can join by intentId
      -> sealed score and reveal metadata are submitted as further Bosphor intents
```

For the Stellar route, the deployed Soroban contract binds the Walrus receipt
with:

```text
attach_storage_ref(round_id, operator, content_hash, commitment_hash,
  storage_provider, intent_id, blob_id, end_epoch)
```

For the EVM route, `IntentSubmitted` is treated as the accepted storage intent.
`IntentExecuted(intentId, proof)` is the later Bosphor/Sui/LayerZero proof
return path. The UI does not block the user on that final proof event because
the accepted intent is already a real on-chain Bosphor record. The EVM route is
explicitly a Walrus storage route; it does not claim that MetaMask can sign
Soroban transactions or replace Stellar settlement.

A deployed Stellar contract must include `attach_storage_ref` and
`get_storage_ref`; older testnet contract IDs that only expose `create_round`
cannot bind the Walrus receipt on-chain.

## Monorepo layout

```
contracts/round/        Soroban primitive (Rust)
packages/tlock/         tlock seal + auditor blob
packages/sdk/           SubRosaClient + optional OZ Channels submitter
services/keeper/        Permissionless keeper + watch mode
services/appraisal-api/ x402-gated appraisal
services/agent/         Multi-agent bidders (mandate + caps)
apps/web/               Jury demo UI
docs/                   Design, threat model, track answers, deploy, limitations
```

## Quick start

```bash
pnpm install
pnpm contract:test          # Rust contract tests
pnpm web:dev                # jury UI — works without .env
pnpm agents:e2e             # testnet full agent proof (needs stellar keys)
pnpm mainnet:verify         # mainnet read-only proof
```

## Documentation

| Doc | Purpose |
| --- | --- |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System overview, lifecycle, trust boundaries, repo map |
| [docs/SCF_PLAN.md](./docs/SCF_PLAN.md) | SCF Build framing, tranches, deliverables, ecosystem value |
| [docs/PILOT_PLAYBOOK.md](./docs/PILOT_PLAYBOOK.md) | OverBlock pilot scope, external pilot outreach, SCF-style demo narrative |
| [docs/INTEGRATION.md](./docs/INTEGRATION.md) | How another Stellar app embeds Sub Rosa |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, storage, settlement rails |
| [docs/WALRUS_STORAGE.md](./docs/WALRUS_STORAGE.md) | Walrus/Bosphor storage routes and Soroban proof reference |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries, mitigations, honest limits |
| [docs/TRACK_ANSWERS.md](./docs/TRACK_ANSWERS.md) | Hack Privacy proof notes; agent proof as support |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md) | Passkey-Kit, Smart Account Kit, OZ Relayer |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 5-minute jury walkthrough |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Env: UI build vs runtime secrets |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Known scope boundaries |

## Current implementation status

- [x] Round contract + storage proof reference + on-chain Drand BLS
- [x] tlock + auditor blob (13 tests)
- [x] SDK (7 tests) + optional OZ Relayer Channels submitter
- [x] Testnet **full lifecycle** (`lifecycle:e2e`) — USDC, 2 bidders, settle → 0
- [x] Testnet **multi-agent** (`agents:e2e`) — x402, mandate, keeper reveal, settle → 0, **single UI trace**
- [x] Mainnet **deploy + settle smoke** — 1/5 XLM, round 1 settled
- [x] Mainnet **verify** + **micro runner** (dry-run default, tiny XLM cap)
- [x] Jury UI — one canonical testnet trace (status, bidders, R, auditor blobs, session keys)
- [x] Watch-mode keeper (`pnpm keeper:watch`)

## Core protocol roadmap

| Tranche | Goal | Deliverables |
| --- | --- | --- |
| 1 | Storage hardening | Production Walrus/Bosphor adapters, receipt indexing, richer proof explorer |
| 2 | Stellar proof hardening | Contract storage reference audits, hosted keeper, reusable UI hooks/components |
| 3 | Mainnet launch | Audited/open-source contracts, production keeper ops, deployment docs |

## Cryptographic design (Privacy track)

- **Seal:** Drand tlock IBE, `bls-unchained-g1-rfc9380`
- **Binding:** `H = sha256(value‖nonce)`
- **Unlock:** round-R BLS verified on-chain before reveal
- **Selective disclosure:** values public post-R; identities auditor-encrypted
