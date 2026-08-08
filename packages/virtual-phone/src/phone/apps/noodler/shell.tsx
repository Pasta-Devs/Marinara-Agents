import React from "react";
import { AtSign, Flame, Heart, MessageCircle, Newspaper, Repeat2, Send } from "lucide-react";
import { phoneRequest, recordActivity } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

interface NoodlePost {
  id: string;
  author: string;
  handle: string;
  text: string;
  at: string;
  image?: string;
  parentPostId?: string;
  likedBy?: string[];
  boostedBy?: string[];
  seed?: { likes: number; boosts: number; replies: number };
}

/**
 * Displayed counts are the post's fictional baseline plus the interactions that actually happened.
 * Counts used to be derived from a hash of the text, so nothing you did ever moved them.
 */
function postStats(post: NoodlePost, replies: number) {
  const seed = post.seed ?? { likes: 0, boosts: 0, replies: 0 };
  return {
    likes: seed.likes + (post.likedBy?.length ?? 0),
    boosts: seed.boosts + (post.boostedBy?.length ?? 0),
    replies: seed.replies + replies,
  };
}

function splitTopic(topic: string) {
  const [tag, ...rest] = topic.split(" | ");
  return { tag: tag?.trim() || topic.trim(), reason: rest.join(" | ").trim() };
}

export function NoodlerShell({ phoneId, ownerName = "You", onBack, onClose }: { phoneId: string; ownerName?: string; onBack: () => void; onClose: () => void }) {
  const [openPostId, setOpenPostId] = React.useState<string | null>(null);
  const store = usePhoneStore(phoneId, "noodler");
  const [tab, setTab] = React.useState<"feed" | "trending">("feed");
  const [feed, setFeed] = React.useState<NoodlePost[] | null>(null);
  const [trending, setTrending] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  // Marks the feed seen, so the notifications route can tell what arrived since (Stage 8.2).
  React.useEffect(() => {
    void store.set("lastSeenAt", new Date().toISOString()).catch(() => undefined);
  }, [store]);

  const postDraft = (parentPostId?: string) => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    recordActivity(phoneId, parentPostId ? `replied on Noodle: "${text.slice(0, 100)}"` : `posted on Noodle: "${text.slice(0, 100)}"`);
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/post`, {
      method: "POST", body: JSON.stringify({ text, ...(parentPostId ? { parentPostId } : {}) }),
    }).then((response) => setFeed(response.posts)).catch(() => setDraft(text));
  };

  const interact = (postId: string, kind: "like" | "boost") => {
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/interact`, {
      method: "POST", body: JSON.stringify({ postId, kind }),
    }).then((response) => setFeed(response.posts)).catch(() => undefined);
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

  const repliesTo = (postId: string) => (feed ?? []).filter((post) => post.parentPostId === postId);
  const openPost = openPostId ? (feed ?? []).find((post) => post.id === openPostId) ?? null : null;

  const renderPost = (post: NoodlePost) => {
    const { likes, replies, boosts } = postStats(post, repliesTo(post.id).length);
    const liked = post.likedBy?.includes(phoneId) ?? false;
    const boosted = post.boostedBy?.includes(phoneId) ?? false;
    return (
      <article key={post.id} className="vp-card vp-post" style={post.parentPostId ? { marginLeft: "1rem" } : undefined}>
        <div className="vp-post-header">
          <span className="vp-post-avatar" aria-hidden="true">{post.author[0]?.toUpperCase() ?? "N"}</span>
          <span className="vp-post-names">
            <span className="vp-post-author">{post.author}</span>
            <span className="vp-post-handle">{post.handle}</span>
          </span>
          <span className="vp-post-time">{new Date(post.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
        </div>
        <p className="vp-post-text">{post.text}</p>
        {post.image ? <img src={post.image} alt={post.text} className="vp-post-image" loading="lazy" /> : null}
        <div className="vp-post-footer">
          <button type="button" onClick={() => setOpenPostId(post.id)} aria-label={`${replies} replies`}>
            <MessageCircle size="0.75rem" aria-hidden="true" /> {replies}
          </button>
          <button type="button" onClick={() => interact(post.id, "boost")} aria-pressed={boosted} aria-label={`${boosts} boosts`} style={boosted ? { color: "var(--vp-accent)" } : undefined}>
            <Repeat2 size="0.75rem" aria-hidden="true" /> {boosts}
          </button>
          <button type="button" onClick={() => interact(post.id, "like")} aria-pressed={liked} aria-label={`${likes} likes`} style={liked ? { color: "var(--vp-accent)" } : undefined}>
            <Heart size="0.75rem" aria-hidden="true" fill={liked ? "currentColor" : "none"} /> {likes}
          </button>
        </div>
      </article>
    );
  };

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
        title={openPost ? "Thread" : "Noodle"}
        titleId="noodler-title"
        closeLabel="Close Noodle"
        onBack={() => openPost ? setOpenPostId(null) : onBack()}
        onClose={onClose}
        actions={[{ id: "refresh", icon: "refresh", label: tab === "feed" ? "Refresh feed" : "Refresh trending", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh") (tab === "feed" ? refreshFeed() : refreshTrending()); }}
        center={<span className="vp-urlbar"><AtSign size="0.75rem" aria-hidden="true" /><span>noodle.local</span></span>}
      />
      <div className="vp-tab-content">
        {tab === "feed" ? (
          <>
            <form className="vp-composer" style={{ marginBottom: "0.875rem" }} onSubmit={(event) => { event.preventDefault(); postDraft(openPostId ?? undefined); }}>
              <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">{openPost ? `Reply to ${openPost.author}` : "Write a post"}</span>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={openPost ? `Reply to ${openPost.author}` : "What's simmering?"} maxLength={500} className="vp-input" />
              </label>
              <button type="submit" aria-label="Post" disabled={!draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
            </form>
            {(loading || feed === null) && !feed?.length ? skeleton : null}
            {feed && feed.length === 0 && !loading ? (
              <p className="vp-muted-note">The plate is empty. Refresh to see what's simmering.</p>
            ) : null}
            {feed?.length ? (
              <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
                {(openPost ? [openPost, ...repliesTo(openPost.id)] : feed.filter((post) => !post.parentPostId)).map((post) => renderPost(post))}
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
