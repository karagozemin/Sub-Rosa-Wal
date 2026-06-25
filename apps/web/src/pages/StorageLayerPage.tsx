import { useMemo, useState } from "react";
import { LOGO_SRC } from "../lib/chain";
import {
  BOSPHOR_ADAPTER_ADDRESS,
  BOSPHOR_CHAIN_ID,
  BOSPHOR_DST_EID,
  BOSPHOR_LZ_OPTIONS,
  createCommitmentHash,
  encryptForDemo,
  getStorageConfigStatus,
} from "../lib/walrusStorage";

type PreparedReceipt = {
  roundId: string;
  submitter: string;
  contentHash: string;
  commitmentHash: string;
  storageProvider: "bosphor-walrus";
  bosphorAdapter: string;
  bosphorChainId: string;
  dstEid: string;
  lzOptions: string;
  timestamp: string;
  stellarProofStatus: "pending";
  encryptedPayloadPreview: string;
  revealKey: string;
};

export function StorageLayerPage({
  goHome,
  goDemo,
}: {
  goHome: () => void;
  goDemo: () => void;
}) {
  const config = useMemo(() => getStorageConfigStatus(), []);
  const [roundId, setRoundId] = useState("round-001");
  const [submitter, setSubmitter] = useState("GDEMO_SUBMITTER_7K2Q");
  const [title, setTitle] = useState("Confidential grant evidence packet");
  const [description, setDescription] = useState(
    "Judge notes, appraisal context, scoring JSON, and evidence metadata that should stay sealed until reveal.",
  );
  const [metadata, setMetadata] = useState('{"category":"grant-review","scoreSchema":"0-100"}');
  const [receipt, setReceipt] = useState<PreparedReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function prepareReceipt() {
    setWorking(true);
    setError(null);
    try {
      let parsedMetadata: unknown = null;
      if (metadata.trim()) parsedMetadata = JSON.parse(metadata);
      const sealed = await encryptForDemo({
        title: title.trim(),
        description: description.trim(),
        metadata: parsedMetadata,
      });
      const commitmentHash = await createCommitmentHash({
        roundId: roundId.trim(),
        submitter: submitter.trim(),
        contentHash: sealed.contentHash,
      });
      setReceipt({
        roundId: roundId.trim(),
        submitter: submitter.trim(),
        contentHash: sealed.contentHash,
        commitmentHash,
        storageProvider: "bosphor-walrus",
        bosphorAdapter: BOSPHOR_ADAPTER_ADDRESS,
        bosphorChainId: BOSPHOR_CHAIN_ID,
        dstEid: BOSPHOR_DST_EID,
        lzOptions: BOSPHOR_LZ_OPTIONS,
        timestamp: new Date().toISOString(),
        stellarProofStatus: "pending",
        encryptedPayloadPreview: JSON.stringify(sealed.encryptedPayload).slice(0, 220),
        revealKey: sealed.revealKey,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare sealed receipt.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="storage-page">
      <nav className="architecture-nav">
        <button type="button" className="brand-link" onClick={goHome}>
          <img src={LOGO_SRC} alt="" />
          <span>Sub Rosa</span>
        </button>
        <div className="architecture-nav-actions">
          <button type="button" className="secondary-action compact" onClick={goDemo}>
            Open demo
          </button>
          <button type="button" className="secondary-action compact" onClick={goHome}>
            Back home
          </button>
        </div>
      </nav>

      <section className="storage-hero">
        <div>
          <span className="hero-eyebrow">
            <span>SR</span>
            Bosphor → Walrus storage layer
          </span>
          <h1>
            Keep Sub Rosa settlement on Stellar. Store encrypted weight on Walrus.
          </h1>
          <p className="lede">
            This layer prepares sealed submissions for real Bosphor/Walrus storage while Stellar
            keeps the compact commitment, reveal, proof reference, and settlement state.
          </p>
        </div>
        <div className={`storage-config-card ${config.ok ? "ok" : "missing"}`}>
          <span>Storage route</span>
          <strong>{config.ok ? "Configured" : "Blocked"}</strong>
          <p>
            {config.ok
              ? `Sepolia ${BOSPHOR_CHAIN_ID} · dstEid ${BOSPHOR_DST_EID}`
              : `Missing ${config.missing.join(", ")}`}
          </p>
          <code>{BOSPHOR_ADAPTER_ADDRESS || "Bosphor adapter not configured"}</code>
        </div>
      </section>

      <section className="storage-flow">
        {[
          ["1", "Seal", "Canonicalize the Sub Rosa submission and encrypt it in the browser."],
          ["2", "Store", "Route the encrypted payload through Bosphor to Walrus."],
          ["3", "Prove", "Record only hashes and Bosphor/Walrus references on Stellar."],
          ["4", "Reveal", "Fetch the blob, recompute hashes, and settle through Soroban."],
        ].map(([index, titleText, copy]) => (
          <article key={index}>
            <span>{index}</span>
            <strong>{titleText}</strong>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="storage-grid">
        <form
          className="panel storage-form"
          onSubmit={(event) => {
            event.preventDefault();
            void prepareReceipt();
          }}
        >
          <header className="panel-head">
            <p className="eyebrow">Create sealed submission</p>
            <h2>Prepare Bosphor/Walrus receipt fields</h2>
            <p>
              This keeps the original Sub Rosa app flow intact. No fake Walrus blob id or fake
              Stellar tx id is generated here.
            </p>
          </header>

          <div className="storage-form-grid">
            <label className="field">
              <span>Round ID</span>
              <input value={roundId} onChange={(event) => setRoundId(event.target.value)} />
            </label>
            <label className="field">
              <span>Submitter</span>
              <input value={submitter} onChange={(event) => setSubmitter(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="field">
            <span>Optional JSON metadata</span>
            <textarea value={metadata} onChange={(event) => setMetadata(event.target.value)} />
          </label>

          {error ? <p className="storage-error">{error}</p> : null}

          <div className="storage-actions">
            <button type="submit" className="primary-action" disabled={working}>
              {working ? "Encrypting..." : "Prepare sealed receipt"}
            </button>
            <button type="button" className="secondary-action" disabled>
              Submit Bosphor intent requires EVM wallet
            </button>
          </div>
        </form>

        <aside className="panel storage-receipt">
          <header className="panel-head">
            <p className="eyebrow">Receipt preview</p>
            <h2>Proof fields only</h2>
            <p>Stellar stores compact references; encrypted full data belongs on Walrus.</p>
          </header>
          {receipt ? (
            <dl>
              {Object.entries(receipt).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>
                    <code>{String(value)}</code>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">
              Prepare a sealed receipt to see contentHash, commitmentHash, Bosphor route metadata,
              and Stellar proof status.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
