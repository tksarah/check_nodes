import WebSocket from "ws";
import { ASTAR_GENESIS_HASH, TELEMETRY_URL } from "./config";
import { TelemetryNode } from "./types";

export const ACTIONS = {
  FeedVersion: 0,
  AddedNode: 3,
  RemovedNode: 4,
  LocatedNode: 5,
  ImportedBlock: 6,
  FinalizedBlock: 7,
  SubscribedTo: 13,
  StaleNode: 20
} as const;

export type FeedMessage = {
  action: number;
  payload: unknown;
};

type SnapshotOptions = {
  telemetryUrl?: string;
  genesisHash?: string;
  timeoutMs?: number;
  quietMs?: number;
  now?: Date;
};

export function deserializeFeedMessages(
  data: string | Buffer | ArrayBuffer | Buffer[]
) {
  const text = Array.isArray(data)
    ? Buffer.concat(data).toString("utf8")
    : Buffer.isBuffer(data)
    ? data.toString("utf8")
    : typeof data === "string"
      ? data
      : Buffer.from(data).toString("utf8");
  const json = JSON.parse(text) as unknown;

  if (!Array.isArray(json) || json.length === 0 || json.length % 2 !== 0) {
    throw new Error("Invalid telemetry feed payload");
  }

  const messages: FeedMessage[] = [];

  for (let index = 0; index < json.length; index += 2) {
    messages.push({
      action: Number(json[index]),
      payload: json[index + 1]
    });
  }

  return messages;
}

export function nodeNameMatches(pattern: string, telemetryName: string) {
  const normalizedPattern = pattern.trim().toLocaleLowerCase();
  const normalizedName = telemetryName.toLocaleLowerCase();

  return normalizedPattern.length > 0 && normalizedName.includes(normalizedPattern);
}

export function parseAddedNode(payload: unknown, now = new Date()): TelemetryNode {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid AddedNode payload");
  }

  const telemetryId = Number(payload[0]);
  const nodeDetails = payload[1] as unknown[];
  const blockDetails = payload[5] as unknown[];
  const locationDetails = payload[6] as unknown[] | null;
  const startupValue = payload[7];
  const name = String(nodeDetails?.[0] ?? "");
  const version = nodeDetails?.[2] == null ? null : String(nodeDetails[2]);
  const startupMs = typeof startupValue === "number" ? startupValue : null;
  const startupTime = startupMs ? new Date(startupMs) : null;
  const blockHeight =
    typeof blockDetails?.[0] === "number" ? Number(blockDetails[0]) : null;
  const location = parseLocation(locationDetails);

  return {
    telemetryId,
    name,
    version,
    location,
    startupTime,
    nodeUptimeSeconds: startupTime
      ? Math.max(0, Math.floor((now.getTime() - startupTime.getTime()) / 1000))
      : null,
    blockHeight,
    finalizedBlockHeight: null,
    stale: false
  };
}

function parseLocation(locationDetails: unknown[] | null | undefined) {
  if (!Array.isArray(locationDetails)) return null;

  const city = locationDetails[2];
  return city == null || String(city).trim() === "" ? null : String(city);
}

export function applyFeedMessages(
  activeNodes: Map<number, TelemetryNode>,
  messages: FeedMessage[],
  now = new Date()
) {
  let subscribed = false;

  for (const message of messages) {
    if (message.action === ACTIONS.SubscribedTo) {
      subscribed = true;
    }

    if (message.action === ACTIONS.AddedNode) {
      const node = parseAddedNode(message.payload, now);
      activeNodes.set(node.telemetryId, node);
    }

    if (message.action === ACTIONS.RemovedNode) {
      activeNodes.delete(Number(message.payload));
    }

    if (message.action === ACTIONS.StaleNode) {
      const node = activeNodes.get(Number(message.payload));
      if (node) {
        activeNodes.set(node.telemetryId, { ...node, stale: true });
      }
    }

    if (message.action === ACTIONS.LocatedNode) {
      const payload = message.payload;
      if (Array.isArray(payload)) {
        const node = activeNodes.get(Number(payload[0]));
        if (node) {
          activeNodes.set(node.telemetryId, {
            ...node,
            location: parseLocation([payload[1], payload[2], payload[3]])
          });
        }
      }
    }

    if (message.action === ACTIONS.ImportedBlock) {
      const payload = message.payload;
      if (Array.isArray(payload)) {
        const node = activeNodes.get(Number(payload[0]));
        const blockDetails = payload[1] as unknown[];
        if (node && typeof blockDetails?.[0] === "number") {
          activeNodes.set(node.telemetryId, {
            ...node,
            blockHeight: Number(blockDetails[0]),
            stale: false
          });
        }
      }
    }

    if (message.action === ACTIONS.FinalizedBlock) {
      const payload = message.payload;
      if (Array.isArray(payload)) {
        const node = activeNodes.get(Number(payload[0]));
        const finalizedBlockHeight =
          typeof payload[1] === "number" ? Number(payload[1]) : null;

        if (node && finalizedBlockHeight != null) {
          activeNodes.set(node.telemetryId, {
            ...node,
            finalizedBlockHeight
          });
        }
      }
    }
  }

  return subscribed;
}

export async function fetchTelemetrySnapshot(options: SnapshotOptions = {}) {
  const telemetryUrl = options.telemetryUrl ?? TELEMETRY_URL;
  const genesisHash = options.genesisHash ?? ASTAR_GENESIS_HASH;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const quietMs = options.quietMs ?? 1_500;
  const startedAt = Date.now();
  const activeNodes = new Map<number, TelemetryNode>();

  return new Promise<{ nodes: TelemetryNode[]; latencyMs: number }>(
    (resolve, reject) => {
      const socket = new WebSocket(telemetryUrl);
      let settled = false;
      let subscribed = false;
      let quietTimer: NodeJS.Timeout | undefined;

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        if (quietTimer) clearTimeout(quietTimer);
        socket.removeAllListeners();
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve({
          nodes: [...activeNodes.values()].filter((node) => !node.stale),
          latencyMs: Date.now() - startedAt
        });
      };

      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const timeoutTimer = setTimeout(() => {
        if (activeNodes.size > 0) {
          finish();
          return;
        }

        fail(new Error("Timed out waiting for telemetry snapshot"));
      }, timeoutMs);

      const resetQuietTimer = () => {
        if (!subscribed) return;
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, quietMs);
      };

      socket.once("open", () => {
        socket.send(`subscribe:${genesisHash}`);
      });

      socket.on("message", (data) => {
        try {
          const now = options.now ?? new Date();
          const messages = deserializeFeedMessages(data);
          subscribed = applyFeedMessages(activeNodes, messages, now) || subscribed;
          resetQuietTimer();
        } catch (error) {
          fail(error instanceof Error ? error : new Error(String(error)));
        }
      });

      socket.once("error", (error) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      });

      socket.once("close", () => {
        if (!settled && activeNodes.size > 0) {
          finish();
        }
      });
    }
  );
}
