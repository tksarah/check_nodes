import { Activity, Gauge, Server, Settings, Timer, TrendingUp } from "lucide-react";
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
  const weeklyAverage = averageAvailability(enabledNodes.map((node) => node.weekly));
  const monthlyAverage = averageAvailability(enabledNodes.map((node) => node.monthly));

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/brand/astar-color-white.png"
            alt="Astar"
          />
          <div>
            <p className="eyebrow">Astar Network</p>
            <h1>Archive Node Monitor</h1>
          </div>
        </div>
        <nav className="nav">
          <Link className="button" href="/admin">
            <Settings size={16} />
            Admin
          </Link>
        </nav>
      </header>

      <section className="grid summary-grid">
        <Metric icon={<Server size={18} />} label="Monitored nodes" value={enabledNodes.length} />
        <Metric icon={<Activity size={18} />} label="Online now" value={`${onlineNodes.length}/${enabledNodes.length}`} />
        <Metric icon={<Timer size={18} />} label="Check interval" value={`${checkIntervalMinutes}m`} />
        <Metric icon={<TrendingUp size={18} />} label="Weekly avg" value={formatPercent(weeklyAverage)} />
        <Metric icon={<Gauge size={18} />} label="Monthly avg" value={formatPercent(monthlyAverage)} />
      </section>

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

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="metric-label">
        {icon} {label}
      </div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
