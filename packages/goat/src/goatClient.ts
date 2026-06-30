import {
  ExecutionRuntime,
  NoopWalletProvider,
  PolicyEngine,
} from "@goatnetwork/agentkit/core";
import { customActionProvider } from "@goatnetwork/agentkit/providers";
import { z } from "zod";

import type { GoatIntegrationConfig, GoatIntegrationStatus } from "./types.js";

export const GOAT_AGENTKIT_PACKAGE = "@goatnetwork/agentkit" as const;

export interface GoatAgentSession {
  provider: ReturnType<typeof customActionProvider>;
  runtime: ExecutionRuntime;
  wallet: NoopWalletProvider;
  status: GoatIntegrationStatus;
}

function envConfig(): Required<Pick<GoatIntegrationConfig, "model" | "network">> &
  GoatIntegrationConfig {
  return {
    apiKey: process.env.GOAT_AGENTKIT_API_KEY || process.env.GOAT_API_KEY,
    model: process.env.GOAT_AGENT_MODEL ?? "goat-agentkit-runtime",
    network: process.env.GOAT_NETWORK ?? "goat-testnet",
    liveEnabled: process.env.GOAT_LIVE_ENABLED === "true",
  };
}

export function getGoatIntegrationStatus(
  config: GoatIntegrationConfig = {},
): GoatIntegrationStatus {
  const merged = { ...envConfig(), ...config };
  const credentialsPresent = Boolean(merged.apiKey);
  const liveEnabled = merged.liveEnabled === true;
  const mode = credentialsPresent && liveEnabled ? "live" : "local_deterministic";
  return {
    available: true,
    mode,
    packageName: GOAT_AGENTKIT_PACKAGE,
    network: merged.network ?? "goat-testnet",
    model: merged.model ?? "goat-agentkit-runtime",
    credentialsPresent,
    liveEnabled,
    tools: ["subrosa.x402.agentDecision"],
    note:
      mode === "live"
        ? "GOAT AgentKit is configured for live tool execution."
        : "GOAT AgentKit is installed and used for action registration; decision generation is local deterministic until GOAT credentials and live mode are supplied.",
  };
}

export function createGoatAgentSession(
  config: GoatIntegrationConfig = {},
): GoatAgentSession {
  const status = getGoatIntegrationStatus(config);
  const wallet = new NoopWalletProvider();
  const provider = customActionProvider([
    {
      name: "subrosa.x402.agentDecision",
      description:
        "Describe the x402-paid Sub Rosa GOAT agent decision route for sealed coordination.",
      schema: z.object({
        route: z.literal("POST /goat/agent-decision"),
      }),
      riskLevel: "read",
      networks: [status.network],
      invoke: async (input) => {
        const parsed = z.object({
          route: z.literal("POST /goat/agent-decision"),
        }).parse(input);
        return {
          route: parsed.route,
          payment: "x402-required",
          output: "structured sealed bid decision",
        };
      },
    },
  ]);
  const policy = new PolicyEngine({
    allowedNetworks: [status.network],
    maxRiskWithoutConfirm: "medium",
    writeEnabled: status.mode === "live",
  });
  const runtime = new ExecutionRuntime(policy, { maxRetries: 1, retryDelayMs: 100 });
  return { provider, runtime, wallet, status };
}
