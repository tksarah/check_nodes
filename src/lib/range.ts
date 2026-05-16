export type TrendRange = "24h" | "7d" | "30d";

const RANGE_DURATIONS: Record<TrendRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

export function parseTrendRange(value: string | string[] | undefined): TrendRange {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (normalized === "7d" || normalized === "30d") {
    return normalized;
  }

  return "24h";
}

export function getTrendSince(range: TrendRange, now = new Date()) {
  return new Date(now.getTime() - RANGE_DURATIONS[range]);
}

export const TREND_RANGES: Array<{ value: TrendRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" }
];
