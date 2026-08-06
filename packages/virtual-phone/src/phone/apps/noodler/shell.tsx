import React from "react";
import { fallbackFeed } from "./manifest";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

function splitPost(post: string) {
  const [author, ...rest] = post.split(" — ");
  return rest.length ? { author: author!, text: rest.join(" — ") } : { author: "Noodler", text: post };
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
      {loading && !feed?.posts.length ? <p role="status" className="vp-muted-note">Loading the feed…</p> : null}
      {feed && feed.posts.length === 0 && !loading ? (
        <p className="vp-muted-note">The feed is quiet right now. Refresh to see what the world is talking about.</p>
      ) : null}
      {feed?.posts.length ? (
        <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
          {feed.posts.map((post, index) => {
            const { author, text } = splitPost(post);
            return (
              <article key={index} className="vp-card vp-post">
                <span className="vp-post-author">{author}</span>
                <p className="vp-post-text">{text}</p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
