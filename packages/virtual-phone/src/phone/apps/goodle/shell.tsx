import React from "react";
import { Search, X } from "lucide-react";
import { fallbackSearchResults } from "./manifest";

export function GoodleShell({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState(() => fallbackSearchResults(""));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setResults(fallbackSearchResults(query));
  };
  return (
    <section aria-labelledby="goodle-title" className="absolute inset-0 z-10 overflow-y-auto bg-[var(--vp-bg)] p-5">
      <header className="mb-5 flex min-h-11 items-center justify-between">
        <h2 id="goodle-title" className="text-sm font-semibold">Goodle</h2>
        <button type="button" aria-label="Close Goodle" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><X size="1rem" aria-hidden="true" /></button>
      </header>
      <form onSubmit={submit} className="flex gap-2">
        <label className="min-w-0 flex-1"><span className="sr-only">Search Goodle</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--vp-surface)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]" /></label>
        <button type="submit" aria-label="Search" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--vp-accent)] text-white"><Search size="1rem" aria-hidden="true" /></button>
      </form>
      <div className="mt-5">
        <h3 className="text-sm font-semibold">{results.title}</h3>
        <p className="mt-2 text-xs text-[var(--vp-muted)]">{results.summary}</p>
        {results.items.length ? <ul className="mt-4 space-y-2">{results.items.map((item) => <li key={item} className="rounded-lg bg-[var(--vp-surface)] p-3 text-xs">{item}</li>)}</ul> : null}
      </div>
    </section>
  );
}
