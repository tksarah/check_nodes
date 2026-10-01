import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSourceBalance, fetchRewardSourceBalance, REWARD_SOURCE_ADDRESS } from "./reward-source-balance";
import { displayAmount } from "./rewards";

// Whitelisted fields from the verified Astar response. Other account data is private.
const account = { address: REWARD_SOURCE_ADDRESS, balance: "217824.5760291882110941",
  transferable_balance: "217824576029188211094128", privateField: "must not be returned" };
const valid = { code: 0, data: { account }, generated_at: 1790896411, privateField: "must not be returned" };
afterEach(() => vi.unstubAllEnvs());

describe("reward source account balances", () => {
  it("normalizes the live response's different units without losing 18-place precision", () => {
    const result = extractSourceBalance(valid);
    expect(result).toEqual({ address: REWARD_SOURCE_ADDRESS, transferableAstr: "217824.576029188211094128",
      balanceAstr: "217824.5760291882110941", sourceGeneratedAt: new Date(1790896411 * 1000).toISOString() });
    expect(displayAmount(result.transferableAstr)).toBe("217,824.58");
    expect(JSON.stringify(result)).not.toContain("privateField");
  });
  it("accepts zero balances as a successful result", () => {
    const result = extractSourceBalance({ code: 0, data: { account: { ...account, balance: "0", transferable_balance: "0" } } });
    expect(result.transferableAstr).toBe("0");
    expect(result.balanceAstr).toBe("0");
    expect(result.sourceGeneratedAt).toBeNull();
  });
  it.each([null, {}, { code: 1, data: valid.data }, { code: 0, data: {} },
    { code: 0, data: { account: { ...account, address: "different-account" } } },
    ...[undefined, "-1", "1.5", "1e18", 0].map(transferable_balance => ({ code: 0, data: { account: { ...account, transferable_balance } } })),
    ...[undefined, "-1", "NaN", "1e5", "0.0000000000000000001", 0].map(balance => ({ code: 0, data: { account: { ...account, balance } } }))
  ])("rejects missing, wrong-account and invalid monetary data", body => {
    expect(() => extractSourceBalance(body)).toThrow();
  });
  it("requests only the fixed Astar account through the free authenticated gateway", async () => {
    vi.stubEnv("PUBFI_API_KEY", "test-pubfi-key");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(valid)));
    const result = await fetchRewardSourceBalance(fetcher);
    expect(Number.isFinite(Date.parse(result.fetchedAt))).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["address", "balanceAstr", "fetchedAt", "sourceGeneratedAt", "transferableAstr"]);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.pubfi.ai/v1/gateway/subscan/astar/api/v2/scan/search:free");
    expect(options.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer test-pubfi-key" });
    expect(JSON.parse(options.body)).toEqual({ key: REWARD_SOURCE_ADDRESS });
    expect(options.cache).toBe("no-store");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(result)).not.toContain("test-pubfi-key");
  });
  it("does not call an upstream API or use a direct key when PubFi is unconfigured", async () => {
    vi.stubEnv("PUBFI_API_KEY", "");
    vi.stubEnv("SUBSCAN_API_KEY", "direct-key");
    const fetcher = vi.fn();
    await expect(fetchRewardSourceBalance(fetcher)).rejects.toThrow("not configured");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 429, 500])("does not retry or reveal upstream responses after HTTP %s", async status => {
    vi.stubEnv("PUBFI_API_KEY", "test-pubfi-key");
    const fetcher = vi.fn().mockResolvedValue(new Response("test-pubfi-key private account data", { status }));
    await expect(fetchRewardSourceBalance(fetcher)).rejects.toThrow(`HTTP ${status}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("sanitizes network errors and malformed JSON", async () => {
    vi.stubEnv("PUBFI_API_KEY", "test-pubfi-key");
    await expect(fetchRewardSourceBalance(vi.fn().mockRejectedValue(new Error("test-pubfi-key"))))
      .rejects.toThrow("request timed out");
    await expect(fetchRewardSourceBalance(vi.fn().mockResolvedValue(new Response("invalid JSON test-pubfi-key"))))
      .rejects.toThrow("request timed out");
  });
});
