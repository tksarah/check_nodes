import { requireAdmin } from "../../../../../lib/auth";
import { fetchRewardSourceBalance } from "../../../../../lib/reward-source-balance";
import { RewardError } from "../../../../../lib/rewards";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  const invalid = await requireAdmin();
  if (invalid) {
    invalid.headers.set("Cache-Control", headers["Cache-Control"]);
    return invalid;
  }
  try {
    return Response.json(await fetchRewardSourceBalance(), { headers });
  } catch (error) {
    const message = error instanceof RewardError ? error.message : "Reward source balance is unavailable. Try again later.";
    return Response.json({ error: message }, { status: error instanceof RewardError ? error.status : 502, headers });
  }
}
