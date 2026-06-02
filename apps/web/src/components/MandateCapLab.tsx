import { useState } from "react";
import { CAP_SAFETY_COPY } from "../demo/trace";
import type { CapDemoResult } from "../lib/demoTypes";

export function MandateCapLab() {
  const [results, setResults] = useState<CapDemoResult[] | null>(null);

  async function run() {
    const { runCapSafetyDemos } = await import("../lib/demoActions");
    setResults(runCapSafetyDemos());
  }

  return (
    <section className="panel cap-panel">
      <header className="panel-head">
        <h2>Mandate & cap safety lab</h2>
        <p>Honest wording: what is enforced where.</p>
      </header>

      <div className="cap-copy">
        <article>
          <h3>{CAP_SAFETY_COPY.mandateTitle}</h3>
          <p>{CAP_SAFETY_COPY.mandateBody}</p>
        </article>
        <article>
          <h3>{CAP_SAFETY_COPY.onChainTitle}</h3>
          <p>{CAP_SAFETY_COPY.onChainBody}</p>
        </article>
        <aside className="callout">
          <strong>Important:</strong> {CAP_SAFETY_COPY.notOnChain}
        </aside>
      </div>

      <button type="button" className="btn" onClick={run}>
        Run negative cap scenarios
      </button>

      {results && (
        <table className="table cap-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Layer</th>
              <th>Expected</th>
              <th>Outcome</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className={r.pass ? "pass" : "fail"}>
                <td>{r.title}</td>
                <td><code>{r.layer}</code></td>
                <td>{r.expected}</td>
                <td className="muted">{r.outcome}</td>
                <td>{r.pass ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
