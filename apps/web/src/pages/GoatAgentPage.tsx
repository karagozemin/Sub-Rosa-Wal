import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchGoatStatus,
  requestGoatDecision,
  savePreparedGoatCommitment,
  type GoatDecision,
  type GoatDecisionRequest,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preparedEntry = useMemo(
    () => (decision ? decisionBidToDemoEntry(decision) : null),
    [decision],
  );

  useEffect(() => {
    fetchGoatStatus().then(setStatus).catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setDecision(await requestGoatDecision(request));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
          <div>
            <p className="eyebrow">Structured output</p>
            <h2>{decision ? decision.recommendedAction : "No decision yet"}</h2>
          </div>
          {decision ? (
            <>
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
          ) : (
            <p className="placeholder">
              The result will include a validated action, bid amount, salt, commitment hash, and
              GOAT mode disclosure.
            </p>
          )}
        </motion.aside>
      </section>
    </main>
  );
}
