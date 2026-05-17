import { PoolClient } from "pg";
import { pool, query } from "./db";
import { resolveLocationCoordinates } from "./location-coordinates";
import { nodeNameMatches, fetchTelemetrySnapshot } from "./telemetry";
import { AvailabilitySummary, MonitoredNode, NodeSample, NodeSummary } from "./types";

const CHECK_ADVISORY_LOCK_ID = 918273645;

type NodeRow = {
  id: string;
  label: string;
  name_pattern: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type SampleRow = {
  id: string;
  node_id: string;
  checked_at: Date;
  is_online: boolean;
  matched_telemetry_names: string[];
  startup_time: Date | null;
  node_uptime_seconds: number | null;
  block_height: string | null;
  finalized_block_height: string | null;
  location: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  coordinate_source: "telemetry" | "lastKnown" | "location" | null;
  version: string | null;
};

export function mapNode(row: NodeRow): MonitoredNode {
  return {
    id: Number(row.id),
    label: row.label,
    namePattern: row.name_pattern,
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapSample(row: SampleRow): NodeSample {
  return {
    id: Number(row.id),
    nodeId: Number(row.node_id),
    checkedAt: row.checked_at,
    isOnline: row.is_online,
    matchedTelemetryNames: row.matched_telemetry_names ?? [],
    startupTime: row.startup_time,
    nodeUptimeSeconds: row.node_uptime_seconds,
    blockHeight: row.block_height == null ? null : Number(row.block_height),
    finalizedBlockHeight:
      row.finalized_block_height == null ? null : Number(row.finalized_block_height),
    location: row.location,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    coordinateSource: row.coordinate_source,
    version: row.version
  };
}

export async function getMonitoredNodes(includeDisabled = false) {
  const result = await query<NodeRow>(
    `select * from monitored_nodes
     ${includeDisabled ? "" : "where enabled = true"}
     order by label asc`
  );

  return result.rows.map(mapNode);
}

export async function createMonitoredNode(label: string, namePattern: string) {
  const result = await query<NodeRow>(
    `insert into monitored_nodes (label, name_pattern)
     values ($1, $2)
     returning *`,
    [label.trim(), namePattern.trim()]
  );

  return mapNode(result.rows[0]);
}

export async function updateMonitoredNode(
  id: number,
  label: string,
  namePattern: string
) {
  const result = await query<NodeRow>(
    `update monitored_nodes
     set label = $2, name_pattern = $3, updated_at = now()
     where id = $1
     returning *`,
    [id, label.trim(), namePattern.trim()]
  );

  return result.rows[0] ? mapNode(result.rows[0]) : null;
}

export async function setNodeEnabled(id: number, enabled: boolean) {
  await query(
    `update monitored_nodes
     set enabled = $2, updated_at = now()
     where id = $1`,
    [id, enabled]
  );
}

export async function deleteMonitoredNode(id: number) {
  await query("delete from monitored_nodes where id = $1", [id]);
}

export async function getCheckIntervalMinutes() {
  const result = await query<{ value: string }>(
    "select value from settings where key = 'checkIntervalMinutes'"
  );

  return Number(result.rows[0]?.value ?? "60");
}

export async function setCheckIntervalMinutes(minutes: number) {
  await query(
    `insert into settings (key, value, updated_at)
     values ('checkIntervalMinutes', $1, now())
     on conflict (key)
     do update set value = excluded.value, updated_at = now()`,
    [String(minutes)]
  );
}

type CheckSource = "worker" | "manual";

export type TelemetryCheckResult =
  | { checkedAt: Date; status: "success"; checkRunId: number; source: CheckSource }
  | { checkedAt: Date; status: "skipped"; reason: "already_running"; source: CheckSource };

export async function recordTelemetryCheck(
  options: { source?: CheckSource } = {}
): Promise<TelemetryCheckResult> {
  const source = options.source ?? "worker";
  const checkedAt = new Date();
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const lockResult = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1) as locked",
      [CHECK_ADVISORY_LOCK_ID]
    );
    lockAcquired = lockResult.rows[0]?.locked === true;

    if (!lockAcquired) {
      return { checkedAt, status: "skipped", reason: "already_running", source };
    }

    await client.query("begin");

    try {
      const monitored = await getMonitoredNodesForClient(client);
      const snapshot = await fetchTelemetrySnapshot({ now: checkedAt });
      const checkRunId = await saveSuccessfulCheck(
        client,
        checkedAt,
        snapshot.latencyMs,
        monitored,
        snapshot.nodes
      );

      await client.query("commit");
      return { checkedAt, status: "success", checkRunId, source };
    } catch (error) {
      await client.query("rollback");
      await saveFailedCheck(client, checkedAt, error);
      throw error;
    }
  } finally {
    if (lockAcquired) {
      await client.query("select pg_advisory_unlock($1)", [CHECK_ADVISORY_LOCK_ID]);
    }
    client.release();
  }
}

async function saveSuccessfulCheck(
  client: PoolClient,
  checkedAt: Date,
  sourceLatencyMs: number,
  monitored: MonitoredNode[],
  telemetryNodes: Awaited<ReturnType<typeof fetchTelemetrySnapshot>>["nodes"]
) {
  const run = await client.query<{ id: string }>(
    `insert into check_runs (checked_at, status, source_latency_ms)
     values ($1, 'success', $2)
     returning id`,
    [checkedAt, sourceLatencyMs]
  );
  const checkRunId = Number(run.rows[0].id);

  for (const node of monitored) {
    const matches = telemetryNodes.filter((telemetryNode) =>
      nodeNameMatches(node.namePattern, telemetryNode.name)
    );
    const primaryMatch = matches[0] ?? null;
    const coordinates = resolveSampleCoordinates(
      primaryMatch?.latitude ?? null,
      primaryMatch?.longitude ?? null,
      primaryMatch?.location ?? null
    );

    await client.query(
      `insert into node_samples (
         node_id,
         check_run_id,
         checked_at,
         is_online,
         matched_telemetry_names,
         startup_time,
         node_uptime_seconds,
         block_height,
         finalized_block_height,
         location,
         latitude,
         longitude,
         coordinate_source,
         version
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        node.id,
        checkRunId,
        checkedAt,
        matches.length > 0,
        matches.map((match) => match.name),
        primaryMatch?.startupTime ?? null,
        primaryMatch?.nodeUptimeSeconds ?? null,
        primaryMatch?.blockHeight ?? null,
        primaryMatch?.finalizedBlockHeight ?? null,
        primaryMatch?.location ?? null,
        coordinates.latitude,
        coordinates.longitude,
        coordinates.coordinateSource,
        primaryMatch?.version ?? null
      ]
    );
  }

  return checkRunId;
}

async function saveFailedCheck(
  client: PoolClient,
  checkedAt: Date,
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  await client.query(
    `insert into check_runs (checked_at, status, error_message)
     values ($1, 'error', $2)`,
    [checkedAt, message]
  );
}

async function getMonitoredNodesForClient(client: PoolClient) {
  const result = await client.query<NodeRow>(
    "select * from monitored_nodes where enabled = true order by label asc"
  );

  return result.rows.map(mapNode);
}

export async function getLatestSamples() {
  const result = await query<SampleRow>(
    `select distinct on (node_id) *
     from node_samples
     order by node_id, checked_at desc`
  );

  return new Map(result.rows.map((row) => [Number(row.node_id), mapSample(row)]));
}

export async function getLastKnownLocationSamples() {
  const result = await query<SampleRow>(
    `select distinct on (node_id) *
     from node_samples
     where latitude is not null and longitude is not null
     order by node_id, checked_at desc`
  );

  return new Map(result.rows.map((row) => [Number(row.node_id), mapSample(row)]));
}

export async function getSamplesForNode(nodeId: number, limit = 120) {
  const result = await query<SampleRow>(
    `select *
     from node_samples
     where node_id = $1
     order by checked_at desc
     limit $2`,
    [nodeId, limit]
  );

  return result.rows.map(mapSample);
}

export async function getSamplesForNodeSince(nodeId: number, since: Date) {
  const result = await query<SampleRow>(
    `select *
     from node_samples
     where node_id = $1 and checked_at >= $2
     order by checked_at asc`,
    [nodeId, since]
  );

  return result.rows.map(mapSample);
}

export async function getLastCheckRun() {
  const result = await query<{
    checked_at: Date;
    status: string;
    error_message: string | null;
  }>(
    `select checked_at, status, error_message
     from check_runs
     order by checked_at desc
     limit 1`
  );

  return result.rows[0] ?? null;
}

export async function getDashboardData() {
  const [
    nodes,
    latestSamples,
    lastKnownLocationSamples,
    lastCheckRun,
    checkIntervalMinutes
  ] =
    await Promise.all([
      getMonitoredNodes(true),
      getLatestSamples(),
      getLastKnownLocationSamples(),
      getLastCheckRun(),
      getCheckIntervalMinutes()
    ]);

  const summaries = await Promise.all(
    nodes.map(async (node): Promise<NodeSummary> => ({
      ...node,
      latestSample: mergeLatestSampleWithLastKnownLocation(
        latestSamples.get(node.id) ?? null,
        lastKnownLocationSamples.get(node.id) ?? null
      ),
      weekly: await getAvailabilitySummary(node.id, 7),
      monthly: await getAvailabilitySummary(node.id, 30)
    }))
  );

  return {
    nodes: summaries,
    lastCheckRun,
    checkIntervalMinutes
  };
}

export function mergeLatestSampleWithLastKnownLocation(
  latestSample: NodeSample | null,
  lastKnownLocationSample: NodeSample | null
) {
  if (!latestSample) return latestSample;
  if (latestSample.latitude != null && latestSample.longitude != null) {
    return latestSample;
  }
  if (lastKnownLocationSample) {
    return {
      ...latestSample,
      location: latestSample.location ?? lastKnownLocationSample.location,
      latitude: lastKnownLocationSample.latitude,
      longitude: lastKnownLocationSample.longitude,
      coordinateSource: "lastKnown" as const
    };
  }

  const locationCoordinates = resolveLocationCoordinates(latestSample.location);
  if (!locationCoordinates) return latestSample;

  return {
    ...latestSample,
    latitude: locationCoordinates.latitude,
    longitude: locationCoordinates.longitude,
    coordinateSource: "location" as const
  };
}

function resolveSampleCoordinates(
  latitude: number | null,
  longitude: number | null,
  location: string | null
) {
  if (latitude != null && longitude != null) {
    return { latitude, longitude, coordinateSource: "telemetry" as const };
  }

  const locationCoordinates = resolveLocationCoordinates(location);
  if (locationCoordinates) {
    return {
      latitude: locationCoordinates.latitude,
      longitude: locationCoordinates.longitude,
      coordinateSource: "location" as const
    };
  }

  return { latitude: null, longitude: null, coordinateSource: null };
}

export async function getAvailabilitySummary(
  nodeId: number,
  days: number,
  now = new Date()
): Promise<AvailabilitySummary> {
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const result = await query<Pick<SampleRow, "checked_at" | "is_online">>(
    `select checked_at, is_online
     from node_samples
     where node_id = $1 and checked_at >= $2
     order by checked_at asc`,
    [nodeId, start]
  );

  return summarizeAvailability(
    result.rows.map((row) => ({
      checkedAt: row.checked_at,
      isOnline: row.is_online
    })),
    now
  );
}

export function summarizeAvailability(
  samples: Array<{ checkedAt: Date; isOnline: boolean }>,
  now = new Date()
): AvailabilitySummary {
  if (samples.length < 2) {
    return {
      onlineHours: 0,
      totalObservedHours: 0,
      availabilityPercent: null
    };
  }

  let onlineMs = 0;
  let totalMs = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const intervalMs = Math.max(
      0,
      current.checkedAt.getTime() - previous.checkedAt.getTime()
    );

    totalMs += intervalMs;

    if (previous.isOnline || current.isOnline) {
      onlineMs += intervalMs;
    }
  }

  const last = samples[samples.length - 1];
  const trailingMs = Math.max(0, now.getTime() - last.checkedAt.getTime());
  totalMs += trailingMs;

  if (last.isOnline) {
    onlineMs += trailingMs;
  }

  const totalObservedHours = totalMs / 3_600_000;
  const onlineHours = onlineMs / 3_600_000;

  return {
    onlineHours,
    totalObservedHours,
    availabilityPercent:
      totalObservedHours === 0 ? null : (onlineHours / totalObservedHours) * 100
  };
}
