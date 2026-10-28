import React from "react";
import { Bookmark, Clock3, LocateFixed, MapPinned, Navigation, Search, Star, X } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity } from "../../platform/api";
import { emojiFor } from "../../platform/emoji-thumb";
import { PhoneEmptyState } from "../../platform/empty-state";
import { usePhoneStore } from "../../platform/use-phone-store";
import { parsePlace, type MapPlace } from "./manifest";

const QUICK_SEARCHES = ["Food", "Coffee", "Shops", "A place to stay"];

// Deterministic scatter keeps a fictional place in the same visual spot for this result set.
const pin = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return { left: `${12 + (Math.abs(hash) % 76)}%`, top: `${16 + (Math.abs(hash >> 8) % 56)}%` };
};

const samePlace = (first: MapPlace, second: MapPlace) => first.name === second.name;
const validPlaces = (value: unknown): MapPlace[] => Array.isArray(value)
  ? value.filter((item): item is MapPlace => !!item && typeof item === "object" && typeof (item as MapPlace).name === "string" && typeof (item as MapPlace).category === "string").slice(0, 20)
  : [];

export function MapsShell({ phoneId, chatId, initialQuery = "", onBack, onClose }: { phoneId: string; chatId: string; initialQuery?: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "maps");
  const [places, setPlaces] = React.useState<MapPlace[]>([]);
  const [query, setQuery] = React.useState(initialQuery);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [saved, setSaved] = React.useState<MapPlace[]>([]);
  const [selected, setSelected] = React.useState<MapPlace | null>(null);
  const [route, setRoute] = React.useState<MapPlace | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const launchedQuery = React.useRef("");

  React.useEffect(() => {
    void Promise.all([store.get("recent"), store.get("saved")]).then(([storedRecent, storedSaved]) => {
      setRecent(Array.isArray(storedRecent) ? storedRecent.filter((item): item is string => typeof item === "string").slice(0, 5) : []);
      setSaved(validPlaces(storedSaved));
    }).catch(() => undefined);
  }, [store]);

  const search = React.useCallback((rawQuery = query) => {
    const nextQuery = rawQuery.trim();
    if (!nextQuery || loading) return;
    setQuery(nextQuery);
    setLoading(true);
    setNotice("");
    setSelected(null);
    setRoute(null);
    void phoneRequest<{ places: string[] }>(`/phones/${encodeURIComponent(phoneId)}/maps/search?chatId=${encodeURIComponent(chatId)}`, { method: "POST", body: JSON.stringify({ query: nextQuery }) })
      .then((response) => {
        setPlaces(response.places.map(parsePlace));
        const nextRecent = [nextQuery, ...recent.filter((item) => item.toLocaleLowerCase() !== nextQuery.toLocaleLowerCase())].slice(0, 5);
        setRecent(nextRecent);
        void store.set("recent", nextRecent).catch(() => undefined);
      })
      .catch((cause) => setNotice(cause instanceof Error ? cause.message : "Maps is unavailable."))
      .finally(() => setLoading(false));
  }, [chatId, loading, phoneId, query, recent, store]);

  React.useEffect(() => {
    const nextQuery = initialQuery.trim();
    if (!nextQuery || launchedQuery.current === nextQuery) return;
    launchedQuery.current = nextQuery;
    setQuery(nextQuery);
    search(nextQuery);
  }, [initialQuery, search]);

  const toggleSaved = (place: MapPlace) => {
    const exists = saved.some((item) => samePlace(item, place));
    const next = exists ? saved.filter((item) => !samePlace(item, place)) : [place, ...saved].slice(0, 20);
    setSaved(next);
    void store.set("saved", next).catch(() => setNotice("Saved places could not be updated."));
  };

  const startRoute = (place: MapPlace) => {
    setSelected(null);
    setRoute(place);
    void recordActivity(phoneId, `started navigation to ${place.name}`).catch(() => undefined);
  };

  const title = route ? "Directions" : "Maps";
  return <section aria-labelledby="maps-title" className="vp-appview vp-appview--fixed vp-maps" data-phone-app="maps">
    <PhoneAppHeader title={title} titleId="maps-title" closeLabel="Close Maps" onBack={() => route ? setRoute(null) : selected ? setSelected(null) : onBack()} onClose={onClose} />
    {route ? (
      <div className="vp-map-route" aria-live="polite">
        <div className="vp-map-route-banner">
          <span className="vp-map-turn"><Navigation size="1.25rem" aria-hidden="true" /></span>
          <span><strong>Continue toward {route.name}</strong><small>Route preview · arrival time depends on the scene</small></span>
        </div>
        <div className="vp-map-canvas vp-map-canvas--route" role="img" aria-label={`Route to ${route.name}`}>
          <span className="vp-map-route-line" aria-hidden="true" />
          <span className="vp-map-origin" aria-hidden="true"><LocateFixed size="1rem" /></span>
          <span className="vp-map-pin is-destination" aria-hidden="true">{emojiFor(`${route.category} ${route.name}`, "📍")}</span>
        </div>
        <div className="vp-map-trip-card">
          <span><strong>{route.name}</strong><small>{route.category}{route.detail ? ` · ${route.detail}` : ""}</small></span>
          <button type="button" className="vp-map-end" onClick={() => setRoute(null)}>End</button>
        </div>
      </div>
    ) : (
      <>
        <form className="vp-map-search" onSubmit={(event) => { event.preventDefault(); search(); }}>
          <Search size="0.95rem" aria-hidden="true" />
          <label><span className="vp-sr-only">Search Maps</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this world" /></label>
          {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size="0.9rem" aria-hidden="true" /></button> : null}
        </form>
        {notice ? <p role="status" className="vp-muted-note vp-map-notice">{notice}</p> : null}
        <div className="vp-map-canvas vp-map-canvas--full" role="img" aria-label="Map of search results">
          {places.map((place) => <button key={place.name} type="button" className={`vp-map-pin${selected?.name === place.name ? " is-selected" : ""}`} style={pin(place.name)} aria-label={`${place.name}, ${place.category}`} onClick={() => setSelected(place)}>{emojiFor(`${place.category} ${place.name}`, "📍")}</button>)}
          {loading ? <span className="vp-map-loading" role="status">Looking around…</span> : null}
        </div>
        <div className="vp-map-sheet">
          <span className="vp-sheet-grip" aria-hidden="true" />
          {selected ? (
            <div className="vp-map-place-card">
              <div className="vp-map-place-head"><span className="vp-emoji-thumb vp-listing-thumb" aria-hidden="true">{emojiFor(`${selected.category} ${selected.name}`, "📍")}</span><span><strong>{selected.name}</strong><small>{selected.category}</small></span><button type="button" className="vp-icon-btn" aria-label={saved.some((item) => samePlace(item, selected)) ? "Remove from saved places" : "Save place"} onClick={() => toggleSaved(selected)}><Star size="1rem" fill={saved.some((item) => samePlace(item, selected)) ? "currentColor" : "none"} aria-hidden="true" /></button></div>
              {selected.detail ? <p>{selected.detail}</p> : null}
              <button type="button" className="vp-accent-btn" onClick={() => startRoute(selected)}><Navigation size="0.95rem" aria-hidden="true" /> Directions</button>
              <small className="vp-map-privacy">Searching and previewing stay on the phone. Starting directions records phone activity.</small>
            </div>
          ) : places.length > 0 ? (
            <div className="vp-list vp-list--inset-rules">{places.map((place) => (
              <button key={place.name} type="button" className="vp-thread-row" onClick={() => setSelected(place)}>
                <span className="vp-emoji-thumb vp-listing-thumb" role="img" aria-label={`Place: ${place.name}`}>{emojiFor(`${place.category} ${place.name}`, "📍")}</span>
                <span className="vp-thread-body"><span className="vp-thread-name">{place.name}</span><span className="vp-thread-preview">{place.category}{place.detail ? ` · ${place.detail}` : ""}</span></span>
                <span className="vp-row-chevron">›</span>
              </button>
            ))}</div>
          ) : (
            <div className="vp-map-start">
              <div className="vp-map-chips">{QUICK_SEARCHES.map((item) => <button key={item} type="button" onClick={() => search(item)}>{item}</button>)}</div>
              {saved.length ? <section><h3><Bookmark size="0.8rem" aria-hidden="true" /> Saved places</h3>{saved.slice(0, 3).map((place) => <button key={place.name} type="button" className="vp-map-history-row" onClick={() => setSelected(place)}><span>{place.name}</span><small>{place.category}</small></button>)}</section> : null}
              {recent.length ? <section><h3><Clock3 size="0.8rem" aria-hidden="true" /> Recent searches</h3>{recent.map((item) => <button key={item} type="button" className="vp-map-history-row" onClick={() => search(item)}>{item}</button>)}</section> : null}
              {!saved.length && !recent.length ? <PhoneEmptyState icon={MapPinned} title="Explore this world" body="Search for an established address, a kind of place, or what might be nearby." /> : null}
            </div>
          )}
        </div>
      </>
    )}
  </section>;
}
