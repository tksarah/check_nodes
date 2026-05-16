import { requireAdminCsrf } from "@/lib/auth";
import { ADMIN_COOKIE } from "@/lib/config";
import { isCookieSecureEnabled } from "@/lib/config";
import { redirectTo } from "@/lib/redirect";

export async function POST(request: Request) {
  const invalid = await requireAdminCsrf(request);
  if (invalid) return invalid;

  const response = redirectTo("/admin");
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: isCookieSecureEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
