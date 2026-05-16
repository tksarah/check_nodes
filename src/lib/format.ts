import { AvailabilitySummary } from "./types";

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo"
  }).format(new Date(date));
}

export function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export function formatHours(value: number) {
  if (value < 1) return `${Math.round(value * 60)}m`;
  return `${value.toFixed(1)}h`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null) return "-";

  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function averageAvailability(summaries: AvailabilitySummary[]) {
  const observed = summaries.filter((summary) => summary.availabilityPercent != null);

  if (observed.length === 0) return null;

  return (
    observed.reduce((total, summary) => total + (summary.availabilityPercent ?? 0), 0) /
    observed.length
  );
}
