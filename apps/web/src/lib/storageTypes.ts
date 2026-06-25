export type StorageReceipt = {
  storageProvider: "bosphor-walrus" | "walrus";
  status?: "submitted" | "executed";
  intentId: string;
  evmTxHash: string;
  walrusBlobId: string;
  endEpoch: string;
  payloadHash: string;
  timestamp: string;
};
