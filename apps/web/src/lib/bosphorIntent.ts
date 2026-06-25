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
  "event IntentSubmitted(bytes32 indexed intentId, address indexed sender, uint64 targetChainId, bytes payload, uint256 nonce, uint256 deadline)",
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

type ExecutedIntentProof = {
  intentId: Hex;
  proof: Hex;
};

function findIntentExecuted(
  logs: Array<{ topics: readonly Hex[]; data: Hex }>,
  intentId?: Hex,
): ExecutedIntentProof | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: BOSPHOR_ABI,
        data: log.data,
        topics: log.topics as unknown as [Hex, ...Hex[]],
      });
      if (
        decoded.eventName === "IntentExecuted" &&
        (!intentId || decoded.args.intentId.toLowerCase() === intentId.toLowerCase())
      ) {
        return { intentId: decoded.args.intentId, proof: decoded.args.proof };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function findIntentSubmitted(logs: Array<{ topics: readonly Hex[]; data: Hex }>): Hex | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: BOSPHOR_ABI,
        data: log.data,
        topics: log.topics as unknown as [Hex, ...Hex[]],
      });
      if (decoded.eventName === "IntentSubmitted") {
        return decoded.args.intentId;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function withExecutedProof(receipt: BosphorProofReceipt, executed: ExecutedIntentProof): BosphorProofReceipt {
  const [walrusBlobId, endEpoch] = decodeAbiParameters(
    [
      { name: "blobId", type: "bytes32" },
      { name: "endEpoch", type: "uint256" },
    ],
    executed.proof,
  );

  return {
    ...receipt,
    status: "executed",
    intentId: executed.intentId,
    walrusBlobId,
    endEpoch: endEpoch.toString(),
    timestamp: new Date().toISOString(),
  };
}

export async function fetchBosphorIntentExecution({
  publicClient,
  receipt,
}: {
  publicClient: PublicClient;
  receipt: BosphorProofReceipt;
}): Promise<BosphorProofReceipt> {
  if (receipt.status === "executed" || !receipt.intentId) return receipt;
  const adapter = requireHex(import.meta.env.VITE_BOSPHOR_ADAPTER_ADDRESS, "VITE_BOSPHOR_ADAPTER_ADDRESS");
  const intentId = receipt.intentId as Hex;
  let fromBlock: bigint | undefined;
  if (receipt.evmTxHash) {
    const txReceipt = await publicClient.getTransactionReceipt({ hash: receipt.evmTxHash as Hex });
    fromBlock = txReceipt.blockNumber;
    const sameReceiptProof = findIntentExecuted(txReceipt.logs, intentId);
    if (sameReceiptProof) return withExecutedProof(receipt, sameReceiptProof);
  }

  if (!receipt.intentId) return receipt;
  const logs = await publicClient.getLogs({
    address: adapter,
    event: INTENT_EXECUTED_EVENT,
    args: { intentId },
    fromBlock,
    toBlock: "latest",
  });
  const executedProof = logs.at(-1)?.args.proof;
  return executedProof ? withExecutedProof(receipt, { intentId, proof: executedProof }) : receipt;
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
  const submittedIntentId = findIntentSubmitted(txReceipt.logs);
  if (!submittedIntentId) {
    throw new Error("Bosphor transaction confirmed, but IntentSubmitted event was not found in the receipt.");
  }
  const executedProof = findIntentExecuted(txReceipt.logs, submittedIntentId);
  if (!executedProof) {
    return {
      storageProvider: "bosphor-walrus",
      status: "submitted",
      intentId: submittedIntentId,
      evmTxHash,
      walrusBlobId: "",
      endEpoch: "",
      payloadHash,
      timestamp: new Date().toISOString(),
    };
  }

  return withExecutedProof({
    storageProvider: "bosphor-walrus",
    status: "submitted",
    intentId: submittedIntentId,
    evmTxHash,
    walrusBlobId: "",
    endEpoch: "",
    payloadHash,
    timestamp: new Date().toISOString(),
  }, executedProof);
}
