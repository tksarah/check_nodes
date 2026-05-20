import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getNodeStatusLabel, getSampleNodeStatus } from "@/lib/node-status";
import {
  getMonitoredNodes,
  getSampleCountForNode,
  getSamplePageForNode,
  getSamplesForNodeSince
} from "@/lib/repository";
import { getTrendSince, parseTrendRange, TREND_RANGES, TrendRange } from "@/lib/range";
import {
  DEFAULT_SAMPLE_PAGE_SIZE,
  getSamplePagination,
  getSingleQueryValue,
  SAMPLE_PAGE_SIZES
} from "@/lib/samples-pagination";
import { NodeSample } from "@/lib/types";
import { getTrendDisplayBars, type TrendDisplayBar } from "@/lib/trend-bars";

export const dynamic = "force-dynamic";

type NodeDetailSearchParams = {
  range?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
};

type NodeDetailQueryState = {
  range?: string;
  page?: string;
  pageSize?: string;
};

export default async function NodeDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<NodeDetailSearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const currentQuery = normalizeNodeDetailQuery(query);
  const nodeId = Number(id);
  const range = parseTrendRange(currentQuery.range);
  const since = getTrendSince(range);
  const nodes = await getMonitoredNodes(true);
  const nodeIndex = nodes.findIndex((candidate) => candidate.id === nodeId);
  const node = nodeIndex >= 0 ? nodes[nodeIndex] : undefined;

  if (!node) {
    notFound();
  }

  const previousNode = nodeIndex > 0 ? nodes[nodeIndex - 1] : null;
  const nextNode = nodeIndex < nodes.length - 1 ? nodes[nodeIndex + 1] : null;

  const [sampleCount, trendSamples] = await Promise.all([
    getSampleCountForNode(nodeId),
    getSamplesForNodeSince(nodeId, since)
  ]);
  const samplePagination = getSamplePagination(
    sampleCount,
    currentQuery.page,
    currentQuery.pageSize
  );
  const samples = await getSamplePageForNode(
    nodeId,
    samplePagination.pageSize,
    samplePagination.offset
  );

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

      {previousNode || nextNode ? (
        <nav className="detail-node-nav" aria-label="Adjacent nodes">
          {previousNode ? (
            <Link className="button" href={buildNodeDetailHref(previousNode.id, currentQuery)}>
              <ArrowLeft size={16} />
              Prev: {previousNode.label}
            </Link>
          ) : null}
          {nextNode ? (
            <Link className="button" href={buildNodeDetailHref(nextNode.id, currentQuery)}>
              Next: {nextNode.label}
              <ArrowRight size={16} />
            </Link>
          ) : null}
        </nav>
      ) : null}

      <OnlineTrend
        nodeId={nodeId}
        query={currentQuery}
        range={range}
        samples={trendSamples}
      />

      <section className="panel">
        <div className="panel-header samples-header">
          <div>
            <h2>Samples</h2>
            <p className="muted samples-summary">
              {samplePagination.totalCount === 0
                ? "No samples recorded for this node yet."
                : `Showing ${samplePagination.startItem}-${samplePagination.endItem} of ${samplePagination.totalCount} samples`}
            </p>
          </div>
          <div className="samples-toolbar">
            <div className="samples-page-size-picker">
              <span className="muted">Per page</span>
              <div className="segmented segmented-compact" aria-label="Samples per page">
                {SAMPLE_PAGE_SIZES.map((size) => (
                  <Link
                    key={size}
                    className={size === samplePagination.pageSize ? "active" : ""}
                    scroll={false}
                    href={buildNodeDetailHref(nodeId, currentQuery, {
                      page: 1,
                      pageSize: size
                    })}
                  >
                    {size}
                  </Link>
                ))}
              </div>
            </div>
            {samplePagination.totalPages > 1 ? (
              <div className="samples-pagination" aria-label="Samples pagination">
                {samplePagination.hasPreviousPage ? (
                  <Link
                    className="button"
                    scroll={false}
                    href={buildNodeDetailHref(nodeId, currentQuery, {
                      page: samplePagination.page - 1,
                      pageSize: samplePagination.pageSize
                    })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="button is-disabled" aria-disabled="true">
                    Previous
                  </span>
                )}
                <span className="samples-page-indicator">
                  Page {samplePagination.page} / {samplePagination.totalPages}
                </span>
                {samplePagination.hasNextPage ? (
                  <Link
                    className="button"
                    scroll={false}
                    href={buildNodeDetailHref(nodeId, currentQuery, {
                      page: samplePagination.page + 1,
                      pageSize: samplePagination.pageSize
                    })}
                  >
                    Next
                  </Link>
                ) : (
                  <span className="button is-disabled" aria-disabled="true">
                    Next
                  </span>
                )}
              </div>
            ) : null}
          </div>
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
              {samples.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No samples recorded for this node yet.
                  </td>
                </tr>
              ) : (
                samples.map((sample) => {
                  const status = getSampleNodeStatus(sample);

                  return (
                    <tr key={sample.id}>
                      <td>{formatDateTime(sample.checkedAt)}</td>
                      <td>
                        <span className="status">
                          <span className={`dot ${status}`} />
                          {getNodeStatusLabel(status)}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function OnlineTrend({
  nodeId,
  query,
  range,
  samples
}: {
  nodeId: number;
  query: NodeDetailQueryState;
  range: TrendRange;
  samples: NodeSample[];
}) {
  const displayBars = getTrendDisplayBars(samples, range);
  const sampleSummary = displayBars.length === samples.length
    ? `${samples.length} samples`
    : `${displayBars.length} bars from ${samples.length} samples`;

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
              href={buildNodeDetailHref(nodeId, query, { range: item.value })}
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
              style={{ gridTemplateColumns: `repeat(${displayBars.length}, minmax(0, 1fr))` }}
            >
              {displayBars.map((bar) => (
                <span
                  key={bar.id}
                  className={bar.status}
                  title={getTrendBarTitle(bar)}
                />
              ))}
            </div>
          </div>
          <div className="trend-legend">
            <span><i className="legend-online" /> Online</span>
            <span><i className="legend-syncing" /> Syncing</span>
            <span><i className="legend-offline" /> Offline</span>
            <span>{sampleSummary}</span>
          </div>
        </>
      )}
    </section>
  );
}

function getTrendBarTitle(bar: TrendDisplayBar) {
  if (bar.isAggregated) {
    return [
      `${formatDateTime(bar.start)} - ${formatDateTime(bar.end)}`,
      getNodeStatusLabel(bar.status),
      `${bar.sampleCount} samples`
    ].join(" / ");
  }

  return [
    formatDateTime(bar.start),
    getNodeStatusLabel(bar.status),
    bar.matchedTelemetryNames.length
      ? `Matched: ${bar.matchedTelemetryNames.join(", ")}`
      : "No matched telemetry"
  ].join(" / ");
}

function normalizeNodeDetailQuery(query?: NodeDetailSearchParams): NodeDetailQueryState {
  return {
    range: getSingleQueryValue(query?.range),
    page: getSingleQueryValue(query?.page),
    pageSize: getSingleQueryValue(query?.pageSize)
  };
}

function buildNodeDetailHref(
  nodeId: number,
  query: NodeDetailQueryState,
  updates: Partial<Record<keyof NodeDetailQueryState, string | number | null>> = {}
) {
  const range = updates.range === null
    ? undefined
    : String(updates.range ?? query.range ?? "");
  const page = updates.page === null
    ? undefined
    : String(updates.page ?? query.page ?? "");
  const pageSize = updates.pageSize === null
    ? undefined
    : String(updates.pageSize ?? query.pageSize ?? "");
  const params = new URLSearchParams();

  if (range) {
    params.set("range", range);
  }

  if (page && page !== "1") {
    params.set("page", page);
  }

  if (pageSize && pageSize !== String(DEFAULT_SAMPLE_PAGE_SIZE)) {
    params.set("pageSize", pageSize);
  }

  const search = params.toString();
  return search ? `/nodes/${nodeId}?${search}` : `/nodes/${nodeId}`;
}
