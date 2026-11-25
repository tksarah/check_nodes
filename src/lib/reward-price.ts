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
    throw new RewardError("priceResponse");
  }
  const timestamp = rows[0].feed_at * 1000;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new RewardError("priceDate");
  }
  try {
    return amount(body.data.ema30_average, true);
  } catch {
    throw new RewardError("priceInvalid");
  }
}

export async function fetchRewardPrice(date: string, fetcher: typeof fetch = fetch) {
  const pubfiKey = process.env.PUBFI_API_KEY?.trim();
  const key = pubfiKey || process.env.SUBSCAN_API_KEY?.trim();
  if (!key) throw new RewardError("priceKey");
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
    if (!response.ok) throw new RewardError("priceHttp", 502, undefined, String(response.status));
    const price = extractDailyEma30(await response.json(), date);
    return { price, source: `Subscan single-day EMA30 (UTC)${pubfiKey ? ", via PubFi" : ""}`, fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof RewardError) throw error;
    throw new RewardError("priceNetwork", 502);
  }
}
