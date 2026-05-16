import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setCheckIntervalMinutes } from "@/lib/repository";

const ALLOWED_INTERVALS = new Set([60, 180, 360, 720]);

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const minutes = Number(form.get("checkIntervalMinutes"));

  if (!ALLOWED_INTERVALS.has(minutes)) {
    return Response.json({ error: "Unsupported interval" }, { status: 400 });
  }

  await setCheckIntervalMinutes(minutes);
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
