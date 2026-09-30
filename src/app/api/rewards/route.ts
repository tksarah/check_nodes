import { publicRewardPeriod } from "@/lib/reward-public";
import { getRewardPeriod, listRewardPeriods } from "@/lib/reward-repository";
import { getMonthBounds, RewardError } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month");
    if (!month) return Response.json({months:await listRewardPeriods(true)},{headers:{"Cache-Control":"no-store"}});
    getMonthBounds(month);
    const period = await getRewardPeriod(month);
    const result = period ? publicRewardPeriod(period) : null;
    if (!result) return Response.json({error:"Published report not found"},{status:404});
    return Response.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    if (error instanceof RewardError) return Response.json({error:error.message},{status:error.status});
    throw error;
  }
}
