import { describe, expect, it } from "vitest";
import { mergeLatestSampleWithLastKnownLocation, summarizeAvailability } from "./repository";
import { NodeSample } from "./types";

describe("summarizeAvailability", () => {
  it("returns no percentage until there are at least two samples", () => {
    const summary = summarizeAvailability([
      { checkedAt: new Date("2026-05-16T00:00:00.000Z"), isOnline: true }
    ]);

    expect(summary).toEqual({
      onlineHours: 0,
      totalObservedHours: 0,
      availabilityPercent: null
    });
  });

  it("counts an interval as online when either side is online", () => {
    const summary = summarizeAvailability(
      [
        { checkedAt: new Date("2026-05-16T00:00:00.000Z"), isOnline: false },
        { checkedAt: new Date("2026-05-16T01:00:00.000Z"), isOnline: true },
        { checkedAt: new Date("2026-05-16T02:00:00.000Z"), isOnline: false }
      ],
      new Date("2026-05-16T02:00:00.000Z")
    );

    expect(summary.onlineHours).toBe(2);
    expect(summary.totalObservedHours).toBe(2);
    expect(summary.availabilityPercent).toBe(100);
  });

  it("adds trailing observed time using the latest sample state", () => {
    const summary = summarizeAvailability(
      [
        { checkedAt: new Date("2026-05-16T00:00:00.000Z"), isOnline: true },
        { checkedAt: new Date("2026-05-16T01:00:00.000Z"), isOnline: false }
      ],
      new Date("2026-05-16T03:00:00.000Z")
    );

    expect(summary.onlineHours).toBe(1);
    expect(summary.totalObservedHours).toBe(3);
    expect(summary.availabilityPercent).toBeCloseTo(33.333, 2);
  });
});

describe("mergeLatestSampleWithLastKnownLocation", () => {
  it("keeps an offline node on the map using its last known coordinates", () => {
    const latestSample = sample({
      checkedAt: new Date("2026-05-16T02:00:00.000Z"),
      isOnline: false,
      location: null,
      latitude: null,
      longitude: null
    });
    const lastKnownLocationSample = sample({
      checkedAt: new Date("2026-05-16T01:00:00.000Z"),
      isOnline: true,
      location: "Tokyo",
      latitude: 35.68,
      longitude: 139.76
    });

    expect(
      mergeLatestSampleWithLastKnownLocation(latestSample, lastKnownLocationSample)
    ).toMatchObject({
      checkedAt: latestSample.checkedAt,
      isOnline: false,
      location: "Tokyo",
      latitude: 35.68,
      longitude: 139.76,
      coordinateSource: "lastKnown"
    });
  });

  it("does not replace fresh coordinates", () => {
    const latestSample = sample({
      location: "Osaka",
      latitude: 34.69,
      longitude: 135.5
    });
    const lastKnownLocationSample = sample({
      location: "Tokyo",
      latitude: 35.68,
      longitude: 139.76
    });

    expect(
      mergeLatestSampleWithLastKnownLocation(latestSample, lastKnownLocationSample)
    ).toMatchObject({
      location: "Osaka",
      latitude: 34.69,
      longitude: 135.5,
      coordinateSource: "telemetry"
    });
  });

  it("uses city coordinates from location when no stored coordinates exist", () => {
    const latestSample = sample({
      isOnline: true,
      location: "Singapore",
      latitude: null,
      longitude: null,
      coordinateSource: null
    });

    expect(
      mergeLatestSampleWithLastKnownLocation(latestSample, null)
    ).toMatchObject({
      location: "Singapore",
      latitude: 1.3521,
      longitude: 103.8198,
      coordinateSource: "location"
    });
  });
});

function sample(overrides: Partial<NodeSample> = {}): NodeSample {
  return {
    id: 1,
    nodeId: 1,
    checkedAt: new Date("2026-05-16T00:00:00.000Z"),
    isOnline: true,
    matchedTelemetryNames: ["astar-archive"],
    startupTime: null,
    nodeUptimeSeconds: null,
    blockHeight: null,
    finalizedBlockHeight: null,
    location: null,
    latitude: null,
    longitude: null,
    coordinateSource: "telemetry",
    version: null,
    ...overrides
  };
}
