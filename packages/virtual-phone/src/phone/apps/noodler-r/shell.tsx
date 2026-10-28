import React from "react";
import { Bookmark, Lock, Search, Sparkles, Users, X } from "lucide-react";
import { phoneRequest, recordActivity, rememberWorldFact } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { PhoneAvatar, hueFor, useAvatarMap } from "../../platform/avatars";
import { charge, InsufficientFundsError } from "../../platform/wallet";
import { formatMoney } from "../banking/manifest";

interface PagePost { id: string; text: string; locked: boolean; at?: string }
interface CreatorPage { creatorPhoneId: string; creatorName: string; tagline: string; price: string; posts: PagePost[] }
interface Subscription { creatorPhoneId: string; creatorName: string; price: string; joinedAt: string }
interface SavedPost { postId: string; creatorPhoneId: string; creatorName: string; text: string; savedAt: string }
interface Contact { phoneId: string; ownerId?: string; ownerName: string }

function priceOf(price: string) {
  const found = price.match(/\d+/u);
  return found ? Number.parseInt(found[0], 10) : 0;
}

function isSubscription(value: unknown): value is Subscription {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<Subscription>;
  return typeof item.creatorPhoneId === "string" && typeof item.creatorName === "string" &&
    typeof item.price === "string" && typeof item.joinedAt === "string";
}

function isSavedPost(value: unknown): value is SavedPost {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<SavedPost>;
  return typeof item.postId === "string" && typeof item.creatorPhoneId === "string" &&
    typeof item.creatorName === "string" && typeof item.text === "string" && typeof item.savedAt === "string";
}

export function NoodlerRShell({ phoneId, chatId, onBack, onClose }: { phoneId: string; chatId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "noodler-r");
  const avatars = useAvatarMap();
  const [contacts, setContacts] = React.useState<Contact[] | null>(null);
  const [page, setPage] = React.useState<CreatorPage | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([]);
  const [savedPosts, setSavedPosts] = React.useState<SavedPost[]>([]);
  const [tab, setTab] = React.useState<"membership" | "discover" | "saved">("membership");
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    void store.set("lastSeenAt", new Date().toISOString()).catch(() => undefined);
    void phoneRequest<{ contacts: Array<{ id: string; ownerId?: string; name: string }> }>(`/phones/${encodeURIComponent(phoneId)}/contacts?chatId=${encodeURIComponent(chatId)}`)
      .then((payload) => { if (active) setContacts(payload.contacts.map((contact) => ({ phoneId: contact.id, ownerId: contact.ownerId, ownerName: contact.name }))); })
      .catch(() => { if (active) setContacts([]); });
    void Promise.all([store.get("subscriptions"), store.get("subs"), store.get("savedPosts")])
      .then(([stored, legacy, saved]) => {
        if (!active) return;
        const records = Array.isArray(stored) ? stored.filter(isSubscription) : [];
        const legacyIds = Array.isArray(legacy) ? legacy.filter((item): item is string => typeof item === "string") : [];
        const migrated = legacyIds.filter((id) => !records.some((item) => item.creatorPhoneId === id)).map((id) => ({ creatorPhoneId: id, creatorName: "Creator", price: "", joinedAt: new Date(0).toISOString() }));
        const next = [...records, ...migrated];
        setSubscriptions(next);
        setSavedPosts(Array.isArray(saved) ? saved.filter(isSavedPost) : []);
        if (migrated.length) void store.set("subscriptions", next).catch(() => undefined);
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Your memberships could not be loaded."); });
    return () => { active = false; };
  }, [phoneId, chatId, store]);

  const openPage = React.useCallback((creatorPhoneId: string, refresh = false) => {
    setLoading(true);
    setError(null);
    if (!refresh) setPage(null);
    void phoneRequest<{ page: CreatorPage }>(`/phones/${encodeURIComponent(phoneId)}/noodler-r/page`, {
      method: "POST", body: JSON.stringify({ creatorPhoneId, chatId, refresh }),
    }).then((response) => setPage(response.page))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "That page is unavailable."))
      .finally(() => setLoading(false));
  }, [phoneId, chatId]);

  const subscription = page ? subscriptions.find((item) => item.creatorPhoneId === page.creatorPhoneId) : undefined;
  const toggleSubscribe = async () => {
    if (!page) return;
    setError(null);
    if (subscription) {
      const next = subscriptions.filter((item) => item.creatorPhoneId !== page.creatorPhoneId);
      setSubscriptions(next);
      try { await store.set("subscriptions", next); } catch (cause) {
        setSubscriptions(subscriptions);
        setError(cause instanceof Error ? cause.message : "The membership could not be changed.");
      }
      return;
    }
    const cost = priceOf(page.price);
    const next = [{ creatorPhoneId: page.creatorPhoneId, creatorName: page.creatorName, price: page.price, joinedAt: new Date().toISOString() }, ...subscriptions];
    try {
      await store.set("subscriptions", next);
      try {
        if (cost > 0) await charge(phoneId, cost, `NoodleR membership — ${page.creatorName}`, `noodler-r:${page.creatorPhoneId}`);
      } catch (cause) {
        await store.set("subscriptions", subscriptions).catch(() => undefined);
        throw cause;
      }
      setSubscriptions(next);
      void recordActivity(phoneId, "joined a creator membership on NoodleR").catch(() => undefined);
      void rememberWorldFact(phoneId, `Joined ${page.creatorName}'s NoodleR membership${page.price ? ` for ${page.price}` : ""}.`, "NoodleR membership").catch(() => undefined);
    } catch (cause) {
      if (cause instanceof InsufficientFundsError) {
        setError(`Not enough in the bank — ${page.price} needed, ${formatMoney(cause.account.balance, cause.account.currency)} available.`);
      } else setError(cause instanceof Error ? cause.message : "The membership could not be started.");
    }
  };

  const toggleSaved = (post: PagePost) => {
    if (!page) return;
    const exists = savedPosts.some((item) => item.postId === post.id);
    const next = exists ? savedPosts.filter((item) => item.postId !== post.id) : [{ postId: post.id, creatorPhoneId: page.creatorPhoneId, creatorName: page.creatorName, text: post.text, savedAt: new Date().toISOString() }, ...savedPosts];
    setSavedPosts(next);
    void store.set("savedPosts", next).catch((cause: unknown) => {
      setSavedPosts(savedPosts);
      setError(cause instanceof Error ? cause.message : "Saved posts could not be updated.");
    });
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const subscribedIds = new Set(subscriptions.map((item) => item.creatorPhoneId));
  const savedCreatorIds = new Set(savedPosts.map((item) => item.creatorPhoneId));
  const visibleContacts = (contacts ?? []).filter((contact) => {
    if (tab === "membership" && !subscribedIds.has(contact.phoneId)) return false;
    if (tab === "saved" && !savedCreatorIds.has(contact.phoneId)) return false;
    return !normalizedQuery || contact.ownerName.toLocaleLowerCase().includes(normalizedQuery);
  });
  const savedOnPage = page ? savedPosts
    .filter((item) => item.creatorPhoneId === page.creatorPhoneId)
    .map((item) => ({ id: item.postId, text: item.text, locked: false, at: item.savedAt })) : [];
  const shownPosts = page && tab === "saved" ? savedOnPage : page?.posts ?? [];

  return (
    <section aria-labelledby="noodler-r-title" className="vp-appview" data-phone-app="noodler-r">
      <PhoneAppHeader
        title={page ? page.creatorName : "NoodleR"}
        titleId="noodler-r-title"
        closeLabel="Close NoodleR"
        onBack={() => page || loading ? setPage(null) : onBack()}
        onClose={onClose}
        actions={page ? [{ id: "refresh-page", icon: "refresh", label: "Get latest drop", kind: "button", disabled: loading, reason: "Checking for a new drop" }] : []}
        onAction={(actionId) => { if (actionId === "refresh-page" && page) openPage(page.creatorPhoneId, true); }}
      />
      {error ? <p role="alert" className="vp-noodlerr-alert">{error}</p> : null}
      {loading && !page ? (
        <div role="status" aria-label="Opening creator page" className="vp-stack">
          <span className="vp-skeleton" style={{ height: "7.5rem", borderRadius: "1.25rem" }} />
          <span className="vp-skeleton vp-skeleton--block" /><span className="vp-skeleton vp-skeleton--block" />
        </div>
      ) : page ? (
        <div className="vp-stack vp-noodlerr-page">
          <header className="vp-noodlerr-hero" style={{ background: `linear-gradient(150deg, hsl(${hueFor(page.creatorName)} 72% 43%), #170710 88%)` }}>
            <span className="vp-noodlerr-kicker">CREATOR CLUB</span>
            <h3>{page.creatorName}</h3>
            <p>{page.tagline || "A private corner for members."}</p>
          </header>
          <div className="vp-noodlerr-membership">
            <span><strong>{page.price || "Free"}</strong><small>{subscription ? "Membership active" : "Unlock the full archive"}</small></span>
            <button type="button" onClick={() => void toggleSubscribe()} className={subscription ? "vp-surface-btn" : "vp-accent-btn"}>{subscription ? "Leave" : "Join"}</button>
          </div>
          {tab === "saved" && subscription ? <p className="vp-muted-note">Saved from this creator</p> : null}
          {shownPosts.length === 0 ? <div className="vp-empty"><span className="vp-empty-icon"><Bookmark size="1.5rem" /></span><h3>{tab === "saved" ? "Nothing saved here" : "The archive is quiet"}</h3><p>{tab === "saved" ? "Save a member post to keep it in your private collection." : "Check again when the creator has a new drop."}</p></div> : shownPosts.map((post, index) => {
            const locked = post.locked && !subscription;
            const saved = savedPosts.some((item) => item.postId === post.id);
            return locked ? (
              <article key={post.id} className="vp-noodlerr-post vp-noodlerr-post--locked" aria-label="Members-only post">
                <Lock size="1.1rem" aria-hidden="true" /><strong>Members only</strong><span>Join to open this post and the private archive.</span>
              </article>
            ) : (
              <article key={post.id} className="vp-noodlerr-post">
                <div className="vp-noodlerr-postmeta"><span>{index === 0 ? "LATEST DROP" : post.locked ? "MEMBER POST" : "FREE PREVIEW"}</span><button type="button" onClick={() => toggleSaved(post)} aria-label={saved ? "Remove saved post" : "Save post"} aria-pressed={saved}><Bookmark size="0.9rem" fill={saved ? "currentColor" : "none"} /></button></div>
                <p>{post.text}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <>
          <div className="vp-noodlerr-intro"><Sparkles size="1.15rem" aria-hidden="true" /><div><strong>Your private memberships</strong><span>Exclusive drops from creators you follow.</span></div></div>
          <div className="vp-filter-tabs" role="tablist" aria-label="NoodleR sections">
            <button type="button" role="tab" aria-selected={tab === "membership"} onClick={() => setTab("membership")}>Memberships ({subscriptions.length})</button>
            <button type="button" role="tab" aria-selected={tab === "discover"} onClick={() => setTab("discover")}>Discover</button>
            <button type="button" role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}>Saved</button>
          </div>
          <label className="vp-inline-search"><Search size="0.85rem" /><span className="vp-sr-only">Search creators</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size="0.75rem" /></button> : null}</label>
          {!contacts ? <div role="status" aria-label="Loading creators" className="vp-stack"><span className="vp-skeleton vp-skeleton--block" /><span className="vp-skeleton vp-skeleton--block" /></div> : visibleContacts.length ? (
            <div className="vp-stack">
              {visibleContacts.map((contact) => {
                const membership = subscriptions.find((item) => item.creatorPhoneId === contact.phoneId);
                return <button key={contact.phoneId} type="button" onClick={() => openPage(contact.phoneId)} className="vp-noodlerr-creator">
                  <PhoneAvatar name={contact.ownerName} url={contact.ownerId ? avatars?.get(contact.ownerId) : null} />
                  <span><strong>{contact.ownerName}</strong><small>{membership ? `${membership.price || "Free"} · Member` : "View free previews"}</small></span><span aria-hidden="true">›</span>
                </button>;
              })}
            </div>
          ) : <div className="vp-empty"><span className="vp-empty-icon">{tab === "discover" ? <Users size="1.5rem" /> : <Lock size="1.5rem" />}</span><h3>{query ? "No creators found" : tab === "discover" ? "No creators yet" : tab === "saved" ? "No saved memberships" : "No memberships"}</h3><p>{query ? "Try another name." : tab === "discover" ? "Creator pages appear as people join this story." : "Discover a creator and join their club to keep them here."}</p></div>}
        </>
      )}
    </section>
  );
}
