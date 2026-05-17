export type MonitoredNode = {
  id: number;
  label: string;
  namePattern: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TelemetryNode = {
  telemetryId: number;
  name: string;
  version: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  startupTime: Date | null;
  nodeUptimeSeconds: number | null;
  blockHeight: number | null;
  finalizedBlockHeight: number | null;
  stale: boolean;
};

export type NodeSample = {
  id: number;
  nodeId: number;
  checkedAt: Date;
  isOnline: boolean;
  matchedTelemetryNames: string[];
  startupTime: Date | null;
  nodeUptimeSeconds: number | null;
  blockHeight: number | null;
  finalizedBlockHeight: number | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: "telemetry" | "lastKnown" | "location" | null;
  version: string | null;
};

export type NodeSummary = MonitoredNode & {
  latestSample: NodeSample | null;
  weekly: AvailabilitySummary;
  monthly: AvailabilitySummary;
};

export type AvailabilitySummary = {
  onlineHours: number;
  totalObservedHours: number;
  availabilityPercent: number | null;
};
