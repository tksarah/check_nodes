import { describe, expect, it } from "vitest";
import {
  getNextDashboardSort,
  parseDashboardSort,
  sortDashboardNodes,
  type DashboardSortState
} from "./dashboard-sort";
import type { NodeSummary } from "./types";

describe("parseDashboardSort", () => {
  it("returns null for invalid values", () => {
    expect(parseDashboardSort("label", "desc")).toBeNull();
    expect(parseDashboardSort("weekly", "down")).toBeNull();
  });

  it("parses supported sort params", () => {
    expect(parseDashboardSort("weekly", "desc")).toEqual({
      column: "weekly",
      direction: "desc"
    });
  });
});

describe("getNextDashboardSort", () => {
  it("defaults a new column to descending", () => {
    expect(getNextDashboardSort(null, "monthly")).toEqual({
      column: "monthly",
      direction: "desc"
    });
  });

  it("toggles direction for the same column", () => {
    expect(
      getNextDashboardSort({ column: "status", direction: "desc" }, "status")
    ).toEqual({
      column: "status",
      direction: "asc"
    });
  });
});

describe("sortDashboardNodes", () => {
  it("keeps the original array when no sort is provided", () => {
    const nodes = [node({ id: 1, label: "Beta" }), node({ id: 2, label: "Alpha" })];

    expect(sortDashboardNodes(nodes, null)).toBe(nodes);
  });

  it("sorts status descending as online, offline, disabled, unknown", () => {
    const result = sort(nodes(), { column: "status", direction: "desc" });

    expect(result.map((item) => item.label)).toEqual([
      "Online node",
      "Offline node",
      "Disabled node",
      "Unknown node"
    ]);
  });

  it("sorts uptime descending by raw seconds", () => {
    const result = sort(
      [
        node({ id: 1, label: "Short", uptime: 30 }),
        node({ id: 2, label: "Long", uptime: 300 }),
        node({ id: 3, label: "Missing", uptime: null })
      ],
      { column: "uptime", direction: "desc" }
    );

    expect(result.map((item) => item.label)).toEqual(["Long", "Short", "Missing"]);
  });

  it("sorts weekly by percentage, not by online hours", () => {
    const result = sort(
      [
        node({ id: 1, label: "High percent", weeklyPercent: 99, weeklyHours: 1 }),
        node({ id: 2, label: "Low percent", weeklyPercent: 80, weeklyHours: 100 }),
        node({ id: 3, label: "Missing", weeklyPercent: null, weeklyHours: 10 })
      ],
      { column: "weekly", direction: "desc" }
    );

    expect(result.map((item) => item.label)).toEqual([
      "High percent",
      "Low percent",
      "Missing"
    ]);
  });

  it("sorts monthly by percentage and uses label as a stable tie breaker", () => {
    const result = sort(
      [
        node({ id: 1, label: "Zulu", monthlyPercent: 95 }),
        node({ id: 2, label: "Alpha", monthlyPercent: 95 }),
        node({ id: 3, label: "Missing", monthlyPercent: null })
      ],
      { column: "monthly", direction: "desc" }
    );

    expect(result.map((item) => item.label)).toEqual(["Alpha", "Zulu", "Missing"]);
  });
});

function sort(items: NodeSummary[], sortState: DashboardSortState) {
  return sortDashboardNodes(items, sortState);
}

function nodes() {
  return [
    node({ id: 1, label: "Unknown node", enabled: true, isOnline: null }),
    node({ id: 2, label: "Disabled node", enabled: false, isOnline: true }),
    node({ id: 3, label: "Offline node", enabled: true, isOnline: false }),
    node({ id: 4, label: "Online node", enabled: true, isOnline: true })
  ];
}

function node(options: {
  id: number;
  label: string;
  enabled?: boolean;
  isOnline?: boolean | null;
  uptime?: number | null;
  weeklyPercent?: number | null;
  weeklyHours?: number;
  monthlyPercent?: number | null;
}) : NodeSummary {
  const enabled = options.enabled ?? true;
  const isOnline = options.isOnline ?? false;

  return {
    id: options.id,
    label: options.label,
    namePattern: options.label.toLowerCase(),
    enabled,
    createdAt: new Date("2026-05-18T00:00:00.000Z"),
    updatedAt: new Date("2026-05-18T00:00:00.000Z"),
    latestSample:
      options.isOnline === null
        ? null
        : {
            id: options.id,
            nodeId: options.id,
            checkedAt: new Date("2026-05-18T00:00:00.000Z"),
            isOnline,
            matchedTelemetryNames: [],
            startupTime: null,
            nodeUptimeSeconds: options.uptime ?? null,
            blockHeight: null,
            finalizedBlockHeight: null,
            location: null,
            latitude: null,
            longitude: null,
            coordinateSource: null,
            version: null
          },
    weekly: {
      onlineHours: options.weeklyHours ?? 0,
      totalObservedHours: 168,
      availabilityPercent: options.weeklyPercent ?? null
    },
    monthly: {
      onlineHours: 0,
      totalObservedHours: 720,
      availabilityPercent: options.monthlyPercent ?? null
    }
  };
}