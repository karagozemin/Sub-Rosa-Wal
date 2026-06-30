<p align="center">
  <img src="./assets/sub-rosa-readme.png" width="250" alt="Sub Rosa logo" />
</p>

# Sub Rosa

**1st Place — Hack Privacy Track, Build On Stellar Hackathon — IBW 2026**
**Sealed coordination infrastructure for private bids, agent decisions, and encrypted evidence.**

This repo is the EVM/Walrus version of Sub Rosa. It combines the original
sealed commit-reveal protocol with encrypted payload storage, x402-paid agent
actions, and a GOAT AgentKit integration for AI builders.

> Private coordination first. Storage, payments, and agents plug into the same sealed round.

The separation of responsibilities is the point:

- **Sub Rosa / Soroban** runs the canonical sealed-round lifecycle: commitment,
  Drand-gated reveal, clearing, escrow, and settlement.
- **tlock / Drand** keeps bids and evaluations unreadable until round `R`.
- **Walrus** stores encrypted heavy payloads: round metadata, evidence,
  appraisals, judge notes, and agent artifacts.
- **Bosphor** gives the EVM wallet route into Walrus storage intents.
- **x402** gates paid appraisal and premium agent actions.
- **GOAT AgentKit** powers AI-agent decision flows that can prepare sealed bids
  for the existing commitment path.

Licensed under [MIT](./LICENSE).

---

## What this repo demonstrates

```text
User / AI agent
  -> mandate or round objective
  -> optional x402 payment
  -> GOAT/appraisal decision
  -> tlock sealed payload + commitment hash
  -> encrypted artifact stored through Walrus/Bosphor
  -> Soroban commit / reveal / settle
```

The app does not generate fake Walrus blob ids, fake Bosphor intent ids, fake
Stellar transaction ids, or fake GOAT-paid decisions. Missing
Walrus/Bosphor/Soroban/x402/GOAT configuration is surfaced explicitly instead
of being hidden behind mock claims.

---

## Why Sub Rosa

Sub Rosa can sit under allocation, judging, scoring, sealed-bid, appraisal, or
evidence-heavy workflows. Those workflows need four things at once:

- sealed inputs that cannot be read early;
- deterministic reveal and settlement;
- encrypted availability for heavy private context;
- paid autonomous agents that can participate without receiving unlimited
  authority.

This repo covers those layers without pretending they are the same thing.
Soroban handles the truth layer. Walrus/Bosphor handles encrypted payload
availability. x402 handles paid access to premium computation. GOAT AgentKit
provides an agent runtime boundary for AI builders.

## Architecture / route table

The live app uses one active wallet route at a time:

| Route | Wallet | What the wallet signs | Shareable identifier | Settlement layer |
| --- | --- | --- | --- | --- |
| **Stellar route** | Freighter | Soroban `create_round`, `attach_storage_ref`, commit, reveal, clear, settle | Numeric Soroban `round_id` | Stellar/Soroban |
| **EVM route** | RainbowKit / MetaMask | Bosphor `submitIntent` calls for round metadata, sealed entry, and reveal metadata | Bosphor `intentId` for the round metadata intent | Storage-only demo route; Stellar settlement remains separate |
| **GOAT agent route** | Backend agent session | x402-paid `POST /goat/agent-decision`, structured bid/evaluation output | Agent decision id / commitment hash | Feeds existing Sub Rosa commit flow |

No runtime mock storage is used. The app does not treat `localStorage` as
Walrus and does not generate fake Bosphor intent IDs, fake Walrus blob IDs, or
fake Stellar tx IDs. Missing storage configuration blocks the action.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the system map, lifecycle, trust boundaries, and monorepo layout.

## Storage and agent behavior

```text
Walrus/Bosphor payload path
  Browser encrypts metadata or agent artifact
    -> direct Walrus publisher or Bosphor submitIntent
    -> compact receipt/reference stays attached to the Sub Rosa flow

GOAT/x402 agent path
  User mandate + round details
    -> POST /goat/agent-decision
    -> x402 payment requirement
    -> structured decision + salt + commitment hash
    -> UI can prefill the existing sealed commitment path
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

For GOAT, live tool execution requires real GOAT credentials/faucet/API access.
Without those, agent responses are marked `local_deterministic`; the x402
payment boundary, schema validation, and commitment handoff remain real.

---

## Underlying Sub Rosa proofs

The original hackathon-winning Sub Rosa protocol proof is still present in this
monorepo: Soroban contracts, TypeScript SDK, keeper service, tlock encryption,
x402 appraisal proof, GOAT decision package, and mainnet/testnet proof commands.

| Layer | Command | Network | What it proves |
| --- | --- | --- | --- |
| **Full product** | `pnpm lifecycle:e2e` | Testnet | 2 bidders, USDC SAC, keeper settle → contract **0** |
| **Multi-agent** | `pnpm agents:e2e` | Testnet | Mandate + x402 + keeper reveal + settle → **single UI trace** |
| **x402 appraisal** | `pnpm appraisal:e2e` | Testnet | HTTP 402 → on-chain USDC settle |
| **GOAT unit/API** | `pnpm goat:test` + `pnpm appraisal:test` | Local/testnet x402 boundary | Agent schema, commitment payload, `/goat/agent-decision` HTTP 402 |
| **Mainnet smoke** | `pnpm mainnet:deploy` + `pnpm mainnet:settle` | Mainnet | Deploy, BLS, settle on **real XLM** |
| **Mainnet verify** | `pnpm mainnet:verify` | Mainnet | Read-only check of settled round 1 |

See [docs/LIMITATIONS.md](./docs/LIMITATIONS.md) for honest scope (mainnet ≠ full USDC product).

---

## GOAT AgentKit integration

This repo includes a real GOAT integration surface for AI builders:

- `@sub-rosa/goat` installs and wraps `@goatnetwork/agentkit`.
- `POST /goat/agent-decision` is protected by the existing x402 resource-server
  pattern used by `POST /appraise`.
- The response is structured JSON with a bid recommendation, risk notes, salt,
  and Sub Rosa commitment hash.
- The `/goat` UI can hand a paid decision into the sealed commitment demo by
  prefilling the commit amount and displaying the agent commitment hash.

Live GOAT tool execution still requires real GOAT credentials/faucet/API access.
Without those, responses are explicitly marked `local_deterministic`; the x402
payment boundary, schema validation, and commitment handoff remain real.

See [docs/GOAT_INTEGRATION.md](./docs/GOAT_INTEGRATION.md) and
[docs/GOAT_DEMO_FLOW.md](./docs/GOAT_DEMO_FLOW.md).

---

## Core protocol idea

Sub Rosa's underlying fairness primitive is unchanged:

- **Seal** each bid with Drand timelock encryption (`tlock`) to a future round R.
- **Force-open** at R: BLS12-381 verified **on-chain** — simultaneous reveal.
- **Settle** deterministically. Identities disclosed only to the auditor.

---

## Protocol integration model

Other applications can embed the Sub Rosa primitive directly, add encrypted
payload storage at the application layer, and optionally route agent decisions
through GOAT/x402:

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
machine; Walrus supplies encrypted payload availability; GOAT/x402 supplies a
paid agent action boundary when autonomous participants are useful.

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

## Monorepo layout

```
contracts/round/        Soroban primitive (Rust)
packages/tlock/         tlock seal + auditor blob
packages/sdk/           SubRosaClient + optional OZ Channels submitter
services/keeper/        Permissionless keeper + watch mode
services/appraisal-api/ x402-gated appraisal
services/agent/         Multi-agent bidders (mandate + caps)
packages/goat/          GOAT AgentKit adapter + decision schema
apps/web/               Jury demo UI
docs/                   Design, threat model, track answers, deploy, limitations
```

## Quick start

```bash
pnpm install
pnpm contract:test          # Rust contract tests
pnpm web:dev                # UI opens without .env; real Walrus/Bosphor/Soroban actions require env configuration
pnpm goat:test              # GOAT decision schema + commitment payload tests
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
| [docs/GOAT_INTEGRATION.md](./docs/GOAT_INTEGRATION.md) | GOAT AgentKit, x402-paid decisions, commitment handoff |
| [docs/GOAT_DEMO_FLOW.md](./docs/GOAT_DEMO_FLOW.md) | Copy-paste GOAT demo flow |
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
- [x] GOAT AgentKit package + x402-gated `/goat/agent-decision` endpoint
- [x] Mainnet **deploy + settle smoke** — 1/5 XLM, round 1 settled
- [x] Mainnet **verify** + **micro runner** (dry-run default, tiny XLM cap)
- [x] Jury UI — one canonical testnet trace (status, bidders, R, auditor blobs, session keys)
- [x] Watch-mode keeper (`pnpm keeper:watch`)

## Core protocol roadmap

| Tranche | Goal | Deliverables |
| --- | --- | --- |
| 1 | Storage hardening | Production Walrus/Bosphor adapters, receipt indexing, richer proof explorer |
| 2 | Agent hardening | Live GOAT credentials, paid agent clients, richer artifact storage, reputation hooks |
| 3 | Stellar proof hardening | Contract storage reference audits, hosted keeper, reusable UI hooks/components |
| 4 | Mainnet launch | Audited/open-source contracts, production keeper ops, deployment docs |

## Cryptographic design (Privacy track)

- **Seal:** Drand tlock IBE, `bls-unchained-g1-rfc9380`
- **Binding:** `H = sha256(value‖nonce)`
- **Unlock:** round-R BLS verified on-chain before reveal
- **Selective disclosure:** values public post-R; identities auditor-encrypted
