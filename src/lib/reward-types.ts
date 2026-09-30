import type { MonthlyAvailability, RewardState } from "./rewards";

export type RewardProfile = {
  nodeId: number; label: string; monitoringEnabled: boolean;
  discordName: string; region: string; address: string;
  identityName: string; hasIdentity: boolean; eligible: boolean; version: number;
};
export type RewardPayment = {
  id: string; entryId: string; amount: string; paidOn: string; txUrl: string;
  memo: string; version: number; createdAt: string;
};
export type RewardEntry = {
  id: string; nodeId: number; nodeRef: number | null; label: string;
  discordName: string; region: string; address: string;
  identityName: string; hasIdentity: boolean;
  availability: MonthlyAvailability; state: RewardState;
  calculatedAmount: string | null; overrideAmount: string | null;
  adjustmentReason: string; confirmedAmount: string | null;
  statePercent: number | null; identityPercent: number;
  payments: RewardPayment[];
};
export type RewardPeriod = {
  id: string; month: string; paymentMonth: string; priceDate: string;
  baseUsd: string; priceUsd: string | null; priceSource: string | null;
  priceFetchedAt: string | null; priceReason: string;
  status: "draft" | "confirmed"; version: number;
  observedAt: string; confirmedAt: string | null; ruleVersion: string;
  checkIntervalMinutes: number; entries: RewardEntry[];
};
export type RewardAudit = {
  id: string; action: string; reason: string; createdAt: string;
  before: unknown; after: unknown;
};
