import { createHash, randomBytes } from "node:crypto";

import { commitment, toHex } from "@sub-rosa/tlock";

import { createGoatAgentSession, getGoatIntegrationStatus } from "./goatClient.js";
import {
  goatAgentDecisionRequestSchema,
  goatAgentDecisionSchema,
  type GoatAgentDecision,
  type GoatAgentDecisionRequest,
  type GoatIntegrationConfig,
  type ParsedGoatAgentDecisionRequest,
} from "./types.js";

const USDC_STROOPS = 10_000_000n;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function amountToStroops(amount: number): bigint {
  return BigInt(Math.round(amount * Number(USDC_STROOPS)));
}

function decimalString(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

function deriveSalt(req: ParsedGoatAgentDecisionRequest): Uint8Array {
  return createHash("sha256")
    .update(`sub-rosa-goat-salt-v1:${canonical(req)}:${randomBytes(16).toString("hex")}`)
    .digest();
}

function scoreDecision(req: ParsedGoatAgentDecisionRequest) {
  const objectiveSignals = req.mandate.objective.toLowerCase();
  const deadlinePressure = req.round.commitDeadline
    ? Math.max(0, req.round.commitDeadline - Math.floor(Date.now() / 1000))
    : 900;
  const riskPenalty = req.mandate.riskTolerance === "low" ? 0.72 : req.mandate.riskTolerance === "medium" ? 0.86 : 0.96;
  const objectiveBoost =
    objectiveSignals.includes("win") || objectiveSignals.includes("secure")
      ? 1.04
      : objectiveSignals.includes("evaluate")
        ? 0.9
        : 0.98;
  const deadlineFactor = deadlinePressure < 120 ? 0.82 : deadlinePressure < 600 ? 0.94 : 1;
  const candidate = req.round.basePrice * objectiveBoost * riskPenalty * deadlineFactor;
  const maxSpend = Math.min(req.mandate.maxBid, req.mandate.maxEscrow);
  const bid = Math.max(0, Math.min(maxSpend, candidate));
  const confidenceBase = req.round.category ? 0.72 : 0.64;
  const confidence =
    req.mandate.riskTolerance === "high"
      ? confidenceBase - 0.04
      : req.mandate.riskTolerance === "low"
        ? confidenceBase + 0.08
        : confidenceBase;
  return {
    bid,
    confidence: Math.max(0.1, Math.min(0.98, Math.round(confidence * 100) / 100)),
    deadlinePressure,
  };
}

export function generateSealedBid(
  request: GoatAgentDecisionRequest,
): Pick<GoatAgentDecision, "bidAmount" | "commitmentPayload"> {
  const parsed = goatAgentDecisionRequestSchema.parse(request);
  const { bid } = scoreDecision(parsed);
  const salt = deriveSalt(parsed);
  const value = amountToStroops(bid);
  return {
    bidAmount: decimalString(bid),
    commitmentPayload: {
      salt: toHex(salt),
      commitmentHash: toHex(commitment(value, salt)),
      encryptedArtifactUri: null,
    },
  };
}

export function generatePrivateEvaluation(
  request: GoatAgentDecisionRequest,
): GoatAgentDecision {
  return generateAgentDecision({ ...request, decisionType: "evaluation" });
}

export function generateAgentDecision(
  request: GoatAgentDecisionRequest,
  config: GoatIntegrationConfig = {},
): GoatAgentDecision {
  const parsed = goatAgentDecisionRequestSchema.parse(request);
  const goatStatus = getGoatIntegrationStatus(config);
  const sessionStatus =
    goatStatus.mode === "live" ? createGoatAgentSession(config).status : goatStatus;
  const { bid, confidence, deadlinePressure } = scoreDecision(parsed);
  const sealed = generateSealedBid(parsed);
  const shouldParticipate = bid > 0 && confidence >= 0.55;
  const requestHash = sha256Hex(canonical(parsed)).slice(0, 12);
  const riskNotes = [
    `Mandate caps bid at ${decimalString(parsed.mandate.maxBid)} USDC and escrow at ${decimalString(parsed.mandate.maxEscrow)} USDC.`,
    deadlinePressure < 120
      ? "Commit deadline is close; prefer skipping unless the round is operationally ready."
      : "Commit window appears usable for a sealed bid workflow.",
    sessionStatus.mode === "live"
      ? "GOAT AgentKit live mode is enabled for tool execution."
      : "Local deterministic decision mode; live GOAT credentials are not active.",
  ];
  const decision: GoatAgentDecision = {
    roundId: parsed.round.roundId,
    agentId: parsed.agentId,
    decisionType: parsed.decisionType,
    recommendedAction: shouldParticipate ? "participate" : "skip",
    bidAmount: shouldParticipate ? sealed.bidAmount : null,
    confidence,
    reasoningSummary:
      shouldParticipate
        ? `GOAT agent session evaluated ${parsed.round.itemRef} (${requestHash}) and prepared a sealed bid within mandate caps.`
        : `GOAT agent session evaluated ${parsed.round.itemRef} (${requestHash}) and recommends skipping under the current mandate.`,
    riskNotes,
    commitmentPayload: sealed.commitmentPayload,
    goat: {
      mode: sessionStatus.mode,
      agentkit: {
        package: sessionStatus.packageName,
        available: sessionStatus.available,
        tools: sessionStatus.tools,
      },
      requiresCredentials: sessionStatus.mode !== "live",
    },
  };
  return verifyAgentOutput(decision);
}

export function verifyAgentOutput(output: unknown): GoatAgentDecision {
  return goatAgentDecisionSchema.parse(output);
}
