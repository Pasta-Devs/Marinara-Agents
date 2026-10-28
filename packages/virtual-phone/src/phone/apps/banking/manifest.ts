import type { AppManifest } from "../../platform/app-manifest";

export const bankingManifest: AppManifest = {
  id: "banking",
  name: "Banking",
  version: "1.0.0",
  icon: "banking",
  category: "utilities",
  capabilities: ["storage.local", "context.read"],
  modelUse: "light",
  removable: true,
  routes: [
    { id: "balance", path: "/", title: "Banking" },
    { id: "history", path: "/history", title: "Transactions" },
  ],
  records: [{ type: "account", ownership: "phone-local" }],
  actions: [
    { id: "adjust-balance", tier: "local" },
    { id: "check-activity", tier: "ambient" },
  ],
  content: { activity: { fields: { changes: "string[]" } } },
  notifications: null,
};

export interface BankTransaction {
  id: string;
  at: string;
  /** Signed, in whole currency units. */
  amount: number;
  description: string;
  /** Who moved it. A bare balance cannot be audited when the model is the one moving it. */
  source: "user" | "story";
}

export interface BankProposal {
  id: string;
  at: string;
  amount: number;
  description: string;
}

export interface BankAccount {
  balance: number;
  currency: string;
  transactions: BankTransaction[];
  /**
   * Proposed changes wait here until the user accepts or discards them, structurally identical to
   * LTM's review queue. This is the guardrail the tester asked for — administrative approval, not
   * an AI plausibility check.
   */
  pending: BankProposal[];
}

export function emptyAccount(currency = "credits"): BankAccount {
  return { balance: 0, currency, transactions: [], pending: [] };
}

export function formatMoney(amount: number, currency: string) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${Math.abs(amount).toLocaleString()} ${currency}`;
}

/** "+120 :: sold the bike" or "-40 :: taxi across town". */
export function parseProposal(line: string): { amount: number; description: string } | null {
  const [amountPart, ...rest] = line.split(" :: ");
  const normalized = (amountPart ?? "").trim().replace(/,/gu, "");
  if (!/^[+-]\d+$/u.test(normalized)) return null;
  const amount = Number.parseInt(normalized, 10);
  if (!Number.isFinite(amount) || amount === 0) return null;
  const description = rest.join(" :: ").trim();
  return { amount, description: description.slice(0, 200) || "Unexplained movement" };
}

/** Add genuinely new suggestions while keeping a retried check from filling the review tray. */
export function mergeProposals(account: BankAccount, proposals: BankProposal[]): BankAccount {
  const known = new Set([
    ...account.pending.map((entry) => `${entry.amount}:${entry.description.trim().toLocaleLowerCase()}`),
    ...account.transactions.map((entry) => `${entry.amount}:${entry.description.trim().toLocaleLowerCase()}`),
  ]);
  const unique = proposals.filter((entry) => {
    const key = `${entry.amount}:${entry.description.trim().toLocaleLowerCase()}`;
    if (known.has(key)) return false;
    known.add(key);
    return true;
  });
  return { ...account, pending: [...unique, ...account.pending].slice(0, 20) };
}

export function applyTransaction(account: BankAccount, entry: BankTransaction): BankAccount {
  return {
    ...account,
    balance: account.balance + entry.amount,
    transactions: [entry, ...account.transactions].slice(0, 200),
  };
}

export function readAccount(value: unknown): BankAccount {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyAccount();
  const record = value as Partial<BankAccount>;
  return {
    balance: Number.isFinite(Number(record.balance)) ? Number(record.balance) : 0,
    currency: typeof record.currency === "string" && record.currency.trim() ? record.currency : "credits",
    transactions: Array.isArray(record.transactions) ? record.transactions.filter((entry): entry is BankTransaction => {
      if (!entry || typeof entry !== "object") return false;
      const transaction = entry as Partial<BankTransaction>;
      return typeof transaction.id === "string" && typeof transaction.at === "string"
        && Number.isFinite(transaction.amount) && transaction.amount !== 0
        && typeof transaction.description === "string"
        && (transaction.source === "user" || transaction.source === "story");
    }).slice(0, 200) : [],
    pending: Array.isArray(record.pending) ? record.pending.filter((entry): entry is BankProposal => {
      if (!entry || typeof entry !== "object") return false;
      const proposal = entry as Partial<BankProposal>;
      return typeof proposal.id === "string" && typeof proposal.at === "string"
        && Number.isFinite(proposal.amount) && proposal.amount !== 0
        && typeof proposal.description === "string";
    }).slice(0, 20) : [],
  };
}
