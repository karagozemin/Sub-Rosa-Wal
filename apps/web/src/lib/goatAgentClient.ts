export const GOAT_AGENT_API_URL =
  import.meta.env.VITE_GOAT_AGENT_API_URL ?? "http://127.0.0.1:4021";

export type GoatDecisionRequest = {
  agentId: string;
  decisionType: "sealed_bid" | "evaluation" | "negotiation";
  round: {
    roundId: string;
    itemRef: string;
    basePrice: number;
    category?: string;
    commitDeadline?: number;
    revealRound?: number;
  };
  mandate: {
    objective: string;
    maxBid: number;
    maxEscrow: number;
    riskTolerance: "low" | "medium" | "high";
    notes?: string;
  };
};

export type GoatDecision = {
  roundId: string;
  agentId: string;
  decisionType: "sealed_bid" | "evaluation" | "negotiation";
  recommendedAction: "participate" | "skip" | "request_more_info";
  bidAmount: string | null;
  confidence: number;
  reasoningSummary: string;
  riskNotes: string[];
  commitmentPayload: {
    salt: string;
    commitmentHash: string;
    encryptedArtifactUri: string | null;
  };
  goat: {
    mode: "live" | "local_deterministic";
    agentkit: {
      package: "@goatnetwork/agentkit";
      available: boolean;
      tools: string[];
    };
    requiresCredentials: boolean;
  };
};

export type GoatPaymentReceipt = {
  transaction?: string;
  network?: string;
  payer?: string;
};

export type GoatPaidDecision = {
  decision: GoatDecision;
  payment?: GoatPaymentReceipt;
};

export type GoatStatus = {
  status: {
    mode: "live" | "local_deterministic";
    network: string;
    model: string;
    credentialsPresent: boolean;
    liveEnabled: boolean;
    tools: string[];
    note: string;
  };
  x402: {
    required: boolean;
    receiverAddress: string;
    network: string;
    priceUsdc: number;
    route: "POST /goat/agent-decision";
  };
  paidDemo?: {
    available: boolean;
    route: "POST /goat/paid-agent-decision";
  };
};

export type GoatPaymentRequirement = {
  price: number;
  network: string;
  receiverAddress: string;
  asset?: string;
  accepts?: unknown[];
};

export type GoatPreparedCommitment = {
  source: "goat-agent-decision";
  roundId: string;
  bidAmount: string;
  commitmentHash: string;
  salt: string;
  decision: GoatDecision;
  savedAt: string;
};

const STORAGE_KEY = "subrosa.goat.preparedCommitment";

export async function fetchGoatStatus(): Promise<GoatStatus> {
  const res = await fetch(`${GOAT_AGENT_API_URL.replace(/\/$/, "")}/goat/status`);
  if (!res.ok) throw new Error(`GOAT status failed with HTTP ${res.status}`);
  return (await res.json()) as GoatStatus;
}

export async function requestGoatDecision(
  request: GoatDecisionRequest,
): Promise<GoatPaidDecision> {
  const res = await fetch(`${GOAT_AGENT_API_URL.replace(/\/$/, "")}/goat/agent-decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await res.json().catch(() => ({}))) as {
    decision?: GoatDecision;
    payment?: GoatPaymentReceipt;
    error?: string;
    accepts?: unknown[];
  };
  if (res.status === 402) {
    throw new GoatPaymentRequiredError({
      price: extractFirstNumber(body.accepts, "price") ?? 0,
      network: extractFirstString(body.accepts, "network") ?? "stellar:testnet",
      receiverAddress:
        extractFirstString(body.accepts, "payTo") ??
        extractFirstString(body.accepts, "payToAddress") ??
        "unknown",
      asset: extractFirstString(body.accepts, "asset"),
      accepts: body.accepts,
    });
  }
  if (!res.ok || !body.decision) {
    throw new Error(body.error ?? `GOAT decision failed with HTTP ${res.status}`);
  }
  return { decision: body.decision, payment: body.payment };
}

export async function requestPaidGoatDecision(
  request: GoatDecisionRequest,
): Promise<GoatPaidDecision> {
  const res = await fetch(`${GOAT_AGENT_API_URL.replace(/\/$/, "")}/goat/paid-agent-decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await res.json().catch(() => ({}))) as {
    decision?: GoatDecision;
    payment?: GoatPaymentReceipt;
    error?: string;
  };
  if (!res.ok || !body.decision) {
    throw new Error(body.error ?? `paid GOAT decision failed with HTTP ${res.status}`);
  }
  return { decision: body.decision, payment: body.payment };
}

export class GoatPaymentRequiredError extends Error {
  requirement: GoatPaymentRequirement;

  constructor(requirement: GoatPaymentRequirement) {
    super("x402 payment required");
    this.name = "GoatPaymentRequiredError";
    this.requirement = requirement;
  }
}

export function savePreparedGoatCommitment(decision: GoatDecision): GoatPreparedCommitment {
  if (!decision.bidAmount) {
    throw new Error("This GOAT decision does not include a bid amount to commit.");
  }
  const prepared: GoatPreparedCommitment = {
    source: "goat-agent-decision",
    roundId: decision.roundId,
    bidAmount: decision.bidAmount,
    commitmentHash: decision.commitmentPayload.commitmentHash,
    salt: decision.commitmentPayload.salt,
    decision,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prepared));
  return prepared;
}

export function consumePreparedGoatCommitment(): GoatPreparedCommitment | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as GoatPreparedCommitment;
  } catch {
    return null;
  }
}

function extractFirstString(values: unknown[] | undefined, key: string): string | undefined {
  for (const value of values ?? []) {
    const found = extractRecordValue(value, key);
    if (typeof found === "string" && found.length > 0) return found;
  }
  return undefined;
}

function extractFirstNumber(values: unknown[] | undefined, key: string): number | undefined {
  for (const value of values ?? []) {
    const found = extractRecordValue(value, key);
    if (typeof found === "number") return found;
    if (typeof found === "string" && found.trim()) {
      const parsed = Number(found);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function extractRecordValue(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (key in record) return record[key];
  for (const child of Object.values(record)) {
    const found = extractRecordValue(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}
