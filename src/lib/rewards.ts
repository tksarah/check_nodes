// Amounts are fixed-point decimal integers. No floating-point money arithmetic.
export const MONEY_SCALE = 10n ** 18n;
export const REWARD_RULE_VERSION = "peers-v1";
export type RewardState = "normal" | "recovery" | "inactive";
export type MonthlyAvailability = {
  onlineHours: number;
  totalObservedHours: number;
  availabilityPercent: number | null;
  sampleCount: number;
  longGapCount: number;
  unobservedHours: number;
  periodHours: number;
};

export class RewardError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function decimalUnits(value: string): bigint {
  if (!/^\d{1,20}(?:\.\d{1,18})?$/.test(value)) {
    throw new RewardError("Enter a non-negative decimal with at most 18 decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * MONEY_SCALE + BigInt(fraction.padEnd(18, "0"));
}

export function decimalString(value: bigint): string {
  const negative = value < 0n;
  const units = negative ? -value : value;
  const fraction = (units % MONEY_SCALE).toString().padStart(18, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${units / MONEY_SCALE}${fraction ? `.${fraction}` : ""}`;
}

export function amount(value: string, positive = false): string {
  const units = decimalUnits(value);
  if (positive && units === 0n) throw new RewardError("Amount must be greater than zero.");
  return decimalString(units);
}

export function displayAmount(value: string | null): string {
  if (value == null) return "—";
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(6, "0").slice(0, 6)}`;
}

export function getMonthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RewardError("Use a month in YYYY-MM format.");
  const [year, number] = month.split("-").map(Number);
  if (year < 2000 || year > 2199) throw new RewardError("Month must be between 2000 and 2199.");
  const start = new Date(Date.UTC(year, number - 1, 1, -9));
  const end = new Date(Date.UTC(year, number, 1, -9));
  const paymentMonth = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}`;
  return { start, end, paymentMonth, priceDate: `${month}-01` };
}

export function currentMonth(now = new Date()) {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 7);
}

export function previousMonth(now = new Date()) {
  const { start } = getMonthBounds(currentMonth(now));
  return currentMonth(new Date(start.getTime() - 1));
}

export function summarizeMonth(
  samples: Array<{ checkedAt: Date; isOnline: boolean }>,
  start: Date,
  end: Date,
  intervalMinutes: number,
  now = new Date()
): MonthlyAvailability {
  const from = start.getTime();
  const until = Math.max(from, Math.min(end.getTime(), now.getTime()));
  const sorted = samples.filter(s => s.checkedAt.getTime() <= now.getTime())
    .sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const sampleCount = sorted.filter(s => s.checkedAt.getTime() >= from && s.checkedAt.getTime() < until).length;
  const periodHours = (until - from) / 3_600_000;
  let onlineMs = 0, observedMs = 0, longGapCount = 0;
  const gapLimit = intervalMinutes * 60_000 * 2;
  for (let i = 0; i < sorted.length; i++) {
    const previous = sorted[i];
    const next = sorted[i + 1];
    const left = Math.max(from, previous.checkedAt.getTime());
    const right = Math.min(until, next?.checkedAt.getTime() ?? until);
    if (right <= left) continue;
    const duration = right - left;
    observedMs += duration;
    if (previous.isOnline || next?.isOnline) onlineMs += duration;
    if ((next?.checkedAt.getTime() ?? until) - previous.checkedAt.getTime() > gapLimit) longGapCount++;
  }
  const sufficient = sorted.length >= 2 && sampleCount > 0 && observedMs > 0;
  return {
    onlineHours: sufficient ? onlineMs / 3_600_000 : 0,
    totalObservedHours: sufficient ? observedMs / 3_600_000 : 0,
    availabilityPercent: sufficient ? onlineMs / observedMs * 100 : null,
    sampleCount, longGapCount, periodHours,
    unobservedHours: sufficient ? Math.max(0, periodHours - observedMs / 3_600_000) : periodHours
  };
}

export function calculateReward(base: string, price: string | null, state: RewardState, availability: number | null, identity: boolean) {
  const statePercent = state === "inactive" ? 0 : state === "recovery" ? 30 : availability == null ? null : availability >= 80 ? 100 : 50;
  const identityPercent = identity ? 100 : 50;
  if (price == null || statePercent == null) return { calculatedAmount: null, statePercent, identityPercent };
  const priceUnits = decimalUnits(price);
  if (priceUnits === 0n) throw new RewardError("Price must be greater than zero.");
  const units = decimalUnits(base) * BigInt(statePercent) * BigInt(identityPercent) * MONEY_SCALE / (10_000n * priceUnits);
  return { calculatedAmount: decimalString(units), statePercent, identityPercent };
}

export function paymentSummary(expected: string | null, payments: Array<{ amount: string }>) {
  const paid = payments.reduce((sum, payment) => sum + decimalUnits(payment.amount), 0n);
  if (expected == null) return { paidAmount: decimalString(paid), difference: null, status: "Draft" };
  const due = decimalUnits(expected);
  const difference = paid - due;
  const status = paid > due ? "Overpaid" : due === 0n ? "Not payable" : paid === due ? "Paid" : paid === 0n ? "Unpaid" : "Partially paid";
  return { paidAmount: decimalString(paid), difference: decimalString(difference), status };
}

export function validateTxUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new RewardError("Enter a valid Subscan transaction URL."); }
  if (url.protocol !== "https:" || url.hostname !== "astar.subscan.io" || !/^\/extrinsic\/(?:\d+-\d+|0x[\da-f]{64})\/?$/i.test(url.pathname) || url.search || url.hash || url.username || url.password) {
    throw new RewardError("Use an https://astar.subscan.io/extrinsic/… transaction link.");
  }
  return `https://astar.subscan.io${url.pathname.replace(/\/$/, "")}`;
}

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  // Avoid spreadsheet formula execution in user-provided labels and comments.
  const isDecimal = /^-?\d+(?:\.\d+)?$/.test(text);
  const safe = !isDecimal && /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
