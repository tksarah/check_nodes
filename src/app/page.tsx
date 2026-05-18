import { Settings } from "lucide-react";
import Link from "next/link";
import {
  getNextDashboardSort,
  parseDashboardSort,
  sortDashboardNodes,
  type DashboardSortColumn,
  type DashboardSortState
} from "@/lib/dashboard-sort";
import { projectEquirectangular } from "@/lib/map-projection";
import { getDashboardData } from "@/lib/repository";
import type { NodeSample, NodeSummary } from "@/lib/types";
import {
  averageAvailability,
  formatDateTime,
  formatDuration,
  formatHours,
  formatPercent
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ sort?: string | string[]; dir?: string | string[] }>;
}) {
  const params = await searchParams;
  const { nodes, lastCheckRun, checkIntervalMinutes } = await getDashboardData();
  const currentSort = parseDashboardSort(params?.sort, params?.dir);
  const sortedNodes = sortDashboardNodes(nodes, currentSort);
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

      <NodeWorldMap nodes={enabledNodes} />

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
                <SortableHeader label="Status" column="status" currentSort={currentSort} />
                <th>Label</th>
                <th>Matched telemetry</th>
                <th>Location</th>
                <th>Block</th>
                <th>Finalized Block</th>
                <SortableHeader label="Node Uptime" column="uptime" currentSort={currentSort} />
                <SortableHeader label="Weekly" column="weekly" currentSort={currentSort} />
                <SortableHeader label="Monthly" column="monthly" currentSort={currentSort} />
              </tr>
            </thead>
            <tbody>
              {sortedNodes.map((node) => (
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
              {sortedNodes.length === 0 ? (
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

function SortableHeader({
  label,
  column,
  currentSort
}: {
  label: string;
  column: DashboardSortColumn;
  currentSort: DashboardSortState | null;
}) {
  const nextSort = getNextDashboardSort(currentSort, column);
  const isActive = currentSort?.column === column;
  const direction = isActive ? currentSort.direction : null;

  return (
    <th scope="col" aria-sort={getAriaSort(direction)}>
      <Link
        className={`sort-link${isActive ? " active" : ""}`}
        href={{
          pathname: "/",
          query: {
            sort: nextSort.column,
            dir: nextSort.direction
          }
        }}
      >
        <span>{label}</span>
        <span className="sort-indicator" aria-hidden="true">
          {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
        </span>
      </Link>
    </th>
  );
}

function getAriaSort(direction: DashboardSortState["direction"] | null) {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

function NodeWorldMap({ nodes }: { nodes: NodeSummary[] }) {
  const mappedNodes = getMappedNodes(nodes);
  const pendingNodes = nodes.filter(
    (node) =>
      node.enabled &&
      (node.latestSample?.latitude == null || node.latestSample.longitude == null)
  );
  const onlineCount = mappedNodes.filter((node) => node.isOnline).length;
  const offlineCount = mappedNodes.length - onlineCount;

  return (
    <section className="panel map-panel" aria-labelledby="node-map-title">
      <div className="panel-header map-panel-header">
        <div>
          <h2 id="node-map-title">Node map</h2>
          <p className="muted">
            Last known location and current online status for monitored nodes.
          </p>
        </div>
        <div className="map-legend" aria-label="Map status legend">
          <span><i className="map-dot online" /> Online {onlineCount}</span>
          <span><i className="map-dot offline" /> Offline {offlineCount}</span>
          <span><i className="map-dot pending" /> Location pending {pendingNodes.length}</span>
        </div>
      </div>

      <div className="map-stage" role="group" aria-label="World map of monitored node locations">
        <img
          className="world-map"
          src="/maps/world-map-dark.png"
          alt=""
          aria-hidden="true"
        />

        {mappedNodes.map((node) => (
          <Link
            key={node.id}
            href={`/nodes/${node.id}`}
            className={`map-marker ${node.isOnline ? "online" : "offline"}`}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: `translate(-50%, -50%) translate(${node.offsetX}px, ${node.offsetY}px)`
            }}
            aria-label={`${node.label}: ${node.isOnline ? "Online" : "Offline"} at ${node.location}. Coordinates from ${node.coordinateSource}.`}
            title={`${node.label} / ${node.isOnline ? "Online" : "Offline"} / ${node.location} / ${node.coordinateSource}`}
          >
            <span className="map-marker-pulse" aria-hidden="true" />
          </Link>
        ))}

        {mappedNodes.length === 0 ? (
          <div className="map-empty">No node locations available yet.</div>
        ) : null}
      </div>

      {pendingNodes.length > 0 ? (
        <div className="map-pending">
          <span>Location pending</span>
          {pendingNodes.slice(0, 4).map((node) => (
            <Link key={node.id} href={`/nodes/${node.id}`}>{node.label}</Link>
          ))}
          {pendingNodes.length > 4 ? <span>+{pendingNodes.length - 4} more</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function getMappedNodes(nodes: NodeSummary[]) {
  const groups = new Map<string, number>();

  return nodes
    .filter(
      (node) =>
        node.enabled &&
        node.latestSample?.latitude != null &&
        node.latestSample.longitude != null
    )
    .map((node) => {
      const latitude = node.latestSample!.latitude!;
      const longitude = node.latestSample!.longitude!;
      const point = projectEquirectangular(latitude, longitude);
      const groupKey = `${latitude.toFixed(1)}:${longitude.toFixed(1)}`;
      const groupIndex = groups.get(groupKey) ?? 0;
      groups.set(groupKey, groupIndex + 1);
      const angle = groupIndex * 1.7;
      const radius = groupIndex === 0 ? 0 : 9 + groupIndex * 2;

      return {
        id: node.id,
        label: node.label,
        location: node.latestSample!.location ?? "Unknown location",
        coordinateSource: formatCoordinateSource(node.latestSample!.coordinateSource),
        isOnline: node.latestSample!.isOnline,
        x: point.x,
        y: point.y,
        offsetX: Math.cos(angle) * radius,
        offsetY: Math.sin(angle) * radius
      };
    });
}

function formatCoordinateSource(source: NodeSample["coordinateSource"]) {
  if (source === "lastKnown") return "Last known coordinates";
  if (source === "location") return "Location lookup";
  return "Telemetry coordinates";
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
