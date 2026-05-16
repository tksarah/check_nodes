import { pool } from "@/lib/db";
import { getCheckIntervalMinutes, recordTelemetryCheck } from "@/lib/repository";

let running = false;

async function runOnce() {
  if (running) return;
  running = true;

  try {
    const result = await recordTelemetryCheck({ source: "worker" });
    if (result.status === "skipped") {
      console.log("[worker] check skipped: already running");
      return;
    }

    console.log(`[worker] check ${result.status} at ${result.checkedAt.toISOString()}`);
  } catch (error) {
    console.error("[worker] check failed", error);
  } finally {
    running = false;
  }
}

async function loop() {
  console.log("[worker] starting Astar telemetry monitor");

  while (true) {
    await runOnce();

    const intervalMinutes = await getCheckIntervalMinutes();
    const sleepMs = Math.max(1, intervalMinutes) * 60 * 1000;
    console.log(`[worker] next check in ${intervalMinutes} minutes`);
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}

process.on("SIGTERM", async () => {
  console.log("[worker] shutting down");
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[worker] shutting down");
  await pool.end();
  process.exit(0);
});

loop().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
