import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { requireAdmin } from "../../../../../lib/auth";
import { fetchRewardSourceBalance } from "../../../../../lib/reward-source-balance";
import { RewardError } from "../../../../../lib/rewards";

vi.mock("../../../../../lib/auth", () => ({ requireAdmin: vi.fn() }));
vi.mock("../../../../../lib/reward-source-balance", () => ({ fetchRewardSourceBalance: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe("private source balance API", () => {
  it("rejects unauthenticated requests before making upstream calls", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 }));
    const result = await GET();
    expect(result.status).toBe(401);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(fetchRewardSourceBalance).not.toHaveBeenCalled();
  });
  it("returns only the dedicated balance result with private no-store caching", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);
    const balance = { address: "source-account", transferableAstr: "1.01", balanceAstr: "2.02",
      fetchedAt: "2026-10-02T00:00:00Z", sourceGeneratedAt: null };
    vi.mocked(fetchRewardSourceBalance).mockResolvedValue(balance);
    const result = await GET();
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(balance);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("reports unavailable balances instead of inventing zero", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);
    vi.mocked(fetchRewardSourceBalance).mockRejectedValue(new RewardError("PUBFI_API_KEY is not configured on the server.", 503));
    const result = await GET();
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ error: "PUBFI_API_KEY is not configured on the server." });
  });
  it("does not expose unexpected exception contents", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(null);
    vi.mocked(fetchRewardSourceBalance).mockRejectedValue(new Error("secret upstream response"));
    const result = await GET();
    expect(result.status).toBe(502);
    expect(JSON.stringify(await result.json())).not.toContain("secret");
  });
});
