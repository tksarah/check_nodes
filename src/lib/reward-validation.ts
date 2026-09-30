import { createHash } from "node:crypto";
import { RewardError } from "./rewards";

export function validateRewardAddress(address: string) {
  // SS58 AccountId32, accepting any network prefix for the same public key.
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (!/^[1-9A-HJ-NP-Za-km-z]{45,50}$/.test(address)) throw new RewardError("Enter a valid Substrate SS58 address.");
  let value = 0n;
  for (const char of address) value = value * 58n + BigInt(alphabet.indexOf(char));
  const bytes: number[] = [];
  while (value > 0n) { bytes.unshift(Number(value % 256n)); value /= 256n; }
  for (const char of address) { if (char !== "1") break; bytes.unshift(0); }
  const data = Buffer.from(bytes);
  const prefixLength = data[0] < 64 ? 1 : data[0] < 128 ? 2 : 0;
  if (!prefixLength || data.length !== prefixLength + 34 || (prefixLength === 1 && (data[0] === 46 || data[0] === 47))) {
    throw new RewardError("Enter a valid Substrate AccountId32 address.");
  }
  const payload = data.subarray(0, -2);
  const checksum = createHash("blake2b512").update(Buffer.from("SS58PRE")).update(payload).digest();
  if (!data.subarray(-2).equals(checksum.subarray(0, 2))) throw new RewardError("The SS58 address checksum is invalid.");
  return address;
}

export function validatePaymentDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RewardError("Use a payment date in YYYY-MM-DD format.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new RewardError("Invalid payment date.");
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  if (value > today) throw new RewardError("Actual payment dates cannot be in the future.");
  return value;
}
