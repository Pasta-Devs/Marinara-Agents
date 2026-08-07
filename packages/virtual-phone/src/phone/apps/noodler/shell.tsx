import React from "react";
import { AtSign, Flame, Heart, MessageCircle, Newspaper, Repeat2, Send } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

function hashOf(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
  return hash;
}

interface NoodlePost {
  id: string;
  author: string;
  handle: string;
  text: string;
  at: string;
}

function postStats(post: NoodlePost) {
  const hash = hashOf(post.id + post.text);
  return { likes: 3 + (hash % 420), replies: hash % 37, boosts: hash % 52 };
}

function splitTopic(topic: string) {
  const [tag, ...rest] = topic.split(" | ");
  return { tag: tag?.trim() || topic.trim(), reason: rest.join(" | ").trim() };
}

export function NoodlerShell({ phoneId, ownerName = "You", onBack, onClose }: { phoneId: string; ownerName?: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "noodler");
  const [tab, setTab] = React.useState<"feed" | "trending">("feed");
  const [feed, setFeed] = React.useState<NoodlePost[] | null>(null);
  const [trending, setTrending] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const postDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/post`, {
      method: "POST", body: JSON.stringify({ text }),
    }).then((response) => setFeed(response.posts)).catch(() => setDraft(text));
  };

  const refreshFeed = React.useCallback(() => {
    setLoading(true);
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodler/feed`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => setFeed(response.posts))
      .catch(() => setFeed((current) => current ?? []))
      .finally(() => setLoading(false));
  }, [phoneId]);

  const refreshTrending = React.useCallback(() => {
    setLoading(true);
    void phoneRequest<{ topics: string[] }>(`/phones/${encodeURIComponent(phoneId)}/noodler/trending`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        setTrending(response.topics);
        void store.set("trending", response.topics).catch(() => undefined);
      })
      .catch(() => setTrending((current) => current ?? []))
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/feed`)
      .then((response) => { if (active) setFeed(response.posts); })
      .catch(() => { if (active) setFeed([]); });
    void store.get("trending").then((cachedTrending) => {
      if (active && Array.isArray(cachedTrending)) setTrending(cachedTrending.filter((topic): topic is string => typeof topic === "string"));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [phoneId, store]);

  React.useEffect(() => {
    if (tab === "trending" && trending === null && !loading) refreshTrending();
  }, [tab, trending, loading, refreshTrending]);

  const skeleton = (
    <div role="status" aria-label="Loading" className="vp-stack" style={{ gap: "0.5rem" }}>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="vp-card vp-post" aria-hidden="true">
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "35%" }} />
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "100%" }} />
          <span className="vp-skeleton vp-skeleton--line" style={{ width: "80%" }} />
        </div>
      ))}
    </div>
  );

  return (
    <section aria-labelledby="noodler-title" className="vp-appview vp-appview--fixed">
      <PhoneAppHeader
        title="Noodle"
        titleId="noodler-title"
        closeLabel="Close Noodle"
        onBack={onBack}
        onClose={onClose}
        actions={[{ id: "refresh", icon: "refresh", label: tab === "feed" ? "Refresh feed" : "Refresh trending", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh") (tab === "feed" ? refreshFeed() : refreshTrending()); }}
        center={<span className="vp-urlbar"><AtSign size="0.75rem" aria-hidden="true" /><span>noodle.local</span></span>}
      />
      <div className="vp-tab-content">
        {tab === "feed" ? (
          <>
            <form className="vp-composer" style={{ marginBottom: "0.875rem" }} onSubmit={(event) => { event.preventDefault(); postDraft(); }}>
              <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Write a post</span>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What's simmering?" maxLength={500} className="vp-input" />
              </label>
              <button type="submit" aria-label="Post" disabled={!draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
            </form>
            {(loading || feed === null) && !feed?.length ? skeleton : null}
            {feed && feed.length === 0 && !loading ? (
              <p className="vp-muted-note">The plate is empty. Refresh to see what's simmering.</p>
            ) : null}
            {feed?.length ? (
              <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
                {feed.map((post) => {
                  const { likes, replies, boosts } = postStats(post);
                  return (
                    <article key={post.id} className="vp-card vp-post">
                      <div className="vp-post-header">
                        <span className="vp-post-avatar" aria-hidden="true">{post.author[0]?.toUpperCase() ?? "N"}</span>
                        <span className="vp-post-names">
                          <span className="vp-post-author">{post.author}</span>
                          <span className="vp-post-handle">{post.handle}</span>
                        </span>
                        <span className="vp-post-time">{new Date(post.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                      <p className="vp-post-text">{post.text}</p>
                      <div className="vp-post-footer" aria-label={`${replies} replies, ${boosts} boosts, ${likes} likes`}>
                        <span><MessageCircle size="0.75rem" aria-hidden="true" /> {replies}</span>
                        <span><Repeat2 size="0.75rem" aria-hidden="true" /> {boosts}</span>
                        <span><Heart size="0.75rem" aria-hidden="true" /> {likes}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {loading && !trending?.length ? skeleton : null}
            {trending && trending.length === 0 && !loading ? (
              <p className="vp-muted-note">Nothing is trending yet. Refresh to see what's bubbling up.</p>
            ) : null}
            {trending?.length ? (
              <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
                {trending.map((topic, index) => {
                  const { tag, reason } = splitTopic(topic);
                  return (
                    <div key={index} className="vp-thread-row">
                      <span className="vp-trend-rank" aria-hidden="true">{index + 1}</span>
                      <span className="vp-thread-body">
                        <span className="vp-thread-name" style={{ color: "var(--vp-accent)" }}>{tag}</span>
                        {reason ? <span className="vp-thread-preview">{reason}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
      <nav className="vp-tabbar" aria-label="Noodle sections">
        <button type="button" aria-current={tab === "feed"} onClick={() => setTab("feed")} className="vp-tabbar-btn"><Newspaper size="1rem" aria-hidden="true" /><span>Main</span></button>
        <button type="button" aria-current={tab === "trending"} onClick={() => setTab("trending")} className="vp-tabbar-btn"><Flame size="1rem" aria-hidden="true" /><span>Trending</span></button>
      </nav>
    </section>
  );
}
