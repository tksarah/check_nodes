import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/config";
import { isCookieSecureEnabled } from "@/lib/config";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecureEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
