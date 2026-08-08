import React from "react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { applyTransaction, emptyAccount, formatMoney, parseProposal, readAccount, type BankAccount } from "./manifest";

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `tx-${Math.random().toString(36).slice(2)}`);

export function BankingShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "banking");
  const [account, setAccount] = React.useState<BankAccount | null>(null);
  const [view, setView] = React.useState<"balance" | "history">("balance");
  const [adjust, setAdjust] = React.useState({ amount: "", description: "" });
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void store.get("account").then((value) => {
      if (active) setAccount(readAccount(value ?? emptyAccount()));
    }).catch(() => { if (active) setAccount(emptyAccount()); });
    return () => { active = false; };
  }, [store]);

  const persist = (next: BankAccount) => {
    setAccount(next);
    void store.set("account", next).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "The account could not be saved.");
    });
  };

  /** The user always has the final say: adjust directly, no approval, no plausibility check. */
  const submitAdjustment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!account) return;
    const amount = Number.parseInt(adjust.amount, 10);
    if (!Number.isFinite(amount) || amount === 0) return;
    persist(applyTransaction(account, {
      id: newId(),
      at: new Date().toISOString(),
      amount,
      description: adjust.description.trim() || "Manual adjustment",
      source: "user",
    }));
    setAdjust({ amount: "", description: "" });
  };

  /**
   * User-triggered, not per-turn. The model reads the story and proposes what money moved; nothing
   * is written until it is accepted. Keeping this on a button rather than on every turn is what
   * stops a banking app from quietly spending tokens forever.
   */
  const checkActivity = () => {
    if (!account) return;
    setChecking(true);
    setError(null);
    void phoneRequest<{ changes: string[] }>(`/phones/${encodeURIComponent(phoneId)}/banking/activity`, {
      method: "POST",
      body: JSON.stringify({ balance: account.balance, currency: account.currency }),
    })
      .then((response) => {
        const proposals = response.changes.flatMap((line) => {
          const parsed = parseProposal(line);
          return parsed ? [{ id: newId(), at: new Date().toISOString(), ...parsed }] : [];
        });
        if (!proposals.length) {
          setError("Nothing in the story moved any money.");
          return;
        }
        persist({ ...account, pending: [...proposals, ...account.pending].slice(0, 20) });
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not reach the bank.");
      })
      .finally(() => setChecking(false));
  };

  const accept = (id: string) => {
    if (!account) return;
    const proposal = account.pending.find((entry) => entry.id === id);
    if (!proposal) return;
    const withoutProposal = { ...account, pending: account.pending.filter((entry) => entry.id !== id) };
    persist(applyTransaction(withoutProposal, {
      id: proposal.id,
      at: new Date().toISOString(),
      amount: proposal.amount,
      description: proposal.description,
      source: "story",
    }));
  };
  const reject = (id: string) => {
    if (!account) return;
    persist({ ...account, pending: account.pending.filter((entry) => entry.id !== id) });
  };

  return (
    <section aria-labelledby="banking-title" className="vp-appview">
      <PhoneAppHeader
        title={view === "history" ? "Transactions" : "Banking"}
        titleId="banking-title"
        closeLabel="Close Banking"
        onBack={() => view === "history" ? setView("balance") : onBack()}
        onClose={onClose}
        actions={view === "history" ? [] : [
          { id: "check-activity", icon: "refresh", label: "Check for activity", kind: "button", disabled: checking, reason: "Checking" },
        ]}
        onAction={(actionId) => { if (actionId === "check-activity") checkActivity(); }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {!account ? (
        <div role="status" aria-label="Loading account" className="vp-stack" style={{ gap: "0.5rem" }}>
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "50%" }} />
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "80%" }} />
        </div>
      ) : view === "history" ? (
        <div className="vp-stack" style={{ gap: "0.5rem" }}>
          {account.transactions.length === 0 ? <p className="vp-muted-note">No transactions yet.</p> : null}
          {account.transactions.map((entry) => (
            <div key={entry.id} className="vp-thread-row">
              <span className="vp-thread-body">
                <span className="vp-thread-name">{entry.description}</span>
                <span className="vp-thread-preview">
                  {new Date(entry.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {entry.source === "story" ? " · from the story" : " · you"}
                </span>
              </span>
              <span className="vp-thread-name" style={{ color: entry.amount < 0 ? "inherit" : "var(--vp-accent)" }}>
                {entry.amount > 0 ? "+" : ""}{formatMoney(entry.amount, account.currency)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="vp-stack" style={{ gap: "0.75rem" }}>
          <div className="vp-card vp-stack" style={{ gap: "0.25rem", alignItems: "center" }}>
            <span className="vp-muted-note">Balance</span>
            <span className="vp-lock-clock" style={{ fontSize: "2rem" }}>{formatMoney(account.balance, account.currency)}</span>
            <button type="button" className="vp-surface-btn" onClick={() => setView("history")}>
              {account.transactions.length} transaction{account.transactions.length === 1 ? "" : "s"}
            </button>
          </div>

          {account.pending.length ? (
            <>
              <h3 className="vp-section-label">Waiting for approval</h3>
              <div className="vp-stack" style={{ gap: "0.5rem" }}>
                {account.pending.map((proposal) => (
                  <div key={proposal.id} className="vp-card vp-stack" style={{ gap: "0.5rem" }}>
                    <span className="vp-thread-name">
                      {proposal.amount > 0 ? "+" : ""}{formatMoney(proposal.amount, account.currency)}
                    </span>
                    <span className="vp-thread-preview">{proposal.description}</span>
                    <div className="vp-store-actions">
                      <button type="button" className="vp-accent-btn" onClick={() => accept(proposal.id)}>Approve</button>
                      <button type="button" className="vp-store-remove" onClick={() => reject(proposal.id)}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h3 className="vp-section-label">Adjust the balance</h3>
          <form className="vp-card vp-stack" style={{ gap: "0.5rem" }} onSubmit={submitAdjustment}>
            <p className="vp-muted-note">Your account, your rules. Nothing here asks the story for permission.</p>
            <label><span className="vp-sr-only">Amount</span>
              <input
                value={adjust.amount}
                onChange={(event) => setAdjust({ ...adjust, amount: event.target.value })}
                placeholder="Amount, e.g. 250 or -40"
                inputMode="numeric"
                className="vp-input"
              />
            </label>
            <label><span className="vp-sr-only">What for</span>
              <input
                value={adjust.description}
                onChange={(event) => setAdjust({ ...adjust, description: event.target.value })}
                placeholder="What for (optional)"
                maxLength={200}
                className="vp-input"
              />
            </label>
            <button type="submit" className="vp-accent-btn" disabled={!adjust.amount.trim()}>Apply</button>
          </form>
        </div>
      )}
    </section>
  );
}
