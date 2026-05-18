import { NodeSummary } from "./types";

export const DASHBOARD_SORT_COLUMNS = ["status", "uptime", "weekly", "monthly"] as const;
export const DASHBOARD_SORT_DIRECTIONS = ["asc", "desc"] as const;

export type DashboardSortColumn = (typeof DASHBOARD_SORT_COLUMNS)[number];
export type DashboardSortDirection = (typeof DASHBOARD_SORT_DIRECTIONS)[number];

export type DashboardSortState = {
  column: DashboardSortColumn;
  direction: DashboardSortDirection;
};

export function parseDashboardSort(
  sort?: string | string[],
  dir?: string | string[]
): DashboardSortState | null {
  const column = normalizeColumn(sort);
  const direction = normalizeDirection(dir);

  if (!column || !direction) {
    return null;
  }

  return { column, direction };
}

export function sortDashboardNodes(nodes: NodeSummary[], sort: DashboardSortState | null) {
  if (!sort) {
    return nodes;
  }

  return [...nodes].sort((left, right) => compareNodes(left, right, sort));
}

export function getNextDashboardSort(
  current: DashboardSortState | null,
  column: DashboardSortColumn
): DashboardSortState {
  if (current?.column === column) {
    return {
      column,
      direction: current.direction === "desc" ? "asc" : "desc"
    };
  }

  return { column, direction: "desc" };
}

function normalizeColumn(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;

  return DASHBOARD_SORT_COLUMNS.includes(candidate as DashboardSortColumn)
    ? (candidate as DashboardSortColumn)
    : null;
}

function normalizeDirection(value?: string | string[]) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;

  return DASHBOARD_SORT_DIRECTIONS.includes(candidate as DashboardSortDirection)
    ? (candidate as DashboardSortDirection)
    : null;
}

function compareNodes(
  left: NodeSummary,
  right: NodeSummary,
  sort: DashboardSortState
) {
  const factor = sort.direction === "asc" ? 1 : -1;

  if (sort.column === "status") {
    return compareByRank(statusRank(left), statusRank(right), factor, left, right);
  }

  if (sort.column === "uptime") {
    return compareNullableNumber(
      left.latestSample?.nodeUptimeSeconds ?? null,
      right.latestSample?.nodeUptimeSeconds ?? null,
      factor,
      left,
      right
    );
  }

  if (sort.column === "weekly") {
    return compareNullableNumber(
      left.weekly.availabilityPercent,
      right.weekly.availabilityPercent,
      factor,
      left,
      right
    );
  }

  return compareNullableNumber(
    left.monthly.availabilityPercent,
    right.monthly.availabilityPercent,
    factor,
    left,
    right
  );
}

function statusRank(node: NodeSummary) {
  if (!node.enabled) return 1;
  if (node.latestSample?.isOnline === true) return 3;
  if (node.latestSample?.isOnline === false) return 2;
  return 0;
}

function compareByRank(
  left: number,
  right: number,
  factor: number,
  leftNode: NodeSummary,
  rightNode: NodeSummary
) {
  if (left !== right) {
    return (left - right) * factor;
  }

  return leftNode.label.localeCompare(rightNode.label, "en");
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
  factor: number,
  leftNode: NodeSummary,
  rightNode: NodeSummary
) {
  if (left == null && right == null) {
    return leftNode.label.localeCompare(rightNode.label, "en");
  }

  if (left == null) return 1;
  if (right == null) return -1;

  if (left !== right) {
    return (left - right) * factor;
  }

  return leftNode.label.localeCompare(rightNode.label, "en");
}