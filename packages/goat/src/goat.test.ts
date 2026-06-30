import assert from "node:assert/strict";
import { test } from "node:test";

import {
  generateAgentDecision,
  generateSealedBid,
  getGoatIntegrationStatus,
  requireX402Payment,
  verifyAgentOutput,
} from "./index.js";

const request = {
  agentId: "goat-alpha",
  decisionType: "sealed_bid" as const,
  round: {
    roundId: "42",
    itemRef: "sub-rosa://round/42",
    basePrice: 100,
    category: "rfp",
    commitDeadline: Math.floor(Date.now() / 1000) + 900,
    revealRound: 123456,
  },
  mandate: {
    objective: "Win only if the bid stays inside the private mandate caps.",
    maxBid: 90,
    maxEscrow: 95,
    riskTolerance: "medium" as const,
    notes: "Prefer disciplined bid sizing.",
  },
};

test("GOAT integration status is honest without live credentials", () => {
  const status = getGoatIntegrationStatus({ apiKey: undefined, liveEnabled: false });
  assert.equal(status.packageName, "@goatnetwork/agentkit");
  assert.equal(status.mode, "local_deterministic");
  assert.equal(status.credentialsPresent, false);
  assert.ok(status.tools.includes("subrosa.x402.agentDecision"));
});

test("agent decision validates structured output", () => {
  const decision = generateAgentDecision(request, { liveEnabled: false });
  assert.equal(decision.roundId, "42");
  assert.equal(decision.agentId, "goat-alpha");
  assert.equal(decision.decisionType, "sealed_bid");
  assert.equal(decision.recommendedAction, "participate");
  assert.match(decision.commitmentPayload.salt, /^[0-9a-f]{64}$/);
  assert.match(decision.commitmentPayload.commitmentHash, /^[0-9a-f]{64}$/);
  assert.equal(verifyAgentOutput(decision).roundId, "42");
});

test("invalid mandate and invalid round input are rejected", () => {
  assert.throws(
    () =>
      generateAgentDecision({
        ...request,
        mandate: { ...request.mandate, objective: "too short" },
      }),
    /String must contain at least 12/,
  );
  assert.throws(
    () =>
      generateAgentDecision({
        ...request,
        round: { ...request.round, basePrice: 0 },
      }),
    /Number must be greater than 0/,
  );
});

test("sealed bid adapter creates commitment payload usable by Sub Rosa", () => {
  const sealed = generateSealedBid(request);
  assert.equal(sealed.bidAmount, "89.44");
  assert.match(sealed.commitmentPayload.salt, /^[0-9a-f]{64}$/);
  assert.match(sealed.commitmentPayload.commitmentHash, /^[0-9a-f]{64}$/);
});

test("x402 payment requirement resolves GOAT env contract", () => {
  const requirement = requireX402Payment({
    receiverAddress: "GDEST",
    network: "stellar:testnet",
    priceUsdc: 0.15,
  });
  assert.equal(requirement.required, true);
  assert.equal(requirement.receiverAddress, "GDEST");
  assert.equal(requirement.route, "POST /goat/agent-decision");
  assert.equal(requirement.priceUsdc, 0.15);
});
