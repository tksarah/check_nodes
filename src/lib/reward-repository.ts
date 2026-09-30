import type { PoolClient } from "pg";
import { query, withTransaction } from "./db";
import type { RewardAudit, RewardEntry, RewardPayment, RewardPeriod, RewardProfile } from "./reward-types";
import { amount, calculateReward, getMonthBounds, REWARD_RULE_VERSION, RewardError, summarizeMonth, validateTxUrl, type MonthlyAvailability, type RewardState } from "./rewards";
import { validatePaymentDate, validateRewardAddress } from "./reward-validation";

type Row = Record<string, unknown>;
const str = (r: Row, key: string) => String(r[key] ?? "");
const iso = (value: unknown) => new Date(value as string | Date).toISOString();
const money = (value: unknown) => value == null ? null : amount(String(value));

function mapProfile(r: Row): RewardProfile {
  return {
    nodeId: Number(r.node_id), label: str(r, "label"), monitoringEnabled: Boolean(r.enabled),
    discordName: str(r, "discord_name"), region: str(r, "region"), address: str(r, "address"),
    identityName: str(r, "identity_name"), hasIdentity: Boolean(r.has_identity), eligible: Boolean(r.eligible), version: Number(r.version ?? 0)
  };
}
function mapPayment(r: Row): RewardPayment {
  return { id: str(r, "id"), entryId: str(r, "entry_id"), amount: money(r.amount)!, paidOn: str(r, "paid_on_text"),
    txUrl: str(r, "tx_url"), memo: str(r, "memo"), version: Number(r.version), createdAt: iso(r.created_at) };
}
function mapEntry(r: Row, payments: RewardPayment[]): RewardEntry {
  return {
    id: str(r, "id"), nodeId: Number(r.original_node_id), nodeRef: r.node_ref == null ? null : Number(r.node_ref),
    label: str(r, "label"), discordName: str(r, "discord_name"), region: str(r, "region"), address: str(r, "address"),
    identityName: str(r, "identity_name"), hasIdentity: Boolean(r.has_identity), availability: r.availability as MonthlyAvailability,
    state: r.state as RewardState, calculatedAmount: money(r.calculated_amount), overrideAmount: money(r.override_amount),
    adjustmentReason: str(r, "adjustment_reason"), confirmedAmount: money(r.confirmed_amount),
    statePercent: r.state_percent == null ? null : Number(r.state_percent), identityPercent: Number(r.identity_percent),
    payments: payments.filter(p => p.entryId === str(r, "id"))
  };
}

export async function getRewardProfiles(): Promise<RewardProfile[]> {
  const result = await query<Row>(`select n.id as node_id, n.label, n.enabled, p.discord_name, p.region, p.address,
    p.identity_name, p.has_identity, p.eligible, p.version from monitored_nodes n
    left join reward_profiles p on p.node_id = n.id order by n.label, n.id`);
  return result.rows.map(mapProfile);
}

async function audit(client: PoolClient, periodId: string | null, action: string, reason: string, before: unknown, after: unknown, nodeId?: number) {
  await client.query(`insert into reward_audit (period_id, node_id, action, reason, before_data, after_data)
    values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, [periodId, nodeId ?? null, action, reason, JSON.stringify(before ?? null), JSON.stringify(after ?? null)]);
}

export async function saveRewardProfile(profile: Omit<RewardProfile, "label" | "monitoringEnabled">) {
  if (profile.address) validateRewardAddress(profile.address);
  if (profile.eligible && !profile.address) throw new RewardError("An eligible node requires a payment address.");
  await withTransaction(async client => {
    const node = await client.query("select id from monitored_nodes where id=$1 for update", [profile.nodeId]);
    if (!node.rowCount) throw new RewardError("Node no longer exists.", 404);
    const existing = await client.query<Row>("select * from reward_profiles where node_id=$1", [profile.nodeId]);
    if (Number(existing.rows[0]?.version ?? 0) !== profile.version) throw new RewardError("Participant changed. Reload before saving.", 409);
    await client.query(`insert into reward_profiles (node_id, discord_name, region, address, identity_name, has_identity, eligible)
      values ($1,$2,$3,$4,$5,$6,$7) on conflict (node_id) do update set discord_name=excluded.discord_name,
      region=excluded.region,address=excluded.address,identity_name=excluded.identity_name,has_identity=excluded.has_identity,
      eligible=excluded.eligible,version=reward_profiles.version+1,updated_at=now()`,
      [profile.nodeId, profile.discordName, profile.region, profile.address, profile.identityName, profile.hasIdentity, profile.eligible]);
    await audit(client, null, "profile_saved", "", existing.rows[0] ?? null, profile, profile.nodeId);
  });
}

export async function listRewardPeriods(confirmedOnly = false) {
  const result = await query<{ month: string; status: "draft" | "confirmed" }>(`select month,status from reward_periods
    ${confirmedOnly ? "where status='confirmed'" : ""} order by month desc`);
  return result.rows;
}

export async function getRewardPeriod(month: string, client?: PoolClient): Promise<RewardPeriod | null> {
  getMonthBounds(month);
  if (!client) return withTransaction(async transaction => {
    await transaction.query("set transaction isolation level repeatable read read only");
    return getRewardPeriod(month, transaction);
  });
  const run = client.query.bind(client);
  const periodResult = await run<Row>("select *, price_date::text as price_date_text from reward_periods where month=$1", [month]);
  const r = periodResult.rows[0];
  if (!r) return null;
  const [entries, payments] = await Promise.all([
    run<Row>("select * from reward_entries where period_id=$1 order by label,id", [r.id]),
    run<Row>(`select p.*,p.paid_on::text as paid_on_text from reward_payments p
      join reward_entries e on e.id=p.entry_id where e.period_id=$1 order by p.paid_on,p.id`, [r.id])
  ]);
  const mappedPayments = payments.rows.map(mapPayment);
  return {
    id: str(r,"id"), month: str(r,"month"), paymentMonth: str(r,"payment_month"), priceDate: str(r,"price_date_text"),
    baseUsd: money(r.base_usd)!, priceUsd: money(r.price_usd), priceSource: r.price_source == null ? null : str(r,"price_source"),
    priceFetchedAt: r.price_fetched_at == null ? null : iso(r.price_fetched_at), priceReason: str(r,"price_reason"),
    status: r.status as RewardPeriod["status"], version: Number(r.version), observedAt: iso(r.observed_at),
    confirmedAt: r.confirmed_at == null ? null : iso(r.confirmed_at), ruleVersion: str(r,"rule_version"),
    checkIntervalMinutes: Number(r.check_interval_minutes), entries: entries.rows.map(row => mapEntry(row, mappedPayments))
  };
}

export async function getRewardAudit(periodId: string): Promise<RewardAudit[]> {
  const result = await query<Row>("select * from reward_audit where period_id=$1 order by id desc", [periodId]);
  return result.rows.map(r => ({ id: str(r,"id"), action: str(r,"action"), reason: str(r,"reason"),
    createdAt: iso(r.created_at), before: r.before_data, after: r.after_data }));
}

async function lockPeriod(client: PoolClient, month: string, version: number) {
  const result = await client.query<Row>("select * from reward_periods where month=$1 for update", [month]);
  if (!result.rowCount) throw new RewardError("Monthly ledger not found.", 404);
  if (Number(result.rows[0].version) !== version) throw new RewardError("Ledger changed. Reload before trying again.", 409);
  return (await getRewardPeriod(month, client))!;
}
function requireDraft(period: RewardPeriod) {
  if (period.status !== "draft") throw new RewardError("Confirmed calculation is locked. Reopen the unpaid ledger first.", 409);
}
async function bump(client: PoolClient, id: string) {
  await client.query("update reward_periods set version=version+1,updated_at=now() where id=$1", [id]);
}

async function refreshEntries(client: PoolClient, period: RewardPeriod, now: Date) {
  const { start, end } = getMonthBounds(period.month);
  const until = new Date(Math.min(end.getTime(), now.getTime()));
  // Explicit opt-outs are applied only during a draft refresh. Preserve deleted nodes' snapshots.
  await client.query(`delete from reward_entries e using reward_profiles p
    where e.period_id=$1 and e.node_ref=p.node_id and p.eligible=false`, [period.id]);
  // Monitoring-disabled participants are still eligible. Add newly opted-in nodes.
  const eligible = await client.query<Row>(`select n.*,p.* from monitored_nodes n join reward_profiles p on p.node_id=n.id
    where p.eligible=true and n.created_at < $1 order by n.id`, [end]);
  for (const r of eligible.rows) {
    await client.query(`insert into reward_entries (period_id,original_node_id,node_ref,label,discord_name,region,address,
      identity_name,has_identity,availability,identity_percent) values ($1,$2,$2,$3,$4,$5,$6,$7,$8,'{}'::jsonb,$9)
      on conflict (period_id,original_node_id) do nothing`, [period.id,r.node_id,r.label,r.discord_name,r.region,r.address,
      r.identity_name,r.has_identity,r.has_identity ? 100 : 50]);
  }
  const entries = await client.query<Row>("select * from reward_entries where period_id=$1 order by id", [period.id]);
  for (const entry of entries.rows) {
    if (entry.node_ref == null) continue;
    const profile = await client.query<Row>(`select n.label,p.discord_name,p.region,p.address,p.identity_name,p.has_identity
      from monitored_nodes n left join reward_profiles p on p.node_id=n.id where n.id=$1`, [entry.node_ref]);
    const p = profile.rows[0];
    const samples = await client.query<{ checked_at: Date; is_online: boolean }>(`
      (select checked_at,is_online from node_samples where node_id=$1 and checked_at < $2 order by checked_at desc,id desc limit 1)
      union all
      (select checked_at,is_online from node_samples where node_id=$1 and checked_at >= $2 and checked_at < $3)
      union all
      (select checked_at,is_online from node_samples where node_id=$1 and checked_at >= $3 and checked_at <= $4 order by checked_at,id limit 1)
      order by checked_at`, [entry.node_ref,start,until,now]);
    const availability = summarizeMonth(samples.rows.map(s => ({ checkedAt: s.checked_at, isOnline: s.is_online })),start,end,period.checkIntervalMinutes,now);
    const identity = Boolean(p?.has_identity ?? entry.has_identity);
    const calculation = calculateReward(period.baseUsd,period.priceUsd,entry.state as RewardState,availability.availabilityPercent,identity);
    await client.query(`update reward_entries set label=$2,discord_name=$3,region=$4,address=$5,identity_name=$6,has_identity=$7,
      availability=$8::jsonb,calculated_amount=$9,state_percent=$10,identity_percent=$11 where id=$1`,
      [entry.id,p?.label ?? entry.label,p?.discord_name ?? entry.discord_name,p?.region ?? entry.region,p?.address ?? entry.address,
       p?.identity_name ?? entry.identity_name,identity,JSON.stringify(availability),calculation.calculatedAmount,calculation.statePercent,calculation.identityPercent]);
  }
  await client.query("update reward_periods set observed_at=$2 where id=$1", [period.id,now]);
}

async function recalculateEntries(client: PoolClient, period: RewardPeriod) {
  for (const entry of period.entries) {
    const calculation = calculateReward(period.baseUsd,period.priceUsd,entry.state,entry.availability.availabilityPercent,entry.hasIdentity);
    await client.query("update reward_entries set calculated_amount=$2,state_percent=$3,identity_percent=$4 where id=$1", [entry.id,calculation.calculatedAmount,calculation.statePercent,calculation.identityPercent]);
  }
}

export async function createRewardPeriod(month: string, now = new Date()) {
  const bounds = getMonthBounds(month);
  if (bounds.start > now) throw new RewardError("Cannot create a ledger for a future month.");
  return withTransaction(async client => {
    const interval = await client.query<{ value: string }>("select value from settings where key='checkIntervalMinutes'");
    const result = await client.query<Row>(`insert into reward_periods (month,payment_month,price_date,rule_version,check_interval_minutes)
      values ($1,$2,$3,$4,$5) on conflict (month) do nothing returning id`, [month,bounds.paymentMonth,bounds.priceDate,REWARD_RULE_VERSION,Number(interval.rows[0]?.value ?? 60)]);
    if (!result.rowCount) throw new RewardError("A ledger already exists for this month.", 409);
    const period = (await getRewardPeriod(month, client))!;
    await refreshEntries(client,period,now);
    const after = await getRewardPeriod(month,client);
    await audit(client,period.id,"created","",null,after);
    return after;
  });
}

export async function refreshRewardPeriod(month: string, version: number, now = new Date()) {
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    requireDraft(before);
    await refreshEntries(client,before,now);
    await bump(client,before.id);
    await audit(client,before.id,"observations_refreshed","",before,await getRewardPeriod(month,client));
  });
}

export async function saveRewardSettings(month: string, version: number, baseUsd: string, priceUsd: string | null, reason: string) {
  baseUsd = amount(baseUsd,true);
  priceUsd = priceUsd == null ? null : amount(priceUsd,true);
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    requireDraft(before);
    const priceChanged = priceUsd !== before.priceUsd;
    if (priceChanged && !reason.trim()) throw new RewardError("A reason is required for a manual price change.");
    await client.query(`update reward_periods set base_usd=$2,price_usd=$3,
      price_source=case when $4 then 'Manual EMA30' else price_source end,
      price_fetched_at=case when $4 then now() else price_fetched_at end,
      price_reason=case when $4 then $5 else price_reason end where id=$1`, [before.id,baseUsd,priceUsd,priceChanged,reason]);
    const period = (await getRewardPeriod(month,client))!;
    await recalculateEntries(client,period);
    await bump(client,before.id);
    await audit(client,before.id,"settings_saved",reason,before,await getRewardPeriod(month,client));
  });
}

export async function saveAutomaticRewardPrice(month: string, version: number, price: { price: string; source: string; fetchedAt: string }) {
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    requireDraft(before);
    if (before.priceUsd != null) throw new RewardError("A saved price already exists. Automatic fetch cannot overwrite it.", 409);
    await client.query("update reward_periods set price_usd=$2,price_source=$3,price_fetched_at=$4 where id=$1", [before.id,amount(price.price,true),price.source,price.fetchedAt]);
    await recalculateEntries(client,(await getRewardPeriod(month,client))!);
    await bump(client,before.id);
    await audit(client,before.id,"price_fetched","",before,await getRewardPeriod(month,client));
  });
}

export async function saveRewardEntry(month: string, version: number, entryId: string, state: RewardState, override: string | null, reason: string) {
  if (!["normal","recovery","inactive"].includes(state)) throw new RewardError("Invalid reward state.");
  const overrideAmount = override == null ? null : amount(override);
  if (overrideAmount != null && !reason.trim()) throw new RewardError("A reason is required for an amount adjustment.");
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    requireDraft(before);
    const entry = before.entries.find(e => e.id === entryId);
    if (!entry) throw new RewardError("Reward entry not found.", 404);
    await client.query("update reward_entries set state=$2,override_amount=$3,adjustment_reason=$4 where id=$1",[entryId,state,overrideAmount,reason]);
    await recalculateEntries(client,(await getRewardPeriod(month,client))!);
    await bump(client,before.id);
    await audit(client,before.id,"entry_saved",reason,entry,(await getRewardPeriod(month,client))!.entries.find(e => e.id === entryId));
  });
}

export async function confirmRewardPeriod(month: string, version: number, now = new Date()) {
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    requireDraft(before);
    if (getMonthBounds(month).end > now) throw new RewardError("A month must be complete before its rewards can be confirmed.");
    if (new Date(before.observedAt) < getMonthBounds(month).end) throw new RewardError("Refresh observations after the operational month has ended before confirming.");
    if (!before.priceUsd) throw new RewardError("A verified positive EMA30 price is required.");
    if (!before.entries.length) throw new RewardError("Add eligible participants before confirming.");
    for (const entry of before.entries) {
      validateRewardAddress(entry.address);
      const finalAmount = entry.overrideAmount ?? entry.calculatedAmount;
      if (finalAmount == null) throw new RewardError(`${entry.label}: observations are insufficient. Enter a reasoned amount adjustment.`);
      if ((entry.overrideAmount != null || entry.availability.availabilityPercent == null) && !entry.adjustmentReason.trim()) {
        throw new RewardError(`${entry.label}: a reason is required for the manual decision.`);
      }
      await client.query("update reward_entries set confirmed_amount=$2 where id=$1",[entry.id,finalAmount]);
    }
    await client.query("update reward_periods set status='confirmed',confirmed_at=$2 where id=$1",[before.id,now]);
    await bump(client,before.id);
    await audit(client,before.id,"confirmed","",before,await getRewardPeriod(month,client));
  });
}

export async function reopenRewardPeriod(month: string, version: number, reason: string) {
  if (!reason.trim()) throw new RewardError("A reason is required to reopen a ledger.");
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    if (before.status !== "confirmed") throw new RewardError("Only confirmed ledgers can be reopened.",409);
    if (before.entries.some(entry => entry.payments.length > 0)) throw new RewardError("This ledger has payments. Correct the payment records with a reason; the confirmed reward stays locked.",409);
    await client.query("update reward_periods set status='draft',confirmed_at=null where id=$1",[before.id]);
    await client.query("update reward_entries set confirmed_amount=null where period_id=$1",[before.id]);
    await bump(client,before.id);
    await audit(client,before.id,"reopened",reason,before,await getRewardPeriod(month,client));
  });
}

export async function saveRewardPayment(month: string, version: number, entryId: string, input: {
  amount: string; paidOn: string; txUrl: string; memo: string; paymentId?: string; reason?: string;
}) {
  const paymentAmount = amount(input.amount,true);
  const paidOn = validatePaymentDate(input.paidOn);
  const txUrl = validateTxUrl(input.txUrl);
  if (input.paymentId && !input.reason?.trim()) throw new RewardError("A correction reason is required.");
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    if (before.status !== "confirmed") throw new RewardError("Confirm rewards before recording a payment.",409);
    const entry = before.entries.find(e => e.id === entryId);
    if (!entry) throw new RewardError("Reward entry not found.",404);
    const previous = input.paymentId ? entry.payments.find(p => p.id === input.paymentId) : null;
    if (input.paymentId && !previous) throw new RewardError("Payment not found.",404);
    if (entry.payments.some(p => p.txUrl === txUrl && p.id !== input.paymentId)) throw new RewardError("This transaction is already recorded for this node.",409);
    if (input.paymentId) {
      await client.query("update reward_payments set amount=$2,paid_on=$3,tx_url=$4,memo=$5,version=version+1,updated_at=now() where id=$1",[input.paymentId,paymentAmount,paidOn,txUrl,input.memo]);
    } else {
      await client.query("insert into reward_payments (entry_id,amount,paid_on,tx_url,memo) values ($1,$2,$3,$4,$5)",[entryId,paymentAmount,paidOn,txUrl,input.memo]);
    }
    await bump(client,before.id);
    await audit(client,before.id,input.paymentId ? "payment_corrected" : "payment_recorded",input.reason ?? "",previous,
      { entryId, amount: paymentAmount, paidOn, txUrl, memo: input.memo });
  });
}

export async function correctPaidReward(month: string, version: number, entryId: string, correctedAmount: string, reason: string) {
  if (!reason.trim()) throw new RewardError("A correction reason is required.");
  correctedAmount = amount(correctedAmount);
  await withTransaction(async client => {
    const before = await lockPeriod(client,month,version);
    if (before.status !== "confirmed" || !before.entries.some(e => e.payments.length)) throw new RewardError("Use reopening for an unpaid ledger.",409);
    const entry = before.entries.find(e => e.id === entryId);
    if (!entry) throw new RewardError("Reward entry not found.",404);
    await client.query("update reward_entries set override_amount=$2,confirmed_amount=$2,adjustment_reason=$3 where id=$1",[entryId,correctedAmount,reason]);
    await bump(client,before.id);
    await audit(client,before.id,"confirmed_amount_corrected",reason,entry,
      (await getRewardPeriod(month,client))!.entries.find(e => e.id === entryId));
  });
}
