import { z } from "zod";

export const decisionTypeSchema = z.enum(["sealed_bid", "evaluation", "negotiation"]);
export const recommendedActionSchema = z.enum([
  "participate",
  "skip",
  "request_more_info",
]);

export const goatRoundInputSchema = z.object({
  roundId: z.string().trim().min(1),
  itemRef: z.string().trim().min(1),
  basePrice: z.number().finite().positive(),
  category: z.string().trim().min(1).optional(),
  commitDeadline: z.number().int().positive().optional(),
  revealRound: z.number().int().positive().optional(),
});

export const goatMandateInputSchema = z.object({
  objective: z.string().trim().min(12),
  maxBid: z.number().finite().positive(),
  maxEscrow: z.number().finite().positive(),
  riskTolerance: z.enum(["low", "medium", "high"]),
  notes: z.string().trim().max(1200).optional(),
});

export const goatAgentDecisionRequestSchema = z.object({
  agentId: z.string().trim().min(1).default("sub-rosa-goat-agent"),
  decisionType: decisionTypeSchema.default("sealed_bid"),
  round: goatRoundInputSchema,
  mandate: goatMandateInputSchema,
});

export const commitmentPayloadSchema = z.object({
  salt: z.string().regex(/^[0-9a-f]{64}$/),
  commitmentHash: z.string().regex(/^[0-9a-f]{64}$/),
  encryptedArtifactUri: z.string().nullable(),
});

export const goatAgentDecisionSchema = z.object({
  roundId: z.string(),
  agentId: z.string(),
  decisionType: decisionTypeSchema,
  recommendedAction: recommendedActionSchema,
  bidAmount: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string().min(1),
  riskNotes: z.array(z.string()),
  commitmentPayload: commitmentPayloadSchema,
  goat: z.object({
    mode: z.enum(["live", "local_deterministic"]),
    agentkit: z.object({
      package: z.literal("@goatnetwork/agentkit"),
      available: z.boolean(),
      tools: z.array(z.string()),
    }),
    requiresCredentials: z.boolean(),
  }),
});

export type GoatRoundInput = z.infer<typeof goatRoundInputSchema>;
export type GoatMandateInput = z.infer<typeof goatMandateInputSchema>;
export type GoatAgentDecisionRequest = z.input<typeof goatAgentDecisionRequestSchema>;
export type ParsedGoatAgentDecisionRequest = z.infer<typeof goatAgentDecisionRequestSchema>;
export type GoatAgentDecision = z.infer<typeof goatAgentDecisionSchema>;
export type CommitmentPayload = z.infer<typeof commitmentPayloadSchema>;

export interface GoatIntegrationConfig {
  apiKey?: string;
  model?: string;
  network?: string;
  liveEnabled?: boolean;
}

export interface GoatIntegrationStatus {
  available: boolean;
  mode: "live" | "local_deterministic";
  packageName: "@goatnetwork/agentkit";
  network: string;
  model: string;
  credentialsPresent: boolean;
  liveEnabled: boolean;
  tools: string[];
  note: string;
}
