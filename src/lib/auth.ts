import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, getAdminPassword } from "./config";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function adminToken() {
  return digest(`astar-monitor:${getAdminPassword()}`);
}

export async function isAdminAuthenticated() {
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;

  if (!value) return false;

  const expected = adminToken();
  const a = Buffer.from(value);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
