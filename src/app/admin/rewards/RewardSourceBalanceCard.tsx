"use client";

import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { displayAmount } from "@/lib/rewards";
import type { RewardSourceBalance } from "@/lib/reward-source-balance-types";

export function RewardSourceBalanceCard({ address }: { address: string }) {
  const [balance, setBalance] = useState<RewardSourceBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        throw new Error(response.status === 401 ? "Admin session expired. Sign in again."
          : typeof body.error === "string" ? body.error : "Balance could not be fetched. Try again later.");
      }
      if (!controller.signal.aborted) setBalance(body as RewardSourceBalance);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Balance could not be fetched. Try again later.");
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

  return <section className="card" aria-labelledby="reward-source-heading">
    <div className="panel-header"><div><h2 id="reward-source-heading">Reward source balance</h2>
      <p className="muted">Current account balances · independent of the selected report month.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading} aria-busy={loading}>
        {loading && <LoaderCircle className="spin" size={16}/>}{loading ? "Fetching balance…" : "Refresh balance"}
      </button></div>
    <p className="reward-address"><a className="reward-link" href={`https://astar.subscan.io/account/${address}`} target="_blank" rel="noopener noreferrer">{address}</a></p>
    <div aria-live="polite">
      {balance ? <><div className="reward-summary">
        <div><span className="muted">Transferable balance</span><strong>{displayAmount(balance.transferableAstr)} ASTR</strong></div>
        <div><span className="muted">Reference balance</span><strong>{displayAmount(balance.balanceAstr)} ASTR</strong></div>
      </div><p className="muted">{error ? "Last successful fetch" : "Fetched"}: {formatDateTime(balance.fetchedAt)} (JST) · Subscan via PubFi
        {balance.sourceGeneratedAt && <><br/>Source response generated: {formatDateTime(balance.sourceGeneratedAt)} (JST)</>}</p></>
        : <p className="muted">{loading ? "Loading balance…" : "Balance unavailable."}</p>}
    </div>
    {error && <p className="reward-warning" role="alert">{balance && "Balance update failed. The previous value is shown. "}{error}</p>}
  </section>;
}
