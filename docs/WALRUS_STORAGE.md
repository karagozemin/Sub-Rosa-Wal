# Walrus Storage Layer

Sub Rosa remains a Stellar/Soroban sealed submission, reveal, and settlement
protocol. Walrus is an encrypted storage layer for heavy round and submission
metadata: descriptions, evidence files, judge notes, appraisal reports, scoring
JSON, and other payloads that should not live directly in contract state.

This repo does not use mock storage in the main live flow. The selected storage
route must produce a real storage record before the UI continues:

- Freighter route: a real Walrus publisher response with `blobId`.
- EVM route: a real Bosphor `IntentSubmitted(intentId)` event.

`IntentExecuted(intentId, proof)` is the later Bosphor/Sui/LayerZero proof
return path. The UI does not block the EVM demo on that asynchronous event.

## Separation Of Duties

| Layer | Responsibility | Does not do |
| --- | --- | --- |
| Stellar / Soroban | Round lifecycle, commitments, escrow, Drand reveal gate, clearing, settlement, compact storage reference | Store large encrypted payloads or call Walrus directly |
| Walrus | Store encrypted heavy data and return a blob reference | Decide fairness, escrow, reveal, or settlement |
| Bosphor | EVM-to-Walrus storage intent route | Replace Stellar/Soroban proof logic |
| Web app | Encrypt client-side, submit to storage route, attach compact proof fields on Soroban | Generate fake blob ids or fake storage receipts |

## Active Wallet Routes

The frontend keeps the original Sub Rosa flow and lets the user choose one
active route at a time.

| Route | Wallet | Storage path | Join identifier | Stellar behavior |
| --- | --- | --- | --- | --- |
| Stellar route | Freighter | Direct Walrus publisher (`VITE_WALRUS_PUBLISHER_URL`) | Numeric Soroban `round_id` | Freighter signs `create_round`, `attach_storage_ref`, commit, reveal, settle |
| EVM route | RainbowKit / wagmi | Bosphor adapter contract -> Walrus | Bosphor round `intentId` | EVM wallet signs Bosphor storage intents only; it cannot sign Soroban transactions |

Freighter cannot sign Bosphor EVM transactions. RainbowKit/EVM wallets cannot
replace Stellar/Soroban signatures. The UI surfaces this explicitly instead of
silently switching wallet responsibilities.

## Freighter / Stellar Route

1. The user chooses a wallet route.
2. The browser prepares the round metadata object.
3. The browser encrypts the metadata with AES-GCM.
4. The app computes:
   - `content_hash`
   - `commitment_hash`
5. The encrypted payload is stored on Walrus through the selected route.
6. The app receives a real storage receipt:
   - `storage_provider`
   - `blob_id`
   - `end_epoch`
7. The normal Sub Rosa Soroban round is created.
8. The operator attaches the compact storage reference on Soroban:

```text
attach_storage_ref(
  round_id,
  operator,
  content_hash,
  commitment_hash,
  storage_provider,
  intent_id,
  blob_id,
  end_epoch
)
```

Soroban stores only the proof/reference fields. The encrypted payload remains
on Walrus.

## RainbowKit / EVM Route

The EVM route exists for Bosphor-to-Walrus storage intents. It does not create a
numeric Soroban round id and does not pretend MetaMask can sign Stellar
transactions.

1. The user connects an EVM wallet on the configured Bosphor deployment chain.
2. The browser encrypts round metadata client-side.
3. The app calls `quote(dstEid, payload, deadline, options)`.
4. The user signs `submitIntent(dstEid, payload, deadline, options)` with
   `msg.value = nativeFee`.
5. The app reads `IntentSubmitted(intentId, ...)` from the confirmed tx receipt.
6. That `intentId` becomes the shareable Bosphor round id.
7. Other users can paste the same `intentId` to join; the app verifies it with
   the adapter's `intents(intentId)` view.
8. Sealed scores and reveal metadata are submitted as additional Bosphor
   storage intents linked back to the round `intentId`.

The EVM wallet pays two things in the same transaction:

```text
required ETH = Bosphor nativeFee value + estimated gas * gas price
```

`nativeFee` comes from `quote(...)` and is sent as `msg.value`; gas is the
normal Sepolia transaction fee. If the active MetaMask account has ETH on a
different network or a different account, the adapter submit can correctly fail
with `insufficient funds for gas * price + value`.

Receipt shape:

```ts
{
  storageProvider: "bosphor-walrus";
  status: "submitted" | "executed";
  intentId: "0x...";
  evmTxHash: "0x...";
  walrusBlobId: "";       // present after IntentExecuted proof, if available
  endEpoch: "";           // present after IntentExecuted proof, if available
  payloadHash: "0x...";
  timestamp: string;
}
```

The accepted Bosphor intent is real on-chain state even before the final
`IntentExecuted` proof returns. The later proof path decodes
`abi.encode(bytes32 blobId, uint256 endEpoch)`.

## Required Contract Support

Walrus-backed rounds require a Round contract with:

- `attach_storage_ref(...)`
- `get_storage_ref(round_id)`

Older deployed contracts that only expose `create_round` can still run normal
Sub Rosa rounds, but they cannot bind a Walrus receipt on-chain.

## Environment

For the Stellar route:

```bash
VITE_WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
```

For the Bosphor route:

```bash
VITE_BOSPHOR_ADAPTER_ADDRESS=0xbC7EF2F021F517d871282C2bb512C741ad2958c3
VITE_BOSPHOR_CHAIN_ID=11155111
VITE_BOSPHOR_DST_EID=40378
VITE_BOSPHOR_LZ_OPTIONS=0x00030100110100000000000000000000000000030d40
VITE_WALLETCONNECT_PROJECT_ID=
```

`VITE_EVM_RPC_URL` is optional. If omitted, wagmi/RainbowKit uses the connected
wallet and configured chain transport.

Bosphor supports chain-agnostic storage routing, but this demo uses the
configured Bosphor deployment chain.

## Non-Goals

- No fake Walrus blob ids.
- No fake Bosphor intent ids.
- No localStorage storage backend.
- No claim that Stellar directly calls Walrus or Bosphor.
- No claim that EVM wallets replace Stellar/Soroban settlement logic.
- No silent fallback from missing real configuration to mock data.
