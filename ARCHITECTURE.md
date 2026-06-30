# Sub Rosa Coordination Stack — Architecture

High-level map of the sealed coordination stack: Soroban commitments, Drand
timelock reveal, Walrus/Bosphor encrypted payloads, x402 payments, GOAT agent
decisions, wallet routes, trust boundaries, and where each proof runs. For
crypto and settlement detail see [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md).

---

## Problem and primitive

Sub Rosa is a **sealed commit–reveal coordination primitive** whose canonical
transaction layer is Stellar Soroban. The EVM/Walrus build adds encrypted,
verifiable payload storage, x402-paid appraisals, and GOAT-powered agent
decisions around the same sealed round. Participants commit now; a public Drand
round **R** forces simultaneous opening later; the contract clears and settles
without operator discretion.

| Phase | Who acts | What happens |
| --- | --- | --- |
| **Agent decision** | User / GOAT agent | Optional x402-paid strategy/evaluation produces structured decision + commitment payload |
| **Storage reference** | Operator / app | Encrypt metadata, store on Walrus, attach compact reference on Soroban |
| **Commit** | Bidder or agent session key | Lock escrow, post commitment `H`, store tlock ciphertext + auditor blob |
| **Wait R** | — | Bids undecryptable; only `H` and escrow are public |
| **Open reveal** | Anyone (keeper) | Submit Drand round-R BLS signature; verified **on-chain** |
| **Reveal** | Anyone (keeper) | Decrypt every seal; contract checks `H` binding |
| **Clear / settle** | Anyone (keeper) | Deterministic winner; SAC transfers; contract balance → 0 |

The operator does **not** need keys to open bids. After R, values are public; identities stay auditor-encrypted until opened with the round auditor key.

---

## System diagram

Sub Rosa separates the **truth layer**, **payload layer**, and **agent/payment
layer**:

- Stellar/Soroban stores commitments, reveal gates, escrow, clearing, settlement,
  and compact storage references.
- Walrus stores encrypted heavy payloads.
- Bosphor is the EVM route into Walrus; it is not a Stellar signer and it does
  not settle Sub Rosa rounds.
- x402 gates paid computation before premium agent/appraisal output is returned.
- GOAT AgentKit provides the AI-agent runtime boundary for structured decisions
  that can feed the same commitment flow.
- The hosted browser demo uses a backend paid relay for GOAT decisions so the
  browser does not need to hold a Stellar payer secret or construct Soroban
  auth entries directly.

```text
                 ┌───────────────────────────────────────┐
                 │               apps/web                 │
                 │ /demo + /goat + route selection        │
                 └───────────────┬───────────────────────┘
                                 │
        ┌────────────────────────┼──────────────────────────┐
        │                        │                          │
        ▼                        ▼                          ▼
┌───────────────┐        ┌────────────────┐        ┌───────────────────┐
│ GOAT agent UI │        │ Freighter route │        │ RainbowKit route  │
│ mandate input │        │ Stellar wallet  │        │ EVM wallet        │
└───────┬───────┘        └───────┬────────┘        └────────┬──────────┘
        │                        │                          │
        ▼                        ▼                          ▼
┌───────────────┐        ┌────────────────┐        ┌───────────────────┐
│ x402 resource │        │ Walrus          │        │ BosphorAdapter    │
│ server        │        │ publisher       │        │ submitIntent      │
└───────┬───────┘        └───────┬────────┘        └────────┬──────────┘
        │                        │                          │
        ▼                        ▼                          ▼
┌───────────────┐        ┌────────────────┐        ┌───────────────────┐
│ GOAT AgentKit │        │ encrypted blob │        │ IntentSubmitted   │
│ session       │        │ blobId/epoch   │        │ intentId          │
└───────┬───────┘        └───────┬────────┘        └────────┬──────────┘
        │                        │                          │
        └────────► commitment payload ◄─────────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────┐
                      │ Stellar Soroban       │
                      │ create/attach/commit  │
                      │ reveal/clear/settle   │
                      └──────────────────────┘

GOAT decision id / H        Numeric round_id             Bosphor intentId
feed commit flow            joins Soroban route          joins storage route
```

The original Sub Rosa backend remains intact:

```text
packages/tlock      sealBid / openBid / Drand R binding
packages/sdk        RoundContract bindings + SubRosaClient
services/keeper     permissionless open_reveal / reveal / clear / settle
services/agent      mandate/cap checks + x402 + commit flow
services/appraisal  HTTP 402 appraisal rail
packages/goat       GOAT AgentKit session + decision schema + x402 metadata
```

---

## Round lifecycle

The Stellar route is the canonical Sub Rosa lifecycle: a Soroban round is
created, participants commit, Drand opens the reveal gate, and settlement
happens on Stellar. The EVM route is a real Bosphor/Walrus storage route for
the same sealed metadata objects; it uses Bosphor intent ids as shareable demo
round ids and does not pretend to perform Soroban settlement.

```mermaid
sequenceDiagram
  participant Op as Operator / creator
  participant A as Agent / bidder
  participant C as Round contract
  participant W as Walrus publisher
  participant B as Bosphor adapter
  participant X as x402 resource server
  participant G as GOAT AgentKit
  participant D as Drand quicknet
  participant K as Keeper

  alt Freighter / Stellar route
    Op->>W: store encrypted round metadata
    W-->>Op: blobId / endEpoch
    Op->>C: create_round(R, deadlines, auditor pubkey)
    Op->>C: attach_storage_ref(content_hash, commitment_hash, blob_id)
    A->>X: pay appraisal (x402, testnet USDC)
    X-->>A: fair value + suggested bid
    A->>C: commit(H, ciphertext, auditor blob, escrow)
    Note over C: Status Open — sealed
    D-->>K: publish round R + BLS sig
    K->>C: open_reveal(sig) — BLS verified on-chain
    K->>C: reveal(bidder, value) for each bidder
    Note over C: Status Revealing
    K->>C: clear() then settle()
    Note over C: Status Settled — balance 0
  else RainbowKit / EVM route
    Op->>B: submitIntent(encrypted round metadata)
    B-->>Op: IntentSubmitted(intentId)
    Note over Op,B: intentId is the shareable Bosphor round id
    A->>B: submitIntent(encrypted sealed score)
    A->>B: submitIntent(encrypted reveal metadata)
    Note over Op,A: Storage-backed demo route only; Stellar settlement is separate
  else GOAT / paid agent route
    A->>X: POST /goat/agent-decision
    X-->>A: HTTP 402 payment requirement
    A->>X: retry with X-PAYMENT
    X->>G: create GOAT agent session / register tools
    G-->>X: structured decision mode + tool status
    X-->>A: decision + salt + commitment hash
    A->>C: use decision in normal sealed commit path
  else GOAT / hosted browser demo
    A->>X: POST /goat/paid-agent-decision
    X->>X: funded backend payer pays POST /goat/agent-decision
    X-->>A: x402 settlement receipt + decision + commitment hash
  end
```

---

## Monorepo layout

| Path | Layer | Responsibility |
| --- | --- | --- |
| `contracts/round/` | On-chain | Soroban Round: storage tiers, storage references, BLS host verify, SAC settle |
| `packages/round-bindings/` | Generated | TypeScript bindings from WASM |
| `packages/tlock/` | Crypto (off-chain) | tlock seal/open, auditor identity blob |
| `packages/sdk/` | Client | `SubRosaClient`, encoding, optional OZ Relayer Channels submitter |
| `services/drand-tools/` | Harness | Live quicknet ↔ on-chain BLS constant validation |
| `services/keeper/` | Ops | Permissionless reveal/clear/settle; `keeper:watch` daemon |
| `services/appraisal-api/` | Service | x402-gated appraisal (SEP-41 USDC on testnet) |
| `services/agent/` | Agent support | Session mandate, cap checks, x402 + commit flow |
| `packages/goat/` | Agent runtime | GOAT AgentKit wrapper, decision schema, x402 requirement metadata, commitment payload adapter |
| `apps/web/` | UI | Jury demo; encrypts metadata, stores through Walrus/Bosphor, reads `demo-trace.generated.ts` from `agents:e2e` |

Package manager: **pnpm** workspace. Contract build: **Stellar CLI** + Rust (`wasm32v1-none`).

---

## Trust boundaries

| Component | Trusted for | Not trusted for |
| --- | --- | --- |
| **Round contract** | Escrow, `H` binding, BLS gate, clearing rule | Off-chain mandate caps |
| **Walrus** | Encrypted heavy metadata availability | Fairness, reveal, escrow, settlement |
| **Bosphor** | EVM-to-Walrus storage intents | Stellar/Soroban transaction signing |
| **Drand quicknet** | Unbiased future randomness / round-R sig | Liveness (keeper can void after grace) |
| **Operator** | Creating rounds, receiving winner payment | Reading sealed bids before R |
| **Keeper** | Liveness (open/reveal/clear) | Secrecy after R (all bids must reveal) |
| **Agent software** | Enforcing mandate caps off-chain | Honesty if compromised or buggy |
| **GOAT AgentKit adapter** | Structured agent decision flow and tool registration boundary | Live GOAT execution without credentials/faucet/API access |
| **Auditor** | Identity disclosure when given secret | Must not learn bid values before R |
| **Appraisal API** | Valuation after x402 pay | Unbiased pricing (economic trust) |
| **GOAT paid demo relay** | Browser-friendly funded testnet payment demo | Production custody; it is a demo payer, not user-owned funds |

Full adversary analysis: [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md).

---

## Two payment rails (same SEP-41 asset, different jobs)

On **testnet**, both appraisal and prize settlement use **USDC SAC**. They are intentionally separate:

| Rail | Path | Used for |
| --- | --- | --- |
| **x402** | Agent/user → resource server via HTTP 402 + facilitator | Appraisal and GOAT agent-action payment |
| **GOAT demo relay** | Browser → backend relay → same x402 resource server | One-click hosted demo; still settles x402 before decision output |
| **SAC `settle()`** | Round contract escrow → operator + refunds | Winner prize — **not** x402 |

**Mainnet smoke** uses **native XLM SAC** (1 / 5 XLM), not USDC — see [docs/LIMITATIONS.md](./docs/LIMITATIONS.md).

---

## Walrus storage layer

Walrus stores encrypted heavy data. Stellar/Soroban stores the compact reference
that binds a round to that payload:

```text
attach_storage_ref(round_id, operator, content_hash, commitment_hash,
  storage_provider, intent_id, blob_id, end_epoch)
```

The application layer is responsible for encrypting data and talking to Walrus.
Stellar does not call Walrus or Bosphor directly.

The live UI supports two explicit wallet routes:

| Route | Wallet | Storage | Join id | Soroban behavior |
| --- | --- | --- | --- | --- |
| Stellar route | Freighter | Direct Walrus publisher | Numeric `round_id` | Freighter signs Sub Rosa round, storage reference, commit, reveal, settle |
| EVM route | RainbowKit / wagmi | Bosphor -> Walrus | Bosphor `intentId` | EVM signs only storage intents; Stellar settlement remains a separate route |

In the EVM route the app treats `IntentSubmitted(intentId)` as the accepted
storage record. `IntentExecuted(intentId, proof)` is the later Bosphor/Sui
proof-return event and is not required for the UI to continue through the
storage-backed demo flow. Participants join by pasting the Bosphor round
`intentId`; the app checks the adapter's `intents(intentId)` view before
allowing a sealed score submission.

See [docs/WALRUS_STORAGE.md](./docs/WALRUS_STORAGE.md) for the storage receipt
shape, environment variables, and non-goals.

---

## GOAT agent layer

GOAT adds an AI-agent decision path before a user or autonomous participant
commits. It does not replace tlock, Soroban, Walrus, or the keeper.

```text
mandate + round details
        │
        ▼
POST /goat/agent-decision
        │
        ▼
x402 payment check
        │
        ▼
GOAT AgentKit session
        │
        ▼
structured decision JSON
        │
        ▼
salt + commitment hash -> existing sealed commit UI
```

The response is validated and explicitly reports whether GOAT is running in
`live` mode or `local_deterministic` mode. Live GOAT execution requires real
GOAT credentials/faucet/API access; local deterministic mode exists for review,
schema validation, and UI handoff testing.

See [docs/GOAT_INTEGRATION.md](./docs/GOAT_INTEGRATION.md) for API shape,
environment variables, and the local-vs-live boundary.

---

## Agent authorization model

```
Principal (G-address)
    │ signs mandate JSON (maxBid, maxEscrow, maxAppraisalSpend, contract, round)
    ▼
Session Ed25519 key  ──► x402 pay + Soroban commit (never principal on-chain)
```

- **Off-chain:** agent verifies mandate signature and caps before any payment or commit.
- **On-chain:** `valid = value > 0 && value ≤ escrow` at reveal.

Production mapping (Passkey / Smart Account Kit / OZ Relayer): [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md). Not on the critical path for this submission.

---

## Planned Stellar Wallets Kit integration

This section describes the planned **Stellar Wallets Kit** integration for the
SCF Integration Track. It does not describe a completed integration and does not
replace the existing proof paths.

### Current state

- The live end-user flow in `apps/web` connects directly to Freighter through
  `@stellar/freighter-api`.
- `apps/web/src/lib/chain.ts` adapts Freighter transaction and authorization
  signing to the generated `RoundContract` client.
- Agent and keeper proofs continue to use session keys and direct Soroban RPC;
  they do not depend on a browser wallet.
- The embedded jury trace and existing testnet/mainnet proof artifacts remain
  unchanged.

### Target state

Stellar Wallets Kit will become the browser-wallet connection and signing layer
for the end-user application. The contract, generated bindings, tlock package,
keeper, and settlement rules remain wallet-agnostic.

```text
Supported Stellar wallet
        │
        ▼
Stellar Wallets Kit
  connect / select / sign
        │
        ▼
apps/web wallet adapter
        │
        ▼
RoundContract client ──► Soroban RPC ──► contracts/round
```

The adapter will expose the signer interface already consumed by
`RoundContract`: the selected public address, transaction signing, and Soroban
authorization-entry signing. This keeps wallet-specific behavior outside the
protocol and SDK layers.

### End-user transaction flows

| Flow | Wallets Kit role | Existing protocol behavior retained |
| --- | --- | --- |
| Connect | Discover/select a supported wallet and expose its active Stellar address | No contract call |
| Create round | Sign the operator transaction | Contract stores deadlines, Drand round, clearing rule, and auditor key |
| Commit | Sign the bidder transaction after the browser seals the value with `packages/tlock` | Contract locks SAC escrow and stores commitment/ciphertext |
| Reveal / clear / settle | Allow an authorized user to submit permissionless lifecycle calls when desired | Keeper can still perform these calls without a browser wallet |
| Read status | Provide the active address for user-specific UI state | Reads continue through Soroban RPC |

The initial target is standardized multi-wallet support for wallets exposed by
Stellar Wallets Kit, including Freighter, xBull, Albedo, and Lobstr where their
supported signing capabilities satisfy the required Soroban flows. Unsupported
wallet/capability combinations will be surfaced explicitly rather than falling
back to hidden keys.

### Migration and verification plan

1. Add a Wallets Kit adapter beside the current Freighter adapter.
2. Verify connection, network selection, transaction signing, and Soroban
   authorization-entry signing against the existing `RoundContract` interface.
3. Move the end-user UI to the Wallets Kit adapter after parity is proven.
4. Retain direct RPC/session-key paths for agents, keepers, automated tests, and
   operational recovery.
5. Test round creation, sealed commit, reveal readiness, settlement, rejection,
   reconnect, and wrong-network states on Stellar testnet.
6. Publish the supported-wallet matrix and test evidence before enabling the
   adapter in the production mainnet web app.

This integration changes how end users authorize transactions; it does not
change the sealed-round state machine, Drand trust model, or SAC settlement
logic.

---

## Demo and proof artifacts

| Network | Contract | UI / trace |
| --- | --- | --- |
| **Testnet** | `CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y` | `apps/web/src/demo/demo-trace.generated.ts` |
| **Testnet Walrus ref contract** | `CC6ROZCIXFTMB47TIWPRKPEHBGI2DSDOONPY47ETVLHUN327EEGJE6UK` | Fresh UI/dev contract with `attach_storage_ref` |
| **Local GOAT/x402 API** | `POST /goat/agent-decision` | `pnpm goat:test` + `pnpm appraisal:test` |
| **Mainnet** | `CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX` | Mainnet proof card in UI; `pnpm mainnet:verify` |

Canonical end-to-end testnet run (agents → x402 → commits → keeper → settle → 0):

```bash
pnpm agents:e2e
```

Other proofs: `pnpm lifecycle:e2e`, `pnpm appraisal:e2e`, `pnpm goat:test`,
`pnpm mainnet:verify`. See README **Proof at a glance**.

The web UI includes a live wallet path for Freighter and RainbowKit route
selection. The embedded trace remains available for read-only judging, but
Walrus-backed live rounds require a deployed contract with `attach_storage_ref`.

---

## Storage model (on-chain)

| Tier | Contents | Lifetime |
| --- | --- | --- |
| **Instance** | Drand pubkey, DST, genesis, period, token SAC | Contract lifetime |
| **Persistent** | Round record, storage reference, per-bidder escrow / revealed value | Until settle or void |
| **Temporary** | Ciphertext + auditor blob | Expires after reveal window |

---

## Related documentation

| Document | Focus |
| --- | --- |
| [docs/TECH_DESIGN.md](./docs/TECH_DESIGN.md) | Cryptography, storage, settlement rails, relayer hook |
| [docs/THREAT_MODEL.md](./docs/THREAT_MODEL.md) | Adversaries and mitigations |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | UI build vs runtime secrets |
| [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md) | 5-minute jury walkthrough |
| [docs/GOAT_INTEGRATION.md](./docs/GOAT_INTEGRATION.md) | GOAT AgentKit + x402-paid decision flow |
| [docs/GOAT_DEMO_FLOW.md](./docs/GOAT_DEMO_FLOW.md) | GOAT demo setup and handoff |
| [docs/TRACK_ANSWERS.md](./docs/TRACK_ANSWERS.md) | Hackathon track mapping |
| [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) | Honest scope boundaries |
| [docs/ECOSYSTEM.md](./docs/ECOSYSTEM.md) | Passkey, Smart Account Kit, OZ Relayer |
