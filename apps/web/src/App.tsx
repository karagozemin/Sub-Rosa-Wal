import { useState } from "react";
import { DEMO_TRACE, isTraceSettled } from "./demo/trace";
import { useLiveRound } from "./hooks/useLiveRound";
import { LifecycleView } from "./components/LifecycleView";
import { ObserverView } from "./components/ObserverView";
import {
  AgentActivity,
  KeeperPanel,
  X402Logs,
} from "./components/AgentPanels";
import { AttackDemo } from "./components/AttackDemo";
import { MandateCapLab } from "./components/MandateCapLab";
import { AuditorView } from "./components/AuditorView";
import { PasskeyPanel } from "./components/PasskeyPanel";
import { SettlementRail } from "./components/SettlementRail";
import { MainnetProofCard } from "./components/MainnetProofCard";
import { DrandCountdownChip } from "./components/DrandCountdownChip";
import { shortAddr, usdc } from "./lib/format";

type Tab =
  | "overview"
  | "lifecycle"
  | "observer"
  | "auditor"
  | "agents"
  | "attack"
  | "caps"
  | "passkey";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Showcase" },
  { id: "attack", label: "Seal Attack" },
  { id: "lifecycle", label: "Flow" },
  { id: "agents", label: "Agents + x402" },
  { id: "observer", label: "Observer" },
  { id: "auditor", label: "Auditor" },
  { id: "caps", label: "Caps" },
  { id: "passkey", label: "Passkey" },
];

const LOGO_SRC = "/sub-rosa-logo.png";
const TAB_IDS = new Set<Tab>(TABS.map((t) => t.id));

function tabFromHash(): Tab {
  const id = window.location.hash.replace(/^#/, "") as Tab;
  return TAB_IDS.has(id) ? id : "overview";
}

function SealFigure() {
  const settled = isTraceSettled(DEMO_TRACE);
  const escrowTotal = DEMO_TRACE.bidders.reduce((s, b) => s + b.escrowUsdc, 0);

  return (
    <div className="seal-figure" aria-label="Sealed Sub Rosa round visual">
      <div className="vault-diagram">
        <div className="vault-ring outer" />
        <div className="vault-ring inner" />
        <div className="hero-logo-medallion">
          <img src={LOGO_SRC} alt="Sub Rosa" />
        </div>
        <div className="beam b1" />
        <div className="beam b2" />
      </div>
      <div className="ledger-thread t1">
        <span>contract</span>
        <strong>{shortAddr(DEMO_TRACE.meta.contractId, 5)}</strong>
      </div>
      <div className="ledger-thread t2">
        <span>Drand round</span>
        <strong>
          {DEMO_TRACE.meta.revealRound > 0
            ? DEMO_TRACE.meta.revealRound.toLocaleString()
            : "—"}
        </strong>
      </div>
      <div className="ledger-thread t3">
        <span>{settled ? "contract balance" : "status"}</span>
        <strong>
          {settled
            ? `${DEMO_TRACE.keeper.contractBalanceFinal} USDC`
            : DEMO_TRACE.meta.roundStatus === "Pending"
              ? "run agents:e2e"
              : `${DEMO_TRACE.meta.roundStatus}${escrowTotal > 0 ? ` · ${escrowTotal.toFixed(2)} USDC escrow` : ""}`}
        </strong>
      </div>
    </div>
  );
}

function ProofMetrics() {
  const settled = isTraceSettled(DEMO_TRACE);
  const winner = DEMO_TRACE.bidders.find((b) => b.winner);
  const escrowTotal = DEMO_TRACE.bidders.reduce((s, b) => s + b.escrowUsdc, 0);
  const metrics = [
    [
      "Round",
      settled ? "Settled" : DEMO_TRACE.meta.roundStatus,
    ],
    [
      "Escrow locked",
      escrowTotal > 0 ? `${escrowTotal.toFixed(2)} USDC` : "—",
    ],
    [
      "Settle",
      settled && DEMO_TRACE.settlement.operatorReceivedUsdc > 0
        ? `${usdc(DEMO_TRACE.settlement.operatorReceivedUsdc)} USDC to operator`
        : settled
          ? "complete"
          : "after keeper clear",
    ],
    ["BLS verify", DEMO_TRACE.keeper.blsVerifiedOnChain ? "on-chain" : "pending keeper"],
    ["Winner", winner?.label ?? (settled ? "—" : "pending reveal")],
  ];

  return (
    <section className="proof-metrics" aria-label="Live proof metrics">
      {metrics.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
}

function LiveControl({
  configured,
  livePoll,
  setLivePoll,
  error,
}: {
  configured: boolean;
  livePoll: boolean;
  setLivePoll: (value: boolean) => void;
  error: string | null;
}) {
  if (!configured) {
    return (
      <div className="live-control">
        <span className="trace-status">Recorded trace</span>
      </div>
    );
  }

  return (
    <div className="live-control">
      <button
        type="button"
        className="btn ghost"
        onClick={() => setLivePoll(!livePoll)}
        title="Toggle optional live contract polling"
      >
        {livePoll ? "Live polling on" : "Poll live contract"}
      </button>
      {error && <p className="error">Live poll: {error}</p>}
    </div>
  );
}

function Opening({
  configured,
  livePoll,
  setLivePoll,
  error,
}: {
  configured: boolean;
  livePoll: boolean;
  setLivePoll: (value: boolean) => void;
  error: string | null;
}) {
  return (
    <section className="opening">
      <div className="opening-copy">
        <p className="eyebrow">Sub Rosa / confidential coordination on Stellar</p>
        <h1>Sealed coordination, opened fairly.</h1>
        <p className="lede">
          A juried protocol demo for private auctions: bids stay hidden until
          Drand R, then anyone can reveal and settle the round on-chain.
        </p>
        <div className="opening-points">
          <span>Drand tlock</span>
          <span>Soroban BLS</span>
          <span>Permissionless keeper</span>
          <span>x402 agents</span>
        </div>
        <LiveControl
          configured={configured}
          livePoll={livePoll}
          setLivePoll={setLivePoll}
          error={error}
        />
      </div>
      <SealFigure />
    </section>
  );
}

function ProofDossier() {
  return (
    <section className="dossier">
      <div className="dossier-copy">
        <p className="eyebrow">Supporting proof</p>
        <h2>Not a storyboard. A recorded live path.</h2>
        <p>
          The jury view stays simple, but the evidence is still here: x402 paid
          appraisals, session mandates, keeper reveal, deterministic settlement.
        </p>
        <p className="muted">{DEMO_TRACE.meta.proofScope}</p>
      </div>
      <div className="dossier-list">
        {DEMO_TRACE.meta.liveE2e.map((cmd) => (
          <code key={cmd}>{cmd}</code>
        ))}
      </div>
    </section>
  );
}

function Overview({
  live,
  configured,
  livePoll,
  setLivePoll,
  error,
}: {
  live: ReturnType<typeof useLiveRound>["live"];
  configured: boolean;
  livePoll: boolean;
  setLivePoll: (value: boolean) => void;
  error: string | null;
}) {
  return (
    <>
      <Opening
        configured={configured}
        livePoll={livePoll}
        setLivePoll={setLivePoll}
        error={error}
      />
      <AttackDemo />
      <ProofMetrics />
      <MainnetProofCard />
      <LifecycleView trace={DEMO_TRACE} />
      <ProofDossier />
      <section className="support-grid">
        <AgentActivity trace={DEMO_TRACE} />
        <X402Logs trace={DEMO_TRACE} />
      </section>
      <section className="support-grid compact">
        <KeeperPanel trace={DEMO_TRACE} />
        <ObserverView trace={DEMO_TRACE} live={live} />
      </section>
      <SettlementRail trace={DEMO_TRACE} />
    </>
  );
}

export default function App() {
  const [tab, setTabState] = useState<Tab>(() => tabFromHash());
  const [livePoll, setLivePoll] = useState(false);
  const { live, error, configured } = useLiveRound(livePoll);
  const setTab = (next: Tab) => {
    setTabState(next);
    window.history.replaceState(null, "", `#${next}`);
  };

  return (
    <div className="app">
      <header className="site-header">
        <button type="button" className="brand" onClick={() => setTab("overview")}>
          <span className="brand-mark">
            <img src={LOGO_SRC} alt="" />
          </span>
          <span>
            <strong>Sub Rosa</strong>
            <small>{DEMO_TRACE.meta.network}</small>
          </span>
        </button>

        <nav className="tabs" aria-label="Demo sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "active" : ""}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <DrandCountdownChip targetRound={DEMO_TRACE.meta.revealRound} />
      </header>

      <main className="main">
        <div key={tab} className="view-shell">
          {tab === "overview" && (
            <Overview
              live={live}
              configured={configured}
              livePoll={livePoll}
              setLivePoll={setLivePoll}
              error={error}
            />
          )}
          {tab === "attack" && <AttackDemo />}
          {tab === "lifecycle" && <LifecycleView trace={DEMO_TRACE} />}
          {tab === "observer" && <ObserverView trace={DEMO_TRACE} live={live} />}
          {tab === "agents" && (
            <>
              <AgentActivity trace={DEMO_TRACE} />
              <X402Logs trace={DEMO_TRACE} />
              <SettlementRail trace={DEMO_TRACE} />
              <KeeperPanel trace={DEMO_TRACE} />
            </>
          )}
          {tab === "auditor" && <AuditorView trace={DEMO_TRACE} />}
          {tab === "caps" && <MandateCapLab />}
          {tab === "passkey" && <PasskeyPanel />}
        </div>
      </main>
    </div>
  );
}
