import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractDailyEma30, fetchRewardPrice } from "./reward-price";

const date = "2026-09-01";
const feedAt = Date.parse(`${date}T00:00:00Z`)/1000;
const valid = {code:0,data:{ema30_average:"0.0051",list:[{feed_at:feedAt,price:"0.9"}]}};
beforeEach(() => vi.stubEnv("PUBFI_API_KEY",""));
afterEach(() => vi.unstubAllEnvs());
describe("verified Subscan EMA30", () => {
  it("uses single-day EMA30, never the ordinary price", () => {
    expect(extractDailyEma30(valid,date)).toBe("0.0051");
  });
  it.each([
    {code:1,data:valid.data}, {code:0,data:{list:valid.data.list}},
    {code:0,data:{ema30_average:"0",list:valid.data.list}},
    {code:0,data:{ema30_average:"0.0051",list:[]}},
    {code:0,data:{ema30_average:"0.0051",list:[{feed_at:feedAt-86400}]}},
    {code:0,data:{ema30_average:"0.0051",list:[{feed_at:feedAt},{feed_at:feedAt+86400}]}}
  ])("rejects unavailable, wrong-day and range-average responses",body => {
    expect(() => extractDailyEma30(body,date)).toThrow();
  });
  it("explains missing credentials without sending a request", async () => {
    vi.stubEnv("SUBSCAN_API_KEY","");
    const fetcher = vi.fn();
    await expect(fetchRewardPrice(date,fetcher)).rejects.toThrow("not configured");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requests a single day on the server", async () => {
    vi.stubEnv("SUBSCAN_API_KEY","test-secret");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(valid),{status:200}));
    expect((await fetchRewardPrice(date,fetcher)).price).toBe("0.0051");
    const [url,options] = fetcher.mock.calls[0];
    expect(url).toBe("https://astar.api.subscan.io/api/scan/price/history");
    expect(JSON.parse(options.body)).toEqual({format:"day",start:date,end:date});
    expect(options.headers["X-API-Key"]).toBe("test-secret");
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.cache).toBe("no-store");
  });
  it("uses the Astar free gateway with Bearer authentication for PubFi", async () => {
    vi.stubEnv("PUBFI_API_KEY","pubfi-test-secret");
    vi.stubEnv("SUBSCAN_API_KEY","direct-test-secret");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(valid),{status:200}));
    const result = await fetchRewardPrice(date,fetcher);
    expect(result.source).toContain("via PubFi");
    const [url,options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.pubfi.ai/v1/gateway/subscan/astar/api/scan/price/history:free");
    expect(options.headers.Authorization).toBe("Bearer pubfi-test-secret");
    expect(options.headers["X-API-Key"]).toBeUndefined();
  });
  it("never retries PubFi failures on paid routes or with direct credentials", async () => {
    vi.stubEnv("PUBFI_API_KEY","pubfi-test-secret");
    vi.stubEnv("SUBSCAN_API_KEY","direct-test-secret");
    const fetcher = vi.fn().mockResolvedValue(new Response(null,{status:403}));
    await expect(fetchRewardPrice(date,fetcher)).rejects.toThrow("HTTP 403");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("falls back to manual entry for the live zero-EMA response",async () => {
    vi.stubEnv("PUBFI_API_KEY","pubfi-test-secret");
    const body = {code:0,data:{ema30_average:"0",list:[{feed_at:feedAt,price:"0.005544562166695712"}]}};
    await expect(fetchRewardPrice(date,vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))).rejects.toThrow();
  });
  it.each([401,429,500])("provides manual fallback for HTTP %s",async status => {
    vi.stubEnv("SUBSCAN_API_KEY","test-secret");
    await expect(fetchRewardPrice(date,vi.fn().mockResolvedValue(new Response(null,{status})))).rejects.toThrow(`HTTP ${status}`);
  });
  it("provides manual fallback after timeout without exposing credentials", async () => {
    vi.stubEnv("SUBSCAN_API_KEY","test-secret");
    await expect(fetchRewardPrice(date,vi.fn().mockRejectedValue(new Error("test-secret")))).rejects.toThrow("timed out");
  });
});
