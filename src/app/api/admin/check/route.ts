import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { adminCheckRedirectPath } from "@/lib/check-result";
import { recordTelemetryCheck } from "@/lib/repository";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const result = await recordTelemetryCheck({ source: "manual" });
    return NextResponse.redirect(
      new URL(adminCheckRedirectPath(result), request.url),
      303
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const url = new URL("/admin", request.url);
    url.searchParams.set("check", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url, 303);
  }
}
