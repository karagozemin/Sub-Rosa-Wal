# Deploy & environment variables

Sub Rosa **does not require a committed `.env` file**. Secrets stay out of git; you inject them where each layer runs.

## Three layers

| Layer | Needs env? | When vars are read |
| --- | --- | --- |
| **Jury UI trace mode** (`apps/web`) | Optional | **Build time** (`VITE_*` baked into static JS) |
| **Live Walrus-backed UI flow** | Yes | **Build time** (`VITE_*` baked into static JS) |
| **GOAT agent UI** | Optional public URL | **Build time** (`VITE_GOAT_AGENT_API_URL`) |
| **Keeper / appraisal / GOAT API** | Yes (secrets) | **Runtime** (shell, systemd, Fly/Railway secrets) |
| **One-off scripts** (deploy, e2e) | Yes | **Runtime** (inline `VAR=… command` or CI secrets) |

---

## 1. Jury UI — ship without any env

The demo works from **embedded `DEMO_TRACE`** (`demo-trace.generated.ts` from `pnpm agents:e2e`). No `.env` needed.

```bash
pnpm install
pnpm web:build
# static output → apps/web/dist
```

Host `dist/` on Vercel, Netlify, Cloudflare Pages, GitHub Pages, S3, etc.

**Build settings (generic):**

| Setting | Value |
| --- | --- |
| Install | `pnpm install` |
| Build | `pnpm web:build` |
| Output directory | `apps/web/dist` |
| Node | 22+ |

---

## 2. Jury UI — optional live contract poll

Only if you want **“Poll live contract”** on the deployed site, set these **before `pnpm web:build`** in the hosting UI (Vercel → Settings → Environment Variables, etc.).

Copy from `apps/web/.env.example`:

```bash
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_CONTRACT_ID=CAPTODBCDEVIK23ALBJBS2TXRTIK47ZA5MBTHYF4XLHG2BK7JPYUCU2Y
VITE_ROUND_ID=1
```

**Mainnet example** (live poll against mainnet smoke):

```bash
VITE_RPC_URL=https://rpc.ankr.com/stellar_soroban
VITE_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
VITE_CONTRACT_ID=CA7KSDEYJEPGZEB2ZROTLUWKQQ6GIRIQNGG6Z745MZ34QHP4UJPWODEX
VITE_ROUND_ID=1
```

Important: Vite only exposes vars prefixed with `VITE_`. They are **public** in the browser bundle — never put secret keys here.

---

## 3. Live Walrus-backed round flow

The live create-round flow stores encrypted metadata on Walrus before the next
route-specific action continues. This path needs real public configuration.
Missing storage vars block creation instead of producing fake blob ids.

For the **Stellar route** (Freighter + direct Walrus publisher):

```bash
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VITE_CONTRACT_ID=CC6ROZCIXFTMB47TIWPRKPEHBGI2DSDOONPY47ETVLHUN327EEGJE6UK
VITE_ESCROW_TOKEN_LABEL=XLM
VITE_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
```

For the **EVM route** (RainbowKit/wagmi + Bosphor -> Walrus):

```bash
VITE_BOSPHOR_ADAPTER_ADDRESS=0x...
VITE_BOSPHOR_CHAIN_ID=...
VITE_BOSPHOR_DST_EID=40378
VITE_BOSPHOR_LZ_OPTIONS=0x00030100110100000000000000000000000000030d40
VITE_WALLETCONNECT_PROJECT_ID=...
```

Optional:

```bash
VITE_EVM_RPC_URL=https://...
```

If `VITE_EVM_RPC_URL` is omitted, wagmi/RainbowKit uses the connected wallet
provider and configured chain. Do not use this optional RPC value as a secret.

The EVM route uses the first Bosphor `IntentSubmitted(intentId)` as the
shareable Bosphor round id. Later sealed score and reveal metadata submissions
are additional Bosphor storage intents linked back to that id. This route does
not sign Soroban settlement transactions.

The configured Soroban contract must expose `attach_storage_ref` and
`get_storage_ref`. Older testnet contracts that only expose the base
`create_round`/commit/reveal lifecycle can run classic Sub Rosa rounds, but
they cannot bind a Walrus receipt on-chain.

### Local dev (optional)

```bash
cp apps/web/.env.example apps/web/.env.local
# edit VITE_* then:
pnpm web:dev
```

`.env.local` is gitignored; not required for production.

---

## 4. Keeper watch mode (runtime secrets)

Runs on a server/VM, not in the static site. No `.env` file required — export vars in the process manager:

```bash
export KEEPER_SECRET="S…"
export ROUND_CONTRACT_ID="C…"
export RPC_URL="https://soroban-testnet.stellar.org"
export NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
export WATCH_POLL_MS=15000
export WATCH_ROUND_IDS=1

pnpm keeper:watch
```

Or one line:

```bash
KEEPER_SECRET=S… ROUND_CONTRACT_ID=C… pnpm keeper:watch
```

On Fly.io / Railway / GitHub Actions: put the same names in **Secrets**, not in the web build.

See root `.env.example` for the full keeper variable list.

---

## 5. GOAT/x402 agent decisions (runtime secrets)

The `/goat` page is a browser UI, but `POST /goat/agent-decision` runs in
`services/appraisal-api` and uses the same x402 resource-server pattern as
`POST /appraise`.

Public browser config:

```bash
VITE_GOAT_AGENT_API_URL=https://your-appraisal-api.example
```

Runtime server config:

| Var | Purpose |
| --- | --- |
| `FACILITATOR_SECRET` | Signs/submits x402 settle txs |
| `PAY_TO` | Receives USDC payment |
| `PAYMENT_ASSET` | SEP-41 token contract |
| `GOAT_X402_PRICE_USDC` | Price for `POST /goat/agent-decision` |
| `GOAT_AGENTKIT_API_KEY` / `GOAT_API_KEY` | Live GOAT credentials, if available |
| `GOAT_LIVE_ENABLED` | Must be `true` before responses claim live GOAT mode |
| `GOAT_NETWORK` | GOAT network label, default `goat-testnet` |

Without live GOAT credentials and `GOAT_LIVE_ENABLED=true`, the API marks
decisions as `local_deterministic`. That mode is acceptable for local review of
schema, x402 boundary, and UI handoff; it is not live GOAT execution.

---

## 6. Deploy & settle scripts (runtime, inline)

Scripts read env at invocation — no `.env` file on disk:

```bash
OPERATOR_SECRET=S… pnpm mainnet:deploy

OPERATOR_SECRET=S… \
ROUND_CONTRACT_ID=CA7KSDEY… \
RPC_URL=https://rpc.ankr.com/stellar_soroban \
pnpm mainnet:settle
```

E2E scripts (`lifecycle:e2e`, `agents:e2e`) generate ephemeral keys via Stellar CLI — they do not need a root `.env` either.

---

## 7. Appraisal API (if you host it)

Runtime env for `pnpm appraisal:start`:

| Var | Purpose |
| --- | --- |
| `FACILITATOR_SECRET` | Signs/submits x402 settle txs |
| `PAY_TO` / server key | Receives USDC |
| `RPC_URL` | Soroban RPC |
| `PRICE` | Appraisal price (default 0.10) |
| `PORT` | HTTP port (default 4021) |

Agents point at the public URL via `X402_APPRAISAL_URL`. The web GOAT page
points at the same service through `VITE_GOAT_AGENT_API_URL`.

---

## Quick decision tree

```
Shipping jury demo only?
  → pnpm web:build, upload dist/, no env

Want live on-chain overlay on the site?
  → set VITE_* in hosting build env, then build

Want live Walrus-backed round creation?
  → set VITE_WALRUS_PUBLISHER_URL or Bosphor vars and use a contract with attach_storage_ref

Want GOAT agent decisions?
  → run appraisal-api with x402 vars; add GOAT credentials only for live mode

Running keeper 24/7?
  → KEEPER_SECRET + ROUND_CONTRACT_ID on the server (runtime)

Deploying new contract round?
  → OPERATOR_SECRET inline for mainnet:deploy / mainnet:settle
```

## Mainnet scripts

```bash
pnpm mainnet:verify              # read-only — no secrets
pnpm mainnet:micro               # dry-run checklist
MAINNET_CONFIRM=SUB_ROSA_MAINNET OPERATOR_SECRET=S… BIDDER_SECRET=S… \
  pnpm mainnet:micro -- --execute   # optional micro commit (≤1 XLM escrow)
```

## Security

- **Never** commit `.env` with secrets (already in `.gitignore`).
- **Never** put `S…` secret keys in `VITE_*` — they end up in public JS.
- Rotate any key that was pasted in chat or logs.
