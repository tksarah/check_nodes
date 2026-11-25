"use client";

import type { ReactNode } from "react";
import { formatPercent } from "@/lib/format";
import { rewardProblemText } from "@/lib/reward-feedback";
import type { RewardEntry, RewardPayment, RewardProfile } from "@/lib/reward-types";
import { displayAmount } from "@/lib/rewards";
import type { RewardRow } from "@/lib/reward-workflow";
import { Field, MoneyField, openRewardTarget, RewardForm, SavedNotice, useRewardUI } from "./RewardForm";

const stateNames: Record<RewardEntry["state"], [string, string]> = {
  normal: ["Normal", "通常"], recovery: ["Recovery", "復旧中"], inactive: ["Inactive", "停止中"]
};
const paymentNames: Record<string, [string, string]> = {
  Unpaid: ["Unpaid", "未払い"], "Partially paid": ["Partially paid", "一部支払い"],
  Paid: ["Paid", "支払済み"], Overpaid: ["Overpaid", "超過払い"], "Not payable": ["No payment due", "支払額なし"]
};

export function openRow(row: RewardRow, profiles: RewardProfile[]) {
  const { entry, issue } = row;
  if (issue?.field === "address" && entry.nodeRef != null) {
    const profile = profiles.find(p => p.nodeId === entry.nodeRef);
    if (profile && (profile.address !== entry.address || !profile.eligible)) return openRewardTarget("rw-sync-" + entry.id);
    return openRewardTarget("rw-profile-" + entry.nodeRef, "address");
  }
  if (issue) return openRewardTarget("rw-edit-" + entry.id, issue.field);
  if (row.outstanding) return openRewardTarget("rw-transfer-" + entry.id, "txUrl");
  return openRewardTarget("rw-row-" + entry.id);
}

function Metric({ label, children, title }: { label: string; children: ReactNode; title?: string }) {
  return <span className="rw-cell" title={title}><small>{label}</small><span>{children}</span></span>;
}

function ParticipantSnapshot({ entry }: { entry: RewardEntry }) {
  const { t } = useRewardUI();
  const a = entry.availability;
  const hours = (n: number) => n < 1 ? Math.round(n * 60) + t(" min", "分") : n.toFixed(1) + t(" h", "時間");
  return <details className="rw-subsection"><summary>{t("Calculation & participant snapshot", "計算根拠・参加者の記録")}</summary>
    <dl className="rw-definition">
      <dt>{t("State / Identity factors", "稼働状態・Identityの係数")}</dt><dd>{t(...stateNames[entry.state])} · {entry.statePercent ?? "—"}% / {entry.identityPercent}%</dd>
      <dt>{t("Calculated reward", "自動計算額")}</dt><dd>{entry.calculatedAmount ?? "—"} ASTR</dd>
      {entry.overrideAmount != null && <><dt>{t("Adjusted reward", "調整額")}</dt><dd>{entry.overrideAmount} ASTR</dd></>}
      <dt>{t("Online / observed", "オンライン時間・観測時間")}</dt><dd>{hours(a.onlineHours)} / {hours(a.totalObservedHours)}</dd>
      <dt>{t("Observations", "観測回数")}</dt><dd>{a.sampleCount}</dd>
      <dt>{t("Long gaps / unobserved edges", "長い観測間隔・月内の未観測時間")}</dt><dd>{a.longGapCount} / {hours(a.unobservedHours)}</dd>
      <dt>{t("Region", "地域")}</dt><dd>{entry.region || "—"}</dd>
      <dt>Identity</dt><dd>{entry.hasIdentity ? entry.identityName || t("Verified", "確認済み") : t("Absent", "未確認")}</dd>
      <dt>Discord</dt><dd>{entry.discordName || "—"}</dd>
      <dt>{t("Payment address", "受取アドレス")}</dt><dd className="reward-address">{entry.address || "—"}</dd>
      {entry.adjustmentReason && <><dt>{t("Decision note", "判断理由")}</dt><dd>{entry.adjustmentReason}</dd></>}
    </dl>
    {entry.nodeRef == null && <p className="muted">{t("The monitoring node was deleted. This month retains its snapshot.", "監視ノードは削除済みです。この月の記録を表示しています。")}</p>}
  </details>;
}

function PaymentForm({ row, today, payment }: { row: RewardRow; today: string; payment?: RewardPayment }) {
  const { t } = useRewardUI();
  const { entry } = row;
  const amount = payment?.amount ?? (row.outstanding ? row.payment.remaining : "");
  return <RewardForm id={payment ? "rw-correct-payment-" + payment.id : "rw-transfer-" + entry.id}
    action="payment" entryId={entry.id} paymentId={payment?.id} owner={"entry-" + entry.id} label={entry.label}
    submit={payment ? t("Save payment correction", "送金記録の訂正を保存") : t("Save transfer record", "送金実績を保存")}>
    <Field name="txUrl" label={t("Subscan transaction link", "Subscanの取引リンク")}><input type="url" defaultValue={payment?.txUrl}
      placeholder="https://astar.subscan.io/extrinsic/…" maxLength={250} required /></Field>
    <div className="rw-pair">
      <MoneyField name="amount" label={t("Actual amount (ASTR)", "実際の送金額（ASTR）")} value={amount} required />
      <Field name="paidOn" label={t("Payment date (JST)", "支払日（日本時間）")}><input type="date" defaultValue={payment?.paidOn ?? today} max={today} required /></Field>
    </div>
    {payment && <Field name="reason" label={t("Correction reason", "訂正理由")}><textarea required maxLength={2000} /></Field>}
    <details className="rw-subsection"><summary>{t("Internal note", "管理メモ")}</summary>
      <Field name="memo" label={t("Note (optional)", "メモ（任意）")}><textarea defaultValue={payment?.memo} maxLength={2000} /></Field>
    </details>
  </RewardForm>;
}

export function RewardEntryRow({ row, draft, today, hasPayments, nextRow, profiles }: {
  row: RewardRow; draft: boolean; today: string; hasPayments: boolean; nextRow?: RewardRow; profiles: RewardProfile[];
}) {
  const { t, language } = useRewardUI();
  const { entry, issue, payment } = row;
  const reviewGaps = entry.availability.availabilityPercent != null && (entry.availability.longGapCount > 0 || entry.availability.unobservedHours > 0);
  const owner = "entry-" + entry.id;
  const amount = entry.overrideAmount ?? entry.calculatedAmount;
  let state = t(...stateNames[entry.state]);
  if (!draft) state = t(...paymentNames[payment.status]);
  else if (issue?.field === "address") state = t("Review address", "受取アドレスを確認");
  else if (issue?.field === "reason") state = t("Add decision reason", "判断理由を入力");
  else if (issue) state = t("Review reward", "報酬額を確認");
  else if (entry.overrideAmount != null) state += t(" · Adjusted", "・金額調整済み");
  return <details id={"rw-row-" + entry.id} className={"rw-row" + (draft ? " rw-draft" : " rw-published")}>
    <summary><span className="rw-node-name">{entry.label}</span>
      {draft ? <>
        <Metric label={t("Availability", "稼働率")}>{entry.availability.availabilityPercent == null ? t("Insufficient data", "観測不足") : formatPercent(entry.availability.availabilityPercent)}
          {reviewGaps && <em>{t("Review advised", "確認推奨")}</em>}</Metric>
        <Metric label={t("Estimated ASTR", "見込報酬 ASTR")} title={amount ?? undefined}>{displayAmount(amount)}</Metric>
      </> : <>
        <Metric label={t("Confirmed ASTR", "確定額 ASTR")} title={entry.confirmedAmount ?? undefined}>{displayAmount(entry.confirmedAmount)}</Metric>
        <Metric label={t("Paid ASTR", "支払済み ASTR")} title={payment.paidAmount}>{displayAmount(payment.paidAmount)}</Metric>
        <Metric label={t("Remaining ASTR", "残額 ASTR")} title={payment.remaining}>{displayAmount(payment.remaining)}</Metric>
      </>}
      <span className={"rw-row-state" + (issue || row.overpaid ? " rw-attention" : "")}>{state}</span>
    </summary>
    <div className="rw-row-body">
      <SavedNotice owner={owner}><button type="button" onClick={event => {
        const current = event.currentTarget.closest("details.rw-row");
        if (current instanceof HTMLDetailsElement) current.open = false;
        if (nextRow) openRow(nextRow, profiles);
        else openRewardTarget("rw-overview");
      }}>
        {nextRow ? t("Next entry to review", "次の明細へ") : t("Back to overview", "月の概要へ")}</button></SavedNotice>
      {draft ? <>
        {issue && <p className="reward-warning">{rewardProblemText(issue, language)}</p>}
        {issue?.field === "address" && entry.nodeRef != null && <div>
          <button type="button" onClick={() => openRewardTarget("rw-profile-" + entry.nodeRef, "address")}>{t("Edit participant address", "参加者の受取アドレスを編集")}</button>
          <RewardForm id={"rw-sync-" + entry.id} action="refresh" submit={t("Apply participant changes", "参加者の変更を反映")} />
        </div>}
        <RewardForm id={"rw-edit-" + entry.id} action="entry" owner={owner} label={entry.label} entryId={entry.id} submit={t("Save monthly decision", "月次の判断を保存")}>
          <Field name="state" label={t("Monthly state", "月次の稼働状態")}><select defaultValue={entry.state}>
            {Object.entries(stateNames).map(([key, pair]) => <option key={key} value={key}>{t(...pair)}</option>)}</select></Field>
          <MoneyField name="overrideAmount" value={entry.overrideAmount} label={t("Adjusted ASTR (leave blank to use calculation)", "調整額（ASTR、空欄で自動計算）")} />
          <Field name="reason" label={t("Decision reason", "判断理由")}><textarea defaultValue={entry.adjustmentReason} maxLength={2000} /></Field>
        </RewardForm></> : <>
        {row.overpaid && <p className="reward-warning">{t("Amount above confirmed reward", "確定額を超えた支払い")} · {payment.difference} ASTR</p>}
        {row.outstanding ? <><p className="muted">{t("Record a completed transfer. Check the amount and date against your receipt.", "送金済みの取引を記録します。取引明細で金額と日付を確認してください。")}</p><PaymentForm row={row} today={today} /></>
          : <details className="rw-subsection"><summary>{t("Record another transfer", "追加の送金を記録")}</summary><PaymentForm row={row} today={today} /></details>}
        {entry.payments.map(p => <div className="rw-payment" key={p.id}><a className="reward-link" href={p.txUrl} target="_blank" rel="noopener noreferrer">
          {p.paidOn} · {p.amount} ASTR · {t("View transaction", "取引を見る")}</a>
          {p.memo && <p>{p.memo}</p>}<details className="rw-subsection"><summary>{t("Correct payment record", "送金記録を訂正")}</summary>
            <PaymentForm row={row} payment={p} today={today} /></details></div>)}
        {hasPayments && <details className="rw-subsection"><summary>{t("Correct confirmed reward", "確定報酬を訂正")}</summary>
          <RewardForm action="correct-reward" owner={owner} label={entry.label} entryId={entry.id} submit={t("Save reward correction", "確定報酬の訂正を保存")}>
            <MoneyField name="amount" label={t("Corrected reward (ASTR)", "訂正後の報酬（ASTR）")} value={entry.confirmedAmount} required />
            <Field name="reason" label={t("Correction reason", "訂正理由")}><textarea required maxLength={2000} /></Field>
          </RewardForm></details>}
      </>}
      <ParticipantSnapshot entry={entry} />
    </div></details>;
}
