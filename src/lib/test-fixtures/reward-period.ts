import type { RewardPeriod } from "../reward-types";

export function rewardFixture(): RewardPeriod {
  return {id:"1",month:"2026-08",paymentMonth:"2026-09",priceDate:"2026-08-01",baseUsd:"30",priceUsd:"0.008",priceSource:"Manual EMA30",
    priceFetchedAt:"2026-09-01T00:00:00Z",priceReason:"private price note",status:"confirmed",version:2,observedAt:"2026-09-01T00:00:00Z",confirmedAt:"2026-09-01T00:00:00Z",
    ruleVersion:"peers-v1",checkIntervalMinutes:60,entries:[{id:"1",nodeId:1,nodeRef:1,label:"Example",discordName:"secret Discord",region:"Japan",address:"secret payment address",identityName:"secret Identity",
      hasIdentity:true,availability:{onlineHours:744,totalObservedHours:744,availabilityPercent:100,sampleCount:744,longGapCount:0,unobservedHours:0,periodHours:744},
      state:"normal",calculatedAmount:"3750",overrideAmount:null,adjustmentReason:"private reason",confirmedAmount:"3750",statePercent:100,identityPercent:100,
      payments:[{id:"1",entryId:"1",amount:"3750",paidOn:"2026-09-01",txUrl:"https://astar.subscan.io/extrinsic/1-1",memo:"secret memo",version:1,createdAt:"2026-09-01T00:00:00Z"}]}]};
}
