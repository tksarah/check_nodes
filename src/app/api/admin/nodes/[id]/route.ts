import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { deleteMonitoredNode, updateMonitoredNode } from "@/lib/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  const form = await request.formData();
  const action = String(form.get("action") ?? "delete");
  const { id } = await params;

  if (action === "update") {
    const label = String(form.get("label") ?? "").trim();
    const namePattern = String(form.get("namePattern") ?? "").trim();

    if (!label || !namePattern) {
      return Response.json(
        { error: "label and namePattern are required" },
        { status: 400 }
      );
    }

    await updateMonitoredNode(Number(id), label, namePattern);
  } else {
    await deleteMonitoredNode(Number(id));
  }

  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
