import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { formatDateTime, formatDuration } from "@/lib/format";
import {
  getMonitoredNodes,
  getSamplesForNode,
  getSamplesForNodeSince
} from "@/lib/repository";
import { getTrendSince, parseTrendRange, TREND_RANGES, TrendRange } from "@/lib/range";
import { NodeSample } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NodeDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ range?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const nodeId = Number(id);
  const range = parseTrendRange(query?.range);
  const since = getTrendSince(range);
  const nodes = await getMonitoredNodes(true);
  const node = nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    notFound();
  }

  const [samples, trendSamples] = await Promise.all([
    getSamplesForNode(nodeId, 120),
    getSamplesForNodeSince(nodeId, since)
  ]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Node detail</p>
          <h1>{node.label}</h1>
          <p className="muted">Pattern: {node.namePattern}</p>
        </div>
        <Link className="button" href="/">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </header>

      <OnlineTrend
        nodeId={nodeId}
        range={range}
        samples={trendSamples}
      />

      <section className="panel">
        <div className="panel-header">
          <h2>Samples</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Checked at</th>
                <th>Status</th>
                <th>Matched telemetry</th>
                <th>Location</th>
                <th>Node Uptime</th>
                <th>Block</th>
                <th>Finalized Block</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.id}>
                  <td>{formatDateTime(sample.checkedAt)}</td>
                  <td>
                    <span className="status">
                      <span className={`dot ${sample.isOnline ? "online" : ""}`} />
                      {sample.isOnline ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td>
                    {sample.matchedTelemetryNames.length
                      ? sample.matchedTelemetryNames.join(", ")
                      : "-"}
                  </td>
                  <td>{sample.location ?? "-"}</td>
                  <td>{formatDuration(sample.nodeUptimeSeconds)}</td>
                  <td>{sample.blockHeight ?? "-"}</td>
                  <td>{sample.finalizedBlockHeight ?? "-"}</td>
                  <td>{sample.version ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function OnlineTrend({
  nodeId,
  range,
  samples
}: {
  nodeId: number;
  range: TrendRange;
  samples: NodeSample[];
}) {
  return (
    <section className="card trend-card">
      <div className="trend-header">
        <div>
          <h2>Online trend</h2>
          <p className="muted">Sample-by-sample online history for this node.</p>
        </div>
        <div className="segmented" aria-label="Trend range">
          {TREND_RANGES.map((item) => (
            <Link
              key={item.value}
              className={item.value === range ? "active" : ""}
              href={`/nodes/${nodeId}?range=${item.value}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {samples.length === 0 ? (
        <div className="empty-trend">No samples in this range.</div>
      ) : (
        <>
          <div className="trend-scroll" aria-label={`${range} online trend`}>
            <div
              className="trend-bars"
              style={{ gridTemplateColumns: `repeat(${samples.length}, minmax(10px, 1fr))` }}
            >
              {samples.map((sample) => (
                <span
                  key={sample.id}
                  className={sample.isOnline ? "online" : "offline"}
                  title={[
                    formatDateTime(sample.checkedAt),
                    sample.isOnline ? "Online" : "Offline",
                    sample.matchedTelemetryNames.length
                      ? `Matched: ${sample.matchedTelemetryNames.join(", ")}`
                      : "No matched telemetry"
                  ].join(" / ")}
                />
              ))}
            </div>
          </div>
          <div className="trend-legend">
            <span><i className="legend-online" /> Online</span>
            <span><i className="legend-offline" /> Offline</span>
            <span>{samples.length} samples</span>
          </div>
        </>
      )}
    </section>
  );
}
