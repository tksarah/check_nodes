import { amount, decimalString, RewardError } from "./rewards";
import type { RewardSourceBalance } from "./reward-source-balance-types";

export const REWARD_SOURCE_ADDRESS = "XMk7AFJR9MZFqMQwwghyiEdqJEu42TahSNkbY5SXbjws8Su";
const endpoint = "https://api.pubfi.ai/v1/gateway/subscan/astar/api/v2/scan/search:free";

function object(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

export function extractSourceBalance(body: unknown): Omit<RewardSourceBalance, "fetchedAt"> {
  const response = object(body);
  const account = object(object(response.data).account);
  if (response.code !== 0 || account.address !== REWARD_SOURCE_ADDRESS) {
    throw new RewardError("Subscan did not return the expected reward source account.", 502);
  }
  // Unlike `balance` (ASTR), `transferable_balance` is an integer in 10^-18 ASTR.
  if (typeof account.transferable_balance !== "string" || !/^\d{1,38}$/.test(account.transferable_balance)
    || typeof account.balance !== "string") {
    throw new RewardError("Subscan did not provide valid account balances.", 502);
  }
  let balanceAstr: string;
  try { balanceAstr = amount(account.balance); } catch {
    throw new RewardError("Subscan did not provide a valid reference balance.", 502);
  }
  const generatedAt = response.generated_at;
  const generatedMs = typeof generatedAt === "number" && Number.isSafeInteger(generatedAt) && generatedAt > 0
    ? generatedAt * 1000 : NaN;
  return {
    address: REWARD_SOURCE_ADDRESS,
    transferableAstr: decimalString(BigInt(account.transferable_balance)),
    balanceAstr,
    sourceGeneratedAt: Number.isFinite(new Date(generatedMs).getTime()) ? new Date(generatedMs).toISOString() : null
  };
}

export async function fetchRewardSourceBalance(fetcher: typeof fetch = fetch): Promise<RewardSourceBalance> {
  const key = process.env.PUBFI_API_KEY?.trim();
  if (!key) throw new RewardError("PUBFI_API_KEY is not configured on the server.", 503);
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ key: REWARD_SOURCE_ADDRESS }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store"
    });
    if (!response.ok) throw new RewardError(`PubFi balance request failed (HTTP ${response.status}). Try again later.`, 502);
    return { ...extractSourceBalance(await response.json()), fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof RewardError) throw error;
    throw new RewardError("Reward source balance could not be fetched or the request timed out. Try again later.", 502);
  }
}
