import { requireAdminCsrf } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { setCheckIntervalMinutes } from "@/lib/repository";

const ALLOWED_INTERVALS = new Set([60, 180, 360, 720]);

export async function POST(request: Request) {
  const invalid = await requireAdminCsrf(request);
  if (invalid) return invalid;

  const form = await request.formData();
  const minutes = Number(form.get("checkIntervalMinutes"));

  if (!ALLOWED_INTERVALS.has(minutes)) {
    return Response.json({ error: "Unsupported interval" }, { status: 400 });
  }

  await setCheckIntervalMinutes(minutes);
  return redirectTo("/admin");
}
