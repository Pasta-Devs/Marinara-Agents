import React from "react";
import { Globe, Search } from "lucide-react";
import { fallbackSearchResults, parsePageSection, parseResultItem, slugify } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { phoneRequest } from "../../platform/api";

const MAX_RECENTS = 8;
const LOGO_COLORS = ["#4285f4", "#ea4335", "#fbbc05", "#4285f4", "#34a853", "#ea4335"];

function hueFor(value: string) {
  let hue = 0;
  for (const char of value) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
}

interface SitePagePayload {
  site: string;
  title: string;
  tagline: string;
  kind: string;
  links: string[];
  sections: string[];
}

interface PageState extends SitePagePayload {
  url: string;
  loading: boolean;
}

export function GoodleShell({ phoneId, initialQuery = "", onBack, onClose }: { phoneId: string; initialQuery?: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "goodle");
  const [query, setQuery] = React.useState(initialQuery);
  const [recents, setRecents] = React.useState<string[]>([]);
  const [results, setResults] = React.useState(() => fallbackSearchResults(""));
  const [searching, setSearching] = React.useState(false);
  const [pages, setPages] = React.useState<PageState[]>([]);
  const page = pages.at(-1) ?? null;
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

  const openPage = (title: string, url: string, site?: string) => {
    setPages((current) => [...current, { site: site ?? url.split("/")[0] ?? "goodle.web", title, tagline: "", kind: "official", links: [], sections: [], url, loading: true }]);
    const settle = (loaded: PageState) => setPages((current) =>
      current.map((entry) => entry.url === url && entry.loading ? loaded : entry));
    void phoneRequest<{ page: SitePagePayload }>(`/phones/${encodeURIComponent(phoneId)}/goodle/page`, {
      method: "POST", body: JSON.stringify({ title, url, query: query.trim(), ...(site ? { site } : {}) }),
    })
      .then((response) => settle({ ...response.page, title: response.page.title || title, url, loading: false }))
      .catch(() => settle({
        site: site ?? url.split("/")[0] ?? "goodle.web", title, tagline: "", kind: "official", links: [],
        sections: ["Offline :: Goodle can't reach this page right now."], url, loading: false,
      }));
  };
  const clearRecents = () => {
    setRecents([]);
    void store.remove("recents").catch(() => undefined);
  };

  const domain = page?.url.split("/")[0] ?? "goodle.web";
  const hue = hueFor(page?.site ?? "");
  const sections = page?.sections.map(parsePageSection) ?? [];

  return (
    <section aria-labelledby="goodle-title" className="vp-appview">
      <PhoneAppHeader
        title={page ? page.site : "Goodle"}
        titleId="goodle-title"
        closeLabel="Close Goodle"
        onBack={() => page ? setPages((current) => current.slice(0, -1)) : onBack()}
        onClose={onClose}
        actions={page ? [] : [{ id: "clear-recents", icon: "trash", label: "Clear recent searches", kind: "button", disabled: recents.length === 0, reason: "No recent searches" }]}
        onAction={(actionId) => { if (actionId === "clear-recents") clearRecents(); }}
      />
      {page ? (
        <div className="vp-site" aria-busy={page.loading}>
          <div className="vp-page-url"><Globe size="0.75rem" aria-hidden="true" /><span>{page.url}</span></div>
          {page.loading ? (
            <div role="status" aria-label="Loading page">
              <span className="vp-skeleton" style={{ height: "5rem", borderRadius: "1.125rem 1.125rem 0 0" }} />
              <span className="vp-skeleton" style={{ height: "2.5rem", borderRadius: "0 0 1.125rem 1.125rem", marginBottom: "1rem" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "60%", height: "0.875rem" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "100%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "95%" }} />
              <span className="vp-skeleton vp-skeleton--line" style={{ width: "88%" }} />
            </div>
          ) : (
            <>
              <header className="vp-site-masthead" style={{ background: `linear-gradient(135deg, hsl(${hue} 62% 42%), hsl(${(hue + 40) % 360} 62% 30%))` }}>
                <span className="vp-site-name">{page.site}</span>
                {page.tagline ? <span className="vp-site-tagline">{page.tagline}</span> : null}
              </header>
              {page.links.length ? (
                <nav className="vp-site-nav" aria-label={`${page.site} sections`}>
                  {page.links.map((link) => (
                    <button key={link} type="button" onClick={() => openPage(link, `${domain}/${slugify(link)}`, page.site)} className="vp-site-nav-btn">{link}</button>
                  ))}
                </nav>
              ) : null}
              <h3 className="vp-page-heading">{page.title}</h3>
              {page.kind === "shop" ? (
                <div className="vp-site-grid">
                  {sections.map((section, index) => (
                    <article key={index} className="vp-site-card">
                      <h4>{section.heading || "Item"}</h4>
                      <p>{section.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                sections.map((section, index) => (
                  <article key={index} className={`vp-site-section${page.kind === "forum" ? " vp-site-section--post" : ""}`}>
                    {section.heading ? <h4>{section.heading}</h4> : null}
                    <p>{section.body}</p>
                  </article>
                ))
              )}
            </>
          )}
        </div>
      ) : (
        <>
          {!results.items.length && !searching ? (
            <div className="vp-goodle-logo" aria-hidden="true">
              {"Goodle".split("").map((letter, index) => <span key={index} style={{ color: LOGO_COLORS[index % LOGO_COLORS.length] }}>{letter}</span>)}
            </div>
          ) : null}
          <form onSubmit={(event) => { event.preventDefault(); search(query); }} className="vp-search-go">
            <label><span className="vp-sr-only">Search Goodle</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="vp-input" style={{ paddingRight: "2.75rem" }} /></label>
            {query.trim() ? <button type="submit" aria-label="Search" className="vp-go-btn"><Search size="0.875rem" aria-hidden="true" /></button> : null}
          </form>
          {recents.length && !searching && !results.items.length ? (
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
                    <button key={item} type="button" onClick={() => openPage(title, url)} className="vp-result-card">
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
