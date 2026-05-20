import { getSampleNodeStatus, type NodeStatus } from "./node-status";
import type { TrendRange } from "./range";
import type { NodeSample } from "./types";

export const TREND_BAR_LIMITS: Record<TrendRange, number> = {
  "24h": 48,
  "7d": 84,
  "30d": 120
};

export type TrendBarStatus = Exclude<NodeStatus, "disabled">;

export type TrendDisplayBar = {
  id: string;
  status: TrendBarStatus;
  start: Date;
  end: Date;
  sampleCount: number;
  matchedTelemetryNames: string[];
  isAggregated: boolean;
};

export function getTrendDisplayBars(
  samples: NodeSample[],
  range: TrendRange
): TrendDisplayBar[] {
  const limit = TREND_BAR_LIMITS[range];

  if (samples.length <= limit) {
    return samples.map((sample) => ({
      id: String(sample.id),
      status: getSampleNodeStatus(sample),
      start: sample.checkedAt,
      end: sample.checkedAt,
      sampleCount: 1,
      matchedTelemetryNames: sample.matchedTelemetryNames,
      isAggregated: false
    }));
  }

  const step = samples.length / limit;
  const bars: TrendDisplayBar[] = [];

  for (let index = 0; index < limit; index += 1) {
    const startIndex = Math.floor(index * step);
    const endIndex = index === limit - 1
      ? samples.length
      : Math.floor((index + 1) * step);
    const group = samples.slice(startIndex, Math.max(startIndex + 1, endIndex));
    const first = group[0];
    const last = group[group.length - 1];

    bars.push({
      id: `${first.id}-${last.id}`,
      status: getGroupStatus(group),
      start: first.checkedAt,
      end: last.checkedAt,
      sampleCount: group.length,
      matchedTelemetryNames: [],
      isAggregated: true
    });
  }

  return bars;
}

function getGroupStatus(samples: NodeSample[]): TrendBarStatus {
  const statuses = samples.map((sample) => getSampleNodeStatus(sample));

  if (statuses.includes("offline")) return "offline";
  if (statuses.includes("syncing")) return "syncing";
  if (statuses.includes("online")) return "online";
  return "unknown";
}
