import React from "react";
import { Flame, Heart, MessageCircle, Newspaper, Repeat2 } from "lucide-react";
import { fallbackFeed } from "./manifest";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

function hashOf(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
  return hash;
}

function splitPost(post: string) {
  const [authorPart, ...rest] = post.split(" — ");
  const raw = rest.length ? authorPart!.trim() : "Noodler";
  const text = rest.length ? rest.join(" — ") : post;
  const handle = raw.match(/@[\w.-]+/u)?.[0] ?? `@${raw.toLowerCase().replace(/[^a-z0-9]+/gu, "") || "noodler"}`;
  const name = raw.replace(handle, "").trim() || handle.slice(1);
  const hash = hashOf(post);
  return { name, handle, text, likes: 3 + (hash % 420), replies: hash % 37, boosts: hash % 52 };
}

function splitTopic(topic: string) {
  const [tag, ...rest] = topic.split(" | ");
  return { tag: tag?.trim() || topic.trim(), reason: rest.join(" | ").trim() };
}

export function NoodlerShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "noodler");
  const [tab, setTab] = React.useState<"feed" | "trending">("feed");
  const [feed, setFeed] = React.useState<{ posts: string[] } | null>(null);
  const [trending, setTrending] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refreshFeed = React.useCallback(() => {
    setLoading(true);
    void phoneRequest<{ feed: { posts: string[] } }>(`/phones/${encodeURIComponent(phoneId)}/noodler/feed`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        setFeed(response.feed);
        void store.set("feed", response.feed).catch(() => undefined);
      })
      .catch(() => setFeed((current) => current ?? fallbackFeed()))
      .finally(() => setLoading(false));
  }, [phoneId, store]);

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
    void Promise.all([store.get("feed"), store.get("trending")]).then(([cachedFeed, cachedTrending]) => {
      if (!active) return;
      const feedValue = cachedFeed as { posts?: unknown } | undefined;
      if (feedValue && Array.isArray(feedValue.posts) && feedValue.posts.every((post) => typeof post === "string")) {
        setFeed({ posts: feedValue.posts as string[] });
      } else {
        refreshFeed();
      }
      if (Array.isArray(cachedTrending)) setTrending(cachedTrending.filter((topic): topic is string => typeof topic === "string"));
    }).catch(() => { if (active) refreshFeed(); });
    return () => { active = false; };
  }, [store, refreshFeed]);

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
        title="Noodler"
        titleId="noodler-title"
        closeLabel="Close Noodler"
        onBack={onBack}
        onClose={onClose}
        actions={[{ id: "refresh", icon: "refresh", label: tab === "feed" ? "Refresh feed" : "Refresh trending", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh") (tab === "feed" ? refreshFeed() : refreshTrending()); }}
      />
      <div className="vp-tab-content">
        {tab === "feed" ? (
          <>
            {loading && !feed?.posts.length ? skeleton : null}
            {feed && feed.posts.length === 0 && !loading ? (
              <p className="vp-muted-note">The feed is quiet right now. Refresh to see what the world is talking about.</p>
            ) : null}
            {feed?.posts.length ? (
              <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
                {feed.posts.map((post, index) => {
                  const { name, handle, text, likes, replies, boosts } = splitPost(post);
                  return (
                    <article key={index} className="vp-card vp-post">
                      <div className="vp-post-header">
                        <span className="vp-post-avatar" aria-hidden="true">{name[0]?.toUpperCase() ?? "N"}</span>
                        <span className="vp-post-names">
                          <span className="vp-post-author">{name}</span>
                          <span className="vp-post-handle">{handle}</span>
                        </span>
                      </div>
                      <p className="vp-post-text">{text}</p>
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
      <nav className="vp-tabbar" aria-label="Noodler sections">
        <button type="button" aria-current={tab === "feed"} onClick={() => setTab("feed")} className="vp-tabbar-btn"><Newspaper size="1rem" aria-hidden="true" /><span>Feed</span></button>
        <button type="button" aria-current={tab === "trending"} onClick={() => setTab("trending")} className="vp-tabbar-btn"><Flame size="1rem" aria-hidden="true" /><span>Trending</span></button>
      </nav>
    </section>
  );
}
