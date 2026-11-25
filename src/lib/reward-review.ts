import type { RewardProblem } from "./reward-feedback";
import type { RewardEntry, RewardPeriod } from "./reward-types";
import { validateRewardAddress } from "./reward-validation";
import { getMonthBounds, RewardError } from "./rewards";

export type DraftReview = {
  monthIssues: RewardProblem[];
  entryIssues: Record<string, RewardProblem>;
};

function reviewEntry(entry: RewardEntry, hasPrice: boolean): RewardProblem | undefined {
  try {
    validateRewardAddress(entry.address);
  } catch (error) {
    if (!(error instanceof RewardError)) throw error;
    return error.problem;
  }
  if (!hasPrice) return;
  if (entry.overrideAmount == null && entry.calculatedAmount == null) {
    return { code: "observations", field: "overrideAmount", detail: entry.label };
  }
  if ((entry.overrideAmount != null || entry.availability.availabilityPercent == null) && !entry.adjustmentReason.trim()) {
    return { code: "decisionReason", field: "reason", detail: entry.label };
  }
}

// Both the page and the locked confirmation transaction read the same rules.
export function reviewRewardDraft(period: RewardPeriod, now = new Date()): DraftReview {
  const end = getMonthBounds(period.month).end;
  const monthIssues: RewardProblem[] = [];
  if (end > now) monthIssues.push({ code: "monthOpen" });
  else if (new Date(period.observedAt) < end) monthIssues.push({ code: "refresh" });
  if (!period.priceUsd) monthIssues.push({ code: "priceMissing", field: "priceUsd" });
  if (!period.entries.length) monthIssues.push({ code: "noParticipants" });
  const entryIssues: Record<string, RewardProblem> = {};
  for (const entry of period.entries) {
    const issue = reviewEntry(entry, period.priceUsd != null);
    if (issue) entryIssues[entry.id] = issue;
  }
  return { monthIssues, entryIssues };
}
