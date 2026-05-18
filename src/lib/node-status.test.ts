import { describe, expect, it } from "vitest";
import {
  getSampleNodeStatus,
  SYNCING_BLOCK_GAP_THRESHOLD
} from "./node-status";
import type { NodeSample } from "./types";

describe("getSampleNodeStatus", () => {
  it("marks an online sample as syncing when the block gap reaches the threshold", () => {
    expect(
      getSampleNodeStatus(
        sample({
          isOnline: true,
          blockHeight: 1000,
          finalizedBlockHeight: 1000 - SYNCING_BLOCK_GAP_THRESHOLD
        })
      )
    ).toBe("syncing");
  });

  it("keeps an online sample online when the block gap is below the threshold", () => {
    expect(
      getSampleNodeStatus(
        sample({
          isOnline: true,
          blockHeight: 1000,
          finalizedBlockHeight: 1000 - SYNCING_BLOCK_GAP_THRESHOLD + 1
        })
      )
    ).toBe("online");
  });

  it("marks an offline sample as offline", () => {
    expect(getSampleNodeStatus(sample({ isOnline: false }))).toBe("offline");
  });

  it("keeps an online sample online when block data is incomplete", () => {
    expect(
      getSampleNodeStatus(
        sample({
          isOnline: true,
          blockHeight: 1000,
          finalizedBlockHeight: null
        })
      )
    ).toBe("online");
  });
});

function sample(options: {
  isOnline: boolean;
  blockHeight?: number | null;
  finalizedBlockHeight?: number | null;
}): NodeSample {
  return {
    id: 1,
    nodeId: 1,
    checkedAt: new Date("2026-05-18T00:00:00.000Z"),
    isOnline: options.isOnline,
    matchedTelemetryNames: [],
    startupTime: null,
    nodeUptimeSeconds: null,
    blockHeight: options.blockHeight ?? null,
    finalizedBlockHeight: options.finalizedBlockHeight ?? null,
    location: null,
    latitude: null,
    longitude: null,
    coordinateSource: null,
    version: null
  };
}
