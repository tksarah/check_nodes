import type { NodeSample, NodeSummary } from "./types";

export const SYNCING_BLOCK_GAP_THRESHOLD = 512;

export type NodeStatus =
  | "unknown"
  | "disabled"
  | "offline"
  | "syncing"
  | "online";

export function getDashboardNodeStatus(node: NodeSummary): NodeStatus {
  if (!node.latestSample) return "unknown";
  if (!node.enabled) return "disabled";

  return getSampleNodeStatus(node.latestSample);
}

export function getSampleNodeStatus(sample: NodeSample | null): Exclude<NodeStatus, "disabled"> {
  if (!sample) return "unknown";
  if (sample.isOnline === false) return "offline";
  if (sample.isOnline !== true) return "unknown";

  if (isSyncingSample(sample)) {
    return "syncing";
  }

  return "online";
}

export function getNodeStatusLabel(status: NodeStatus) {
  if (status === "online") return "Online";
  if (status === "syncing") return "Syncing";
  if (status === "offline") return "Offline";
  if (status === "disabled") return "Disabled";
  return "Unknown";
}

function isSyncingSample(sample: NodeSample) {
  const { blockHeight, finalizedBlockHeight } = sample;

  return (
    blockHeight != null &&
    finalizedBlockHeight != null &&
    blockHeight - finalizedBlockHeight >= SYNCING_BLOCK_GAP_THRESHOLD
  );
}
