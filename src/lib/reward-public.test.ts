import { describe, expect, it } from "vitest";
import { publicRewardPeriod } from "./reward-public";
import { rewardCsv } from "./reward-csv";
import { csvCell } from "./rewards";
import type { RewardPeriod } from "./reward-types";

export function rewardFixture(): RewardPeriod {
  return {id:"1",month:"2026-08",paymentMonth:"2026-09",priceDate:"2026-08-01",baseUsd:"30",priceUsd:"0.008",priceSource:"Manual EMA30",
    priceFetchedAt:"2026-09-01T00:00:00Z",priceReason:"private price note",status:"confirmed",version:2,observedAt:"2026-09-01T00:00:00Z",confirmedAt:"2026-09-01T00:00:00Z",
    ruleVersion:"peers-v1",checkIntervalMinutes:60,entries:[{id:"1",nodeId:1,nodeRef:1,label:"Example",discordName:"secret Discord",region:"Japan",address:"secret payment address",identityName:"secret Identity",
      hasIdentity:true,availability:{onlineHours:744,totalObservedHours:744,availabilityPercent:100,sampleCount:744,longGapCount:0,unobservedHours:0,periodHours:744},
      state:"normal",calculatedAmount:"3750",overrideAmount:null,adjustmentReason:"private reason",confirmedAmount:"3750",statePercent:100,identityPercent:100,
      payments:[{id:"1",entryId:"1",amount:"3750",paidOn:"2026-09-01",txUrl:"https://astar.subscan.io/extrinsic/1-1",memo:"secret memo",version:1,createdAt:"2026-09-01T00:00:00Z"}]}]};
}
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
