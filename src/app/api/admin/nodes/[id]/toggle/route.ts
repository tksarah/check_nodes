import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setNodeEnabled } from "@/lib/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const { id } = await params;
  await setNodeEnabled(Number(id), String(form.get("enabled")) === "true");
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
