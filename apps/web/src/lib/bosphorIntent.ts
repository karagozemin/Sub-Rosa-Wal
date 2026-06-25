import {
  decodeAbiParameters,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiItem,
  stringToHex,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { StorageReceipt } from "./storageTypes";

const BOSPHOR_ABI = parseAbi([
  "function quote(uint32 dstEid, bytes payload, uint256 deadline, bytes options) view returns (uint256 nativeFee, uint256 lzTokenFee)",
  "function submitIntent(uint32 dstEid, bytes payload, uint256 deadline, bytes options) payable returns (bytes32 intentId)",
  "event IntentExecuted(bytes32 indexed intentId, bytes proof)",
]);
const INTENT_EXECUTED_EVENT = parseAbiItem("event IntentExecuted(bytes32 indexed intentId, bytes proof)");

export type BosphorProofReceipt = StorageReceipt & { storageProvider: "bosphor-walrus" };

export type BosphorSubmissionPayload = {
  protocol: "sub-rosa-round-storage-v1";
  useCase: string;
  submitter: string;
  itemRef: string;
  revealRound: string;
  commitDeadline: string;
  revealDeadline: string;
  contentHash: string;
  commitmentHash: string;
  encryptedPayload: {
    algorithm: "AES-GCM";
    iv: string;
    ciphertext: string;
  };
};

function requireHex(value: string | undefined, name: string): Hex {
  if (!value?.trim()) throw new Error(`${name} is required.`);
  if (!value.startsWith("0x")) throw new Error(`${name} must be 0x-prefixed.`);
  return value as Hex;
}

function makePayload(input: BosphorSubmissionPayload): Hex {
  const json = JSON.stringify(input);
  return encodeAbiParameters(
    [
      { name: "protocol", type: "string" },
      { name: "submitter", type: "string" },
      { name: "contentHash", type: "bytes32" },
      { name: "commitmentHash", type: "bytes32" },
      { name: "encryptedPayload", type: "bytes" },
    ],
    [
      input.protocol,
      input.submitter,
      `0x${input.contentHash}` as Hex,
      `0x${input.commitmentHash}` as Hex,
      stringToHex(json),
    ],
  );
}

function findIntentExecuted(logs: Array<{ topics: readonly Hex[]; data: Hex }>, intentId: Hex) {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: BOSPHOR_ABI,
        data: log.data,
        topics: log.topics as unknown as [Hex, ...Hex[]],
      });
      if (decoded.eventName === "IntentExecuted" && decoded.args.intentId === intentId) {
        return decoded.args.proof;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function waitForIntentExecuted({
  publicClient,
  adapter,
  intentId,
  fromBlock,
}: {
  publicClient: PublicClient;
  adapter: Hex;
  intentId: Hex;
  fromBlock: bigint;
}) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const logs = await publicClient.getLogs({
      address: adapter,
      event: INTENT_EXECUTED_EVENT,
      args: { intentId },
      fromBlock,
      toBlock: "latest",
    });
    const proof = logs.at(-1)?.args.proof;
    if (proof) return proof;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  return null;
}

export async function submitBosphorIntent({
  walletClient,
  publicClient,
  account,
  input,
}: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Hex;
  input: BosphorSubmissionPayload;
}): Promise<BosphorProofReceipt> {
  const adapter = requireHex(import.meta.env.VITE_BOSPHOR_ADAPTER_ADDRESS, "VITE_BOSPHOR_ADAPTER_ADDRESS");
  const dstEid = Number(import.meta.env.VITE_BOSPHOR_DST_EID ?? "40378");
  if (!Number.isFinite(dstEid) || dstEid <= 0) throw new Error("VITE_BOSPHOR_DST_EID must be set.");
  const options = requireHex(import.meta.env.VITE_BOSPHOR_LZ_OPTIONS, "VITE_BOSPHOR_LZ_OPTIONS");
  const payload = makePayload(input);
  const payloadHash = keccak256(payload);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);

  const [nativeFee] = (await publicClient.readContract({
    address: adapter,
    abi: BOSPHOR_ABI,
    functionName: "quote",
    args: [dstEid, payload, deadline, options],
  })) as readonly [bigint, bigint];

  const { result: simulatedIntentId } = await publicClient.simulateContract({
    address: adapter,
    abi: BOSPHOR_ABI,
    functionName: "submitIntent",
    args: [dstEid, payload, deadline, options],
    account,
    value: nativeFee,
  });

  const evmTxHash = await walletClient.sendTransaction({
    account,
    chain: null,
    to: adapter,
    value: nativeFee,
    data: encodeFunctionData({
      abi: BOSPHOR_ABI,
      functionName: "submitIntent",
      args: [dstEid, payload, deadline, options],
    }),
  });
  const txReceipt = await publicClient.waitForTransactionReceipt({ hash: evmTxHash });
  const proof = findIntentExecuted(txReceipt.logs, simulatedIntentId);
  const executedProof =
    proof ??
    (await waitForIntentExecuted({
      publicClient,
      adapter,
      intentId: simulatedIntentId,
      fromBlock: txReceipt.blockNumber,
    }));
  if (!executedProof) {
    throw new Error("Bosphor intent was submitted, but IntentExecuted proof was not found in the transaction receipt yet.");
  }
  const [walrusBlobId, endEpoch] = decodeAbiParameters(
    [
      { name: "blobId", type: "bytes32" },
      { name: "endEpoch", type: "uint256" },
    ],
    executedProof,
  );

  return {
    storageProvider: "bosphor-walrus",
    intentId: simulatedIntentId,
    evmTxHash,
    walrusBlobId,
    endEpoch: endEpoch.toString(),
    payloadHash,
    timestamp: new Date().toISOString(),
  };
}
