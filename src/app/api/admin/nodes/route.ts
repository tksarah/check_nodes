import { requireAdminCsrf } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { createMonitoredNode } from "@/lib/repository";

export async function POST(request: Request) {
  const invalid = await requireAdminCsrf(request);
  if (invalid) return invalid;

  const form = await request.formData();
  const label = String(form.get("label") ?? "").trim();
  const namePattern = String(form.get("namePattern") ?? "").trim();

  if (!label || !namePattern) {
    return Response.json({ error: "label and namePattern are required" }, { status: 400 });
  }

  await createMonitoredNode(label, namePattern);
  return redirectTo("/admin");
}
