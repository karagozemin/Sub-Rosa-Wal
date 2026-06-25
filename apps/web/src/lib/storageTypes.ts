export type StorageReceipt = {
  storageProvider: "bosphor-walrus" | "walrus";
  intentId: string;
  evmTxHash: string;
  walrusBlobId: string;
  endEpoch: string;
  payloadHash: string;
  timestamp: string;
};
