export type RewardLanguage = "en" | "ja";
export const REWARD_LANGUAGE_COOKIE = "reward_language";

const messages = {
  decimal: ["Enter a non-negative decimal with at most 18 decimal places.", "0以上の数値を小数18桁以内で入力してください。"],
  positive: ["Amount must be greater than zero.", "0より大きい金額を入力してください。"],
  pricePositive: ["Price must be greater than zero.", "0より大きい価格を入力してください。"],
  monthFormat: ["Use a month in YYYY-MM format.", "対象月を年と月で選択してください。"],
  monthRange: ["Month must be between 2000 and 2199.", "2000年から2199年までの対象月を選択してください。"],
  txUrl: ["Use an https://astar.subscan.io/extrinsic/… transaction link.", "Astar Subscanの取引ページ（https://astar.subscan.io/extrinsic/…）のリンクを貼ってください。"],
  address: ["Enter a valid Substrate SS58 address.", "受取先のSS58アドレスを確認してください。"],
  addressType: ["Enter a valid Substrate AccountId32 address.", "32バイトのSubstrateアカウントのSS58アドレスを入力してください。"],
  addressChecksum: ["The SS58 address checksum is invalid.", "SS58アドレスが正しくありません。受取先からコピーし直してください。"],
  date: ["Use a valid payment date in YYYY-MM-DD format.", "実際の支払日を選択してください。"],
  futureDate: ["Actual payment dates cannot be in the future.", "日本時間の今日以前の支払日を選択してください。"],
  eligibleAddress: ["An eligible node requires a payment address.", "報酬対象にするには受取アドレスを入力してください。"],
  nodeMissing: ["Node no longer exists.", "ノードが削除されました。一覧を再読み込みしてください。"],
  profileChanged: ["Participant changed. Reload before saving.", "参加者情報が更新されました。最新の内容を確認してから保存してください。"],
  ledgerMissing: ["Monthly ledger not found.", "対象月の台帳が見つかりません。月を選び直してください。"],
  ledgerChanged: ["Ledger changed. Reload before trying again.", "台帳が更新されました。最新の内容を確認してから入力し直してください。"],
  locked: ["Confirmed calculation is locked. Reopen the unpaid ledger first.", "確定済みです。支払記録がない台帳は編集を再開できます。"],
  futureMonth: ["Cannot create a ledger for a future month.", "今月以前の対象月を選択してください。"],
  ledgerExists: ["A ledger already exists for this month. Reload to open it.", "この月の台帳は作成済みです。再読み込みして開いてください。"],
  priceReason: ["A reason is required for a manual price change.", "手入力した価格の出典・変更理由を入力してください。"],
  priceSaved: ["A saved price already exists. Automatic fetch cannot overwrite it.", "価格は保存済みです。変更する場合は理由を添えて手入力してください。"],
  state: ["Invalid reward state.", "月次の稼働状態を選び直してください。"],
  adjustmentReason: ["A reason is required for an amount adjustment.", "報酬額を調整した理由を入力してください。"],
  entryMissing: ["Reward entry not found.", "対象の明細が見つかりません。台帳を再読み込みしてください。"],
  monthOpen: ["A month must be complete before its rewards can be confirmed.", "対象月が終了すると報酬を確定できます。"],
  refresh: ["Refresh observations after the operational month has ended before confirming.", "対象月が終了しました。確定前に稼働データを更新してください。"],
  priceMissing: ["A verified positive EMA30 price is required.", "月初のEMA30価格を設定してください。"],
  noParticipants: ["Add eligible participants before confirming.", "報酬対象の参加者を設定し、台帳に反映してください。"],
  observations: ["{value} has insufficient observations. Review the state or enter an amount with a reason.", "「{value}」の観測が不足しています。稼働状態または調整額を確認し、理由を入力してください。"],
  decisionReason: ["{value} needs a reason for the manual decision.", "「{value}」の判断理由を入力してください。"],
  reopenReason: ["A reason is required to reopen a ledger.", "編集を再開する理由を入力してください。"],
  confirmedOnly: ["Only confirmed ledgers can be reopened.", "確定した台帳を選択してください。"],
  hasPayments: ["This ledger has payments. Correct the payment records with a reason.", "支払記録があります。対象の明細から理由を添えて訂正してください。"],
  correctionReason: ["A correction reason is required.", "訂正理由を入力してください。"],
  confirmFirst: ["Confirm rewards before recording a payment.", "送金実績を記録する前に報酬を確定してください。"],
  paymentMissing: ["Payment not found.", "支払記録が見つかりません。台帳を再読み込みしてください。"],
  duplicateTx: ["This transaction is already recorded for this node.", "このノードには同じ取引が記録済みです。取引リンクを確認してください。"],
  reopenFirst: ["Use reopening for an unpaid ledger.", "支払記録がないため、台帳の編集を再開して変更してください。"],
  priceResponse: ["Subscan did not provide a verifiable single-day EMA30. Enter the verified price manually.", "月初1日分のEMA30を確認できませんでした。確認した価格を手入力してください。"],
  priceDate: ["Subscan returned a different price date. Enter the verified price manually.", "取得した価格の日付が一致しません。対象月1日の価格を確認して入力してください。"],
  priceInvalid: ["Subscan did not provide a positive valid EMA30. Enter the verified price manually.", "取得したEMA30が無効です。価格を確認して手入力してください。"],
  priceKey: ["The price API key is not configured. Enter the verified EMA30 manually.", "価格取得用APIキーが未設定です。確認したEMA30を手入力してください。"],
  priceHttp: ["Subscan price request failed (HTTP {value}). Retry or enter the verified price.", "Subscanから価格を取得できませんでした（HTTP {value}）。再取得するか、確認した価格を入力してください。"],
  priceNetwork: ["Subscan price request failed or timed out. Retry or enter the verified price.", "価格取得が失敗したか、時間切れです。再取得するか、確認した価格を入力してください。"],
  pricePending: ["Check the price in the saved draft and retry if needed.", "保存した下書きの価格を確認し、未設定なら再取得してください。"],
  priceFetchConflict: ["Only a draft without a saved price can fetch a price. Reload the ledger.", "最新の台帳を開いてください。価格未設定の下書きで取得できます。"],
  balanceAccount: ["Subscan did not return the expected reward source account.", "送金元の口座を確認できませんでした。残高を再取得してください。"],
  balanceData: ["Subscan did not provide valid account balances.", "口座残高を確認できませんでした。時間をおいて再取得してください。"],
  balanceKey: ["PUBFI_API_KEY is not configured on the server.", "残高取得用のPUBFI_API_KEYが未設定です。"],
  balanceHttp: ["PubFi balance request failed (HTTP {value}). Try again later.", "残高を取得できませんでした（HTTP {value}）。時間をおいて再取得してください。"],
  balanceNetwork: ["Reward source balance could not be fetched or the request timed out. Try again later.", "残高を取得できませんでした。時間をおいて再取得してください。"],
  longField: ["Shorten this value and try again.", "入力が長すぎます。短くして保存してください。"],
  required: ["Complete this field.", "この項目を入力してください。"],
  invalidField: ["Check the value in this field.", "この項目の入力内容を確認してください。"],
  session: ["Your session expired. Sign in again in Admin.", "セッションの期限が切れました。管理画面で再度ログインしてください。"],
  csrf: ["Reload this page to renew the form before saving.", "フォームの有効期限が切れました。ページを再読み込みして保存してください。"],
  unknown: ["Unable to save rewards. Reload the ledger and try again.", "保存結果を確認できませんでした。台帳を再読み込みして確認してください。"]
} as const;

export type RewardProblem = { code: keyof typeof messages; field?: string; detail?: string };

export function rewardProblemText(problem: RewardProblem, language: RewardLanguage): string {
  const pair = Object.hasOwn(messages, problem.code) ? messages[problem.code] : messages.unknown;
  return pair[language === "ja" ? 1 : 0].replace("{value}", () => problem.detail ?? "");
}

export class RewardError extends Error {
  readonly problem: RewardProblem;

  constructor(code: RewardProblem["code"], public status = 400, field?: string, detail?: string) {
    const problem = { code, field, detail };
    super(rewardProblemText(problem, "en"));
    this.problem = problem;
  }
}
