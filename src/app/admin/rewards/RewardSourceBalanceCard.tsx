"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { rewardProblemText, type RewardProblem } from "@/lib/reward-feedback";
import { displayAmount } from "@/lib/rewards";
import type { RewardSourceBalance } from "@/lib/reward-source-balance-types";
import { useRewardUI } from "./RewardForm";

export function RewardSourceBalanceCard({ address }: { address: string }) {
  const { t, language, time } = useRewardUI();
  const [balance, setBalance] = useState<RewardSourceBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RewardProblem | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/rewards/source-balance", {
        cache: "no-store", credentials: "same-origin", signal: controller.signal
      });
      const body = await response.json();
      if (!response.ok) {
        if (!controller.signal.aborted) setError(response.status === 401 ? { code: "session" } : body.problem ?? { code: "balanceNetwork" });
        return;
      }
      if (!controller.signal.aborted) setBalance(body as RewardSourceBalance);
    } catch {
      if (!controller.signal.aborted) setError({ code: "balanceNetwork" });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { activeRequest.current?.abort(); activeRequest.current = null; };
  }, [refresh]);

  return <details className="rw-panel rw-disclosure">
    <summary>{t("Current source balance", "送金元の現在の残高")}
      {balance && <span>{displayAmount(balance.transferableAstr)} ASTR · {time(balance.fetchedAt)}</span>}</summary>
    <div className="rw-body"><div className="panel-header"><p className="muted">{t("Current account balance across all months.", "対象月にかかわらず、現在の口座残高を表示します。")}</p>
      <button type="button" onClick={() => void refresh()} disabled={loading} aria-busy={loading}>
        {loading && <LoaderCircle className="spin" size={16}/>}{loading ? t("Fetching…", "取得中…") : t("Refresh balance", "残高を更新")}
      </button></div>
    <p className="reward-address"><a className="reward-link" href={`https://astar.subscan.io/account/${address}`} target="_blank" rel="noopener noreferrer">{address}</a></p>
    <div aria-live="polite">
      {balance ? <><div className="reward-summary">
        <div><span className="muted">{t("Transferable", "送金可能額")}</span><strong>{displayAmount(balance.transferableAstr)} ASTR</strong></div>
        <div><span className="muted">{t("Reference balance", "参考残高")}</span><strong>{displayAmount(balance.balanceAstr)} ASTR</strong></div>
      </div><p className="muted">{t("Last successful fetch", "最終取得")} · {time(balance.fetchedAt)} · Subscan / PubFi
        {balance.sourceGeneratedAt && <><br/>{t("Source updated", "取得元の更新")} · {time(balance.sourceGeneratedAt)}</>}</p></>
        : <p className="muted">{loading ? t("Loading balance…", "残高を取得中…") : t("Balance unavailable.", "残高を取得できませんでした。")}</p>}
    </div>
    {error && <p className="reward-warning" role="alert">{balance && t("Showing the last successful balance. ", "前回取得できた残高を表示しています。")}{rewardProblemText(error, language)}</p>}
    </div></details>;
}
