import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminCsrfToken, isAdminAuthenticated } from "@/lib/auth";
import { REWARD_LANGUAGE_COOKIE, type RewardProblem } from "@/lib/reward-feedback";
import { getRewardAudit, getRewardPeriod, getRewardProfiles, listRewardPeriods } from "@/lib/reward-repository";
import { reviewRewardDraft } from "@/lib/reward-review";
import { REWARD_SOURCE_ADDRESS } from "@/lib/reward-source-balance";
import { getMonthBounds, japanDate, previousMonth } from "@/lib/rewards";
import { RewardWorkspace } from "./RewardWorkspace";
import "./reward-admin.css";

export const dynamic = "force-dynamic";

type Params = { month?: string; saved?: string; error?: string; warning?: string; detail?: string };

export default async function RewardsAdminPage({ searchParams }: { searchParams?: Promise<Params> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const params = await searchParams;
  const now = new Date();
  let month = params?.month ?? previousMonth(now);
  let invalidMonth = false;
  try {
    if (getMonthBounds(month).start > now) invalidMonth = true;
  } catch { invalidMonth = true; }
  if (invalidMonth) month = previousMonth(now);
  const [store, csrf, profiles, months, period] = await Promise.all([
    cookies(), getAdminCsrfToken(), getRewardProfiles(), listRewardPeriods(), getRewardPeriod(month)
  ]);
  const audits = period ? await getRewardAudit(period.id) : [];
  const review = period?.status === "draft" ? reviewRewardDraft(period, now) : null;
  const code = params?.error ?? params?.warning;
  const notice = code ? { code: code as RewardProblem["code"], detail: String(params?.detail ?? "").slice(0, 200) } : null;
  return <RewardWorkspace key={month} month={month} today={japanDate(now)} csrf={csrf} period={period} review={review}
    profiles={profiles} months={months} audits={audits} sourceAddress={REWARD_SOURCE_ADDRESS} invalidMonth={invalidMonth}
    initialLanguage={store.get(REWARD_LANGUAGE_COOKIE)?.value === "ja" ? "ja" : "en"} initialNotice={notice} initialSaved={!!params?.saved} />;
}
