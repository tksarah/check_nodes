import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  applyFeedMessages,
  deserializeFeedMessages,
  nodeNameMatches
} from "./telemetry";

const now = new Date("2026-05-16T12:00:00.000Z");

function addedNode(id: number, name: string, startupMs = now.getTime() - 3_600_000) {
  return {
    action: ACTIONS.AddedNode,
    payload: [
      id,
      [name, "Astar", "5.0.0", null, null, "linux", "x86_64", "gnu", undefined, {}],
      [12, 0],
      [[]],
      [[], [], []],
      [12345, "0xabc", 12000, now.getTime(), null],
      [35.68, 139.76, "Tokyo"],
      startupMs
    ]
  };
}

describe("telemetry feed parser", () => {
  it("deserializes squashed feed messages", () => {
    const messages = deserializeFeedMessages(
      JSON.stringify([ACTIONS.FeedVersion, 33, ACTIONS.SubscribedTo, "0xabc"])
    );

    expect(messages).toEqual([
      { action: ACTIONS.FeedVersion, payload: 33 },
      { action: ACTIONS.SubscribedTo, payload: "0xabc" }
    ]);
  });

  it("rejects invalid payload shapes", () => {
    expect(() => deserializeFeedMessages(JSON.stringify([ACTIONS.FeedVersion]))).toThrow(
      "Invalid telemetry feed payload"
    );
  });

  it("tracks added, stale, imported, and removed nodes", () => {
    const activeNodes = new Map();

    applyFeedMessages(activeNodes, [addedNode(1, "astar-archive-a")], now);
    expect(activeNodes.get(1)).toMatchObject({
      name: "astar-archive-a",
      nodeUptimeSeconds: 3600,
      blockHeight: 12345,
      location: "Tokyo",
      latitude: 35.68,
      longitude: 139.76,
      stale: false
    });

    applyFeedMessages(
      activeNodes,
      [{ action: ACTIONS.StaleNode, payload: 1 }],
      now
    );
    expect(activeNodes.get(1).stale).toBe(true);

    applyFeedMessages(
      activeNodes,
      [{ action: ACTIONS.ImportedBlock, payload: [1, [12346]] }],
      now
    );
    expect(activeNodes.get(1)).toMatchObject({ blockHeight: 12346, stale: false });

    applyFeedMessages(
      activeNodes,
      [{ action: ACTIONS.FinalizedBlock, payload: [1, 12340, "0xdef"] }],
      now
    );
    expect(activeNodes.get(1).finalizedBlockHeight).toBe(12340);

    applyFeedMessages(
      activeNodes,
      [{ action: ACTIONS.LocatedNode, payload: [1, 34.69, 135.5, "Osaka"] }],
      now
    );
    expect(activeNodes.get(1).location).toBe("Osaka");
    expect(activeNodes.get(1).latitude).toBe(34.69);
    expect(activeNodes.get(1).longitude).toBe(135.5);

    applyFeedMessages(
      activeNodes,
      [{ action: ACTIONS.RemovedNode, payload: 1 }],
      now
    );
    expect(activeNodes.has(1)).toBe(false);
  });
});

describe("node matching", () => {
  it("matches partial names case-insensitively", () => {
    expect(nodeNameMatches("Archive-Tokyo", "astar-ARCHIVE-tokyo-01")).toBe(true);
  });

  it("does not match empty patterns or unrelated names", () => {
    expect(nodeNameMatches("", "astar-archive")).toBe(false);
    expect(nodeNameMatches("shibuya", "astar-archive")).toBe(false);
  });
});
