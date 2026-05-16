import { describe, expect, it } from "vitest";
import { getTrendSince, parseTrendRange } from "./range";

describe("parseTrendRange", () => {
  it("accepts supported trend ranges", () => {
    expect(parseTrendRange("24h")).toBe("24h");
    expect(parseTrendRange("7d")).toBe("7d");
    expect(parseTrendRange("30d")).toBe("30d");
  });

  it("falls back to 24h for invalid or missing ranges", () => {
    expect(parseTrendRange("1y")).toBe("24h");
    expect(parseTrendRange(undefined)).toBe("24h");
    expect(parseTrendRange(["30d"])).toBe("30d");
  });
});

describe("getTrendSince", () => {
  const now = new Date("2026-05-17T00:00:00.000Z");

  it("calculates 24h boundaries", () => {
    expect(getTrendSince("24h", now).toISOString()).toBe(
      "2026-05-16T00:00:00.000Z"
    );
  });

  it("calculates 7d and 30d boundaries", () => {
    expect(getTrendSince("7d", now).toISOString()).toBe(
      "2026-05-10T00:00:00.000Z"
    );
    expect(getTrendSince("30d", now).toISOString()).toBe(
      "2026-04-17T00:00:00.000Z"
    );
  });
});
