import React from "react";
import { Globe, Search } from "lucide-react";
import { fallbackSearchResults, parseResultItem } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { phoneRequest } from "../../platform/api";

const MAX_RECENTS = 8;

interface PageState {
  title: string;
  url: string;
  body: string[];
  loading: boolean;
}

export function GoodleShell({ phoneId, initialQuery = "", onBack, onClose }: { phoneId: string; initialQuery?: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "goodle");
  const [query, setQuery] = React.useState(initialQuery);
  const [recents, setRecents] = React.useState<string[]>([]);
  const [results, setResults] = React.useState(() => fallbackSearchResults(""));
  const [searching, setSearching] = React.useState(false);
  const [page, setPage] = React.useState<PageState | null>(null);
  const recentsRef = React.useRef(recents);
  recentsRef.current = recents;

  React.useEffect(() => {
    let active = true;
    void store.get("recents").then((value) => {
      if (active && Array.isArray(value)) setRecents(value.filter((item): item is string => typeof item === "string"));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [store]);

  const search = React.useCallback((term: string) => {
    const trimmed = term.trim();
    setResults(fallbackSearchResults(trimmed));
    if (!trimmed) return;
    const next = [trimmed, ...recentsRef.current.filter((recent) => recent !== trimmed)].slice(0, MAX_RECENTS);
    setRecents(next);
    void store.set("recents", next).catch(() => undefined);
    setSearching(true);
    void phoneRequest<{ results: ReturnType<typeof fallbackSearchResults> }>(`/phones/${encodeURIComponent(phoneId)}/goodle/search`, {
      method: "POST", body: JSON.stringify({ query: trimmed }),
    })
      .then((response) => setResults(response.results))
      .catch(() => setResults(fallbackSearchResults(trimmed)))
      .finally(() => setSearching(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery);
      search(initialQuery);
    }
    // Home-screen searches hand off once, on mount.
  }, []);

  const openPage = (item: string) => {
    const { title, url } = parseResultItem(item);
    setPage({ title, url, body: [], loading: true });
    void phoneRequest<{ page: { title: string; body: string[] } }>(`/phones/${encodeURIComponent(phoneId)}/goodle/page`, {
      method: "POST", body: JSON.stringify({ title, url, query: query.trim() }),
    })
      .then((response) => setPage({ title: response.page.title || title, url, body: response.page.body, loading: false }))
      .catch(() => setPage({ title, url, body: ["Goodle can't reach this page right now."], loading: false }));
  };
  const clearRecents = () => {
    setRecents([]);
    void store.remove("recents").catch(() => undefined);
  };

  return (
    <section aria-labelledby="goodle-title" className="vp-appview">
      <PhoneAppHeader
        title={page ? page.title : "Goodle"}
        titleId="goodle-title"
        closeLabel="Close Goodle"
        onBack={() => page ? setPage(null) : onBack()}
        onClose={onClose}
        actions={page ? [] : [{ id: "clear-recents", icon: "trash", label: "Clear recent searches", kind: "button", disabled: recents.length === 0, reason: "No recent searches" }]}
        onAction={(actionId) => { if (actionId === "clear-recents") clearRecents(); }}
      />
      {page ? (
        <div>
          <div className="vp-page-url"><Globe size="0.75rem" aria-hidden="true" /><span>{page.url}</span></div>
          {page.loading ? (
            <div role="status" aria-label="Loading page">
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "60%", height: "0.875rem" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "100%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "95%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "88%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "70%" }} />
            </div>
          ) : (
            <div className="vp-page-body">
              <h3 className="vp-page-heading">{page.title}</h3>
              {page.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          )}
        </div>
      ) : (
        <>
          <form onSubmit={(event) => { event.preventDefault(); search(query); }} className="vp-search-row">
            <label><span className="vp-sr-only">Search Goodle</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="vp-input" /></label>
            <button type="submit" aria-label="Search" className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Search size="1rem" aria-hidden="true" /></button>
          </form>
          {recents.length ? (
            <div className="vp-chip-row" aria-label="Recent searches">
              {recents.map((recent) => (
                <button key={recent} type="button" onClick={() => { setQuery(recent); search(recent); }} className="vp-chip">{recent}</button>
              ))}
            </div>
          ) : null}
          <div aria-busy={searching}>
            <h3 className="vp-result-title">{results.title}</h3>
            <p className="vp-result-summary">{searching ? "Searching…" : results.summary}</p>
            {searching ? (
              <div role="status" aria-label="Loading results" className="vp-result-list">
                {[0, 1, 2, 3].map((index) => <span key={index} className="vp-skeleton vp-skeleton--block" />)}
              </div>
            ) : results.items.length ? (
              <div className="vp-result-list">
                {results.items.map((item) => {
                  const { title, url, snippet } = parseResultItem(item);
                  return (
                    <button key={item} type="button" onClick={() => openPage(item)} className="vp-result-card">
                      <span className="vp-result-link">{title}</span>
                      <span className="vp-result-url">{url}</span>
                      {snippet ? <span className="vp-result-snippet">{snippet}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
