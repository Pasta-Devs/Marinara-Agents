import React from "react";
import { AtSign, Bookmark, Flame, Heart, MessageCircle, Newspaper, Repeat2, Search, Send, Soup, TrendingUp, X } from "lucide-react";
import { phoneRequest, recordActivity, rememberWorldFact } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneEmptyState } from "../../platform/empty-state";
import { rememberPerson } from "../../platform/people";

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

export function NoodlerShell({ phoneId, ownerName = "You", openWeb, onBack, onClose }: { phoneId: string; ownerName?: string; openWeb?: (query: string) => void; onBack: () => void; onClose: () => void }) {
  const [openPostId, setOpenPostId] = React.useState<string | null>(null);
  const store = usePhoneStore(phoneId, "noodler");
  const postClock = useStoryClock();
  const [tab, setTab] = React.useState<"feed" | "explore" | "saved">("feed");
  const [feed, setFeed] = React.useState<NoodlePost[] | null>(null);
  const [trending, setTrending] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [composing, setComposing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [profileHandle, setProfileHandle] = React.useState<string | null>(null);
  const [savedIds, setSavedIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const posting = React.useRef(false);

  // Marks the feed seen, so the notifications route can tell what arrived since (Stage 8.2).
  React.useEffect(() => {
    void store.set("lastSeenAt", new Date().toISOString()).catch(() => undefined);
    void store.get<string[]>("savedPosts").then((value) => setSavedIds(Array.isArray(value) ? value : [])).catch(() => undefined);
  }, [store]);

  const postDraft = (parentPostId?: string) => {
    const text = draft.trim();
    if (!text || posting.current) return;
    posting.current = true;
    setDraft("");
    const parent = parentPostId ? (feed ?? []).find((post) => post.id === parentPostId) : null;
    if (parent && parent.author !== ownerName) {
      void rememberPerson(phoneId, {
        name: parent.author,
        handle: parent.handle,
        bio: `Posts as ${parent.handle} on Noodle.`,
        phoneLabel: "Noodle",
        source: "Talked on Noodle",
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : `${parent.author} could not be added to Contacts.`));
    }
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/post`, {
      method: "POST", body: JSON.stringify({ text, ...(parentPostId ? { parentPostId } : {}) }),
    }).then((response) => {
      setFeed(response.posts);
      setComposing(false);
      void Promise.all([
        recordActivity(phoneId, parent ? "replied publicly on Noodle" : "posted publicly on Noodle"),
        rememberWorldFact(phoneId, parent ? `Replied to ${parent.author} on Noodle: "${text.slice(0, 180)}".` : `Posted on Noodle: "${text.slice(0, 180)}".`, "Noodle post"),
      ])
        .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The post could not be shared with the phone."));
      window.setTimeout(() => {
        void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/feed`)
          .then((latest) => setFeed(latest.posts))
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Replies could not be loaded."));
      }, 1_500);
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "The post could not be published.");
      setDraft(text);
    }).finally(() => { posting.current = false; });
  };

  const toggleSaved = (postId: string) => {
    setSavedIds((current) => {
      const next = current.includes(postId) ? current.filter((id) => id !== postId) : [postId, ...current];
      void store.set("savedPosts", next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Saved posts could not be updated."));
      return next;
    });
  };

  const interact = (postId: string, kind: "like" | "boost") => {
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/interact`, {
      method: "POST", body: JSON.stringify({ postId, kind }),
    }).then((response) => setFeed(response.posts)).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The interaction failed."));
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
      })
      .catch(() => setTrending((current) => current ?? []))
      .finally(() => setLoading(false));
  }, [phoneId]);

  React.useEffect(() => {
    let active = true;
    void phoneRequest<{ posts: NoodlePost[] }>(`/phones/${encodeURIComponent(phoneId)}/noodle/feed`)
      .then((response) => { if (active) setFeed(response.posts); })
      .catch(() => { if (active) setFeed([]); });
    return () => { active = false; };
  }, [phoneId, store]);

  React.useEffect(() => {
    if (tab === "explore" && trending === null && !loading) refreshTrending();
  }, [tab, trending, loading, refreshTrending]);

  const repliesTo = (postId: string) => (feed ?? []).filter((post) => post.parentPostId === postId);
  const openPost = openPostId ? (feed ?? []).find((post) => post.id === openPostId) ?? null : null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const topLevelPosts = (feed ?? []).filter((post) => !post.parentPostId);
  const visiblePosts = (tab === "saved" || profileHandle ? (feed ?? []) : topLevelPosts).filter((post) => {
    if (tab === "saved" && !savedIds.includes(post.id)) return false;
    if (profileHandle && post.handle !== profileHandle) return false;
    return !normalizedQuery || `${post.author} ${post.handle} ${post.text}`.toLocaleLowerCase().includes(normalizedQuery);
  });

  const renderPost = (post: NoodlePost) => {
    const { likes, replies, boosts } = postStats(post, repliesTo(post.id).length);
    const liked = post.likedBy?.includes(phoneId) ?? false;
    const boosted = post.boostedBy?.includes(phoneId) ?? false;
    return (
      <article key={post.id} className={`vp-post${post.parentPostId ? " vp-post--reply" : ""}`}>
        <div className="vp-post-header">
          <button type="button" className="vp-post-avatar" aria-label={`View ${post.author}'s posts`} onClick={() => { setProfileHandle(post.handle); setOpenPostId(null); setTab("feed"); }}>{post.author[0]?.toUpperCase() ?? "N"}</button>
          <button type="button" className="vp-post-names" onClick={() => { setProfileHandle(post.handle); setOpenPostId(null); setTab("feed"); }}>
            <span className="vp-post-author">{post.author}</span>
            <span className="vp-post-handle">{post.handle}</span>
          </button>
          <span className="vp-post-time">{postClock.time(post.at)}</span>
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
          <button type="button" onClick={() => toggleSaved(post.id)} aria-pressed={savedIds.includes(post.id)} aria-label={savedIds.includes(post.id) ? "Remove from saved posts" : "Save post"} className="vp-post-save">
            <Bookmark size="0.75rem" aria-hidden="true" fill={savedIds.includes(post.id) ? "currentColor" : "none"} />
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
    <section aria-labelledby="noodler-title" className="vp-appview vp-appview--fixed" data-phone-app="noodler">
      <PhoneAppHeader
        title={openPost ? "Post" : profileHandle ? profileHandle : tab === "saved" ? "Saved" : "Noodle"}
        titleId="noodler-title"
        closeLabel="Close Noodle"
        onBack={() => openPost ? setOpenPostId(null) : profileHandle ? setProfileHandle(null) : onBack()}
        onClose={onClose}
        actions={openPost || profileHandle ? [] : [
          { id: "compose", icon: "edit", label: "New post", kind: "button" },
          ...(tab === "saved" ? [] : [{ id: "refresh", icon: "refresh", label: tab === "explore" ? "Refresh trends" : "Refresh feed", kind: "button" as const, disabled: loading, reason: "Refreshing" }]),
        ]}
        onAction={(actionId) => { if (actionId === "compose") setComposing(true); if (actionId === "refresh") (tab === "explore" ? refreshTrending() : refreshFeed()); }}
        center={openPost ? undefined : <AtSign size="1rem" aria-hidden="true" />}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      <div className="vp-tab-content">
        {tab !== "explore" ? (
          <>
            {openPost ? <form className="vp-noodle-reply" onSubmit={(event) => { event.preventDefault(); postDraft(openPost.id); }}>
              <label><span className="vp-sr-only">Reply to {openPost.author}</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Reply to ${openPost.handle}`} maxLength={500} className="vp-input" /></label>
              <button type="submit" aria-label="Send reply" disabled={!draft.trim()} className="vp-icon-btn vp-noodle-send"><Send size="1rem" aria-hidden="true" /></button>
            </form> : null}
            {!openPost && !profileHandle ? <label className="vp-search-field"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search posts</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tab === "saved" ? "Search saved posts" : "Search Noodle"} />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size="0.75rem" /></button> : null}</label> : null}
            {profileHandle ? <div className="vp-noodle-profile"><span className="vp-post-avatar" aria-hidden="true">{profileHandle.replace("@", "")[0]?.toUpperCase()}</span><div><strong>{profileHandle}</strong><span>{visiblePosts.length} public {visiblePosts.length === 1 ? "post" : "posts"} in this story</span></div></div> : null}
            {(loading || feed === null) && !feed?.length ? skeleton : null}
            {feed && feed.length === 0 && !loading ? (
              <PhoneEmptyState icon={Soup} title="Nothing on the feed" body="Refresh to see what the world is posting about right now." action={{ label: "Refresh", onClick: () => void refreshFeed() }} />
            ) : null}
            {feed?.length && (openPost || visiblePosts.length) ? (
              <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
                {(openPost ? [openPost, ...repliesTo(openPost.id)] : visiblePosts).map((post) => renderPost(post))}
              </div>
            ) : null}
            {feed?.length && !openPost && visiblePosts.length === 0 ? <PhoneEmptyState icon={tab === "saved" ? Bookmark : Search} title={tab === "saved" && !query ? "No saved posts" : profileHandle ? `No posts from ${profileHandle}` : "No matching posts"} body={tab === "saved" && !query ? "Save a post from the timeline to keep it here privately." : "Try a different search."} /> : null}
          </>
        ) : (
          <>
            {loading && !trending?.length ? skeleton : null}
            {trending && trending.length === 0 && !loading ? (
              <PhoneEmptyState icon={TrendingUp} title="Nothing trending" body="Refresh to see what is bubbling up in this world." action={{ label: "Refresh", onClick: () => void refreshTrending() }} />
            ) : null}
            {trending?.length ? (
              <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
                {trending.map((topic, index) => {
                  const { tag, reason } = splitTopic(topic);
                  const contents = <>
                      <span className="vp-trend-rank" aria-hidden="true">{index + 1}</span>
                      <span className="vp-thread-body">
                        <span className="vp-thread-name" style={{ color: "var(--vp-accent)" }}>{tag}</span>
                        {reason ? <span className="vp-thread-preview">{reason}</span> : null}
                      </span>
                      {openWeb ? <span className="vp-row-chevron">›</span> : null}
                    </>;
                  return openWeb
                    ? <button key={index} type="button" className="vp-thread-row" onClick={() => openWeb(tag)} aria-label={`Search the web for ${tag}`}>{contents}</button>
                    : <div key={index} className="vp-thread-row">{contents}</div>;
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
      {composing ? <div className="vp-noodle-compose" role="dialog" aria-modal="true" aria-labelledby="noodle-compose-title">
        <div className="vp-noodle-compose-head"><button type="button" onClick={() => setComposing(false)}>Cancel</button><strong id="noodle-compose-title">New post</strong><button type="button" onClick={() => postDraft()} disabled={!draft.trim()}>Post</button></div>
        <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What’s happening?" maxLength={500} />
        <div className="vp-noodle-compose-meta"><span><AtSign size="0.75rem" /> Public in this story</span><span>{draft.length}/500</span></div>
        <p>People in the story may see and respond to this.</p>
      </div> : null}
      <nav className="vp-tabbar" aria-label="Noodle sections">
        <button type="button" aria-current={tab === "feed"} onClick={() => { setTab("feed"); setOpenPostId(null); setProfileHandle(null); }} className="vp-tabbar-btn"><Newspaper size="1rem" aria-hidden="true" /><span>Home</span></button>
        <button type="button" aria-current={tab === "explore"} onClick={() => { setTab("explore"); setOpenPostId(null); setProfileHandle(null); }} className="vp-tabbar-btn"><Flame size="1rem" aria-hidden="true" /><span>Explore</span></button>
        <button type="button" aria-current={tab === "saved"} onClick={() => { setTab("saved"); setOpenPostId(null); setProfileHandle(null); }} className="vp-tabbar-btn"><Bookmark size="1rem" aria-hidden="true" /><span>Saved</span></button>
      </nav>
    </section>
  );
}
