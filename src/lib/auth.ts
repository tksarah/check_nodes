import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminPassword } from "./config";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

type LoginAttempt = {
  count: number;
  resetAt: number;
};

const loginAttempts = new Map<string, LoginAttempt>();

function digest(value: string, purpose: string) {
  return createHmac("sha256", getAdminPassword())
    .update(purpose)
    .update(":")
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

export function createAdminSessionToken(now = Date.now()) {
  const payload = `${randomBytes(32).toString("base64url")}.${now + SESSION_MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${digest(payload, "admin-session")}`;
}

export function validateAdminSession(value: string, now = Date.now()) {
  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [nonce, expiresAt, signature] = parts;
  const expiry = Number(expiresAt);

  if (!nonce || !Number.isFinite(expiry) || expiry <= now) return false;

  const payload = `${nonce}.${expiresAt}`;
  return safeEqual(signature, digest(payload, "admin-session"));
}

export function csrfTokenForSession(sessionToken: string) {
  return digest(sessionToken, "admin-csrf");
}

export function validateCsrfToken(sessionToken: string, csrfToken: string) {
  if (!sessionToken || !csrfToken) return false;
  return safeEqual(csrfToken, csrfTokenForSession(sessionToken));
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;

  if (!value) return false;

  return validateAdminSession(value);
}

export async function getAdminCsrfToken() {
  const store = await cookies();
  const session = store.get(ADMIN_COOKIE)?.value;

  if (!session || !validateAdminSession(session)) return "";

  return csrfTokenForSession(session);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function requireAdminCsrf(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const store = await cookies();
  const session = store.get(ADMIN_COOKIE)?.value ?? "";
  let csrfToken = "";

  try {
    const form = await request.clone().formData();
    csrfToken = String(form.get("csrfToken") ?? "");
  } catch {
    return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  if (!validateCsrfToken(session, csrfToken)) {
    return Response.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  return null;
}

function currentAttempt(key: string, now = Date.now()) {
  const attempt = loginAttempts.get(key);

  if (!attempt || attempt.resetAt <= now) {
    return { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  }

  return attempt;
}

export function isLoginRateLimited(key: string, now = Date.now()) {
  return currentAttempt(key, now).count >= LOGIN_MAX_FAILURES;
}

export function recordFailedLogin(key: string, now = Date.now()) {
  const attempt = currentAttempt(key, now);
  loginAttempts.set(key, {
    count: attempt.count + 1,
    resetAt: attempt.resetAt
  });
}

export function recordSuccessfulLogin(key: string) {
  loginAttempts.delete(key);
}

export function loginRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}

export { SESSION_MAX_AGE_SECONDS };
