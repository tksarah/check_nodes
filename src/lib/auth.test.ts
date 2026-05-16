import { describe, expect, it, vi } from "vitest";
import {
  csrfTokenForSession,
  isLoginRateLimited,
  recordFailedLogin,
  recordSuccessfulLogin,
  validateAdminSession,
  validateCsrfToken
} from "./auth";

describe("admin session tokens", () => {
  it("rejects tampered session tokens", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "strong-password");
    const { createAdminSessionToken } = await import("./auth");
    const token = createAdminSessionToken();

    expect(validateAdminSession(token)).toBe(true);
    expect(validateAdminSession(`${token}x`)).toBe(false);

    vi.unstubAllEnvs();
  });

  it("creates csrf tokens bound to the session token", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "strong-password");
    const { createAdminSessionToken } = await import("./auth");
    const session = createAdminSessionToken();
    const token = csrfTokenForSession(session);

    expect(validateCsrfToken(session, token)).toBe(true);
    expect(validateCsrfToken(`${session}x`, token)).toBe(false);
    expect(validateCsrfToken(session, `${token}x`)).toBe(false);

    vi.unstubAllEnvs();
  });
});

describe("login rate limiting", () => {
  it("rate-limits repeated failures and resets after success", () => {
    const key = `test-${Date.now()}`;

    for (let index = 0; index < 5; index += 1) {
      expect(isLoginRateLimited(key)).toBe(false);
      recordFailedLogin(key);
    }

    expect(isLoginRateLimited(key)).toBe(true);
    recordSuccessfulLogin(key);
    expect(isLoginRateLimited(key)).toBe(false);
  });
});
