import Link from "next/link";
import { formatDateTime, formatHours, formatPercent } from "@/lib/format";
import { publicRewardPeriod } from "@/lib/reward-public";
import { getRewardPeriod, listRewardPeriods } from "@/lib/reward-repository";
import { displayAmount, getMonthBounds } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export default async function PublishedRewardsPage({searchParams}: {searchParams?: Promise<{month?: string}>}) {
  const params = await searchParams;
  const months = await listRewardPeriods(true);
  const month = params?.month ?? months[0]?.month;
  let period = null;
  let invalidMonth = false;
  if (month) {
    try { getMonthBounds(month); } catch { invalidMonth = true; }
    if (!invalidMonth) {
      const saved = await getRewardPeriod(month);
      period = saved ? publicRewardPeriod(saved) : null;
    }
  }
  return <main className="shell rewards-shell"><header className="topbar"><div><p className="eyebrow">Astar Network · Peers Program</p><h1>Monthly reports &amp; rewards</h1>
    <p className="muted">Published availability reports and manually recorded reward payments.</p></div><Link className="button" href="/">Dashboard</Link></header>
    {months.length > 0 && <section className="card"><nav className="actions" aria-label="Published reward months">{months.map(m => <Link className={`button ${m.month === month ? "primary" : ""}`} key={m.month} href={`/rewards?month=${m.month}`}>{m.month}</Link>)}</nav></section>}
    {!period ? <section className="card"><h2>{invalidMonth ? "Invalid month" : "No published report"}</h2><p className="muted">Only confirmed monthly reports appear here.</p></section> : <>
      <section className="card"><p className="eyebrow">Confirmed</p><h2>{period.month} operations → {period.paymentMonth} payment</h2>
        <p className="muted">Calendar month in Japan time · Observations captured {formatDateTime(period.observedAt)} · Confirmed {formatDateTime(period.confirmedAt)}</p>
        <div className="reward-summary"><div><span className="muted">Confirmed rewards</span><strong>{displayAmount(period.totalReward)} ASTR</strong></div><div><span className="muted">Actual payments</span><strong>{displayAmount(period.totalPaid)} ASTR</strong></div><div><span className="muted">Participants</span><strong>{period.entries.length}</strong></div></div>
        <p className="muted">Base reward: {period.baseUsd} USD · EMA30: {period.priceUsd} USD/ASTR · {period.priceDate} (UTC) · {period.priceSource}</p>
        <p className="muted">Normal: ≥80% availability earns 100%; below 80% earns 50%. Recovery: 30%. Inactive: 0%. Without Identity: another 50% reduction. A confirmed amount may include an administrator adjustment.</p>
        <p className="muted">Availability uses the existing observation estimate: an interval counts as online if either adjacent observation is online. Missing observations are shown separately. Payment records are entered by the administrator.</p>
      </section>
      <section className="panel"><div className="table-wrap"><table><thead><tr><th>Node</th><th>Monthly availability</th><th>Online / observed</th><th>State / factors</th><th>Calculated ASTR</th><th>Confirmed ASTR</th><th>Actual paid ASTR</th><th>Payment status</th><th>Transactions</th></tr></thead>
        <tbody>{period.entries.map(e => <tr key={e.id}><td>{e.label}</td><td>{formatPercent(e.availability.availabilityPercent)}<div className="muted">{e.availability.sampleCount} observations</div>{(e.availability.longGapCount > 0 || e.availability.unobservedHours > 0 || e.availability.availabilityPercent == null) && <div className="reward-warning">{e.availability.longGapCount} long gaps; {formatHours(e.availability.unobservedHours)} unobserved{e.availability.availabilityPercent == null && "; insufficient data"}</div>}</td>
          <td>{formatHours(e.availability.onlineHours)} / {formatHours(e.availability.totalObservedHours)}</td><td>{e.state}<div className="muted">State {e.statePercent ?? "—"}% · Identity {e.identityPercent}%</div></td><td title={e.calculatedAmount ?? "Unavailable"}>{displayAmount(e.calculatedAmount)}</td><td title={e.confirmedAmount ?? ""}>{displayAmount(e.confirmedAmount)}</td><td title={e.paidAmount}>{displayAmount(e.paidAmount)}</td><td>{e.status}<div className="muted">Difference: {e.difference} ASTR</div></td>
          <td>{e.payments.length ? e.payments.map((p,i) => <div className="reward-tx" key={`${p.txUrl}-${i}`}><a className="reward-link" href={p.txUrl} target="_blank" rel="noopener noreferrer">{p.paidOn} · {displayAmount(p.amount)} ASTR</a></div>) : "—"}</td></tr>)}</tbody>
      </table></div></section><p className="muted">ASTR amounts retain 18 decimal places and are displayed to 6. Rule version: {period.ruleVersion}.</p>
    </>}
  </main>;
}
