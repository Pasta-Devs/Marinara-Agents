import React from "react";
import { Lock } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

function hueFor(value: string) {
  let hue = 0;
  for (const char of value) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

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

export function NoodlerRShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "noodler-r");
  const [contacts, setContacts] = React.useState<Array<{ phoneId: string; ownerName: string }> | null>(null);
  const [page, setPage] = React.useState<CreatorPage | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [subs, setSubs] = React.useState<string[]>([]);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<{ contacts: Array<{ phoneId: string; ownerName: string }> }>(`/phones/${encodeURIComponent(phoneId)}/messaging`)
      .then((payload) => { if (active) setContacts(payload.contacts); })
      .catch(() => { if (active) setContacts([]); });
    void store.get("subs").then((value) => {
      if (active && Array.isArray(value)) setSubs(value.filter((item): item is string => typeof item === "string"));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [phoneId, store]);

  const openPage = (creatorPhoneId: string, refresh = false) => {
    setLoading(true);
    if (!refresh) setPage(null);
    void phoneRequest<{ page: CreatorPage }>(`/phones/${encodeURIComponent(phoneId)}/noodler-r/page`, {
      method: "POST", body: JSON.stringify({ creatorPhoneId, refresh }),
    })
      .then((response) => setPage(response.page))
      .catch(() => setPage((current) => current ?? null))
      .finally(() => setLoading(false));
  };
  const subscribed = page ? subs.includes(page.creatorPhoneId) : false;
  const toggleSubscribe = () => {
    if (!page) return;
    const next = subscribed ? subs.filter((id) => id !== page.creatorPhoneId) : [page.creatorPhoneId, ...subs];
    setSubs(next);
    void store.set("subs", next).catch(() => undefined);
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
            <button type="button" onClick={toggleSubscribe} className="vp-accent-btn">{subscribed ? "Subscribed ✓" : "Subscribe"}</button>
          </div>
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
                  <span className="vp-thread-avatar" style={{ background: `linear-gradient(180deg, hsl(${hueFor(contact.ownerName)} 70% 55%), hsl(${hueFor(contact.ownerName)} 70% 38%))` }} aria-hidden="true">{initials(contact.ownerName)}</span>
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
