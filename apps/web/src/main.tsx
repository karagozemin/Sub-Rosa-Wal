import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { EvmWalletProvider } from "./wallet/EvmWalletProvider";
import "./styles/demo.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <EvmWalletProvider>
      <App />
    </EvmWalletProvider>
  </StrictMode>,
);
