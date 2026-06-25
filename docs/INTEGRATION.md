# Integrating Sub Rosa

Sub Rosa does not require users to come to the Sub Rosa demo app. The demo app
is a showcase. The intended product surface is a Soroban contract, TypeScript
packages, and an application-layer Walrus storage route that other apps can
embed.

## Target integration

```bash
npm install @sub-rosa/sdk @sub-rosa/tlock
```

`@sub-rosa/sdk` is already present in this monorepo as `packages/sdk`. Publishing
to npm is a release step, not a protocol requirement.

## What an app integrates

An integrating app usually needs five pieces:

| Piece | Role |
| --- | --- |
| Round contract | Stores commitments, escrow, deadlines, Drand R, reveal state, and compact storage references |
| `@sub-rosa/sdk` | Creates rounds and submits contract calls from app backend/frontend |
| `@sub-rosa/tlock` | Seals values to Drand R and opens ciphertext after R |
| Walrus storage route | Stores encrypted heavy metadata/submission payloads before the Soroban action |
| Keeper | Opens reveal and settles when Drand R is live; permissionless by design |

Walrus is not the transaction layer. Stellar/Soroban remains responsible for
round lifecycle, proof references, reveal, clearing, escrow, and settlement.

## Minimal flow

```ts
import { SubRosaClient } from "@sub-rosa/sdk";
import { generateNonce, quicknet, sealBid } from "@sub-rosa/tlock";

const drand = quicknet();
const client = new SubRosaClient({
  rpcUrl,
  networkPassphrase,
  contractId,
  secretKey,
});

// Before creating or updating an important round object, encrypt metadata in
// the browser/app layer and store it through the configured Walrus route.
const storageReceipt = await storageAdapter.storeEncryptedPayload({
  payload,
  contentHash,
  commitmentHash,
});

await client.attachStorageRef({
  roundId,
  contentHash: storageReceipt.contentHash,
  commitmentHash: storageReceipt.commitmentHash,
  storageProvider: storageReceipt.storageProvider,
  intentId: storageReceipt.intentId ?? "",
  blobId: storageReceipt.blobId,
  endEpoch: storageReceipt.endEpoch,
});

const sealed = await sealBid({
  value,
  nonce: generateNonce(),
  round: revealRound,
  client: drand,
  identity,
  auditorPublicKey,
});

await client.commit({
  roundId,
  sealed,
  escrow,
});
```

After Drand round `R` is published, any keeper or participant can submit the
Drand signature, reveal valid entries, clear the round, and settle escrow.

## Wallet routes

| Route | Wallet | What it signs |
| --- | --- | --- |
| Stellar route | Freighter | Soroban `create_round`, `attach_storage_ref`, commit, reveal, settle |
| EVM route | RainbowKit / wagmi | Bosphor storage intent only |

Freighter cannot sign Bosphor EVM transactions. RainbowKit/EVM wallets cannot
sign Soroban transactions. If an app offers both routes, keep them explicit so
the user understands which account is active.

## Walrus integration requirements

- The app must receive a real Walrus blob id from the selected storage route.
- The main app flow must not generate fake Walrus blob ids or fake Bosphor
  intent ids.
- `localStorage` can cache recent receipts for UI convenience, but it must not
  act as the storage backend.
- A Soroban contract used for Walrus-backed rounds must expose
  `attach_storage_ref(...)` and `get_storage_ref(round_id)`.

## Allocation use cases

- SCF-style grant allocation: judges cannot react to leaked scores
- Hackathon judging: panel scores open together after judging closes
- Bounty distribution: reviews and allocation inputs stay sealed
- RFP scoring: vendors and evaluators cannot tune inputs from visible competitors
- Sealed auctions: bids remain unreadable before close
- DAO/community allocation: demand signals and ballots do not leak during the window

## Hosted vs embedded

| Mode | Who uses it | Notes |
| --- | --- | --- |
| Embedded SDK | Stellar app developers | App owns UI and user flow |
| Hosted keeper | Apps that want liveness without running ops | Keeper cannot read early values; it only opens after R |
| Demo frontend | Reviewers, pilots, onboarding | Shows the primitive working end-to-end |

## Trust model

Sub Rosa does not ask integrators to trust a reveal operator. Before Drand R,
values are timelock-encrypted. After R, the Drand BLS signature is public and
the Soroban contract verifies it before opening reveal.
