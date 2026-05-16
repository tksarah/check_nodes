import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/config";
import { isCookieSecureEnabled } from "@/lib/config";
import { adminToken } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);

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
