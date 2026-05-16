import { describe, expect, it } from "vitest";
import { summarizeAvailability } from "./repository";

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
