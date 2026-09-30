import type { RewardPeriod } from "./reward-types";
import { decimalString, decimalUnits, paymentSummary } from "./rewards";

export function publicRewardPeriod(period: RewardPeriod) {
  if (period.status !== "confirmed") return null;
  // Explicit allowlist: never spread database objects into public responses.
  const entries = period.entries.map(entry => ({
    id: entry.id, label: entry.label, availability: {
      onlineHours: entry.availability.onlineHours, totalObservedHours: entry.availability.totalObservedHours,
      availabilityPercent: entry.availability.availabilityPercent, sampleCount: entry.availability.sampleCount,
      longGapCount: entry.availability.longGapCount, unobservedHours: entry.availability.unobservedHours,
      periodHours: entry.availability.periodHours
    },
    state: entry.state, statePercent: entry.statePercent, identityPercent: entry.identityPercent,
    calculatedAmount: entry.calculatedAmount, confirmedAmount: entry.confirmedAmount,
    ...paymentSummary(entry.confirmedAmount, entry.payments),
    payments: entry.payments.map(payment => ({ amount: payment.amount, paidOn: payment.paidOn, txUrl: payment.txUrl }))
  }));
  return {
    month: period.month, paymentMonth: period.paymentMonth, priceDate: period.priceDate,
    baseUsd: period.baseUsd, priceUsd: period.priceUsd, priceSource: period.priceSource,
    confirmedAt: period.confirmedAt, observedAt: period.observedAt, ruleVersion: period.ruleVersion,
    totalReward: decimalString(entries.reduce((sum, entry) => sum + decimalUnits(entry.confirmedAmount ?? "0"), 0n)),
    totalPaid: decimalString(entries.reduce((sum, entry) => sum + decimalUnits(entry.paidAmount), 0n)),
    entries
  };
}
