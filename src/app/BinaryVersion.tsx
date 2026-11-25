import { formatDateTime } from "../lib/format";
import type { BinaryVersionObservation } from "../lib/types";

export function BinaryVersion({ observation }: { observation: BinaryVersionObservation | null }) {
  if (!observation) return <span>-</span>;

  return (
    <span className="binary-version">
      {observation.version}
      {observation.isHistorical && (
        <small className="muted">Last seen: {formatDateTime(observation.checkedAt)}</small>
      )}
    </span>
  );
}
