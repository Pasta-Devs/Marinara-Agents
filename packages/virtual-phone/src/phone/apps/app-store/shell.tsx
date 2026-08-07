import React from "react";
import type { AppManifest } from "../../platform/app-manifest";
import { appDescription, modelUseLabel } from "./manifest";
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
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = apps.find(({ manifest }) => manifest.id === openId) ?? null;

  /** Removing an app can destroy that app's storage, so it asks first. Installing stays instant. */
  const remove = (manifest: AppManifest) => {
    if (!window.confirm(`Remove ${manifest.name}? Anything it saved on this phone goes with it.`)) return;
    onInstalledChange(manifest.id, false);
    setOpenId(null);
  };
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? apps.filter(({ manifest }) => manifest.name.toLowerCase().includes(needle) || manifest.category.toLowerCase().includes(needle))
    : apps;
  const categories = [...new Set(filtered.map(({ manifest }) => manifest.category))].sort();
  const featured = !needle ? apps.filter(({ manifest, installed }) => !installed && manifest.removable) : [];

  const row = ({ manifest, installed }: { manifest: AppManifest; installed: boolean }) => (
    <article key={manifest.id} className="vp-card vp-card-row">
      <span className={`vp-card-icon ${appIconClass(manifest.id)}`} aria-hidden="true">{React.createElement(appGlyph(manifest.id), { size: "1rem" })}</span>
      <button type="button" className="vp-card-body" onClick={() => setOpenId(manifest.id)} style={{ textAlign: "left", background: "none", border: 0, font: "inherit", color: "inherit", cursor: "pointer" }}>
        <h3>{manifest.name}</h3>
        <p>{titleCase(manifest.category)} · {modelUseLabel(manifest.modelUse)}</p>
      </button>
      <div className="vp-store-actions">
        {installed
          ? <button type="button" onClick={() => onOpenApp(manifest.id)} className="vp-accent-btn">Open</button>
          : <button type="button" onClick={() => onInstalledChange(manifest.id, true)} className="vp-accent-btn">Get</button>}
        {installed && manifest.removable
          ? <button type="button" onClick={() => remove(manifest)} className="vp-store-remove">Remove</button>
          : null}
      </div>
    </article>
  );

  return (
    <section aria-labelledby="app-store-title" className="vp-appview">
      <PhoneAppHeader
        title={open ? open.manifest.name : "App Store"}
        titleId="app-store-title"
        closeLabel="Close App Store"
        onBack={() => open ? setOpenId(null) : onBack()}
        onClose={onClose}
      />
      {open ? (
        <div className="vp-stack" style={{ gap: "0.75rem" }}>
          <div className="vp-card vp-card-row">
            <span className={`vp-card-icon ${appIconClass(open.manifest.id)}`} aria-hidden="true">{React.createElement(appGlyph(open.manifest.id), { size: "1rem" })}</span>
            <div className="vp-card-body">
              <h3>{open.manifest.name}</h3>
              <p>{titleCase(open.manifest.category)} · {modelUseLabel(open.manifest.modelUse)}</p>
            </div>
          </div>
          <p className="vp-page-body">{appDescription(open.manifest.id) || "No description available."}</p>
          <div className="vp-store-actions">
            {open.installed
              ? <button type="button" onClick={() => onOpenApp(open.manifest.id)} className="vp-accent-btn">Open</button>
              : <button type="button" onClick={() => onInstalledChange(open.manifest.id, true)} className="vp-accent-btn">Get</button>}
            {open.installed && open.manifest.removable
              ? <button type="button" onClick={() => remove(open.manifest)} className="vp-store-remove">Remove</button>
              : null}
          </div>
          {open.manifest.removable ? null : <p className="vp-muted-note">This app is part of the phone and cannot be removed.</p>}
        </div>
      ) : (
      <>
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
      </>
      )}
    </section>
  );
}
