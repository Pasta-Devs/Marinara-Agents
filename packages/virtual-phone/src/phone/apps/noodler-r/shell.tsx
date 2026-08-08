import React from "react";
import { Lock } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { PhoneAvatar, hueFor, useAvatarMap } from "../../platform/avatars";
import { charge, InsufficientFundsError } from "../../platform/wallet";
import { formatMoney } from "../banking/manifest";

interface PagePost {
  id: string;
  text: string;
  locked: boolean;
}
interface CreatorPage {
  creatorPhoneId: string;
  creatorName: string;
  tagline: string;
  price: string;
  posts: PagePost[];
}

export function NoodlerRShell({ phoneId, chatId, onBack, onClose }: { phoneId: string; chatId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "noodler-r");
  const [chargeError, setChargeError] = React.useState<string | null>(null);
  const [contacts, setContacts] = React.useState<Array<{ phoneId: string; ownerId?: string; ownerName: string }> | null>(null);
  const avatars = useAvatarMap();
  const [page, setPage] = React.useState<CreatorPage | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [subs, setSubs] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<{ contacts: Array<{ id: string; ownerId?: string; name: string }> }>(`/phones/${encodeURIComponent(phoneId)}/contacts?chatId=${encodeURIComponent(chatId)}`)
      .then((payload) => { if (active) setContacts(payload.contacts.map((contact) => ({ phoneId: contact.id, ownerId: contact.ownerId, ownerName: contact.name }))); })
      .catch(() => { if (active) setContacts([]); });
    void store.get("subs").then((value) => {
      if (active && Array.isArray(value)) setSubs(value.filter((item): item is string => typeof item === "string"));
    }).catch((cause: unknown) => {
      if (active) setChargeError(cause instanceof Error ? cause.message : "Subscriptions could not be loaded.");
    });
    return () => { active = false; };
  }, [phoneId, chatId, store]);

  const openPage = (creatorPhoneId: string, refresh = false) => {
    setLoading(true);
    if (!refresh) setPage(null);
    void phoneRequest<{ page: CreatorPage }>(`/phones/${encodeURIComponent(phoneId)}/noodler-r/page`, {
      method: "POST", body: JSON.stringify({ creatorPhoneId, chatId, refresh }),
    })
      .then((response) => setPage(response.page))
      .catch(() => setPage((current) => current ?? null))
      .finally(() => setLoading(false));
  };
  const subscribed = page ? subs.includes(page.creatorPhoneId) : false;
  /**
   * Subscribing was free, so the price on a creator page was decoration. When Banking is on the
   * phone it is charged for real, which is what gives earning money an in-roleplay point. Without
   * Banking installed, nothing changes and subscribing stays free.
   */
  const priceOf = (price: string) => {
    const found = price.match(/-?\d+/u);
    return found ? Math.abs(Number.parseInt(found[0], 10)) : 0;
  };
  const toggleSubscribe = async () => {
    if (!page) return;
    setChargeError(null);
    const cost = priceOf(page.price);
    if (!subscribed && cost > 0) {
      try {
        const next = [page.creatorPhoneId, ...subs];
        await store.set("subs", next);
        try {
          await charge(phoneId, cost, `Subscribed to ${page.creatorName} on NoodleR`, `noodler-r:${page.creatorPhoneId}`);
        } catch (cause) {
          await store.set("subs", subs);
          throw cause;
        }
      } catch (cause) {
        if (cause instanceof InsufficientFundsError) {
          setChargeError(`Not enough in the bank — ${page.price} needed, ${formatMoney(cause.account.balance, cause.account.currency)} available.`);
        } else {
          setChargeError(cause instanceof Error ? cause.message : "The bank could not complete the subscription.");
        }
        return;
      }
    }
    const next = subscribed ? subs.filter((id) => id !== page.creatorPhoneId) : [page.creatorPhoneId, ...subs];
    setSubs(next);
    try {
      if (subscribed || cost === 0) await store.set("subs", next);
    } catch (cause) {
      setChargeError(cause instanceof Error ? cause.message : "The subscription could not be saved.");
    }
  };

  return (
    <section aria-labelledby="noodler-r-title" className="vp-appview">
      <PhoneAppHeader
        title={page ? page.creatorName : "NoodleR"}
        titleId="noodler-r-title"
        closeLabel="Close NoodleR"
        onBack={() => page || loading ? (setPage(null), undefined) : onBack()}
        onClose={onClose}
        actions={page ? [{ id: "refresh-page", icon: "refresh", label: "Refresh page", kind: "button", disabled: loading, reason: "Loading" }] : []}
        onAction={(actionId) => { if (actionId === "refresh-page" && page) openPage(page.creatorPhoneId, true); }}
      />
      {loading && !page ? (
        <div role="status" aria-label="Loading page">
          <span className="vp-skeleton" style={{ height: "6rem", borderRadius: "1.125rem" }} />
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "50%", marginTop: "0.875rem" }} />
          <span className="vp-skeleton vp-skeleton--block" style={{ marginTop: "0.5rem" }} />
          <span className="vp-skeleton vp-skeleton--block" style={{ marginTop: "0.5rem" }} />
        </div>
      ) : page ? (
        <div className="vp-stack" style={{ gap: "0.625rem" }}>
          <header className="vp-site-masthead" style={{ borderRadius: "1.125rem", background: `linear-gradient(150deg, hsl(${hueFor(page.creatorName)} 70% 40%), #14060f 90%)` }}>
            <span className="vp-site-name">{page.creatorName}</span>
            <span className="vp-site-tagline">{page.tagline || "No bio yet"}</span>
          </header>
          <div className="vp-noodlerr-subrow">
            <span className="vp-muted-note">{page.price || "Free page"}</span>
            <button type="button" onClick={() => void toggleSubscribe()} className="vp-accent-btn">{subscribed ? "Subscribed ✓" : "Subscribe"}</button>
          </div>
          {chargeError ? <p role="alert" className="vp-muted-note">{chargeError}</p> : null}
          {page.posts.length === 0 ? <p className="vp-muted-note">No posts yet.</p> : page.posts.map((post) => (
            post.locked && !subscribed ? (
              <div key={post.id} className="vp-card vp-noodlerr-locked" aria-label="Locked post">
                <Lock size="1rem" aria-hidden="true" />
                <span>Subscribe to unlock this post</span>
              </div>
            ) : (
              <article key={post.id} className="vp-card vp-post">
                <p className="vp-post-text">{post.text}</p>
                {post.locked ? <span className="vp-muted-note">Subscriber post</span> : null}
              </article>
            )
          ))}
        </div>
      ) : (
        <>
          <p className="vp-muted-note" style={{ marginBottom: "0.875rem" }}>Creator pages from this story's cast. Everything here is fictional and shared across the chat.</p>
          {!contacts ? (
            <div role="status" aria-label="Loading creators" className="vp-stack" style={{ gap: "0.5rem" }}>
              {[0, 1].map((index) => (
                <div key={index} className="vp-thread-row" aria-hidden="true">
                  <span className="vp-skeleton vp-skeleton--avatar" />
                  <span className="vp-thread-body"><span className="vp-skeleton vp-skeleton--line" style={{ width: "45%" }} /></span>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <p className="vp-muted-note">No one else has a phone in this chat yet.</p>
          ) : (
            <div className="vp-stack" style={{ gap: "0.5rem" }}>
              {contacts.map((contact) => (
                <button key={contact.phoneId} type="button" onClick={() => openPage(contact.phoneId)} className="vp-thread-row">
                  <PhoneAvatar name={contact.ownerName} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
                  <span className="vp-thread-body">
                    <span className="vp-thread-name">{contact.ownerName}</span>
                    <span className="vp-thread-preview">{subs.includes(contact.phoneId) ? "Subscribed" : "View page"}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
