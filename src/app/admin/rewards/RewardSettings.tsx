"use client";

import Link from "next/link";
import type { RewardAudit, RewardPeriod, RewardProfile } from "@/lib/reward-types";
import { Field, MoneyField, openRewardTarget, RewardForm, SavedNotice, useRewardUI } from "./RewardForm";

export function PeriodSettings({ period }: { period: RewardPeriod }) {
  const { t, time } = useRewardUI();
  const sourceNames: Record<string, string> = {
    "Manual EMA30": t("Manually verified EMA30", "手動で確認したEMA30"),
    "Subscan single-day EMA30 (UTC)": t("Subscan daily EMA30 (UTC)", "Subscanの当日EMA30（UTC）"),
    "Subscan single-day EMA30 (UTC), via PubFi": t("Subscan daily EMA30 via PubFi (UTC)", "PubFi経由のSubscan当日EMA30（UTC）")
  };
  return <details className="rw-panel rw-disclosure" id="rw-settings">
    <summary>{t("Price, base reward & observations", "価格・基準報酬・稼働データ")}</summary>
    <div className="rw-body">
      <p>{t("Base reward", "基準報酬")} {period.baseUsd} USD · EMA30 {period.priceUsd ?? "—"} USD/ASTR · {period.priceDate} UTC</p>
      {period.priceSource && <p className="muted">{sourceNames[period.priceSource] ?? period.priceSource} · {time(period.priceFetchedAt)}</p>}
      {period.priceReason && <p>{period.priceReason}</p>}
      {period.status === "draft" && <>
        {!period.priceUsd && <RewardForm action="fetch-price" owner="settings" submit={t("Retry Subscan price", "Subscanから再取得")} />}
        <RewardForm id="rw-price-form" action="settings" owner="settings" submit={t("Save price and base reward", "価格・基準報酬を保存")}>
          <MoneyField name="priceUsd" label={t("Verified EMA30 on " + period.priceDate + " (UTC, USD/ASTR)", period.priceDate + "（UTC）の確認済みEMA30（USD/ASTR）")} value={period.priceUsd} />
          <Field name="reason" label={t("Source or reason for a manual price change", "価格を手入力した出典・理由")}><textarea maxLength={2000} /></Field>
          <MoneyField name="baseUsd" label={t("Base reward (USD)", "基準報酬（USD）")} value={period.baseUsd} required />
        </RewardForm>
      </>}
      <SavedNotice owner="settings"><button type="button" onClick={() => openRewardTarget("rw-overview")}>{t("Back to overview", "月の概要へ")}</button></SavedNotice>
      <p className="muted">{t("Observations captured", "稼働データの集計時刻")} · {time(period.observedAt)}</p>
      {period.confirmedAt && <p className="muted">{t("Published", "公開日時")} · {time(period.confirmedAt)}</p>}
      {period.status === "draft" && <RewardForm action="refresh" owner="settings" submit={t("Refresh observations and participants", "稼働データと参加者を更新")} />}
      <p className="muted">{t("Normal nodes earn 100% at 80% availability or above, and 50% below. Recovery earns 30%, inactive earns 0%. Without a verified Identity the reward is halved.",
        "通常時は稼働率80%以上で満額、80%未満で半額です。復旧中は30%、停止中は0%です。認証済みIdentityがない場合はさらに半額になります。")}</p>
    </div></details>;
}

export function Participants({ profiles, draft }: { profiles: RewardProfile[]; draft: boolean }) {
  const { t, saved } = useRewardUI();
  return <details className="rw-panel rw-disclosure" id="rw-profiles"><summary>{t("Participant settings", "参加者設定")}
    <span>{t("Private", "管理者限定")}</span></summary><div className="rw-body">
    <p className="muted">{t("Save eligible participants here. Creating or refreshing a draft copies their settings into that month.",
      "報酬対象者を登録します。設定は下書きの作成時、または「参加者を反映」でその月の台帳に取り込まれます。")}</p>
    {profiles.length === 0 && <Link className="button" href="/admin">{t("Register a monitoring node", "監視ノードを登録")}</Link>}
    {profiles.map(profile => <details key={profile.nodeId} className="rw-subsection"><summary>{profile.label} · {profile.eligible ? t("Eligible", "報酬対象") : t("Not eligible", "対象外")}</summary>
      <p className="muted">{profile.monitoringEnabled ? t("Monitoring enabled", "監視中") : t("Monitoring disabled", "監視停止中")}</p>
      <RewardForm id={"rw-profile-" + profile.nodeId} action="profile" owner={"profile-" + profile.nodeId} label={profile.label}
        nodeId={profile.nodeId} version={profile.version} submit={t("Save participant", "参加者を保存")}>
        <label className="checkbox-label"><input type="checkbox" name="eligible" defaultChecked={profile.eligible} />{t("Eligible for monthly rewards", "月次報酬の対象にする")}</label>
        <Field name="address" label={t("Payment address (SS58)", "受取アドレス（SS58）")}><input defaultValue={profile.address} maxLength={100} /></Field>
        <label className="checkbox-label"><input type="checkbox" name="hasIdentity" defaultChecked={profile.hasIdentity} />{t("Verified on-chain Identity", "オンチェーンIdentityを確認済み")}</label>
        <details className="rw-subsection"><summary>{t("Participant details", "参加者の詳細")}</summary>
          <Field name="identityName" label={t("On-chain Identity name", "オンチェーンIdentity名")}><input defaultValue={profile.identityName} maxLength={200} /></Field>
          <Field name="discordName" label={t("Discord name", "Discord名")}><input defaultValue={profile.discordName} maxLength={200} /></Field>
          <Field name="region" label={t("Region", "地域")}><input defaultValue={profile.region} maxLength={200} /></Field>
        </details>
      </RewardForm>
      <SavedNotice owner={"profile-" + profile.nodeId}>{draft && saved?.action === "profile" && <button type="button" onClick={() => openRewardTarget("rw-apply-profiles")}>{t("Go to apply changes", "台帳への反映へ進む")}</button>}</SavedNotice>
    </details>)}
    {draft && profiles.length > 0 && <RewardForm id="rw-apply-profiles" action="refresh" owner="participants" submit={t("Apply participants to this draft", "この月の台帳に参加者を反映")} />}
    <SavedNotice owner="participants" />
  </div></details>;
}

const auditNames: Record<string, [string, string]> = {
  created: ["Draft created", "下書き作成"], price_fetched: ["Price retrieved", "価格取得"],
  settings_saved: ["Settings saved", "設定保存"], observations_refreshed: ["Observations refreshed", "稼働データ更新"],
  entry_saved: ["Monthly decision saved", "月次判断保存"], confirmed: ["Report published", "確定・公開"],
  reopened: ["Ledger reopened", "編集再開"], profile_saved: ["Participant saved", "参加者設定保存"], payment_recorded: ["Payment recorded", "送金記録"],
  payment_corrected: ["Payment corrected", "送金記録訂正"], confirmed_amount_corrected: ["Reward corrected", "確定報酬訂正"]
};

export function AuditHistory({ audits }: { audits: RewardAudit[] }) {
  const { t, time } = useRewardUI();
  return <details className="rw-panel rw-disclosure"><summary>{t("Audit history", "変更履歴")}<span>{t("Private", "管理者限定")}</span></summary>
    <div className="rw-body">{audits.map(audit => <details className="reward-audit" key={audit.id}>
      <summary>{time(audit.createdAt)} · {auditNames[audit.action] ? t(...auditNames[audit.action]) : audit.action}</summary>
      {audit.reason && <p>{audit.reason}</p>}<div className="reward-settings">
        <div><h3>{t("Before", "変更前")}</h3><pre>{JSON.stringify(audit.before, null, 2)}</pre></div>
        <div><h3>{t("After", "変更後")}</h3><pre>{JSON.stringify(audit.after, null, 2)}</pre></div>
      </div></details>)}</div></details>;
}
