export interface X402RequirementInput {
  enabled?: boolean;
  receiverAddress?: string;
  network?: string;
  priceUsdc?: number;
}

export interface X402Requirement {
  required: boolean;
  receiverAddress: string;
  network: string;
  priceUsdc: number;
  route: "POST /goat/agent-decision";
}

export function requireX402Payment(input: X402RequirementInput = {}): X402Requirement {
  const required = input.enabled ?? process.env.GOAT_X402_ENABLED !== "false";
  return {
    required,
    receiverAddress:
      input.receiverAddress ??
      process.env.GOAT_X402_RECEIVER_ADDRESS ??
      process.env.PAY_TO ??
      "",
    network:
      input.network ??
      process.env.GOAT_X402_NETWORK ??
      process.env.X402_NETWORK ??
      "stellar:testnet",
    priceUsdc: input.priceUsdc ?? Number(process.env.GOAT_X402_PRICE_USDC ?? "0.10"),
    route: "POST /goat/agent-decision",
  };
}
