import type { DraftReview } from "./reward-review";
import type { RewardEntry, RewardPeriod, RewardProfile } from "./reward-types";
import { decimalString, decimalUnits, getMonthBounds, paymentSummary } from "./rewards";

export function paymentPosition(entry: RewardEntry) {
  const summary = paymentSummary(entry.confirmedAmount, entry.payments);
  const remaining = summary.difference?.startsWith("-") ? summary.difference.slice(1) : "0";
  return { ...summary, remaining };
}

export function rewardWorkflow(period: RewardPeriod | null, review: DraftReview | null, profiles: RewardProfile[]) {
  const draft = period?.status === "draft";
  const rows = (period?.entries ?? []).map(entry => {
    const issue = review?.entryIssues[entry.id];
    const payment = paymentPosition(entry);
    const outstanding = !draft && payment.remaining !== "0";
    const overpaid = !draft && payment.status === "Overpaid";
    return { entry, issue, payment, outstanding, overpaid, priority: issue || outstanding ? 0 : overpaid ? 1 : 2 };
  }).sort((left, right) => left.priority - right.priority);
  const attention = rows.filter(row => row.issue || row.outstanding);
  const overpaid = rows.filter(row => row.overpaid);
  let total = 0n;
  let paid = 0n;
  let incomplete = false;
  for (const { entry } of rows) {
    const value = entry.confirmedAmount ?? entry.overrideAmount ?? entry.calculatedAmount;
    if (value == null) incomplete = true;
    else total += decimalUnits(value);
    for (const payment of entry.payments) paid += decimalUnits(payment.amount);
  }
  function nextStep() {
    if (!period) return "create";
    if (!draft) return attention.length ? "payments" : overpaid.length ? "overpaid" : "complete";
    const issues = review?.monthIssues.map(issue => issue.code) ?? [];
    if (issues.includes("noParticipants")) {
      const end = getMonthBounds(period.month).end;
      const available = profiles.filter(p => new Date(p.nodeCreatedAt) < end);
      if (profiles.length && !available.length) return "chooseMonth";
      return available.some(p => p.eligible) ? "refresh" : "participants";
    }
    if (issues.includes("refresh")) return "refresh";
    if (issues.includes("priceMissing")) return "price";
    if (attention.length) return "entries";
    if (issues.includes("monthOpen")) return "wait";
    return "confirm";
  }
  return { rows, attention, overpaid, step: nextStep(), total: incomplete ? null : decimalString(total), paid: decimalString(paid) };
}

export type RewardRow = ReturnType<typeof rewardWorkflow>["rows"][number];
