import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { http, type Chain } from "viem";

const bosphorChainId = Number(import.meta.env.VITE_BOSPHOR_CHAIN_ID ?? "11155111");
const rpcUrl =
  import.meta.env.VITE_EVM_RPC_URL ||
  (bosphorChainId === 11155111 ? "https://ethereum-sepolia-rpc.publicnode.com" : undefined);

const bosphorChain = {
  id: Number.isFinite(bosphorChainId) && bosphorChainId > 0 ? bosphorChainId : 11155111,
  name: bosphorChainId === 11155111 ? "Sepolia" : `Bosphor chain ${bosphorChainId}`,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [rpcUrl ?? "https://ethereum-sepolia-rpc.publicnode.com"],
    },
  },
} as const satisfies Chain;

export const BOSPHOR_CHAIN = bosphorChain;

export function EvmWalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig] = useState(() =>
    getDefaultConfig({
      appName: "Sub Rosa",
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "missing-walletconnect-project-id",
      chains: [bosphorChain],
      transports: {
        [bosphorChain.id]: http(rpcUrl ?? bosphorChain.rpcUrls.default.http[0]),
      },
    }),
  );

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#5b6cff",
            accentColorForeground: "#ffffff",
            borderRadius: "small",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
