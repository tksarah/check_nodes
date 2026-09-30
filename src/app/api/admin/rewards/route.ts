import { requireAdminCsrf } from "@/lib/auth";
import { redirectTo } from "@/lib/redirect";
import { fetchRewardPrice } from "@/lib/reward-price";
import { confirmRewardPeriod, correctPaidReward, createRewardPeriod, getRewardPeriod, refreshRewardPeriod, reopenRewardPeriod,
  saveAutomaticRewardPrice, saveRewardEntry, saveRewardPayment, saveRewardProfile, saveRewardSettings } from "@/lib/reward-repository";
import { getMonthBounds, previousMonth, RewardError, type RewardState } from "@/lib/rewards";

function field(form: FormData, key: string, max = 2000) {
  const value = String(form.get(key) ?? "").trim();
  if (value.length > max) throw new RewardError(`${key} is too long.`);
  return value;
}
function integer(form: FormData, key: string, allowZero = false) {
  const value = field(form,key,20);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < (allowZero ? 0 : 1)) throw new RewardError(`Invalid ${key}.`);
  return Number(value);
}
function id(form: FormData, key: string) {
  const value = field(form,key,20);
  if (!/^[1-9]\d{0,18}$/.test(value)) throw new RewardError(`Invalid ${key}.`);
  return value;
}

export async function POST(request: Request) {
  const invalid = await requireAdminCsrf(request);
  if (invalid) return invalid;
  let month = previousMonth();
  try {
    const form = await request.formData();
    month = field(form,"month",7) || month;
    getMonthBounds(month);
    const action = field(form,"action",40);
    if (action === "create") {
      await createRewardPeriod(month);
    } else if (action === "profile") {
      await saveRewardProfile({ nodeId: integer(form,"nodeId"), version: integer(form,"version",true),
        discordName: field(form,"discordName",200), region: field(form,"region",200), address: field(form,"address",100),
        identityName: field(form,"identityName",200), hasIdentity: form.get("hasIdentity") === "on", eligible: form.get("eligible") === "on" });
    } else {
      const version = integer(form,"version");
      switch (action) {
        case "settings":
          await saveRewardSettings(month,version,field(form,"baseUsd",40),field(form,"priceUsd",40) || null,field(form,"reason")); break;
        case "fetch-price": {
          const period = await getRewardPeriod(month);
          if (!period) throw new RewardError("Monthly ledger not found.",404);
          if (period.status !== "draft" || period.priceUsd != null || period.version !== version) throw new RewardError("Only a draft without a saved price can fetch a price. Reload the ledger.",409);
          await saveAutomaticRewardPrice(month,version,await fetchRewardPrice(period.priceDate)); break;
        }
        case "refresh": await refreshRewardPeriod(month,version); break;
        case "entry": await saveRewardEntry(month,version,id(form,"entryId"),field(form,"state",20) as RewardState,field(form,"overrideAmount",40) || null,field(form,"reason")); break;
        case "confirm": await confirmRewardPeriod(month,version); break;
        case "reopen": await reopenRewardPeriod(month,version,field(form,"reason")); break;
        case "payment": await saveRewardPayment(month,version,id(form,"entryId"),{
          amount: field(form,"amount",40), paidOn: field(form,"paidOn",10), txUrl: field(form,"txUrl",250), memo: field(form,"memo"),
          paymentId: field(form,"paymentId",20) ? id(form,"paymentId") : undefined, reason: field(form,"reason")
        }); break;
        case "correct-reward": await correctPaidReward(month,version,id(form,"entryId"),field(form,"amount",40),field(form,"reason")); break;
        default: throw new RewardError("Unknown reward action.");
      }
    }
    return redirectTo(`/admin/rewards?month=${encodeURIComponent(month)}&saved=1`);
  } catch (error) {
    const message = error instanceof RewardError ? error.message : "Unable to save rewards. Please reload and try again.";
    if (!(error instanceof RewardError)) console.error("Reward action failed", error instanceof Error ? error.name : "Unknown error");
    return redirectTo(`/admin/rewards?month=${encodeURIComponent(month)}&error=${encodeURIComponent(message)}`);
  }
}
