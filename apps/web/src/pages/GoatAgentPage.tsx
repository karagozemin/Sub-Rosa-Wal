import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchGoatStatus,
  GoatPaymentRequiredError,
  GOAT_AGENT_API_URL,
  requestPaidGoatDecision,
  requestGoatDecision,
  savePreparedGoatCommitment,
  type GoatDecision,
  type GoatDecisionRequest,
  type GoatPaymentReceipt,
  type GoatPaymentRequirement,
  type GoatStatus,
} from "../lib/goatAgentClient";
import { decisionBidToDemoEntry } from "../lib/goatDecisionCommitment";

type Props = {
  goHome: () => void;
  goDemo: () => void;
};

const initialRequest: GoatDecisionRequest = {
  agentId: "sub-rosa-goat-agent",
  decisionType: "sealed_bid",
  round: {
    roundId: "demo-goat-round",
    itemRef: "sub-rosa://goat/demo-private-allocation",
    basePrice: 100,
    category: "rfp",
    commitDeadline: Math.floor(Date.now() / 1000) + 900,
  },
  mandate: {
    objective: "Generate a private sealed bid strategy only if the bid stays within mandate caps.",
    maxBid: 90,
    maxEscrow: 95,
    riskTolerance: "medium",
    notes: "Prefer a defensible bid with enough margin for reveal-time audit.",
  },
};

export function GoatAgentPage({ goHome, goDemo }: Props) {
  const [status, setStatus] = useState<GoatStatus | null>(null);
  const [request, setRequest] = useState<GoatDecisionRequest>(initialRequest);
  const [decision, setDecision] = useState<GoatDecision | null>(null);
  const [payment, setPayment] = useState<GoatPaymentReceipt | null>(null);
  const [paymentRequirement, setPaymentRequirement] = useState<GoatPaymentRequirement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "idle" | "checking" | "payment_required" | "signing" | "settled"
  >("idle");
  const preparedEntry = useMemo(
    () => (decision ? decisionBidToDemoEntry(decision) : null),
    [decision],
  );
  const paidRelayAvailable = status?.paidDemo?.available === true;

  useEffect(() => {
    fetchGoatStatus().then(setStatus).catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    setDecision(null);
    setPayment(null);
    setPaymentRequirement(null);
    setStage(paidRelayAvailable ? "signing" : "checking");
    try {
      const result = paidRelayAvailable
        ? await requestPaidGoatDecision(request)
        : await requestGoatDecision(request);
      setDecision(result.decision);
      setPayment(result.payment ?? null);
      setStage("settled");
    } catch (e) {
      if (e instanceof GoatPaymentRequiredError) {
        setPaymentRequirement(e.requirement);
        setStage("payment_required");
      } else {
        setError(e instanceof Error ? e.message : String(e));
        setStage("idle");
      }
    } finally {
      setBusy(false);
    }
  }

  function useDecision() {
    if (!decision) return;
    savePreparedGoatCommitment(decision);
    goDemo();
  }

  return (
    <main className="goat-page">
      <nav className="architecture-nav">
        <button type="button" className="brand-link" onClick={goHome}>
          <img src="/sub-rosa-logo.png" alt="" /> Sub Rosa
        </button>
        <div className="architecture-nav-actions">
          <button type="button" className="secondary-action" onClick={goDemo}>
            Open sealed round
          </button>
        </div>
      </nav>

      <section className="goat-hero">
        <div>
          <p className="eyebrow">GOAT AgentKit + x402</p>
          <h1>GOAT agent strategy</h1>
          <p className="lede">
            Generate a structured agent decision behind the same x402 payment boundary used by the
            appraisal API, then carry the prepared bid into Sub Rosa's sealed commitment flow.
          </p>
        </div>
        <aside className={`goat-status ${status?.status.mode === "live" ? "live" : "local"}`}>
          <span>integration</span>
          <strong>{status?.status.mode === "live" ? "live GOAT" : "local deterministic"}</strong>
          <p>{status?.status.note ?? "Loading GOAT status..."}</p>
          <dl>
            <div>
              <dt>x402</dt>
              <dd>{status ? `${status.x402.priceUsdc} USDC` : "..."}</dd>
            </div>
            <div>
              <dt>network</dt>
              <dd>{status?.x402.network ?? "..."}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="goat-workspace">
        <form className="panel goat-form" onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}>
          <div>
            <p className="eyebrow">Mandate</p>
            <h2>Paid agent action</h2>
          </div>
          <label>
            Objective
            <textarea
              value={request.mandate.objective}
              onChange={(e) =>
                setRequest({
                  ...request,
                  mandate: { ...request.mandate, objective: e.target.value },
                })
              }
            />
          </label>
          <div className="goat-form-grid">
            <label>
              Round id
              <input
                value={request.round.roundId}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    round: { ...request.round, roundId: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Item ref
              <input
                value={request.round.itemRef}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    round: { ...request.round, itemRef: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Base price
              <input
                type="number"
                min="1"
                value={request.round.basePrice}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    round: { ...request.round, basePrice: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              Max bid
              <input
                type="number"
                min="1"
                value={request.mandate.maxBid}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    mandate: { ...request.mandate, maxBid: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              Max escrow
              <input
                type="number"
                min="1"
                value={request.mandate.maxEscrow}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    mandate: { ...request.mandate, maxEscrow: Number(e.target.value) },
                  })
                }
              />
            </label>
            <label>
              Risk
              <select
                value={request.mandate.riskTolerance}
                onChange={(e) =>
                  setRequest({
                    ...request,
                    mandate: {
                      ...request.mandate,
                      riskTolerance: e.target.value as GoatDecisionRequest["mandate"]["riskTolerance"],
                    },
                  })
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          {error ? <p className="goat-error">{error}</p> : null}
          <button type="submit" className="primary-action" disabled={busy}>
            {busy ? "Requesting x402 action..." : "Generate paid decision"}
          </button>
        </form>

        <motion.aside layout className="panel goat-result">
          <ResultHeader decision={decision} stage={stage} />
          {decision ? (
            <>
              {payment ? (
                <div className="goat-success-strip">
                  <span>payment settled</span>
                  <strong>{payment.transaction ? short(payment.transaction) : "x402 accepted"}</strong>
                  <p>
                    Paid agent action unlocked, decision generated, and commitment payload is ready.
                  </p>
                </div>
              ) : null}
              <div className="goat-result-grid">
                <article>
                  <span>bid</span>
                  <strong>{decision.bidAmount ? `${decision.bidAmount} USDC` : "skip"}</strong>
                </article>
                <article>
                  <span>confidence</span>
                  <strong>{Math.round(decision.confidence * 100)}%</strong>
                </article>
              </div>
              <p>{decision.reasoningSummary}</p>
              <dl>
                <div>
                  <dt>commitment</dt>
                  <dd>{decision.commitmentPayload.commitmentHash}</dd>
                </div>
                <div>
                  <dt>salt</dt>
                  <dd>{decision.commitmentPayload.salt}</dd>
                </div>
              </dl>
              <ul>
                {decision.riskNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <button
                type="button"
                className="primary-action"
                disabled={!preparedEntry}
                onClick={useDecision}
              >
                Use in sealed commitment
              </button>
            </>
          ) : paymentRequirement ? (
            <PaymentCheckpoint
              requirement={paymentRequirement}
              status={status}
              paidRelayAvailable={paidRelayAvailable}
            />
          ) : (
            <LaunchState status={status} paidRelayAvailable={paidRelayAvailable} busy={busy} />
          )}
        </motion.aside>
      </section>
    </main>
  );
}

function ResultHeader({
  decision,
  stage,
}: {
  decision: GoatDecision | null;
  stage: "idle" | "checking" | "payment_required" | "signing" | "settled";
}) {
  const title = decision
    ? decision.recommendedAction
    : stage === "payment_required"
      ? "Payment checkpoint armed"
      : stage === "signing"
        ? "Signing x402 payment"
        : "Ready for paid decision";
  return (
    <div>
      <p className="eyebrow">Agent output</p>
      <h2>{title}</h2>
    </div>
  );
}

function LaunchState({
  status,
  paidRelayAvailable,
  busy,
}: {
  status: GoatStatus | null;
  paidRelayAvailable: boolean;
  busy: boolean;
}) {
  return (
    <div className="goat-empty-state">
      <div className="goat-steps" aria-label="GOAT paid decision progress">
        <Step done label="Backend online" value={status ? status.x402.network : "checking"} />
        <Step done={paidRelayAvailable} label="Paid relay" value={paidRelayAvailable ? "funded" : "not configured"} />
        <Step done={busy} label="x402 request" value={busy ? "running" : "ready"} />
      </div>
      <p>
        Press generate to trigger the paid GOAT relay. The backend pays the same x402-protected
        agent endpoint with a funded Stellar testnet payer, then returns the transaction and
        prepared sealed-bid commitment here.
      </p>
    </div>
  );
}

function PaymentCheckpoint({
  requirement,
  status,
  paidRelayAvailable,
}: {
  requirement: GoatPaymentRequirement;
  status: GoatStatus | null;
  paidRelayAvailable: boolean;
}) {
  const api = GOAT_AGENT_API_URL.replace(/\/$/, "");
  return (
    <div className="goat-payment-card">
      <div className="goat-payment-pulse">
        <span />
        <strong>402</strong>
      </div>
      <div>
        <p className="eyebrow">x402 is enforcing payment</p>
        <h3>{requirement.price || status?.x402.priceUsdc || "0.10"} USDC to unlock the agent</h3>
        <p>
          The backend is reachable and refused the unpaid call. That is the real payment boundary,
          not a UI mock.
        </p>
      </div>
      <dl>
        <div>
          <dt>receiver</dt>
          <dd>{requirement.receiverAddress}</dd>
        </div>
        <div>
          <dt>network</dt>
          <dd>{requirement.network}</dd>
        </div>
        <div>
          <dt>endpoint</dt>
          <dd>{api}/goat/agent-decision</dd>
        </div>
      </dl>
      <div className="goat-terminal">
        {paidRelayAvailable
          ? "Paid relay is configured. Click Generate again to settle the protected x402 route server-side."
          : "Configure GOAT_DEMO_PAYER_SECRET on the backend to enable one-click paid decisions."}
      </div>
    </div>
  );
}

function Step({ done, label, value }: { done: boolean; label: string; value: string }) {
  return (
    <article className={done ? "done" : ""}>
      <span>{done ? "ready" : "pending"}</span>
      <strong>{label}</strong>
      <small>{value}</small>
    </article>
  );
}

function short(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}
