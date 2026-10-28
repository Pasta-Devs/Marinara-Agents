import React from "react";
import { Check, ChevronRight, Search, ShieldCheck, Sparkles } from "lucide-react";
import type { AppManifest } from "../../platform/app-manifest";
import { PhoneAppHeader } from "../../platform/app-header";
import { PhoneEmptyState } from "../../platform/empty-state";
import { appGlyph, appIconClass } from "../../platform/app-icons";
import { appDescription, capabilitySummary, modelUseLabel, privacyLabel, storyImpactLabel } from "./manifest";

type StoreApp = { manifest: AppManifest; installed: boolean };

interface AppStoreShellProps {
  apps: StoreApp[];
  onInstalledChange: (appId: string, installed: boolean) => void;
  onOpenApp: (appId: string) => void;
  onBack: () => void;
  onClose: () => void;
}

function titleCase(value: string) {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value;
}

function AppIcon({ manifest, large = false }: { manifest: AppManifest; large?: boolean }) {
  return (
    <span className={`vp-card-icon ${large ? "vp-store-icon--large" : ""} ${appIconClass(manifest.id)}`} aria-hidden="true">
      {React.createElement(appGlyph(manifest.id), { size: large ? "1.5rem" : "1rem" })}
    </span>
  );
}

export function AppStoreShell({ apps, onInstalledChange, onOpenApp, onBack, onClose }: AppStoreShellProps) {
  const [query, setQuery] = React.useState("");
  const [section, setSection] = React.useState<"discover" | "installed">("discover");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = apps.find(({ manifest }) => manifest.id === openId) ?? null;
  const installedCount = apps.filter(({ installed }) => installed).length;

  const remove = (manifest: AppManifest) => {
    if (!window.confirm(`Remove ${manifest.name} from this phone? Its saved information will stay here if you install it again.`)) return;
    onInstalledChange(manifest.id, false);
    setOpenId(null);
  };

  const needle = query.trim().toLocaleLowerCase();
  const searched = apps.filter(({ manifest }) => {
    if (!needle) return true;
    return [manifest.name, manifest.category, appDescription(manifest.id)]
      .some((value) => value.toLocaleLowerCase().includes(needle));
  });
  const visible = section === "installed" ? searched.filter(({ installed }) => installed) : searched;
  const categories = [...new Set(visible.map(({ manifest }) => manifest.category))].sort();

  const installButton = ({ manifest, installed }: StoreApp) => installed ? (
    <button type="button" onClick={() => onOpenApp(manifest.id)} className="vp-store-get">Open</button>
  ) : (
    <button type="button" onClick={() => onInstalledChange(manifest.id, true)} className="vp-store-get" aria-label={`Install ${manifest.name}`}>Get</button>
  );

  const row = (app: StoreApp) => {
    const { manifest, installed } = app;
    return (
      <article key={manifest.id} className="vp-store-row">
        <button type="button" className="vp-store-row-main" onClick={() => setOpenId(manifest.id)} aria-label={`View ${manifest.name}`}>
          <AppIcon manifest={manifest} />
          <span className="vp-store-row-copy">
            <strong>{manifest.name}</strong>
            <small>{appDescription(manifest.id)}</small>
            <span>{modelUseLabel(manifest.modelUse)}</span>
          </span>
          <ChevronRight size="0.875rem" aria-hidden="true" />
        </button>
        <div className="vp-store-actions">{installButton(app)}</div>
      </article>
    );
  };

  return (
    <section aria-labelledby="app-store-title" className="vp-appview" data-phone-app="app-store">
      <PhoneAppHeader
        title={open ? open.manifest.name : "App Store"}
        titleId="app-store-title"
        closeLabel="Close App Store"
        onBack={() => open ? setOpenId(null) : onBack()}
        onClose={onClose}
      />

      {open ? (
        <div className="vp-store-detail">
          <div className="vp-store-detail-hero">
            <AppIcon manifest={open.manifest} large />
            <div>
              <h3>{open.manifest.name}</h3>
              <p>{titleCase(open.manifest.category)}</p>
            </div>
            {installButton(open)}
          </div>

          <p className="vp-store-description">{appDescription(open.manifest.id) || "No description available."}</p>

          <section aria-labelledby="store-access-title">
            <h3 id="store-access-title" className="vp-section-label">Before you install</h3>
            <div className="vp-store-disclosures">
              <div><Sparkles size="1rem" aria-hidden="true" /><span><strong>How it responds</strong><small>{modelUseLabel(open.manifest.modelUse)}</small></span></div>
              <div><ShieldCheck size="1rem" aria-hidden="true" /><span><strong>Data</strong><small>{privacyLabel(open.manifest)}</small></span></div>
              <div><Check size="1rem" aria-hidden="true" /><span><strong>Roleplay</strong><small>{storyImpactLabel(open.manifest)}</small></span></div>
            </div>
          </section>

          <section aria-labelledby="store-access-list-title">
            <h3 id="store-access-list-title" className="vp-section-label">Access</h3>
            <div className="vp-group">
              {capabilitySummary(open.manifest).map((item) => <p key={item} className="vp-store-access-row">{item}</p>)}
            </div>
          </section>

          {open.installed && open.manifest.removable ? (
            <button type="button" onClick={() => remove(open.manifest)} className="vp-store-remove-wide">Remove App</button>
          ) : null}
          {!open.manifest.removable ? <p className="vp-muted-note vp-store-system-note">Built into this phone. This app cannot be removed.</p> : null}
        </div>
      ) : (
        <>
          <label className="vp-store-search">
            <Search size="0.875rem" aria-hidden="true" />
            <span className="vp-sr-only">Search apps</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" />
          </label>

          <div className="vp-filter-tabs" role="tablist" aria-label="App Store section">
            <button type="button" role="tab" aria-selected={section === "discover"} onClick={() => setSection("discover")}>Discover</button>
            <button type="button" role="tab" aria-selected={section === "installed"} onClick={() => setSection("installed")}>Installed · {installedCount}</button>
          </div>

          {!query && section === "discover" ? (
            <div className="vp-store-intro">
              <Sparkles size="1.125rem" aria-hidden="true" />
              <div><strong>Apps for this phone</strong><span>Add tools, social spaces, and story features. Products are sold in Shop; used listings belong in Bazaar.</span></div>
            </div>
          ) : null}

          {visible.length === 0 ? (
            <PhoneEmptyState
              icon={Search}
              title={section === "installed" ? "No installed app found" : "No app found"}
              body={query ? "Try an app name, category, or what you want to do." : "Installed apps will appear here."}
            />
          ) : categories.map((category) => (
            <section key={category} className="vp-store-category">
              <h3 className="vp-section-label">{titleCase(category)}</h3>
              <div className="vp-store-list">{visible.filter(({ manifest }) => manifest.category === category).map(row)}</div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
