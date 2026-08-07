import React from "react";
import type { AppManifest } from "../../platform/app-manifest";
import { modelUseLabel } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";
import { appGlyph, appIconClass } from "../../platform/app-icons";

function titleCase(value: string) {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

interface AppStoreShellProps {
  apps: Array<{ manifest: AppManifest; installed: boolean }>;
  onInstalledChange: (appId: string, installed: boolean) => void;
  onOpenApp: (appId: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export function AppStoreShell({ apps, onInstalledChange, onOpenApp, onBack, onClose }: AppStoreShellProps) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? apps.filter(({ manifest }) => manifest.name.toLowerCase().includes(needle) || manifest.category.toLowerCase().includes(needle))
    : apps;
  const categories = [...new Set(filtered.map(({ manifest }) => manifest.category))].sort();
  const featured = !needle ? apps.filter(({ manifest, installed }) => !installed && manifest.removable) : [];

  const row = ({ manifest, installed }: { manifest: AppManifest; installed: boolean }) => (
    <article key={manifest.id} className="vp-card vp-card-row">
      <span className={`vp-card-icon ${appIconClass(manifest.id)}`} aria-hidden="true">{React.createElement(appGlyph(manifest.id), { size: "1rem" })}</span>
      <div className="vp-card-body">
        <h3>{manifest.name}</h3>
        <p>{titleCase(manifest.category)} · {modelUseLabel(manifest.modelUse)}</p>
      </div>
      <div className="vp-store-actions">
        {installed
          ? <button type="button" onClick={() => onOpenApp(manifest.id)} className="vp-accent-btn">Open</button>
          : <button type="button" onClick={() => onInstalledChange(manifest.id, true)} className="vp-accent-btn">Get</button>}
        {installed && manifest.removable
          ? <button type="button" onClick={() => onInstalledChange(manifest.id, false)} className="vp-store-remove">Remove</button>
          : null}
      </div>
    </article>
  );

  return (
    <section aria-labelledby="app-store-title" className="vp-appview">
      <PhoneAppHeader title="App Store" titleId="app-store-title" closeLabel="Close App Store" onBack={onBack} onClose={onClose} />
      <div className="vp-search-go" style={{ marginBottom: "0.75rem" }}>
        <label><span className="vp-sr-only">Search apps</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" className="vp-input" /></label>
      </div>
      {featured.length ? (
        <>
          <h3 className="vp-section-label">Not on this phone</h3>
          <div className="vp-stack" style={{ gap: "0.5rem", marginTop: "0.625rem", marginBottom: "0.875rem" }}>
            {featured.map(row)}
          </div>
        </>
      ) : null}
      {filtered.length === 0 ? <p className="vp-muted-note">No apps match "{query}".</p> : null}
      {categories.map((category) => (
        <React.Fragment key={category}>
          <h3 className="vp-section-label">{titleCase(category)}</h3>
          <div className="vp-stack" style={{ gap: "0.5rem", marginTop: "0.625rem", marginBottom: "0.875rem" }}>
            {filtered.filter(({ manifest }) => manifest.category === category).map(row)}
          </div>
        </React.Fragment>
      ))}
    </section>
  );
}
