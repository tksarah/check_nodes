import type { TelemetryCheckResult } from "./repository";

export function adminCheckRedirectPath(result: TelemetryCheckResult) {
  if (result.status === "skipped") {
    return "/admin?check=running";
  }

  return "/admin?check=success";
}
