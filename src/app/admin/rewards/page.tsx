import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAdminCsrfToken, isAdminAuthenticated } from "@/lib/auth";
import { formatDateTime, formatHours, formatPercent } from "@/lib/format";
import { getRewardAudit, getRewardPeriod, getRewardProfiles, listRewardPeriods } from "@/lib/reward-repository";
import type { RewardEntry, RewardPeriod, RewardProfile } from "@/lib/reward-types";
import { currentMonth, decimalString, decimalUnits, displayAmount, getMonthBounds, paymentSummary, previousMonth } from "@/lib/rewards";
import { SubmitButton } from "../SubmitButton";
import { REWARD_SOURCE_ADDRESS } from "@/lib/reward-source-balance";
import { RewardSourceBalanceCard } from "./RewardSourceBalanceCard";

export const dynamic = "force-dynamic";
const endpoint = "/api/admin/rewards";

function Hidden({ csrf, month, action, version, entryId }: { csrf: string; month: string; action: string; version?: number; entryId?: string }) {
  return <><input type="hidden" name="csrfToken" value={csrf}/><input type="hidden" name="month" value={month}/>
    <input type="hidden" name="action" value={action}/>{version != null && <input type="hidden" name="version" value={version}/>}
    {entryId && <input type="hidden" name="entryId" value={entryId}/>}</>;
}
function DecimalInput({ name, value, required = false }: { name: string; value?: string | null; required?: boolean }) {
  return <input name={name} defaultValue={value ?? ""} inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,18})?" maxLength={39} required={required} placeholder="0.000000"/>;
}
function Action({ period, csrf, action, children }: { period: RewardPeriod; csrf: string; action: string; children: ReactNode }) {
  return <form action={endpoint} method="post"><Hidden csrf={csrf} month={period.month} action={action} version={period.version}/>{children}</form>;
}

export default async function RewardsAdminPage({searchParams}: {searchParams?: Promise<{month?: string; error?: string; saved?: string}>}) {
  if (!(await isAdminAuthenticated())) redirect("/admin");
  const params = await searchParams;
  let month = params?.month ?? previousMonth();
  let invalidMonth = false;
  try { getMonthBounds(month); } catch { month = previousMonth(); invalidMonth = true; }
  const [csrf, profiles, months, period] = await Promise.all([getAdminCsrfToken(),getRewardProfiles(),listRewardPeriods(),getRewardPeriod(month)]);
  const audits = period ? await getRewardAudit(period.id) : [];
  const hasPayments = period?.entries.some(e => e.payments.length > 0) ?? false;
  const due = period ? decimalString(period.entries.reduce((sum,e) => sum + decimalUnits(e.confirmedAmount ?? e.overrideAmount ?? e.calculatedAmount ?? "0"),0n)) : "0";
  const paid = period ? decimalString(period.entries.flatMap(e => e.payments).reduce((sum,p) => sum + decimalUnits(p.amount),0n)) : "0";
  const missing = period?.entries.filter(e => e.overrideAmount == null && e.calculatedAmount == null).length ?? 0;

  return <main key={`${month}-${period?.version ?? "new"}`} className="shell rewards-shell">
    <header className="topbar"><div><p className="eyebrow">Protected · Peers Program</p><h1>Monthly reports &amp; rewards</h1>
      <p className="muted">Review calendar-month availability, confirm rewards and record manual transfers.</p></div>
      <nav className="nav"><Link className="button" href="/admin">Admin</Link><Link className="button" href="/rewards">Published reports</Link></nav></header>
    {(params?.error || invalidMonth) && <div className="notice error" role="alert">{invalidMonth ? "Invalid month. Showing the previous month." : params?.error}</div>}
    {params?.saved && <div className="notice success" role="status">Saved successfully.</div>}
    <RewardSourceBalanceCard address={REWARD_SOURCE_ADDRESS}/>
    <section className="card rewards-toolbar"><form action="/admin/rewards" method="get" className="actions">
      <label>Operational month (JST)<input name="month" type="month" defaultValue={month} min="2000-01" max={currentMonth()} required/></label>
      <button type="submit">Open month</button></form>
      <div className="actions">{months.map(m => <Link key={m.month} className={`button ${m.month === month ? "primary" : ""}`} href={`/admin/rewards?month=${m.month}`}>{m.month} · {m.status}</Link>)}</div>
    </section>

    {!period ? <section className="card"><h2>{month} · No ledger yet</h2><p className="muted">Configure eligible participants below, then create a draft. Disabled monitoring nodes can still receive rewards.</p>
      <form action={endpoint} method="post"><Hidden csrf={csrf} month={month} action="create"/><SubmitButton className="primary" pendingLabel="Creating…">Create monthly draft</SubmitButton></form></section> : <>
      <section className="card">
        <div className="panel-header"><div><p className="eyebrow">{period.status === "confirmed" ? "Confirmed · Published" : "Draft · Private"}</p><h2>{month} operations → {period.paymentMonth} payment</h2>
          <p className="muted">Observations captured: {formatDateTime(period.observedAt)}{period.confirmedAt && ` · Confirmed: ${formatDateTime(period.confirmedAt)}`}</p></div>
          <a className="button" href={`/api/admin/rewards/export?month=${month}`}>Export CSV</a></div>
        <div className="reward-summary"><div><span className="muted">{period.status === "draft" ? "Provisional" : "Confirmed"} total</span><strong>{displayAmount(due)} ASTR</strong>{missing > 0 && <span className="reward-warning">Incomplete: {missing} uncalculated {missing === 1 ? "entry" : "entries"}</span>}</div>
          <div><span className="muted">Actual payments</span><strong>{displayAmount(paid)} ASTR</strong></div><div><span className="muted">Participants</span><strong>{period.entries.length}</strong></div></div>
        <p className="muted">Normal: ≥80% availability earns 100%; below 80% earns 50%. Recovery: 30%. Inactive: 0%. Without Identity: another 50% reduction.</p>
        <p className="muted">Amounts retain 18 decimal places; the display rounds to 2. Missing observations are not treated as 0%.</p>
        {period.status === "draft" ? <div className="reward-settings">
          <Action csrf={csrf} period={period} action="settings"><div className="form-grid">
            <label>Base reward (USD)<DecimalInput name="baseUsd" value={period.baseUsd} required/></label>
            <label>Verified EMA30 (USD/ASTR) · {period.priceDate} (UTC)<DecimalInput name="priceUsd" value={period.priceUsd}/></label>
            <label>Reason for manual price change<textarea name="reason" maxLength={2000} placeholder="Source checked and why the price was entered or changed"/></label>
            <SubmitButton className="primary" pendingLabel="Saving…">Save price &amp; base reward</SubmitButton></div></Action>
          <div><p className="muted">Price source: {period.priceSource ?? "Not set"}<br/>Recorded: {formatDateTime(period.priceFetchedAt)}</p>
            {period.priceReason && <p className="muted">Price note: {period.priceReason}</p>}
            {period.priceUsd == null && <Action csrf={csrf} period={period} action="fetch-price"><SubmitButton pendingLabel="Fetching…">Fetch Subscan EMA30</SubmitButton></Action>}
            <p className="muted">Requires PUBFI_API_KEY (free gateway) or SUBSCAN_API_KEY (direct access). Unverifiable or unavailable prices must be entered manually. A saved price is never overwritten by automatic fetching.</p>
            <Action csrf={csrf} period={period} action="refresh"><SubmitButton pendingLabel="Refreshing…">Refresh observations &amp; participant snapshots</SubmitButton></Action>
            <p className="muted">Refresh updates observations and participant snapshots, adds eligible participants and removes explicit opt-outs. Existing states and amount adjustments are preserved.</p>
          </div></div> : <p className="muted">Base: {period.baseUsd} USD · EMA30: {period.priceUsd} USD/ASTR · {period.priceDate} (UTC) · {period.priceSource}</p>}
      </section>

      {period.entries.length === 0 && <section className="card"><p>No eligible participants in this draft. Configure participants below, then refresh the draft.</p></section>}
      {period.entries.map(entry => <EntryCard key={`${entry.id}-${period.version}`} entry={entry} period={period} csrf={csrf} hasPayments={hasPayments}/>)}

      <section className="card">
        {period.status === "draft" ? <><h2>Confirm and publish</h2><p className="muted">Confirmation publishes node availability, reward amounts, payment status and Tx links. Payment addresses, Discord names and internal notes remain private. The operational month must be complete, with observations refreshed after month-end.</p>
          <Action csrf={csrf} period={period} action="confirm"><SubmitButton className="primary" pendingLabel="Confirming…">Confirm rewards &amp; publish report</SubmitButton></Action></> : !hasPayments ? <><h2>Reopen unpaid ledger</h2><p className="muted">Reopening removes this report from public view until it is confirmed again.</p>
          <Action csrf={csrf} period={period} action="reopen"><label>Reason<textarea name="reason" required maxLength={2000}/></label><SubmitButton pendingLabel="Reopening…">Reopen for editing</SubmitButton></Action></> : <><h2>Confirmed ledger</h2><p className="muted">Payments exist. Use the correction forms on each entry. Earlier reward amounts and payment records remain in the audit history.</p></>}
      </section>
      <section className="card"><h2>Audit history · Private</h2><p className="muted">Changes include the previous and resulting values. Times are shown in Japan time.</p>
        {audits.map(a => <details key={a.id} className="reward-audit"><summary>{formatDateTime(a.createdAt)} · {a.action}{a.reason && ` · ${a.reason}`}</summary>
          <div className="reward-settings"><div><h3>Before</h3><pre>{JSON.stringify(a.before,null,2)}</pre></div><div><h3>After</h3><pre>{JSON.stringify(a.after,null,2)}</pre></div></div></details>)}
      </section>
    </>}
    <section className="panel"><div className="panel-header"><div><h2>Reward participants · Private</h2><p className="muted">Eligibility is independent of monitoring. Save profiles before creating or refreshing a draft. Confirmed snapshots are unchanged.</p></div></div>
      <div className="reward-profiles">{profiles.map(profile => <ProfileForm key={`${profile.nodeId}-${profile.version}`} profile={profile} month={month} csrf={csrf}/>)}</div>
      {profiles.length === 0 && <p className="muted">Register a monitoring node in Admin first.</p>}
    </section>
  </main>;
}

function ProfileForm({profile,month,csrf}: {profile: RewardProfile; month: string; csrf: string}) {
  return <details className="reward-profile"><summary><strong>{profile.label}</strong> · {profile.eligible ? "Reward eligible" : "Not eligible"} · Monitoring {profile.monitoringEnabled ? "enabled" : "disabled"}</summary>
    <form action={endpoint} method="post" className="form-grid"><Hidden csrf={csrf} month={month} action="profile" version={profile.version}/><input type="hidden" name="nodeId" value={profile.nodeId}/>
      <label>Discord name<input name="discordName" defaultValue={profile.discordName} maxLength={200}/></label>
      <label>Region<input name="region" defaultValue={profile.region} maxLength={200}/></label>
      <label>Payment address (Substrate SS58)<input name="address" defaultValue={profile.address} maxLength={100}/></label>
      <label>On-chain Identity name<input name="identityName" defaultValue={profile.identityName} maxLength={200}/></label>
      <label className="checkbox-label"><input type="checkbox" name="hasIdentity" defaultChecked={profile.hasIdentity}/>Verified on-chain Identity present</label>
      <label className="checkbox-label"><input type="checkbox" name="eligible" defaultChecked={profile.eligible}/>Eligible for monthly rewards</label>
      <SubmitButton className="primary" pendingLabel="Saving…">Save participant</SubmitButton>
    </form></details>;
}

function EntryCard({entry,period,csrf,hasPayments}: {entry: RewardEntry; period: RewardPeriod; csrf: string; hasPayments: boolean}) {
  const summary = paymentSummary(entry.confirmedAmount,entry.payments);
  const a = entry.availability;
  return <section className="card reward-entry"><div className="panel-header"><div><h2>{entry.label}</h2><p className="muted">{entry.region || "No region"} · Identity: {entry.hasIdentity ? entry.identityName || "Present" : "Not present"}{entry.nodeRef == null && " · Monitoring node deleted; snapshot retained"}</p></div>
    <strong className={summary.status === "Overpaid" || summary.status === "Partially paid" ? "reward-warning" : ""}>{summary.status}</strong></div>
    <div className="reward-metrics"><div><span>Availability</span><strong>{formatPercent(a.availabilityPercent)}</strong></div><div><span>Online / observed</span><strong>{formatHours(a.onlineHours)} / {formatHours(a.totalObservedHours)}</strong></div>
      <div><span>Observations</span><strong>{a.sampleCount}</strong></div><div><span>Calculated reward</span><strong>{displayAmount(entry.calculatedAmount)} ASTR</strong></div>
      <div><span>{period.status === "draft" ? "Provisional reward" : "Confirmed reward"}</span><strong>{displayAmount(entry.confirmedAmount ?? entry.overrideAmount ?? entry.calculatedAmount)} ASTR</strong></div></div>
    {(a.availabilityPercent == null || a.longGapCount > 0 || a.unobservedHours > 0) && <p className="reward-warning">{a.availabilityPercent == null && "Insufficient observations. "}Long observation gaps: {a.longGapCount}; unobserved month edges: {formatHours(a.unobservedHours)}. Long gaps remain in the existing availability estimate; review before confirming.</p>}
    <p className="muted">State: {entry.state} · State factor: {entry.statePercent == null ? "Unavailable" : `${entry.statePercent}%`} · Identity factor: {entry.identityPercent}%</p>
    <details className="reward-private"><summary>Private participant snapshot</summary><p>Discord: {entry.discordName || "—"}</p><p className="reward-address">Address: {entry.address || "—"}</p></details>
    {period.status === "draft" ? <form action={endpoint} method="post" className="form-grid reward-entry-form"><Hidden csrf={csrf} month={period.month} action="entry" version={period.version} entryId={entry.id}/>
      <label>Monthly state<select name="state" defaultValue={entry.state}><option value="normal">Normal</option><option value="recovery">Recovery / resync</option><option value="inactive">Inactive / not running</option></select></label>
      <label>Adjusted reward (ASTR) · blank uses calculation<DecimalInput name="overrideAmount" value={entry.overrideAmount}/></label>
      <label>Reason / internal note<textarea name="reason" defaultValue={entry.adjustmentReason} maxLength={2000}/></label>
      <SubmitButton className="primary" pendingLabel="Saving…">Save monthly decision</SubmitButton>
    </form> : <>
      {entry.adjustmentReason && <p className="muted">Internal adjustment reason: {entry.adjustmentReason}</p>}
      <p><strong>Actual paid: {displayAmount(summary.paidAmount)} ASTR</strong> · Difference (paid − confirmed): {displayAmount(summary.difference)} ASTR</p>
      <div className="reward-payment-list">{entry.payments.map(p => <div key={p.id} className="reward-payment"><p>{p.paidOn} · {displayAmount(p.amount)} ASTR · <a className="reward-link" href={p.txUrl} target="_blank" rel="noopener noreferrer">View Tx</a></p>{p.memo && <p className="muted">Internal note: {p.memo}</p>}
        <details><summary>Correct payment record</summary><form action={endpoint} method="post" className="form-grid"><Hidden csrf={csrf} month={period.month} action="payment" version={period.version} entryId={entry.id}/><input type="hidden" name="paymentId" value={p.id}/>
          <label>Actual amount (ASTR)<DecimalInput name="amount" value={p.amount} required/></label><label>Payment date (JST)<input type="date" name="paidOn" defaultValue={p.paidOn} required/></label>
          <label>Subscan Tx link<input type="url" name="txUrl" defaultValue={p.txUrl} required maxLength={250}/></label><label>Internal note<textarea name="memo" defaultValue={p.memo} maxLength={2000}/></label>
          <label>Correction reason<textarea name="reason" required maxLength={2000}/></label><SubmitButton pendingLabel="Saving…">Save correction</SubmitButton>
        </form></details></div>)}</div>
      <details className="reward-payment"><summary>Record a manual transfer</summary><p className="muted">Record a completed transfer only. This application does not send funds.</p><form action={endpoint} method="post" className="form-grid">
        <Hidden csrf={csrf} month={period.month} action="payment" version={period.version} entryId={entry.id}/>
        <label>Actual amount (ASTR)<DecimalInput name="amount" required/></label><label>Payment date (JST)<input type="date" name="paidOn" required/></label>
        <label>Subscan Tx link<input type="url" name="txUrl" placeholder="https://astar.subscan.io/extrinsic/…" required maxLength={250}/></label><label>Internal note<textarea name="memo" maxLength={2000}/></label>
        <SubmitButton className="primary" pendingLabel="Recording…">Record transfer</SubmitButton>
      </form></details>
      {hasPayments && <details className="reward-payment"><summary>Correct confirmed reward amount</summary><p className="muted">The calculation stays unchanged. Previous confirmed amounts remain in the private audit history.</p><form action={endpoint} method="post" className="form-grid">
        <Hidden csrf={csrf} month={period.month} action="correct-reward" version={period.version} entryId={entry.id}/><label>Corrected reward (ASTR)<DecimalInput name="amount" value={entry.confirmedAmount} required/></label>
        <label>Correction reason<textarea name="reason" required maxLength={2000}/></label><SubmitButton pendingLabel="Saving…">Save reward correction</SubmitButton>
      </form></details>}
    </>}
  </section>;
}
