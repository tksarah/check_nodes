import { ADMIN_COOKIE, getAdminPassword } from "@/lib/config";
import { isCookieSecureEnabled } from "@/lib/config";
import {
  createAdminSessionToken,
  isLoginRateLimited,
  loginRateLimitKey,
  recordFailedLogin,
  recordSuccessfulLogin,
  SESSION_MAX_AGE_SECONDS
} from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const rateLimitKey = loginRateLimitKey(request);
  if (isLoginRateLimited(rateLimitKey)) {
    return Response.json({ error: "Too many login attempts" }, { status: 429 });
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const response = redirectTo("/admin");

  if (password === getAdminPassword()) {
    recordSuccessfulLogin(rateLimitKey);
    response.cookies.set(ADMIN_COOKIE, createAdminSessionToken(), {
      httpOnly: true,
      secure: isCookieSecureEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
  } else {
    recordFailedLogin(rateLimitKey);
    response.cookies.set(ADMIN_COOKIE, "failed", {
      httpOnly: true,
      secure: isCookieSecureEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: 60
    });
  }

  return response;
}
