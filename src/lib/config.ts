export const ASTAR_GENESIS_HASH =
  process.env.ASTAR_GENESIS_HASH ??
  "0x9eb76c5184c4ab8679d2d5d819fdf90b9c001403e9e17da2e14b6d8aec4029c6";

export const TELEMETRY_URL =
  process.env.TELEMETRY_URL ?? "wss://feed.telemetry.polkadot.io/feed";

export const ADMIN_COOKIE = "astar_admin";

const PLACEHOLDER_VALUES = new Set(["", "change-me"]);

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
}

function requireProductionSecret(name: string, value: string | undefined) {
  if (!isProductionRuntime()) {
    return value;
  }

  if (
    value == null ||
    PLACEHOLDER_VALUES.has(value.trim()) ||
    value.includes("change-me") ||
    value.includes("<")
  ) {
    throw new Error(`${name} must be set to a non-placeholder value in production`);
  }

  return value;
}

export function getDatabaseUrl() {
  const value = requireProductionSecret("DATABASE_URL", process.env.DATABASE_URL);
  return value ?? "postgres://astar:astar@localhost:5432/astar_monitor";
}

export function getAdminPassword() {
  const value = requireProductionSecret("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
  return value ?? "change-me";
}

export function isCookieSecureEnabled() {
  return process.env.COOKIE_SECURE !== "false";
}

export function assertProductionConfig() {
  requireProductionSecret("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
  requireProductionSecret("POSTGRES_PASSWORD", process.env.POSTGRES_PASSWORD);
  requireProductionSecret("DATABASE_URL", process.env.DATABASE_URL);
}

export function assertDatabaseConfig() {
  requireProductionSecret("DATABASE_URL", process.env.DATABASE_URL);
}
