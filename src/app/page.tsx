import { Settings } from "lucide-react";
import Link from "next/link";
import { getDashboardData } from "@/lib/repository";
import {
  averageAvailability,
  formatDateTime,
  formatDuration,
  formatHours,
  formatPercent
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { nodes, lastCheckRun, checkIntervalMinutes } = await getDashboardData();
  const enabledNodes = nodes.filter((node) => node.enabled);
  const onlineNodes = enabledNodes.filter((node) => node.latestSample?.isOnline);
  const offlineNodes = enabledNodes.length - onlineNodes.length;
  const weeklyAverage = averageAvailability(enabledNodes.map((node) => node.weekly));
  const monthlyAverage = averageAvailability(enabledNodes.map((node) => node.monthly));
  const checkStatusLabel =
    lastCheckRun?.status === "error"
      ? "Check error"
      : offlineNodes > 0
        ? `${offlineNodes} node${offlineNodes === 1 ? "" : "s"} need attention`
        : "All monitored nodes online";
  const checkStatusTone = lastCheckRun?.status === "error" ? "error" : offlineNodes > 0 ? "warning" : "healthy";

  return (
    <main className="shell">
      <header className="topbar topbar-operations">
        <div className="topbar-main">
          <div className="brand brand-compact">
            <img
              className="brand-symbol"
              src="/brand/astar-symbol-color.png"
              alt="Astar"
            />
            <div>
              <p className="eyebrow">Astar Network</p>
              <h1>Peers Program Dashboard</h1>
              <p className="muted topbar-subtitle">
                Archive node uptime and telemetry status at a glance.
              </p>
            </div>
          </div>
          <nav className="nav topbar-actions">
            <Link className="button topbar-button" href="/admin">
              <Settings size={16} />
              Admin
            </Link>
          </nav>
        </div>

        <div className="topbar-strip" aria-label="Dashboard overview">
          <div className="topbar-chips">
            <StripChip label="Monitored nodes" value={enabledNodes.length} />
            <StripChip label="Online now" value={`${onlineNodes.length}/${enabledNodes.length}`} />
            <StripChip label="Offline now" value={offlineNodes} />
            <StripChip label="Interval" value={`${checkIntervalMinutes}m`} />
            <StripChip
              label="Last checked"
              value={formatDateTime(lastCheckRun?.checked_at) ?? "Not yet run"}
            />
            <StripChip label="Weekly avg" value={formatPercent(weeklyAverage)} />
            <StripChip label="Monthly avg" value={formatPercent(monthlyAverage)} />
            <p className={`signal-pill ${checkStatusTone}`}>{checkStatusLabel}</p>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Node status</h2>
            <p className="muted">
              Last check: {formatDateTime(lastCheckRun?.checked_at)}
              {lastCheckRun?.status === "error" ? ` / ${lastCheckRun.error_message}` : ""}
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Label</th>
                <th>Matched telemetry</th>
                <th>Location</th>
                <th>Block</th>
                <th>Finalized Block</th>
                <th>Node Uptime</th>
                <th>Weekly</th>
                <th>Monthly</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <span className="status">
                      <span
                        className={`dot ${node.latestSample?.isOnline ? "online" : ""}`}
                        aria-hidden="true"
                      />
                      {node.latestSample?.isOnline ? "Online" : "Offline"}
                    </span>
                    <p className="muted">
                      <Link href={`/nodes/${node.id}`}>Detail</Link>
                      {!node.enabled ? " / Disabled" : ""}
                    </p>
                  </td>
                  <td>
                    <strong>{node.label}</strong>
                    {!node.enabled ? <p className="muted">Disabled</p> : null}
                  </td>
                  <td>
                    {node.latestSample?.matchedTelemetryNames.length
                      ? node.latestSample.matchedTelemetryNames.join(", ")
                      : "-"}
                  </td>
                  <td>{node.latestSample?.location ?? "-"}</td>
                  <td>{node.latestSample?.blockHeight ?? "-"}</td>
                  <td>{node.latestSample?.finalizedBlockHeight ?? "-"}</td>
                  <td>{formatDuration(node.latestSample?.nodeUptimeSeconds)}</td>
                  <td>
                    {formatPercent(node.weekly.availabilityPercent)}
                    <p className="muted">{formatHours(node.weekly.onlineHours)} online</p>
                  </td>
                  <td>
                    {formatPercent(node.monthly.availabilityPercent)}
                    <p className="muted">{formatHours(node.monthly.onlineHours)} online</p>
                  </td>
                </tr>
              ))}
              {nodes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No nodes registered yet. Open Admin to add node name patterns.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function StripChip({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="strip-chip">
      <span className="strip-chip-label">{label}</span>
      <strong className="strip-chip-value">{value}</strong>
    </div>
  );
}
