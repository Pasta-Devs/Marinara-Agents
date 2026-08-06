import React from "react";
import { Search } from "lucide-react";
import { fallbackSearchResults } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";
import { usePhoneStore } from "../../platform/use-phone-store";

const MAX_RECENTS = 8;

export function GoodleShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "goodle");
  const [query, setQuery] = React.useState("");
  const [recents, setRecents] = React.useState<string[]>([]);
  const [results, setResults] = React.useState(() => fallbackSearchResults(""));

  React.useEffect(() => {
    let active = true;
    void store.get("recents").then((value) => {
      if (active && Array.isArray(value)) setRecents(value.filter((item): item is string => typeof item === "string"));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [store]);

  const search = (term: string) => {
    setResults(fallbackSearchResults(term));
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recents.filter((recent) => recent !== trimmed)].slice(0, MAX_RECENTS);
    setRecents(next);
    void store.set("recents", next).catch(() => undefined);
  };
  const clearRecents = () => {
    setRecents([]);
    void store.remove("recents").catch(() => undefined);
  };

  return (
    <section aria-labelledby="goodle-title" className="vp-appview">
      <PhoneAppHeader
        title="Goodle"
        titleId="goodle-title"
        closeLabel="Close Goodle"
        onBack={onBack}
        onClose={onClose}
        actions={[{ id: "clear-recents", icon: "trash", label: "Clear recent searches", kind: "button", disabled: recents.length === 0, reason: "No recent searches" }]}
        onAction={(actionId) => { if (actionId === "clear-recents") clearRecents(); }}
      />
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
      <div>
        <h3 className="vp-result-title">{results.title}</h3>
        <p className="vp-result-summary">{results.summary}</p>
        {results.items.length ? <ul className="vp-result-list">{results.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </div>
    </section>
  );
}
