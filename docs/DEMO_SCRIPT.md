# Jury Demo Script (~5 minutes)

Walkthrough for `pnpm web:dev` (default http://localhost:5173).

## Primary narrative: sealed coordination stack

Open the demo by framing this repo as **Sub Rosa sealed coordination
infrastructure**, not as a generic upload app and not as a single-chain wallet
demo:

1. A user creates or joins a sealed Sub Rosa round.
2. A user or GOAT-powered agent prepares a private bid/evaluation.
3. x402 gates premium appraisal or agent-decision actions.
4. The browser encrypts round/submission metadata before any chain action.
5. Walrus stores the encrypted payload.
6. Freighter route attaches a compact Walrus reference to Soroban.
7. RainbowKit route records a real Bosphor storage intent and uses the
   `intentId` as the shareable storage-backed round id.
8. Drand and Soroban still handle the canonical commit, reveal, proof
   reference, escrow, and settlement path on the Stellar route.
9. The organizer can publish a verifiable receipt that separates agent
   reasoning, encrypted payload storage, and settlement.

The current live case proves the sealed-scoring primitive. The recorded
evidence view proves the contract lifecycle, settlement, and public audit path.

Keep the framing tight: Sub Rosa still uses Stellar/Soroban for fairness,
reveal, proof references, and settlement. Walrus stores encrypted heavy
metadata. GOAT/x402 prepares paid agent decisions; it does not replace the
sealed commit or settlement path.

## 1. Showcase (30s)

- **Opening:** sealed coordination for private bids, evidence, and agent decisions
- **Mainnet proof card:** settled round 1 on real XLM (link to stellar.expert)
- **Drand chip:** live countdown to recorded testnet R (from `demo-trace.generated.ts`)

## 2. Seal Attack (45s)

- Click **Run live comparison**
- **Seal-off:** plaintext "bid" readable immediately — broken baseline
- **Seal-on:** tlock ciphertext — undecryptable until R
- Point: operator cannot read sealed bids early

## 3. Flow (30s)

- Lifecycle timeline: create → commit → wait R → open → reveal → clear → settle
- On create, point out the small storage status: encrypted metadata stored on
  Walrus, compact reference attached on Soroban.
- Drand banner shows R status
- Settlement stats: contract balance → 0

## Live wallet route (45s)

- **Freighter route:** Freighter is the active Stellar account. The app stores
  encrypted metadata on Walrus, then Freighter signs the normal Soroban action.
  The shareable id is the numeric Soroban `round_id`.
- **RainbowKit route:** RainbowKit is the active EVM account for the Bosphor
  storage route. MetaMask signs `submitIntent` for round metadata, sealed score,
  and reveal metadata. The shareable id is the Bosphor `intentId` from the first
  round metadata intent.
- The user should see only one active route at a time.
- The EVM route is a real Bosphor/Walrus storage route, not Stellar settlement.
  It does not claim MetaMask can sign Soroban transactions.
- No fake storage: if Walrus/Bosphor config is missing, the action is blocked
  with setup text.

## 4. GOAT agents + x402 (60s)

- Open `#/goat` and show the GOAT integration status.
- Enter a mandate, max bid, max escrow, and risk tolerance.
- Explain that `POST /goat/agent-decision` is x402-gated; a plain browser call
  correctly receives HTTP 402 unless a funded paid client signs and retries.
- When a paid response is available, the output is structured JSON with
  recommended action, bid amount, confidence, salt, and commitment hash.
- Click **Use in sealed commitment** to prefill the normal Sub Rosa commit path.
- Position the existing multi-agent trace as the live testnet proof for the
  underlying agent/x402/sealed commit lifecycle.
- Two agents with principals vs session keys
- x402 log: 0.10 USDC appraisal settled on-chain
- **Settlement rails panel:** x402 (appraisal) vs SAC settle() (winner prize) — same USDC, different paths
- Keeper steps: wait R → BLS verify → reveal all → clear → settle

## 5. Observer (20s)

- Public table: escrow + revealed bids after R
- Note: identities still auditor-encrypted

## 6. Auditor (60s)

- Pre-filled demo auditor secret
- **Decrypt identity blobs** → `agent:G…` for each bidder
- **Run live bid decrypt** → tlock open against published quicknet R
- Explain selective disclosure: values public, names auditor-only

## 7. Caps (30s)

- Off-chain mandate vs on-chain escrow cap
- **Run negative cap scenarios** — unit-test outcomes in browser

## 8. Passkey (30s, optional)

- **This build:** agents use Ed25519 session mandates — not Passkey-signed commits
- **Passkey tab:** real WebAuthn **Create passkey** (testnet WASM baked in); optional deploy smart wallet
- **Production path (documented, not implemented):** Smart Account Kit + optional OZ Relayer for fee sponsorship
- See `docs/ECOSYSTEM.md` for mapping mandate → smart-account policy

## Optional: live contract poll

Set in `apps/web/.env.local` (or hosting build env — see `docs/DEPLOY.md`):

```
VITE_CONTRACT_ID=CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y
VITE_ROUND_ID=1
VITE_RPC_URL=https://soroban-testnet.stellar.org
```

Toggle **Poll live contract** on Showcase.

For live Walrus-backed round creation, use a contract that exposes
`attach_storage_ref`, for example the current testnet dev contract:

```
VITE_CONTRACT_ID=CC6ROZCIXFTMB47TIWPRKPEHBGI2DSDOONPY47ETVLHUN327EEGJE6UK
VITE_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
```

## CLI proof (if asked)

```bash
pnpm lifecycle:e2e
pnpm goat:test
pnpm agents:e2e
pnpm mainnet:verify
pnpm keeper:watch
```

## Docs for judges

- [TECH_DESIGN.md](./TECH_DESIGN.md)
- [WALRUS_STORAGE.md](./WALRUS_STORAGE.md)
- [GOAT_INTEGRATION.md](./GOAT_INTEGRATION.md)
- [GOAT_DEMO_FLOW.md](./GOAT_DEMO_FLOW.md)
- [THREAT_MODEL.md](./THREAT_MODEL.md)
- [TRACK_ANSWERS.md](./TRACK_ANSWERS.md)
- [ECOSYSTEM.md](./ECOSYSTEM.md)
