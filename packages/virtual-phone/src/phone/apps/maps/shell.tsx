import React from "react";
import { MapPinned, Navigation, Search } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity, rememberWorldFact } from "../../platform/api";
import { emojiFor } from "../../platform/emoji-thumb";
import { PhoneEmptyState } from "../../platform/empty-state";
import { parsePlace, type MapPlace } from "./manifest";

// Deterministic scatter so pins hold their spot between renders without storing coordinates.
const pin = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const x = 12 + (Math.abs(hash) % 76);
  const y = 16 + (Math.abs(hash >> 8) % 62);
  return { left: `${x}%`, top: `${y}%` };
};

export function MapsShell({ phoneId, chatId, onBack, onClose }: { phoneId: string; chatId: string; onBack: () => void; onClose: () => void }) {
  const [places, setPlaces] = React.useState<MapPlace[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [openName, setOpenName] = React.useState<string | null>(null);

  const search = () => {
    if (!query.trim()) return;
    setLoading(true);
    setNotice("");
    void phoneRequest<{ places: string[] }>(`/phones/${encodeURIComponent(phoneId)}/maps/search?chatId=${encodeURIComponent(chatId)}`, { method: "POST", body: JSON.stringify({ query }) })
      .then((r) => setPlaces(r.places.map(parsePlace)))
      .catch((e) => setNotice(e instanceof Error ? e.message : "Maps is unavailable."))
      .finally(() => setLoading(false));
  };

  const route = (place: MapPlace) => {
    setOpenName(place.name);
    void recordActivity(phoneId, `looked up directions to ${place.name} on Maps`).catch(() => undefined);
    void rememberWorldFact(phoneId, `${place.name} — ${place.category}${place.detail ? `: ${place.detail}` : ""}`, "Maps").catch(() => undefined);
  };
  const open = places.find((p) => p.name === openName) ?? null;

  return <section aria-labelledby="maps-title" className={`vp-appview${open ? "" : " vp-appview--fixed vp-maps"}`}>
    <PhoneAppHeader title={open ? open.name : "Maps"} titleId="maps-title" closeLabel="Close Maps" onBack={() => open ? setOpenName(null) : onBack()} onClose={onClose}
      actions={open ? [] : [{ id: "refresh", icon: "refresh", label: "Search", kind: "button", disabled: loading || !query.trim(), reason: "Type what to look for first" }]} onAction={() => search()} />
    {notice ? <p role="status" className="vp-muted-note">{notice}</p> : null}
    {open ? (
      <div className="vp-stack" style={{ gap: "0.75rem" }}>
        <div className="vp-map-canvas vp-map-canvas--detail"><span className="vp-map-pin is-open" aria-hidden="true">{emojiFor(`${open.category} ${open.name}`, "📍")}</span></div>
        <div className="vp-card vp-stack" style={{ gap: "0.35rem" }}><span className="vp-section-label">{open.category}</span><h3 style={{ margin: 0 }}>{open.name}</h3>{open.detail ? <p className="vp-thread-preview" style={{ whiteSpace: "normal" }}>{open.detail}</p> : null}<span className="vp-muted-note">Directions looked up — the story knows you checked.</span></div>
      </div>
    ) : (
      <>
        <form className="vp-composer" onSubmit={(e) => { e.preventDefault(); search(); }}><label style={{ flex: 1 }}><span className="vp-sr-only">Search Maps</span><input className="vp-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search places nearby" /></label><button className="vp-icon-btn" aria-label="Search" type="submit"><Search size="1rem" aria-hidden="true" /></button></form>
        {/* The map is the app. Results ride over it on a sheet, the way every maps app does it. */}
        <div className="vp-map-canvas vp-map-canvas--full" role="img" aria-label="Map of nearby places">
          {places.map((p) => <button key={p.name} type="button" className="vp-map-pin" style={pin(p.name)} aria-label={`${p.name}, ${p.category}`} onClick={() => route(p)}>{emojiFor(`${p.category} ${p.name}`, "📍")}</button>)}
        </div>
        <div className="vp-map-sheet">
          <span className="vp-sheet-grip" aria-hidden="true" />
          {places.length === 0 && !loading ? (
            <PhoneEmptyState icon={MapPinned} title="Nothing dropped yet" body="Search for what would be nearby in this world — a bar, a clinic, the street the scene is on." />
          ) : (
            <div className="vp-list vp-list--inset-rules">{places.map((p) => (
              <button key={p.name} type="button" className="vp-thread-row" onClick={() => route(p)}>
                <span className="vp-emoji-thumb vp-listing-thumb" role="img" aria-label={`Picture: ${p.name}`}>{emojiFor(`${p.category} ${p.name}`, "📍")}</span>
                <span className="vp-thread-body"><span className="vp-thread-name">{p.name}</span><span className="vp-thread-preview">{p.category}{p.detail ? ` · ${p.detail}` : ""}</span></span>
                <Navigation size="0.9rem" aria-hidden="true" className="vp-row-chevron" />
              </button>
            ))}</div>
          )}
        </div>
      </>
    )}
  </section>;
}
