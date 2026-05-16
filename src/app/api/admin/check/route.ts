import { requireAdminCsrf } from "@/lib/auth";
import { adminCheckRedirectPath } from "@/lib/check-result";
import { redirectTo } from "@/lib/redirect";
import { recordTelemetryCheck } from "@/lib/repository";

export async function POST(request: Request) {
  const invalid = await requireAdminCsrf(request);
  if (invalid) return invalid;

  try {
    const result = await recordTelemetryCheck({ source: "manual" });
    return redirectTo(adminCheckRedirectPath(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const url = new URL("http://internal/admin");
    url.searchParams.set("check", "error");
    url.searchParams.set("message", message);
    return redirectTo(`${url.pathname}${url.search}`);
  }
}
