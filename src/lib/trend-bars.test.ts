import { describe, expect, it } from "vitest";
import { getTrendDisplayBars, TREND_BAR_LIMITS } from "./trend-bars";
import type { NodeSample } from "./types";

describe("getTrendDisplayBars", () => {
  it("keeps samples unchanged when they fit within the range limit", () => {
    const samples = [
      createSample(1, "2026-05-17T00:00:00.000Z", true),
      createSample(2, "2026-05-17T01:00:00.000Z", false)
    ];

    const bars = getTrendDisplayBars(samples, "24h");

    expect(bars).toHaveLength(samples.length);
    expect(bars[0]).toMatchObject({
      id: "1",
      status: "online",
      sampleCount: 1,
      isAggregated: false
    });
    expect(bars[1]).toMatchObject({
      id: "2",
      status: "offline",
      sampleCount: 1,
      isAggregated: false
    });
  });

  it("compresses samples to the configured range limit", () => {
    const samples = Array.from({ length: 140 }, (_, index) =>
      createSample(index + 1, `2026-05-17T${String(index % 24).padStart(2, "0")}:00:00.000Z`, true)
    );

    const bars = getTrendDisplayBars(samples, "7d");

    expect(bars).toHaveLength(TREND_BAR_LIMITS["7d"]);
    expect(bars.every((bar) => bar.isAggregated)).toBe(true);
    expect(bars.reduce((total, bar) => total + bar.sampleCount, 0)).toBe(samples.length);
  });

  it("prioritizes offline, then syncing, then online within aggregated groups", () => {
    const online = createSample(1, "2026-05-17T00:00:00.000Z", true);
    const syncing = createSample(2, "2026-05-17T01:00:00.000Z", true, {
      blockHeight: 2_000,
      finalizedBlockHeight: 1_000
    });
    const offline = createSample(3, "2026-05-17T02:00:00.000Z", false);

    expect(
      getTrendDisplayBars([...repeat(online, 47), syncing, offline], "24h").some(
        (bar) => bar.status === "offline"
      )
    ).toBe(true);
    expect(
      getTrendDisplayBars([...repeat(online, 48), syncing], "24h").some(
        (bar) => bar.status === "syncing"
      )
    ).toBe(true);
    expect(getTrendDisplayBars(repeat(online, 49), "24h")[0].status).toBe("online");
  });
});

function createSample(
  id: number,
  checkedAt: string,
  isOnline: boolean,
  overrides: Partial<NodeSample> = {}
): NodeSample {
  return {
    id,
    nodeId: 1,
    checkedAt: new Date(checkedAt),
    isOnline,
    matchedTelemetryNames: isOnline ? ["astar-node"] : [],
    startupTime: null,
    nodeUptimeSeconds: null,
    blockHeight: null,
    finalizedBlockHeight: null,
    location: null,
    latitude: null,
    longitude: null,
    coordinateSource: null,
    version: null,
    ...overrides
  };
}

function repeat(sample: NodeSample, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...sample,
    id: index + 1,
    checkedAt: new Date(sample.checkedAt.getTime() + index * 60 * 60 * 1000)
  }));
}
