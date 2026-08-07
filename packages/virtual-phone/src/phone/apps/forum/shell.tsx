import React from "react";
import { Globe, Send } from "lucide-react";
import { phoneRequest } from "../../platform/api";
import { PhoneAppHeader } from "../../platform/app-header";

interface ForumPost {
  id: string;
  author: string;
  text: string;
  at: string;
}
interface ForumThread {
  id: string;
  title: string;
  author: string;
  at: string;
  posts: ForumPost[];
}

export function ForumShell({ phoneId, ownerName = "You", onBack, onClose }: { phoneId: string; ownerName?: string; onBack: () => void; onClose: () => void }) {
  const [threads, setThreads] = React.useState<ForumThread[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(() => {
    void phoneRequest<{ threads: ForumThread[] }>(`/phones/${encodeURIComponent(phoneId)}/forum`)
      .then((response) => setThreads(response.threads))
      .catch(() => setThreads((current) => current ?? []));
  }, [phoneId]);

  React.useEffect(() => {
    setThreads(null);
    setActiveId(null);
    load();
  }, [load]);

  const refresh = () => {
    setLoading(true);
    void phoneRequest<{ threads: ForumThread[] }>(`/phones/${encodeURIComponent(phoneId)}/forum/refresh`, { method: "POST", body: JSON.stringify({}) })
      .then((response) => setThreads(response.threads))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };
  const active = threads?.find((thread) => thread.id === activeId) ?? null;
  const reply = () => {
    if (!active || !draft.trim()) return;
    setSending(true);
    void phoneRequest<{ threads: ForumThread[] }>(`/phones/${encodeURIComponent(phoneId)}/forum/reply`, {
      method: "POST", body: JSON.stringify({ threadId: active.id, text: draft }),
    })
      .then((response) => { setThreads(response.threads); setDraft(""); })
      .catch(() => undefined)
      .finally(() => setSending(false));
  };

  return (
    <section aria-labelledby="forum-title" className="vp-appview">
      <PhoneAppHeader
        title={active ? active.title : "Forum"}
        titleId="forum-title"
        closeLabel="Close Forum"
        onBack={() => active ? setActiveId(null) : onBack()}
        onClose={onClose}
        actions={active ? [] : [{ id: "refresh", icon: "refresh", label: "Refresh threads", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh") refresh(); }}
        center={<span className="vp-urlbar"><Globe size="0.75rem" aria-hidden="true" /><span>board.web{active ? `/${active.id.slice(0, 6)}` : ""}</span></span>}
      />
      {active ? (
        <div className="vp-stack" style={{ gap: "0.5rem" }}>
          <h3 className="vp-page-heading" style={{ margin: 0 }}>{active.title}</h3>
          {active.posts.map((post, index) => (
            <article key={post.id} className={`vp-card vp-post${index === 0 ? " vp-forum-op" : ""}`}>
              <div className="vp-post-names">
                <span className="vp-post-author">{post.author}</span>
                {index === 0 ? <span className="vp-post-handle">OP</span> : null}
                <span className="vp-post-time">{new Date(post.at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              </div>
              <p className="vp-post-text">{post.text}</p>
            </article>
          ))}
          <form className="vp-composer" onSubmit={(event) => { event.preventDefault(); reply(); }}>
            <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Reply as {ownerName}</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Reply as ${ownerName}`} maxLength={1000} disabled={sending} className="vp-input" />
            </label>
            <button type="submit" aria-label="Post reply" disabled={sending || !draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
          </form>
          {sending ? <p role="status" className="vp-muted-note">Posting…</p> : null}
        </div>
      ) : !threads ? (
        <div role="status" aria-label="Loading threads" className="vp-stack" style={{ gap: "0.5rem" }}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="vp-thread-row" aria-hidden="true">
              <span className="vp-thread-body">
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "80%" }} />
                <span className="vp-skeleton vp-skeleton--line" style={{ width: "45%" }} />
              </span>
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <p className="vp-muted-note">No threads yet. Refresh to see what the world is arguing about.</p>
      ) : (
        <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
          {threads.map((thread) => (
            <button key={thread.id} type="button" onClick={() => setActiveId(thread.id)} className="vp-thread-row">
              <span className="vp-thread-body">
                <span className="vp-thread-name">{thread.title}</span>
                <span className="vp-thread-preview">by {thread.author} · {Math.max(0, thread.posts.length - 1)} replies</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
