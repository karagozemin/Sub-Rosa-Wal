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
): Promise<GoatDecision> {
  const res = await fetch(`${GOAT_AGENT_API_URL.replace(/\/$/, "")}/goat/agent-decision`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const body = (await res.json().catch(() => ({}))) as {
    decision?: GoatDecision;
    error?: string;
    accepts?: unknown[];
  };
  if (res.status === 402) {
    throw new Error(
      `x402 payment required by ${GOAT_AGENT_API_URL}. Use a paid agent client or run the backend e2e with funded Stellar testnet keys.`,
    );
  }
  if (!res.ok || !body.decision) {
    throw new Error(body.error ?? `GOAT decision failed with HTTP ${res.status}`);
  }
  return body.decision;
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
