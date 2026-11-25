import { describe, expect, it } from "vitest";
import { rewardProblemText } from "./reward-feedback";
import { reviewRewardDraft } from "./reward-review";
import { paymentPosition, rewardWorkflow } from "./reward-workflow";
import { japanDate } from "./rewards";
import { rewardFixture } from "./test-fixtures/reward-period";

const end = new Date("2026-08-31T15:00:00Z");
function draft() {
  const p = rewardFixture();
  p.status = "draft";
  const entry = p.entries[0];
  entry.confirmedAmount = null;
  entry.adjustmentReason = "";
  entry.payments = [];
  entry.address = "aZkj2EgiZkUbnKk6XMp9pf9f9SALXSAaTgz17ZEYUaq2UZy";
  return p;
}
describe("reward manager next action", () => {
  it("shows a missing monthly price once, including when many entries have no amount yet", () => {
    const p = draft();
    p.priceUsd = null;
    p.entries[0].calculatedAmount = null;
    p.entries.push({ ...p.entries[0], id: "2" });
    const review = reviewRewardDraft(p, end);
    expect(review.entryIssues).toEqual({});
    expect(rewardWorkflow(p, review, [])).toMatchObject({ step: "price", total: null, attention: [] });
  });
  it("distinguishes advisory gaps, the JST month boundary, stale observations and missing participants", () => {
    const p = draft();
    p.entries[0].availability.longGapCount = 3;
    expect(rewardWorkflow(p, reviewRewardDraft(p, end), []).step).toBe("confirm");
    const beforeEnd = new Date(end.getTime() - 1);
    expect(japanDate(beforeEnd)).toBe("2026-08-31");
    expect(japanDate(end)).toBe("2026-09-01");
    expect(rewardWorkflow(p, reviewRewardDraft(p, beforeEnd), []).step).toBe("wait");
    p.observedAt = beforeEnd.toISOString();
    expect(rewardWorkflow(p, reviewRewardDraft(p, end), []).step).toBe("refresh");
    p.entries = [];
    expect(rewardWorkflow(p, reviewRewardDraft(p, end), []).step).toBe("participants");
    const profile = { nodeId: 1, label: "Archive", monitoringEnabled: false, nodeCreatedAt: end.toISOString(),
      discordName: "", region: "", address: "", identityName: "", hasIdentity: false, eligible: true, version: 1 };
    expect(rewardWorkflow(p, reviewRewardDraft(p, end), [profile]).step).toBe("chooseMonth");
    profile.nodeCreatedAt = beforeEnd.toISOString();
    expect(rewardWorkflow(p, reviewRewardDraft(p, end), [profile]).step).toBe("refresh");
  });
  it("places unresolved rows first, supports reasoned zero, and checks the snapshot address", () => {
    const p = draft();
    const missing = { ...p.entries[0], id: "2", label: "Node B", calculatedAmount: null,
      availability: { ...p.entries[0].availability, availabilityPercent: null } };
    p.entries.push(missing);
    let flow = rewardWorkflow(p, reviewRewardDraft(p, end), []);
    expect(flow.step).toBe("entries");
    expect(flow.rows.map(row => row.entry.id)).toEqual(["2", "1"]);
    expect(rewardProblemText(flow.attention[0].issue!, "ja")).toContain("Node B");
    p.entries[1].overrideAmount = "0";
    expect(reviewRewardDraft(p, end).entryIssues["2"].field).toBe("reason");
    p.entries[1].adjustmentReason = "No operation this month";
    flow = rewardWorkflow(p, reviewRewardDraft(p, end), []);
    expect(flow.step).toBe("confirm");
    p.entries[1].address = "invalid";
    expect(reviewRewardDraft(p, end).entryIssues["2"].field).toBe("address");
  });
  it("prefills exact remaining amounts and separates complete and excess payments", () => {
    const p = rewardFixture();
    const e = p.entries[0];
    e.confirmedAmount = "100.000000000000000001";
    e.payments[0].amount = "40";
    expect(paymentPosition(e).remaining).toBe("60.000000000000000001");
    expect(rewardWorkflow(p, null, []).step).toBe("payments");
    e.payments[0].amount = e.confirmedAmount;
    expect(rewardWorkflow(p, null, []).step).toBe("complete");
    e.payments[0].amount = "101";
    expect(paymentPosition(e).remaining).toBe("0");
    expect(rewardWorkflow(p, null, []).step).toBe("overpaid");
    e.payments[0].amount = "99999999999999999999";
    e.payments.push({ ...e.payments[0], id: "9", amount: "1" });
    expect(rewardWorkflow(p, null, []).paid).toBe("100000000000000000000");
  });
});
