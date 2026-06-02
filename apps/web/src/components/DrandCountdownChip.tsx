import { formatCountdown, useDrandCountdown } from "../hooks/useDrandCountdown";

export function DrandCountdownChip({ targetRound }: { targetRound: number }) {
  const drand = useDrandCountdown(targetRound);

  if (drand.loading) {
    return (
      <div className="round-chip drand-chip" title="Drand quicknet countdown">
        <span className="drand-label">Drand</span>
        <strong>R {targetRound.toLocaleString()}</strong>
        <small>syncing…</small>
      </div>
    );
  }

  if (drand.error) {
    return (
      <div className="round-chip drand-chip warn" title={drand.error}>
        <span className="drand-label">Drand</span>
        <strong>R {targetRound.toLocaleString()}</strong>
        <small>offline</small>
      </div>
    );
  }

  return (
    <div
      className={`round-chip drand-chip ${drand.published ? "published" : "waiting"}`}
      title={
        drand.published
          ? `Round R=${targetRound} is published on quicknet`
          : `Estimated ${formatCountdown(drand.secondsRemaining)} until R=${targetRound}`
      }
    >
      <span className="drand-label">Drand</span>
      <strong>R {targetRound.toLocaleString()}</strong>
      <small>
        {drand.published
          ? `live · now ${drand.currentRound?.toLocaleString() ?? "—"}`
          : formatCountdown(drand.secondsRemaining)}
      </small>
    </div>
  );
}
