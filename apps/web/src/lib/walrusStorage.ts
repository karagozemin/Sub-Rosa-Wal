const encoder = new TextEncoder();

export const BOSPHOR_ADAPTER_ADDRESS = import.meta.env.VITE_BOSPHOR_ADAPTER_ADDRESS ?? "";
export const BOSPHOR_CHAIN_ID = import.meta.env.VITE_BOSPHOR_CHAIN_ID ?? "11155111";
export const BOSPHOR_DST_EID = import.meta.env.VITE_BOSPHOR_DST_EID ?? "40378";
export const BOSPHOR_LZ_OPTIONS =
  import.meta.env.VITE_BOSPHOR_LZ_OPTIONS ??
  "0x00030100110100000000000000000000000000030d40";
export const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "";
export const WALRUS_PUBLISHER_URL = import.meta.env.VITE_WALRUS_PUBLISHER_URL ?? "";

export type StorageConfigStatus = {
  ok: boolean;
  missing: string[];
};

export type StorageRoute = "stellar-walrus" | "bosphor-walrus";

export function getBosphorConfigStatus(): StorageConfigStatus {
  const required = [
    ["VITE_BOSPHOR_ADAPTER_ADDRESS", BOSPHOR_ADAPTER_ADDRESS],
    ["VITE_BOSPHOR_CHAIN_ID", BOSPHOR_CHAIN_ID],
    ["VITE_BOSPHOR_DST_EID", BOSPHOR_DST_EID],
    ["VITE_BOSPHOR_LZ_OPTIONS", BOSPHOR_LZ_OPTIONS],
    ["VITE_WALLETCONNECT_PROJECT_ID", WALLETCONNECT_PROJECT_ID],
  ];
  const missing = required.filter(([, value]) => !String(value).trim()).map(([key]) => key);
  return { ok: missing.length === 0, missing };
}

export function getDirectWalrusConfigStatus(): StorageConfigStatus {
  const missing = WALRUS_PUBLISHER_URL.trim() ? [] : ["VITE_WALRUS_PUBLISHER_URL"];
  return { ok: missing.length === 0, missing };
}

export function getStorageConfigStatus(route: StorageRoute = "bosphor-walrus"): StorageConfigStatus {
  return route === "stellar-walrus" ? getDirectWalrusConfigStatus() : getBosphorConfigStatus();
}

export type DirectWalrusReceipt = {
  storageProvider: "walrus";
  intentId: "";
  evmTxHash: "";
  walrusBlobId: string;
  endEpoch: string;
  payloadHash: string;
  timestamp: string;
};

export async function storeDirectWalrusPayload(input: {
  payload: unknown;
  contentHash: string;
}): Promise<DirectWalrusReceipt> {
  if (!WALRUS_PUBLISHER_URL.trim()) {
    throw new Error("Walrus publisher is not configured. Add VITE_WALRUS_PUBLISHER_URL to store encrypted submissions on Walrus without an EVM wallet.");
  }
  const publisherBase = WALRUS_PUBLISHER_URL.replace(/\/$/, "");
  const publisherUrl = publisherBase.endsWith("/v1/blobs")
    ? publisherBase
    : `${publisherBase}/v1/blobs`;
  const response = await fetch(publisherUrl, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input.payload),
  });
  if (!response.ok) {
    throw new Error(`Walrus publisher failed with HTTP ${response.status}.`);
  }
  const data = (await response.json()) as {
    blobId?: string;
    blob_id?: string;
    newlyCreated?: { blobObject?: { blobId?: string; storage?: { endEpoch?: number | string } } };
    alreadyCertified?: { blobId?: string; endEpoch?: number | string };
    endEpoch?: number | string;
  };
  const walrusBlobId =
    data.blobId ??
    data.blob_id ??
    data.newlyCreated?.blobObject?.blobId ??
    data.alreadyCertified?.blobId;
  if (!walrusBlobId) {
    throw new Error("Walrus publisher response did not include a blob id.");
  }
  const endEpoch =
    data.endEpoch ??
    data.newlyCreated?.blobObject?.storage?.endEpoch ??
    data.alreadyCertified?.endEpoch ??
    "";
  return {
    storageProvider: "walrus",
    intentId: "",
    evmTxHash: "",
    walrusBlobId,
    endEpoch: String(endEpoch),
    payloadHash: input.contentHash,
    timestamp: new Date().toISOString(),
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createCommitmentHash(input: {
  roundId: string;
  submitter: string;
  contentHash: string;
}): Promise<string> {
  return sha256Hex(`sub-rosa-storage-v1:${input.roundId}:${input.submitter}:${input.contentHash}`);
}

export async function encryptForDemo(plaintext: unknown) {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const serialized = JSON.stringify(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(serialized));
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const contentHash = await sha256Hex(serialized);
  return {
    contentHash,
    revealKey: bytesToBase64(new Uint8Array(rawKey)),
    encryptedPayload: {
      algorithm: "AES-GCM" as const,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    },
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
