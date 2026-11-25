"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { REWARD_LANGUAGE_COOKIE, rewardProblemText, type RewardLanguage, type RewardProblem } from "@/lib/reward-feedback";
import type { DraftReview } from "@/lib/reward-review";
import type { RewardAudit, RewardPeriod, RewardProfile } from "@/lib/reward-types";
import { rewardWorkflow } from "@/lib/reward-workflow";
import { displayAmount, getMonthBounds } from "@/lib/rewards";
import { openRow, RewardEntryRow } from "./RewardEntryRow";
import { Field, openRewardTarget, RewardContext, RewardForm, SavedNotice, useRewardUI, type SavedAction } from "./RewardForm";
import { AuditHistory, Participants, PeriodSettings } from "./RewardSettings";
import { RewardSourceBalanceCard } from "./RewardSourceBalanceCard";

type Props = {
  month: string; today: string; csrf: string; initialLanguage: RewardLanguage; period: RewardPeriod | null;
  profiles: RewardProfile[]; months: { month: string; status: "draft" | "confirmed" }[];
  audits: RewardAudit[]; review: DraftReview | null; sourceAddress: string;
  invalidMonth: boolean; initialNotice: RewardProblem | null; initialSaved: boolean;
};

function monthName(month: string, language: RewardLanguage) {
  return new Intl.DateTimeFormat(language, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(month + "-01T00:00:00Z"));
}

type Workflow = ReturnType<typeof rewardWorkflow>;
function NextAction({ flow, period, profiles }: { flow: Workflow; period: RewardPeriod | null; profiles: RewardProfile[] }) {
  const { t, month } = useRewardUI();
  const n = flow.attention.length;
  let title: string;
  let note: string;
  let action: ReactNode = null;
  function jump(text: string, run: () => void) {
    return <button type="button" className="primary" onClick={run}>{text}</button>;
  }
  switch (flow.step) {
    case "create":
      title = t("Prepare this month’s draft", "この月の下書きを作成");
      note = t("Use saved participants and observations. The opening EMA30 price is retrieved once.", "登録済みの参加者と稼働データを取り込み、月初のEMA30価格を1回取得します。");
      action = <RewardForm action="create" primary submit={t("Create monthly draft", "月次の下書きを作成")} />;
      break;
    case "chooseMonth":
      title = t("No nodes registered during this period", "この月の終了時点で登録ノードがありません");
      note = t("Choose the month a node was first registered or a later month.", "ノードの登録月以降を選ぶと、参加者を台帳に取り込めます。");
      action = jump(t("Choose another month", "別の対象月を選択"), () => openRewardTarget("rw-choose-month", "month"));
      break;
    case "participants":
      title = t("Choose reward participants", "報酬対象の参加者を設定");
      note = t("This draft has no participants. Save an eligible node and apply it to this month.", "台帳に参加者がいません。対象ノードを設定し、この月に反映してください。");
      action = profiles.length ? jump(t("Open participant settings", "参加者設定を開く"), () => openRewardTarget("rw-profiles"))
        : <Link className="button primary" href="/admin">{t("Register a node", "ノードを登録")}</Link>;
      break;
    case "refresh":
      title = t("Update monthly observations and participants", "稼働データと参加者を更新");
      note = t("Bring this draft up to date. Monthly decisions and adjustments are retained.", "対象月の最新データを取り込みます。保存済みの月次判断と調整額を引き継ぎます。");
      action = <RewardForm action="refresh" primary submit={t("Refresh draft", "下書きを更新")} />;
      break;
    case "price":
      title = t("Set this month’s EMA30 price", "今月のEMA30価格を設定");
      note = t("One verified price calculates rewards for every participant.", "対象月1日（UTC）の価格を1件設定すると、全員の報酬を計算できます。");
      action = jump(t("Set price", "価格を設定"), () => openRewardTarget("rw-price-form", "priceUsd"));
      break;
    case "entries":
      title = t(n + (n === 1 ? " node needs a decision" : " nodes need a decision"), "判断が必要なノードが" + n + "件あります");
      note = t("Open the first outstanding item to see what needs updating.", "該当する明細を開くと、対応が必要な欄に移動します。");
      action = jump(t("Review " + n + (n === 1 ? " entry" : " entries"), "要対応の" + n + "件を確認"), () => openRow(flow.attention[0], profiles));
      break;
    case "wait":
      title = t("Waiting for month-end", "対象月の終了待ち");
      note = t("Refresh observations from " + getMonthBounds(month).paymentMonth + "-01 (JST) to publish.", getMonthBounds(month).paymentMonth + "-01（日本時間）以降に稼働データを更新すると公開できます。");
      break;
    case "confirm":
      title = t("Ready to publish", "報酬を確定・公開できます");
      note = t("The report publishes availability, rewards, payment status and transaction links. Addresses and internal notes stay private.",
        "稼働率・報酬額・支払状況・取引リンクを公開します。受取アドレスと管理メモは管理者限定です。");
      action = <RewardForm action="confirm" primary submit={t("Confirm and publish", "確定して公開")} />;
      break;
    case "payments":
      title = t(n + (n === 1 ? " node has a remaining balance" : " nodes have a remaining balance"), "未払い残額があるノードは" + n + "件です");
      note = t("After sending funds, record the transaction against the node.", "送金が済んだら、該当ノードに実際の取引を記録してください。");
      action = jump(t("Record a transfer", "送金実績を記録"), () => openRow(flow.attention[0], profiles));
      break;
    case "overpaid":
      title = t("Review excess payments", "超過払いの明細を確認");
      note = t("Payments exceed the confirmed amount for " + flow.overpaid.length + (flow.overpaid.length === 1 ? " node." : " nodes."), flow.overpaid.length + "件で送金記録の合計が確定額を超えています。");
      action = jump(t("Review payment details", "送金明細を確認"), () => openRow(flow.overpaid[0], profiles));
      break;
    default:
      title = t("Payment records complete", "送金記録が完了しました");
      note = t("All confirmed rewards are accounted for.", "全参加者の確定額と支払済み額が一致しています。");
  }
  return <section className="rw-next" aria-labelledby="rw-next-title">
    <div><h2 id="rw-next-title">{title}</h2><p>{note}</p>
      {period && <span className="rw-next-total">{t("Participants", "参加者")} {flow.rows.length} · {period.status === "draft" ? t("Estimated total", "見込合計") : t("Confirmed total", "確定合計")} {displayAmount(flow.total)} ASTR
        {period.status === "confirmed" && <> · {t("Paid", "支払済み")} {displayAmount(flow.paid)} ASTR</>}</span>}
    </div>{action}</section>;
}

export function RewardWorkspace(props: Props) {
  const [language, setLanguage] = useState(props.initialLanguage);
  const [saved, setSaved] = useState<SavedAction | null>(null);
  const choose = (value: RewardLanguage) => {
    document.cookie = REWARD_LANGUAGE_COOKIE + "=" + value + "; Path=/admin/rewards; Max-Age=31536000; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
    setLanguage(value);
  };
  return <RewardContext.Provider value={{ language, month: props.month, csrf: props.csrf, version: props.period?.version, saved, onSaved: setSaved }}>
    <WorkspaceContents {...props} chooseLanguage={choose} />
  </RewardContext.Provider>;
}

function WorkspaceContents({ period, profiles, months, audits, month, today, review, sourceAddress, invalidMonth,
  initialNotice, initialSaved, chooseLanguage }: Props & { chooseLanguage: (language: RewardLanguage) => void }) {
  const { language, t, saved } = useRewardUI();
  const router = useRouter();
  const flow = rewardWorkflow(period, review, profiles);
  const draft = period?.status === "draft";
  const hasPayments = !!period?.entries.some(e => e.payments.length > 0);
  const paymentMonth = getMonthBounds(month).paymentMonth;
  return <main className="shell rewards-shell rw-shell" lang={language}>
    <header className="rw-header"><div className="rw-title"><img src="/brand/astar-symbol-color.png" alt="" width="30" height="30" />
      <h1>{t("Reward management", "報酬管理")}</h1></div>
      <div className="rw-language" role="group" aria-label={t("Display language", "表示言語")}>
        <button type="button" lang="ja" aria-pressed={language === "ja"} onClick={() => chooseLanguage("ja")}>日本語</button>
        <button type="button" lang="en" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>English</button>
      </div></header>
    <section id="rw-overview" tabIndex={-1} className="rw-panel rw-overview" aria-labelledby="rw-month">
      <div className="rw-month-head"><div>
        <span className={"rw-status" + (period?.status === "confirmed" ? " rw-live" : "")}>
          {!period ? t("No ledger yet", "台帳未作成") : draft ? t("Draft · Private", "下書き・非公開") : t("Confirmed · Published", "確定・公開済み")}</span>
        <h2 id="rw-month">{monthName(month, language)}{t(" operations", "の稼働分")}</h2>
        <p>{t("Payment month", "支払月")} · {monthName(paymentMonth, language)} · JST</p>
      </div>
      <details className="rw-month-picker"><summary>{t("Change month", "対象月を変更")}</summary><div className="rw-month-controls">
        {months.length > 0 && <label>{t("Saved ledgers", "作成済みの台帳")}<select defaultValue={period ? month : ""} onChange={e => router.push("/admin/rewards?month=" + e.target.value)}>
          <option value="" disabled>{t("Choose a ledger", "台帳を選択")}</option>
          {months.map(m => <option key={m.month} value={m.month}>{m.month} · {m.status === "draft" ? t("Draft", "下書き") : t("Published", "公開済み")}</option>)}</select></label>}
        <form id="rw-choose-month" className="rw-fields" action="/admin/rewards" method="get"><label>{t("Operational month (JST)", "対象月（日本時間）")}
          <input type="month" name="month" defaultValue={month} min="2000-01" max={today.slice(0, 7)} required /></label>
          <button type="submit">{t("Open month", "対象月を開く")}</button></form>
      </div></details></div>
      <NextAction flow={flow} period={period} profiles={profiles} />
      <SavedNotice owner="overview" />
      {!saved && (invalidMonth || initialNotice || initialSaved) && <p className="rw-inline-notice" role="status">
        {invalidMonth && t("Invalid month. Showing the previous month. ", "対象月が無効なため前月を表示しています。")}
        {initialSaved && t("Saved. ", "保存しました。")}{initialNotice && rewardProblemText(initialNotice, language)}</p>}
    </section>
    {flow.rows.length > 0 && <section key={period?.status} className="rw-panel rw-list" aria-labelledby="rw-list-heading"><div className="rw-list-title">
      <h2 id="rw-list-heading">{draft ? t("Monthly rewards", "ノード別の報酬") : t("Payment records", "ノード別の送金記録")}</h2>
      <span>{flow.rows.length} {t(flow.rows.length === 1 ? "node" : "nodes", "件")}</span></div>
      <div className={"rw-column-head " + (draft ? "rw-draft" : "rw-published")} aria-hidden="true">
        <span>{t("Node", "ノード")}</span>
        {draft ? <><span>{t("Availability", "稼働率")}</span><span>{t("Estimated ASTR", "見込報酬 ASTR")}</span></>
          : <><span>{t("Confirmed ASTR", "確定額 ASTR")}</span><span>{t("Paid ASTR", "支払済み ASTR")}</span><span>{t("Remaining ASTR", "残額 ASTR")}</span></>}
        <span>{t("Status", "状態")}</span></div>
      {flow.rows.map(row => <RewardEntryRow key={row.entry.id} row={row} draft={draft} today={today} hasPayments={hasPayments}
        nextRow={flow.attention[0]?.entry.id === row.entry.id ? flow.attention[1] : flow.attention[0]} profiles={profiles} />)}
    </section>}
    <RewardSourceBalanceCard address={sourceAddress} />
    {period && <PeriodSettings key={"settings-" + period.status} period={period} />}
    <Participants profiles={profiles} draft={draft} />
    {period?.status === "confirmed" && !hasPayments && <details className="rw-panel rw-disclosure"><summary>{t("Reopen unpaid ledger", "未払い台帳の編集を再開")}</summary>
      <div className="rw-body"><p className="muted">{t("The published report is withdrawn until you confirm it again.", "再度確定するまで公開レポートを取り下げます。")}</p>
        <RewardForm action="reopen" submit={t("Reopen ledger", "台帳の編集を再開")}>
          <Field name="reason" label={t("Reason", "再開理由")}><textarea required maxLength={2000} /></Field></RewardForm></div></details>}
    {period && <AuditHistory audits={audits} />}
    <nav className="rw-links" aria-label={t("Other reward tools", "関連するページと操作")}>
      <Link href="/admin">{t("Admin console", "管理コンソール")}</Link>
      <Link href={period?.status === "confirmed" ? "/rewards?month=" + month : "/rewards"}>{t("Published reports", "公開レポート")}</Link>
      {period && <a href={"/api/admin/rewards/export?month=" + month}>{t("Export CSV", "CSV出力")}</a>}
    </nav>
  </main>;
}
