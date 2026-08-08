import { phoneRequest } from "./api";
import type { BankAccount } from "../apps/banking/manifest";

export class InsufficientFundsError extends Error {
  constructor(readonly account: BankAccount, readonly required: number) {
    super("Insufficient funds");
  }
}

async function move(phoneId: string, amount: number, description: string, transactionId: string): Promise<BankAccount | null> {
  const response = await phoneRequest<{ account: BankAccount | null; insufficient: boolean }>(
    `/phones/${encodeURIComponent(phoneId)}/wallet/move`,
    { method: "POST", body: JSON.stringify({ amount, description, transactionId }) },
  );
  if (response.insufficient && response.account) throw new InsufficientFundsError(response.account, Math.abs(amount));
  return response.account;
}

export function charge(phoneId: string, amount: number, description: string, transactionId: string) {
  return move(phoneId, -Math.abs(amount), description, transactionId);
}

export function credit(phoneId: string, amount: number, description: string, transactionId: string) {
  return move(phoneId, Math.abs(amount), description, transactionId);
}
