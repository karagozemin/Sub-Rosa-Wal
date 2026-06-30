# Known Limitations

Honest boundaries for hackathon submission. No hidden fallbacks.

## Network scope

| Proof | Network | What it shows |
| --- | --- | --- |
| Keeper lifecycle (USDC, 2 bidders) | **Testnet** | `pnpm lifecycle:e2e` |
| Multi-agent + x402 + UI trace | **Testnet** | `pnpm agents:e2e` |
| GOAT package + API boundary | **Local/testnet x402 boundary** | `pnpm goat:test`, `pnpm appraisal:test` |
| Primitive deploy + settle smoke | **Mainnet** | `pnpm mainnet:deploy`, `pnpm mainnet:settle`, `pnpm mainnet:verify` |
| Optional micro commit | **Mainnet** | `pnpm mainnet:micro` (dry-run default; tiny XLM only) |

Mainnet does **not** replay 700 / 459 USDC demo amounts. Mainnet smoke uses **1 XLM bid / 5 XLM escrow** on native XLM SAC.

## Off-chain enforcement

- **Mandate caps** (`maxBid`, `maxAppraisalSpend`) are verified by agent software, not the Soroban contract.
- Only **escrow** and **bid ≤ escrow** are enforced on-chain at reveal.
- A malicious or buggy agent could exceed mandate caps if funded — see `docs/THREAT_MODEL.md`.

## Not in critical path

- **OpenZeppelin Relayer Channels** — optional SDK submitter; all e2e scripts default to direct Soroban RPC.
- **Passkey-Kit** — UI demo + ecosystem docs; agents use Ed25519 session keys in this build.
- **Hosted appraisal API on mainnet** — x402 proof is testnet-only in automated e2e.

## GOAT AgentKit

- `@goatnetwork/agentkit` is installed and wired through `@sub-rosa/goat`.
- Live GOAT tool execution requires real GOAT credentials/faucet/API access and
  `GOAT_LIVE_ENABLED=true`.
- Without those, `POST /goat/agent-decision` marks output as
  `local_deterministic`. That is useful for schema, x402 boundary, and UI
  handoff testing, but it is not presented as live GOAT inference.
- The GOAT decision can prepare a bid amount and commitment payload; the actual
  sealed commit still uses the existing Sub Rosa route.

## Walrus storage layer

- The main app flow does **not** use mock storage. Missing Walrus/Bosphor
  configuration blocks create actions instead of producing fake demo data.
- The app does not use `localStorage` as a Walrus blob backend. It may cache
  recent receipts for convenience only.
- Freighter can sign Stellar/Soroban actions, but it cannot sign Bosphor EVM
  transactions.
- RainbowKit/EVM wallets can sign Bosphor storage intents, but they cannot
  replace Stellar/Soroban proof, reveal, or settlement logic.
- In the EVM route, the Bosphor round `intentId` is shareable for joining the
  storage-backed demo flow. It is not a numeric Soroban `round_id`.
- Older deployed Round contracts without `attach_storage_ref` can run the base
  Sub Rosa lifecycle, but cannot bind a Walrus receipt on-chain.

## UI demo trace

- **Single canonical trace** — `apps/web/src/demo/demo-trace.generated.ts`, written by `pnpm agents:e2e`.
- Covers agents → x402 → sealed commits → keeper reveal → clear → settle on one testnet contract.
- Optional live poll requires build-time `VITE_*` vars — see `docs/DEPLOY.md`.

## Operational

- Drand quicknet must publish round R for reveal to open; keeper can void after grace if R never arrives.
- Temporary storage expires after the reveal window — seals are not kept forever by design.
- Mainnet wasm upload requires substantial XLM for resource fees (~30+ XLM observed).

## Intentional PRD deviation

- **Two autonomous agents** instead of one — stronger supporting proof on testnet.
  The winning hackathon track was Hack Privacy.
