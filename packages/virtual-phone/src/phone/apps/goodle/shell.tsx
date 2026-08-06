import React from "react";
import { Search } from "lucide-react";
import { fallbackSearchResults } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";

export function GoodleShell({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState(() => fallbackSearchResults(""));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setResults(fallbackSearchResults(query));
  };
  return (
    <section aria-labelledby="goodle-title" className="vp-appview">
      <PhoneAppHeader title="Goodle" titleId="goodle-title" closeLabel="Close Goodle" onBack={onBack} onClose={onClose} />
      <form onSubmit={submit} className="vp-search-row">
        <label><span className="vp-sr-only">Search Goodle</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="vp-input" /></label>
        <button type="submit" aria-label="Search" className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Search size="1rem" aria-hidden="true" /></button>
      </form>
      <div>
        <h3 className="vp-result-title">{results.title}</h3>
        <p className="vp-result-summary">{results.summary}</p>
        {results.items.length ? <ul className="vp-result-list">{results.items.map((item) => <li key={item}>{item}</li>)}</ul> : null}
      </div>
    </section>
  );
}
