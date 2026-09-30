import { requireAdmin } from "@/lib/auth";
import { rewardCsv } from "@/lib/reward-csv";
import { getRewardPeriod } from "@/lib/reward-repository";
import { getMonthBounds, RewardError } from "@/lib/rewards";

export async function GET(request: Request) {
  const invalid = await requireAdmin();
  if (invalid) return invalid;
  try {
    const month = new URL(request.url).searchParams.get("month") ?? "";
    getMonthBounds(month);
    const period = await getRewardPeriod(month);
    if (!period) return Response.json({error:"Monthly ledger not found"},{status:404});
    return new Response(rewardCsv(period),{headers:{"Content-Type":"text/csv; charset=utf-8",
      "Content-Disposition":`attachment; filename="peers-rewards-${month}.csv"`,"Cache-Control":"private, no-store"}});
  } catch (error) {
    if (error instanceof RewardError) return Response.json({error:error.message},{status:error.status});
    throw error;
  }
}
