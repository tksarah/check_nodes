"use client";

import { useRouter } from "next/navigation";
import { cloneElement, createContext, useContext, useEffect, useId, useRef, useState, useTransition } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { rewardProblemText, type RewardLanguage, type RewardProblem } from "@/lib/reward-feedback";

export type SavedAction = { action: string; owner?: string; label?: string; warning?: RewardProblem };
type WorkspaceContext = {
  language: RewardLanguage;
  month: string;
  csrf: string;
  version?: number;
  saved: SavedAction | null;
  onSaved: (result: SavedAction) => void;
};
export const RewardContext = createContext<WorkspaceContext | null>(null);

export function useRewardUI() {
  const context = useContext(RewardContext);
  if (!context) throw new Error("Missing reward workspace");
  const { language } = context;
  const t = (english: string, japanese: string) => language === "ja" ? japanese : english;
  const time = (value: string | null) => value ? new Intl.DateTimeFormat(language, {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo"
  }).format(new Date(value)) + " JST" : "—";
  return { ...context, t, time };
}

// Open every containing disclosure before focusing a field, including on mobile.
export function openRewardTarget(id: string, field?: string) {
  const target = document.getElementById(id);
  if (!target) return;
  for (let el: HTMLElement | null = target; el; el = el.parentElement) {
    if (el instanceof HTMLDetailsElement) el.open = true;
  }
  const named = field && target instanceof HTMLFormElement ? target.elements.namedItem(field) : null;
  const focus = named instanceof HTMLElement ? named : target.hasAttribute("tabindex") ? target
    : target.querySelector<HTMLElement>("summary, input:not([type=hidden]), button, a[href]") ?? target;
  focus.focus({ preventScroll: true });
  focus.scrollIntoView({ block: "nearest" });
}

export function SavedNotice({ owner, children }: { owner: string; children?: ReactNode }) {
  const { saved, t, language, version } = useRewardUI();
  const notice = useRef<HTMLDivElement>(null);
  const active = saved != null && (saved.owner ?? "overview") === owner;
  useEffect(() => {
    const el = notice.current;
    if (active && el && (document.activeElement === document.body || document.activeElement === el)) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: "nearest" });
    }
  }, [active, saved, version]);
  if (!active) return null;
  const captions: Record<string, [string, string]> = {
    create: ["Draft created.", "下書きを作成しました。"],
    confirm: ["Report published.", "レポートを公開しました。"],
    reopen: ["Ledger reopened.", "台帳の編集を再開しました。"],
    refresh: ["Observations and participants updated.", "稼働データと参加者を更新しました。"],
    payment: ["Payment record saved.", "送金記録を保存しました。"],
    entry: ["Monthly decision saved.", "月次の判断を保存しました。"],
    profile: ["Participant saved.", "参加者設定を保存しました。"],
    "correct-reward": ["Confirmed reward corrected.", "確定報酬を訂正しました。"]
  };
  const caption = captions[saved.action] ?? ["Settings saved.", "設定を保存しました。"];
  return <div className="rw-saved" ref={notice} tabIndex={-1} role="status">{saved.label && <strong>{saved.label} · </strong>}{t(...caption)}
    {saved.warning && <p className="reward-warning">{rewardProblemText(saved.warning, language)}</p>}
    {children}</div>;
}

const IssueContext = createContext<RewardProblem | null>(null);
type ControlProps = { name?: string; "aria-invalid"?: boolean; "aria-describedby"?: string };

export function Field({ name, label, children }: { name: string; label: string; children: ReactElement<ControlProps> }) {
  const problem = useContext(IssueContext);
  const { language } = useRewardUI();
  const errorId = useId();
  const invalid = problem?.field === name;
  return <label><span>{label}</span>
    {cloneElement(children, { name, "aria-invalid": invalid || undefined, "aria-describedby": invalid ? errorId : undefined })}
    {invalid && <span className="rw-error" id={errorId} role="alert">{rewardProblemText(problem, language)}</span>}
  </label>;
}

export function MoneyField({ name, label, value, required }: { name: string; label: string; value?: string | null; required?: boolean }) {
  return <Field name={name} label={label}><input defaultValue={value ?? ""} inputMode="decimal"
    pattern="[0-9]{1,20}(\.[0-9]{1,18})?" maxLength={39} required={required} /></Field>;
}

type FormProps = {
  action: string; submit: string; children?: ReactNode; id?: string; owner?: string; label?: string;
  version?: number; entryId?: string; paymentId?: string; nodeId?: number; primary?: boolean;
};

export function RewardForm({ action, submit, children, id, owner, label, version, entryId, paymentId, nodeId, primary }: FormProps) {
  const ui = useRewardUI();
  const router = useRouter();
  const [problem, setProblem] = useState<RewardProblem | null>(null);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const pending = sending || refreshing;
  const formVersion = version ?? ui.version;

  useEffect(() => {
    if (pending || !problem?.field) return;
    const control = formRef.current?.elements.namedItem(problem.field);
    if (!(control instanceof HTMLElement)) return;
    for (let el = control.parentElement; el && el !== formRef.current; el = el.parentElement) {
      if (el instanceof HTMLDetailsElement) el.open = true;
    }
    control.focus();
  }, [problem, pending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || pending) return;
    const form = event.currentTarget;
    function showIssue(issue: RewardProblem) {
      const control = issue.field ? form.elements.namedItem(issue.field) : null;
      if (control instanceof HTMLElement && !(control instanceof HTMLInputElement && control.type === "hidden")) {
        setProblem(issue);
      } else {
        setProblem({ ...issue, field: undefined });
      }
    }
    for (const input of Array.from(form.elements)) {
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) continue;
      if (!input.willValidate || input.validity.valid) continue;
      let code: RewardProblem["code"] = "invalidField";
      if (input.validity.valueMissing) code = "required";
      else if (input.name === "txUrl") code = "txUrl";
      else if (input.name === "paidOn") code = input.validity.rangeOverflow ? "futureDate" : "date";
      else if (input.validity.patternMismatch) code = "decimal";
      showIssue({ code, field: input.name });
      return;
    }
    const data = new FormData(form);
    inFlight.current = true;
    setSending(true);
    setProblem(null);
    try {
      const response = await fetch("/api/admin/rewards", {
        method: "POST", body: data, headers: { Accept: "application/json" }, credentials: "same-origin", cache: "no-store"
      });
      const body = await response.json();
      if (!response.ok || !body.saved) {
        showIssue(body.problem ?? { code: "unknown" });
        return;
      }
      ui.onSaved({ action, owner, label, warning: body.warning });
      startRefresh(() => router.refresh());
    } catch {
      showIssue({ code: "unknown" });
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return <form ref={formRef} id={id} action="/api/admin/rewards" method="post" noValidate onSubmit={handleSubmit}>
    <input type="hidden" name="month" value={ui.month} />
    <input type="hidden" name="csrfToken" value={ui.csrf} />
    <input type="hidden" name="action" value={action} />
    {formVersion != null && <input type="hidden" name="version" value={formVersion} />}
    {entryId && <input type="hidden" name="entryId" value={entryId} />}
    {paymentId && <input type="hidden" name="paymentId" value={paymentId} />}
    {nodeId != null && <input type="hidden" name="nodeId" value={nodeId} />}
    <fieldset className="rw-fields" key={formVersion} disabled={pending}>
      <IssueContext.Provider value={problem}>{children}</IssueContext.Provider>
      {problem && !problem.field && <p className="rw-error" role="alert">{rewardProblemText(problem, ui.language)}
        {["ledgerChanged", "profileChanged", "ledgerExists", "priceFetchConflict", "csrf", "unknown"].includes(problem.code) &&
          <> <button type="button" onClick={() => window.location.reload()}>{ui.t("Reload ledger", "台帳を再読み込み")}</button></>}
        {problem.code === "session" && <> <a className="reward-link" href="/admin">{ui.t("Admin login", "管理ログイン")}</a></>}
      </p>}
      <button type="submit" className={primary ? "primary" : undefined} aria-busy={pending}>
        {pending ? ui.t("Saving…", "処理中…") : submit}
      </button>
    </fieldset>
  </form>;
}
