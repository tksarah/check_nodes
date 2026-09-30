import { amount, RewardError } from "./rewards";

type PriceResponse = {
  code?: number;
  data?: { ema30_average?: string; list?: Array<{ feed_at?: number; price?: string }> };
};

export function extractDailyEma30(body: PriceResponse, date: string): string {
  const rows = body.data?.list;
  // A range average is accepted only when the response proves it contains
  // exactly the requested UTC calendar day. Never use the ordinary `price`.
  if (body.code !== 0 || !rows || rows.length !== 1 || typeof rows[0].feed_at !== "number" || !body.data?.ema30_average) {
    throw new RewardError("Subscan did not provide a verifiable single-day EMA30. Enter the verified price manually.");
  }
  const timestamp = rows[0].feed_at * 1000;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new RewardError("Subscan returned a different price date. Enter the verified price manually.");
  }
  try {
    return amount(body.data.ema30_average, true);
  } catch {
    throw new RewardError("Subscan did not provide a positive valid EMA30. Enter the verified price manually.");
  }
}

export async function fetchRewardPrice(date: string, fetcher: typeof fetch = fetch) {
  const pubfiKey = process.env.PUBFI_API_KEY?.trim();
  const key = pubfiKey || process.env.SUBSCAN_API_KEY?.trim();
  if (!key) throw new RewardError("PUBFI_API_KEY or SUBSCAN_API_KEY is not configured. Enter the verified EMA30 manually.");
  // PubFi credentials belong only to its gateway. The explicit free variant
  // must never fall back to a paid route or forward the key to Subscan.
  const url = pubfiKey
    ? "https://api.pubfi.ai/v1/gateway/subscan/astar/api/scan/price/history:free"
    : "https://astar.api.subscan.io/api/scan/price/history";
  const authentication: Record<string, string> = pubfiKey ? { Authorization: `Bearer ${key}` } : { "X-API-Key": key };
  try {
    const response = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authentication },
      // On the Astar network route the default is the native ASTR/USD series.
      // The optional selector `currency: "usd"` returned no rows in live verification.
      body: JSON.stringify({ format: "day", start: date, end: date }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store"
    });
    if (!response.ok) throw new RewardError(`Subscan price request failed (HTTP ${response.status}). Enter the price manually.`);
    const price = extractDailyEma30(await response.json(), date);
    return { price, source: `Subscan single-day EMA30 (UTC)${pubfiKey ? ", via PubFi" : ""}`, fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof RewardError) throw error;
    throw new RewardError("Subscan price request failed or timed out. Enter the verified price manually.");
  }
}
