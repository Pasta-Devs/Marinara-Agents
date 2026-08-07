import React from "react";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
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

export function NoodlerShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "noodler");
  const [feed, setFeed] = React.useState<{ posts: string[] } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(() => {
    setLoading(true);
    void phoneRequest<{ feed: { posts: string[] } }>(`/phones/${encodeURIComponent(phoneId)}/noodler/feed`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => {
        setFeed(response.feed);
        void store.set("feed", response.feed).catch(() => undefined);
      })
      .catch(() => setFeed((current) => current ?? fallbackFeed()))
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void store.get("feed").then((value) => {
      if (!active) return;
      const cached = value as { posts?: unknown } | undefined;
      if (cached && Array.isArray(cached.posts) && cached.posts.every((post) => typeof post === "string")) {
        setFeed({ posts: cached.posts as string[] });
      } else {
        refresh();
      }
    }).catch(() => { if (active) refresh(); });
    return () => { active = false; };
  }, [store, refresh]);

  return (
    <section aria-labelledby="noodler-title" className="vp-appview">
      <PhoneAppHeader
        title="Noodler"
        titleId="noodler-title"
        closeLabel="Close Noodler"
        onBack={onBack}
        onClose={onClose}
        actions={[{ id: "refresh-feed", icon: "refresh", label: "Refresh feed", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh-feed") refresh(); }}
      />
      {loading && !feed?.posts.length ? (
        <div role="status" aria-label="Loading the feed" className="vp-stack" style={{ gap: "0.5rem" }}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="vp-card vp-post" aria-hidden="true">
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "35%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "100%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "80%" }} />
            </div>
          ))}
        </div>
      ) : null}
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
    </section>
  );
}
