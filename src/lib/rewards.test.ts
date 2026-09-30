import { describe, expect, it } from "vitest";
import { amount, calculateReward, currentMonth, decimalString, decimalUnits, displayAmount, getMonthBounds, paymentSummary, previousMonth, summarizeMonth, validateTxUrl } from "./rewards";
import { validatePaymentDate, validateRewardAddress } from "./reward-validation";

describe("reward money arithmetic", () => {
  it("matches the spreadsheet examples without floating-point rounding", () => {
    expect(calculateReward("30","0.008","normal",99,true).calculatedAmount).toBe("3750");
    expect(calculateReward("30","0.008","recovery",99,true).calculatedAmount).toBe("1125");
    expect(calculateReward("30","0.0233","normal",79,true).calculatedAmount).toBe("643.776824034334763948");
    expect(calculateReward("30","0.0051","normal",100,true).calculatedAmount).toBe("5882.352941176470588235");
  });
  it.each([[79.999999,50],[80,100],[80.000001,100]])("uses the unrounded 80%% boundary (%s)",(rate, factor) => {
    expect(calculateReward("30","1","normal",rate,true).statePercent).toBe(factor);
  });
  it("applies recovery/inactive first and then Identity reduction", () => {
    expect(calculateReward("30","1","recovery",null,false).calculatedAmount).toBe("4.5");
    expect(calculateReward("30","1","inactive",null,false).calculatedAmount).toBe("0");
    expect(calculateReward("30","1","normal",79,false).calculatedAmount).toBe("7.5");
  });
  it("distinguishes unknown, zero, and missing price", () => {
    expect(calculateReward("30","1","normal",null,true).calculatedAmount).toBeNull();
    expect(calculateReward("30",null,"inactive",0,true).calculatedAmount).toBeNull();
    expect(() => calculateReward("30","0","normal",100,true)).toThrow();
    expect(amount("0")).toBe("0");
    expect(() => amount("0",true)).toThrow();
  });
  it("preserves at most 18 places and rejects unsafe input", () => {
    expect(decimalString(decimalUnits("00012.000000000000000001"))).toBe("12.000000000000000001");
    expect(displayAmount("12345.123456999999999999")).toBe("12,345.123456");
    for (const bad of ["-1","1e18","NaN","1.0000000000000000001","", "1,000"]) expect(() => decimalUnits(bad)).toThrow();
  });
  it.each([["0","Unpaid","-10"],["3","Partially paid","-7"],["10","Paid","0"],["11","Overpaid","1"]])("reconciles %s ASTR",(paid,status,difference) => {
    expect(paymentSummary("10",[{amount:paid}])).toEqual({paidAmount:paid,status,difference});
  });
  it("aggregates partial payments exactly, and handles no-payment rewards", () => {
    expect(paymentSummary("0.3",[{amount:"0.1"},{amount:"0.2"}]).status).toBe("Paid");
    expect(paymentSummary("0",[]).status).toBe("Not payable");
    expect(paymentSummary(null,[]).status).toBe("Draft");
  });
});

describe("calendar month availability", () => {
  it("uses JST month boundaries and handles leap years and December", () => {
    const leap = getMonthBounds("2024-02");
    expect(leap.start.toISOString()).toBe("2024-01-31T15:00:00.000Z");
    expect(leap.end.toISOString()).toBe("2024-02-29T15:00:00.000Z");
    expect((leap.end.getTime()-leap.start.getTime())/3_600_000).toBe(696);
    expect(getMonthBounds("2026-12").paymentMonth).toBe("2027-01");
    expect(currentMonth(new Date("2026-09-30T15:00:00Z"))).toBe("2026-10");
    expect(previousMonth(new Date("2026-01-01T00:00:00Z"))).toBe("2025-12");
  });
  it.each(["2026-13","2026-00","2026-9","x","1900-01"])('rejects invalid month %s',(month) => expect(() => getMonthBounds(month)).toThrow());
  const start = new Date("2026-08-31T15:00:00Z");
  const end = new Date("2026-09-30T15:00:00Z");
  const sample = (hours: number, isOnline: boolean) => ({checkedAt:new Date(start.getTime()+hours*3_600_000),isOnline});
  it("clips intervals across both month edges and preserves either-side-online semantics", () => {
    const summary = summarizeMonth([sample(-1,false),sample(1,true),sample(719,false),sample(721,false)],start,end,60,new Date(end.getTime()+3_600_000));
    expect(summary.sampleCount).toBe(2);
    expect(summary.onlineHours).toBe(719);
    expect(summary.totalObservedHours).toBe(720);
    expect(summary.availabilityPercent).toBeCloseTo(719/720*100);
    expect(summary.unobservedHours).toBe(0);
    expect(summary.longGapCount).toBe(1);
  });
  it("caps the current month at now and excludes future observations", () => {
    const summary = summarizeMonth([sample(0,true),sample(1,false),sample(3,true)],start,end,60,sample(2,true).checkedAt);
    expect(summary.periodHours).toBe(2);
    expect(summary.totalObservedHours).toBe(2);
    expect(summary.onlineHours).toBe(1);
    expect(summary.availabilityPercent).toBe(50);
  });
  it("returns unknown for insufficient or missing data instead of zero", () => {
    expect(summarizeMonth([],start,end,60,end).availabilityPercent).toBeNull();
    expect(summarizeMonth([sample(1,true)],start,end,60,end).availabilityPercent).toBeNull();
    expect(summarizeMonth([sample(-2,true),sample(-1,true)],start,end,60,end).availabilityPercent).toBeNull();
    expect(summarizeMonth([sample(-2,true),sample(-1,true)],start,end,60,end).totalObservedHours).toBe(0);
    expect(summarizeMonth([sample(-2,true),sample(-1,true)],start,end,60,end).unobservedHours).toBe(720);
  });
  it("counts an all-offline observed month as zero and flags missing edges", () => {
    const summary = summarizeMonth([sample(10,false),sample(11,false)],start,end,60,end);
    expect(summary.availabilityPercent).toBe(0);
    expect(summary.unobservedHours).toBe(10);
    expect(summary.longGapCount).toBe(1);
  });
});

describe("payment validation", () => {
  it.each(["aZkj2EgiZkUbnKk6XMp9pf9f9SALXSAaTgz17ZEYUaq2UZy","X2mhhtngdrRtXyyJy89KGfQojc24Jhy8wKzi2h2HVXiNKhk"])("validates spreadsheet SS58 AccountId32 addresses",address => {
    expect(validateRewardAddress(address)).toBe(address);
    expect(() => validateRewardAddress(address.slice(0,-1)+"1")).toThrow();
  });
  it("rejects EVM and malformed addresses", () => {
    expect(() => validateRewardAddress("0x"+"1".repeat(40))).toThrow();
    expect(() => validateRewardAddress("invalid")).toThrow();
  });
  it("allows shared batch Tx across recipients and valid hash links", () => {
    expect(validateTxUrl("https://astar.subscan.io/extrinsic/10649617-2/")).toBe("https://astar.subscan.io/extrinsic/10649617-2");
    expect(validateTxUrl("https://astar.subscan.io/extrinsic/0x"+"a".repeat(64))).toContain("0x");
    for (const url of ["javascript:alert(1)","https://evil.test/extrinsic/1-1","https://astar.subscan.io.evil.test/extrinsic/1-1","https://astar.subscan.io/extrinsic/1-1?x=1","garbage"]) expect(() => validateTxUrl(url)).toThrow();
  });
  it("validates real calendar dates and rejects future transfers", () => {
    expect(validatePaymentDate("2024-02-29",new Date("2026-01-01"))).toBe("2024-02-29");
    expect(() => validatePaymentDate("2025-02-29")).toThrow();
    expect(() => validatePaymentDate("2026-10-01",new Date("2026-09-30T00:00:00Z"))).toThrow();
  });
});
