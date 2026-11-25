import { describe, expect, it } from "vitest";
import { publicRewardPeriod } from "./reward-public";
import { rewardCsv } from "./reward-csv";
import { csvCell } from "./rewards";
import { rewardFixture } from "./test-fixtures/reward-period";
describe("reward publication boundary", () => {
  it("never publishes drafts", () => {
    const period = rewardFixture(); period.status="draft";
    expect(publicRewardPeriod(period)).toBeNull();
  });
  it("exposes only explicitly allowed fields, even with future private fields", () => {
    const period = rewardFixture();
    Object.assign(period,{newPrivateField:"future secret"});
    Object.assign(period.entries[0],{newPrivateField:"future secret"});
    Object.assign(period.entries[0].availability,{newPrivateField:"future secret"});
    const result = publicRewardPeriod(period)!;
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/secret|private|address|discord|memo|override|adjustmentReason|"version"|newPrivateField/i);
    expect(result.totalReward).toBe("3750");
    expect(result.totalPaid).toBe("3750");
    expect(result.entries[0].status).toBe("Paid");
    expect(result.entries[0].payments[0].txUrl).toContain("subscan");
  });
  it("admin CSV retains full precision, escapes content and prevents formula injection", () => {
    const period=rewardFixture();
    period.entries[0].label='=HYPERLINK("bad")';
    period.entries[0].confirmedAmount="0.000000000000000001";
    const csv = rewardCsv(period);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("0.000000000000000001");
    expect(csv).toContain(`"'=HYPERLINK(""bad"")"`);
    expect(csv).toContain("secret payment address");
    expect(csvCell("-0.000000000000000001")).toBe('"-0.000000000000000001"');
  });
});
