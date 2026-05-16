import { requireAdminCsrf } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { setNodeEnabled } from "@/lib/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const invalid = await requireAdminCsrf(request);
  if (invalid) return invalid;

  const form = await request.formData();
  const { id } = await params;
  await setNodeEnabled(Number(id), String(form.get("enabled")) === "true");
  return redirectTo("/admin");
}
