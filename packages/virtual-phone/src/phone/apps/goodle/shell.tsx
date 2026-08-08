import React from "react";
import { Globe, Search, Star } from "lucide-react";
import { fallbackSearchResults, looksLikeUrl, normalizeUrl, parseLinkedText, parsePageSection, parseResultItem, slugify } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";
import { phoneRequest, recordActivity } from "../../platform/api";
import { hueFor } from "../../platform/avatars";

const MAX_RECENTS = 8;
const LOGO_COLORS = ["#4285f4", "#ea4335", "#fbbc05", "#4285f4", "#34a853", "#ea4335"];

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
  // Pages popped by Back, kept so Forward can re-enter them without regenerating.
  const [forward, setForward] = React.useState<PageState[]>([]);
  const [bookmarks, setBookmarks] = React.useState<PageState[]>([]);
  const page = pages.at(-1) ?? null;
  const recentsRef = React.useRef(recents);
  recentsRef.current = recents;

  React.useEffect(() => {
    let active = true;
    void store.get("recents").then((value) => {
      if (active && Array.isArray(value)) setRecents(value.filter((item): item is string => typeof item === "string"));
    }).catch(() => undefined);
    void store.get("bookmarks").then((value) => {
      if (active && Array.isArray(value)) {
        setBookmarks(value.filter((item): item is PageState => !!item && typeof (item as PageState).url === "string"));
      }
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
    recordActivity(phoneId, `looked up "${trimmed}"`);
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
    setForward([]);
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
  const back = () => {
    setPages((current) => {
      const leaving = current.at(-1);
      if (leaving) setForward((stack) => [...stack, leaving]);
      return current.slice(0, -1);
    });
  };
  const goForward = () => {
    setForward((stack) => {
      const next = stack.at(-1);
      if (next) setPages((current) => [...current, next]);
      return stack.slice(0, -1);
    });
  };
  const bookmarked = page ? bookmarks.some((entry) => entry.url === page.url) : false;
  const toggleBookmark = () => {
    if (!page || page.loading) return;
    // Snapshots the page, not just the address. Generated pages are not stable across
    // regenerations, so a URL-only bookmark would quietly return something else.
    const next = bookmarked
      ? bookmarks.filter((entry) => entry.url !== page.url)
      : [{ ...page }, ...bookmarks].slice(0, 30);
    setBookmarks(next);
    void store.set("bookmarks", next).catch(() => undefined);
  };
  const openBookmark = (entry: PageState) => {
    setForward([]);
    setPages((current) => [...current, entry]);
  };
  const submitQuery = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    // A typed address opens that address in this world; it never reaches the real internet.
    if (looksLikeUrl(trimmed)) {
      const url = normalizeUrl(trimmed);
      openPage(url.split("/").slice(1).join("/") || url, url);
      return;
    }
    search(trimmed);
  };
  const clearRecents = () => {
    setRecents([]);
    void store.remove("recents").catch(() => undefined);
  };

  const domain = page?.url.split("/")[0] ?? "goodle.web";
  const renderBody = (body: string) => parseLinkedText(body).map((part, index) => part.link
    ? (
      <button key={index} type="button" className="vp-inline-link" onClick={() => openPage(part.text, `${domain}/${slugify(part.text)}`, page?.site)}>
        {part.text}
      </button>
    )
    : <React.Fragment key={index}>{part.text}</React.Fragment>);
  const hue = hueFor(page?.site ?? "");
  const sections = page?.sections.map(parsePageSection) ?? [];

  return (
    <section aria-labelledby="goodle-title" className="vp-appview">
      <PhoneAppHeader
        title={page ? page.site : "Goodle"}
        titleId="goodle-title"
        closeLabel="Close Goodle"
        onBack={() => page ? back() : onBack()}
        onClose={onClose}
        actions={page ? [] : [{ id: "clear-recents", icon: "trash", label: "Clear recent searches", kind: "button", disabled: recents.length === 0, reason: "No recent searches" }]}
        onAction={(actionId) => { if (actionId === "clear-recents") clearRecents(); }}
        center={page ? (
          <span className="vp-urlbar">
            <Globe size="0.75rem" aria-hidden="true" />
            <span>{page.url}</span>
            <button type="button" onClick={goForward} disabled={forward.length === 0} aria-label="Forward" className="vp-urlbar-btn">›</button>
            <button type="button" onClick={toggleBookmark} disabled={page.loading} aria-label={bookmarked ? "Remove bookmark" : "Bookmark this page"} aria-pressed={bookmarked} className="vp-urlbar-btn">
              <Star size="0.75rem" aria-hidden="true" fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </span>
        ) : undefined}
      />
      {page ? (
        <div className="vp-site" aria-busy={page.loading}>
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
                      <p>{renderBody(section.body)}</p>
                    </article>
                  ))}
                </div>
              ) : (
                sections.map((section, index) => (
                  <article key={index} className={`vp-site-section${page.kind === "forum" ? " vp-site-section--post" : ""}`}>
                    {section.heading ? <h4>{section.heading}</h4> : null}
                    <p>{renderBody(section.body)}</p>
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
          <form onSubmit={(event) => { event.preventDefault(); submitQuery(); }} className="vp-search-go">
            <label><span className="vp-sr-only">Search Goodle</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search or type an address" className="vp-input" style={{ paddingRight: "2.75rem" }} /></label>
            {query.trim() ? <button type="submit" aria-label="Search" className="vp-go-btn"><Search size="0.875rem" aria-hidden="true" /></button> : null}
          </form>
          {recents.length && !searching && !results.items.length ? (
            <div className="vp-chip-row" aria-label="Recent searches">
              {recents.map((recent) => (
                <button key={recent} type="button" onClick={() => { setQuery(recent); search(recent); }} className="vp-chip">{recent}</button>
              ))}
            </div>
          ) : null}
          {bookmarks.length && !searching && !results.items.length ? (
            <div className="vp-chip-row" aria-label="Bookmarks">
              {bookmarks.map((entry) => (
                <button key={entry.url} type="button" onClick={() => openBookmark(entry)} className="vp-chip">
                  <Star size="0.625rem" aria-hidden="true" fill="currentColor" /> {entry.site || entry.url}
                </button>
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
