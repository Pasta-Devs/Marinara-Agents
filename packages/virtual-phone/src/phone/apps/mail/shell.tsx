import React from "react";
import { mergeInbox, parseEmail, type MailItem } from "./manifest";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

export function MailShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "mail");
  const [inbox, setInbox] = React.useState<MailItem[] | null>(null);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const persist = React.useCallback((items: MailItem[]) => {
    setInbox(items);
    void store.set("inbox", items).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not save the inbox.");
    });
  }, [store]);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setOpenIndex(null);
    setError(null);
    void phoneRequest<{ emails: string[] }>(`/phones/${encodeURIComponent(phoneId)}/mail/inbox`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        setInbox((current) => {
          const merged = mergeInbox(current ?? [], response.emails);
          void store.set("inbox", merged).catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Could not save the inbox.");
          });
          return merged;
        });
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not reach the mail server.");
        setInbox((current) => current ?? []);
      })
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void store.get("inbox").then((value) => {
      if (!active) return;
      const cached = Array.isArray(value)
        ? value.filter((item): item is MailItem => !!item && typeof (item as MailItem).text === "string")
        : null;
      if (cached?.length) setInbox(cached);
      else refresh();
    }).catch(() => { if (active) refresh(); });
    return () => { active = false; };
  }, [store, refresh]);

  const openEmail = (index: number) => {
    setOpenIndex(index);
    if (inbox && !inbox[index]!.read) {
      persist(inbox.map((item, itemIndex) => itemIndex === index ? { ...item, read: true } : item));
    }
  };
  const openItem = openIndex !== null && inbox ? inbox[openIndex] ?? null : null;
  const openParsed = openItem ? parseEmail(openItem.text) : null;

  return (
    <section aria-labelledby="mail-title" className="vp-appview">
      <PhoneAppHeader
        title={openParsed ? openParsed.from : "Mail"}
        titleId="mail-title"
        closeLabel="Close Mail"
        onBack={() => openParsed ? setOpenIndex(null) : onBack()}
        onClose={onClose}
        actions={openParsed ? [] : [{ id: "refresh-inbox", icon: "refresh", label: "Refresh inbox", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh-inbox") refresh(); }}
      />
      {openParsed ? (
        <div className="vp-mail-read">
          <h3 className="vp-page-heading">{openParsed.subject}</h3>
          <p className="vp-mail-meta">From {openParsed.from}</p>
          <div className="vp-page-body"><p>{openParsed.body}</p></div>
        </div>
      ) : (
        <>
          {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
          {loading && !inbox?.length ? (
            <div role="status" aria-label="Loading mail" className="vp-stack" style={{ gap: "0.5rem" }}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="vp-thread-row" aria-hidden="true">
                  <span className="vp-thread-body">
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "40%" }} />
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
                    <span className="vp-skeleton vp-skeleton--line" style={{ width: "90%" }} />
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {inbox && inbox.length === 0 && !loading ? (
            <p className="vp-muted-note">The inbox is empty. Refresh to check for new mail.</p>
          ) : null}
          {inbox?.length ? (
            <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
              {inbox.map((item, index) => {
                const email = parseEmail(item.text);
                return (
                  <button key={index} type="button" onClick={() => openEmail(index)} className="vp-thread-row">
                    <span className="vp-thread-body">
                      <span className="vp-thread-name" style={item.read ? { fontWeight: 500 } : undefined}>
                        {!item.read ? <span className="vp-mail-dot" aria-label="Unread" /> : null}
                        {email.from}
                      </span>
                      <span className="vp-thread-name" style={{ fontWeight: item.read ? 500 : 600, fontSize: "0.75rem" }}>{email.subject}</span>
                      <span className="vp-thread-preview">{email.body}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
