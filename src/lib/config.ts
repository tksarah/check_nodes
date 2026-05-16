export const ASTAR_GENESIS_HASH =
  process.env.ASTAR_GENESIS_HASH ??
  "0x9eb76c5184c4ab8679d2d5d819fdf90b9c001403e9e17da2e14b6d8aec4029c6";

export const TELEMETRY_URL =
  process.env.TELEMETRY_URL ?? "wss://feed.telemetry.polkadot.io/feed";

export const ADMIN_COOKIE = "astar_admin";

export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ?? "postgres://astar:astar@localhost:5432/astar_monitor"
  );
}

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD ?? "change-me";
}

export function isCookieSecureEnabled() {
  return process.env.COOKIE_SECURE !== "false";
}
