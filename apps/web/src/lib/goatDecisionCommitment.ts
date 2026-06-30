import type { GoatDecision } from "./goatAgentClient";

export function decisionBidToDemoEntry(decision: GoatDecision): number | null {
  if (!decision.bidAmount) return null;
  const parsed = Number(decision.bidAmount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.round(parsed));
}
