import type { RewardPeriod } from "./reward-types";
import { csvCell, paymentSummary } from "./rewards";

export function rewardCsv(period: RewardPeriod) {
  const headers = ["Month (JST)","Payment month","Ledger status","Node","Discord name","Region","Payment address","Identity name","Has identity",
    "State","Availability %","Online hours","Observed hours","Sample count","Long gap count","Unobserved hours","Base USD","EMA30 USD/ASTR",
    "Price date (UTC)","Price source","Price recorded at","Price reason","Calculated ASTR","Adjusted ASTR","Adjustment reason","Confirmed ASTR","Paid ASTR","Paid minus confirmed ASTR","Payment status","Payments (date / amount / Tx / internal memo)"];
  const rows = period.entries.map(e => {
    const p = paymentSummary(e.confirmedAmount,e.payments);
    return [period.month,period.paymentMonth,period.status,e.label,e.discordName,e.region,e.address,e.identityName,e.hasIdentity,e.state,
      e.availability.availabilityPercent,e.availability.onlineHours,e.availability.totalObservedHours,e.availability.sampleCount,e.availability.longGapCount,e.availability.unobservedHours,
      period.baseUsd,period.priceUsd,period.priceDate,period.priceSource,period.priceFetchedAt,period.priceReason,e.calculatedAmount,e.overrideAmount,e.adjustmentReason,e.confirmedAmount,
      p.paidAmount,p.difference,p.status,e.payments.map(payment => `${payment.paidOn} / ${payment.amount} / ${payment.txUrl} / ${payment.memo}`).join("\n")];
  });
  return "\uFEFF" + [headers,...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
}
