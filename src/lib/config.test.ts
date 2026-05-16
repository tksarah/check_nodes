import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertDatabaseConfig,
  assertProductionConfig,
  getAdminPassword,
  getDatabaseUrl
} from "./config";

describe("production config validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects placeholder production secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("ADMIN_PASSWORD", "change-me");
    vi.stubEnv("POSTGRES_PASSWORD", "strong-postgres-password");
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://astar:strong-postgres-password@postgres:5432/astar_monitor"
    );

    expect(() => getAdminPassword()).toThrow("ADMIN_PASSWORD must be set");
    expect(() => assertProductionConfig()).toThrow("ADMIN_PASSWORD must be set");
  });

  it("rejects placeholder database urls in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("ADMIN_PASSWORD", "strong-admin-password");
    vi.stubEnv("POSTGRES_PASSWORD", "strong-postgres-password");
    vi.stubEnv("DATABASE_URL", "postgres://astar:change-me@postgres:5432/astar_monitor");

    expect(() => getDatabaseUrl()).toThrow("DATABASE_URL must be set");
    expect(() => assertDatabaseConfig()).toThrow("DATABASE_URL must be set");
  });

  it("allows database initialization without unrelated service secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("POSTGRES_PASSWORD", "");
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://astar:strong-postgres-password@postgres:5432/astar_monitor"
    );

    expect(() => assertDatabaseConfig()).not.toThrow();
  });

  it("allows production builds to compile without runtime secrets", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("ADMIN_PASSWORD", "");
    vi.stubEnv("POSTGRES_PASSWORD", "");
    vi.stubEnv("DATABASE_URL", "");

    expect(getAdminPassword()).toBe("");
    expect(getDatabaseUrl()).toBe("");
  });
});
