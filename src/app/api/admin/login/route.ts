import { ADMIN_COOKIE } from "@/lib/config";
import { isCookieSecureEnabled } from "@/lib/config";
import { adminToken } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const response = redirectTo("/admin");

  if (password === (process.env.ADMIN_PASSWORD ?? "change-me")) {
    response.cookies.set(ADMIN_COOKIE, adminToken(), {
      httpOnly: true,
      secure: isCookieSecureEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  } else {
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
