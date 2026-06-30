# GOAT Demo Flow

This flow demonstrates the GOAT AgentKit integration honestly inside the full
Sub Rosa stack: local status and UI wiring work without live GOAT credentials;
paid `POST /goat/agent-decision` requires the same funded x402 setup as the
appraisal API; the resulting decision feeds the existing sealed commitment
route.

## 1. Install

```bash
pnpm install
```

## 2. Configure the x402 resource server

Copy `.env.example` into your shell or process manager and fill:

```bash
FACILITATOR_SECRET=S...
PAY_TO=G...
PAYMENT_ASSET=C...
PRICE=0.10
GOAT_X402_PRICE_USDC=0.10
X402_NETWORK=stellar:testnet
RPC_URL=https://soroban-testnet.stellar.org
```

`FACILITATOR_SECRET` pays Soroban fees. `PAY_TO` receives USDC. Both accounts
need the expected Stellar testnet setup.

## 3. Optional live GOAT mode

If you have GOAT credentials/faucet access:

```bash
GOAT_AGENTKIT_API_KEY=...
GOAT_LIVE_ENABLED=true
GOAT_NETWORK=goat-testnet
```

Without these values, responses remain marked `local_deterministic`.

## 4. Start the backend

```bash
pnpm appraisal:start
```

Check status:

```bash
curl http://127.0.0.1:4021/goat/status
```

## 5. Start the web app

```bash
pnpm web:dev
```

Open:

```text
http://127.0.0.1:5173/#/goat
```

## 6. Generate a GOAT agent decision

Enter:

- Round id
- Item reference
- Base price
- Objective / mandate
- Max bid
- Max escrow
- Risk tolerance

Click `Generate paid decision`.

From a plain browser request, the endpoint will return HTTP 402 because no
x402 payment signature is attached. That is expected and proves the endpoint is
not bypassing payment. A funded paid agent client can sign and retry, following
the same pattern as `services/appraisal-api/src/client.ts`.

## 7. Use the decision in Sub Rosa

When a paid response is available, click `Use in sealed commitment`.

The app stores the decision handoff locally, navigates to the sealed round demo,
prefills the entry amount from `decision.bidAmount`, and shows the GOAT
commitment hash banner. The actual sealed commit still uses the existing Sub
Rosa flow and the selected wallet route.

## 8. Continue the existing flow

Create or join a round, then commit:

- Stellar route: Freighter signs Soroban commit/reveal/settle.
- EVM route: RainbowKit signs Bosphor/Walrus storage intents.
