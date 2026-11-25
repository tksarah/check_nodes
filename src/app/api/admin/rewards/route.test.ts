import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminCsrf } from "../../../../lib/auth";
import { fetchRewardPrice } from "../../../../lib/reward-price";
import { createRewardPeriod, saveAutomaticRewardPrice, saveRewardPayment } from "../../../../lib/reward-repository";
import { RewardError } from "../../../../lib/rewards";
import type { RewardPeriod } from "../../../../lib/reward-types";
import { POST } from "./route";

vi.mock("../../../../lib/auth", () => ({ requireAdminCsrf: vi.fn() }));
vi.mock("../../../../lib/reward-price", () => ({ fetchRewardPrice: vi.fn() }));
vi.mock("../../../../lib/reward-repository", () => ({
  createRewardPeriod: vi.fn(), saveAutomaticRewardPrice: vi.fn(), saveRewardPayment: vi.fn()
}));

function request(fields: Record<string, string> = {}, json = true) {
  return new Request("http://localhost/api/admin/rewards", {
    method: "POST", headers: { Accept: json ? "application/json" : "text/html" },
    body: new URLSearchParams({ month: "2026-08", action: "create", ...fields })
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAdminCsrf).mockResolvedValue(null);
  vi.mocked(createRewardPeriod).mockResolvedValue({ version: 1, priceDate: "2026-08-01" } as RewardPeriod);
});
describe("monthly reward actions", () => {
  it("uses the committed draft version and its UTC price date once", async () => {
    const price = { price: "0.005", source: "Subscan", fetchedAt: "2026-09-01T00:00:00Z" };
    vi.mocked(fetchRewardPrice).mockResolvedValue(price);
    expect(await (await POST(request())).json()).toEqual({ saved: true });
    expect(fetchRewardPrice).toHaveBeenCalledTimes(1);
    expect(fetchRewardPrice).toHaveBeenCalledWith("2026-08-01");
    expect(saveAutomaticRewardPrice).toHaveBeenCalledWith("2026-08", 1, price);
  });
  it("keeps a successfully created draft on upstream failure or a later concurrent edit", async () => {
    vi.mocked(fetchRewardPrice).mockRejectedValueOnce(new RewardError("priceKey"));
    expect(await (await POST(request())).json()).toEqual({ saved: true, warning: { code: "priceKey" } });
    expect(saveAutomaticRewardPrice).not.toHaveBeenCalled();
    vi.mocked(saveAutomaticRewardPrice).mockRejectedValueOnce(new RewardError("ledgerChanged", 409));
    expect(await (await POST(request())).json()).toEqual({ saved: true, warning: { code: "ledgerChanged" } });
  });
  it("avoids price calls on duplicate creates and returns field-specific errors without redirecting", async () => {
    vi.mocked(createRewardPeriod).mockRejectedValue(new RewardError("ledgerExists", 409));
    expect((await POST(request())).status).toBe(409);
    expect(fetchRewardPrice).not.toHaveBeenCalled();
    vi.mocked(saveRewardPayment).mockRejectedValue(new RewardError("duplicateTx", 409, "txUrl"));
    const response = await POST(request({ action: "payment", version: "2", entryId: "1" }));
    expect(await response.json()).toEqual({ problem: { code: "duplicateTx", field: "txUrl" } });
  });
  it("keeps form redirects and denies an expired form before modifying a ledger", async () => {
    vi.mocked(fetchRewardPrice).mockRejectedValue(new RewardError("priceNetwork"));
    expect((await POST(request({}, false))).headers.get("Location")).toBe("/admin/rewards?month=2026-08&saved=1&warning=priceNetwork");
    vi.mocked(requireAdminCsrf).mockResolvedValue(new Response(null, { status: 403 }));
    expect(await (await POST(request())).json()).toEqual({ problem: { code: "csrf" } });
    expect(createRewardPeriod).toHaveBeenCalledTimes(1);
  });
});
