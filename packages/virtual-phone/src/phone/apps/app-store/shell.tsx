import React from "react";
import { Search, Settings, Store } from "lucide-react";
import type { AppManifest } from "../../platform/app-manifest";
import { modelUseLabel } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";

function appIconClass(appId: string) {
  if (appId === "settings" || appId === "app-store" || appId === "goodle") return `vp-app-icon--${appId}`;
  return "vp-app-icon--default";
}

interface AppStoreShellProps {
  apps: Array<{ manifest: AppManifest; installed: boolean }>;
  onInstalledChange: (appId: string, installed: boolean) => void;
  onBack: () => void;
  onClose: () => void;
}

export function AppStoreShell({ apps, onInstalledChange, onBack, onClose }: AppStoreShellProps) {
  return (
    <section aria-labelledby="app-store-title" className="vp-appview">
      <PhoneAppHeader title="App Store" titleId="app-store-title" closeLabel="Close App Store" onBack={onBack} onClose={onClose} />
      <div className="vp-stack" style={{ gap: "0.5rem" }}>
        {apps.map(({ manifest, installed }) => (
          <article key={manifest.id} className="vp-card vp-card-row">
            <span className={`vp-card-icon ${appIconClass(manifest.id)}`} aria-hidden="true">{manifest.id === "settings" ? <Settings size="1rem" /> : manifest.id === "goodle" ? <Search size="1rem" /> : <Store size="1rem" />}</span>
            <div className="vp-card-body">
              <h3>{manifest.name}</h3>
              <p>{modelUseLabel(manifest.modelUse)}</p>
            </div>
            {manifest.removable ? <button type="button" onClick={() => onInstalledChange(manifest.id, !installed)} className="vp-accent-btn">{installed ? "Remove" : "Install"}</button> : <span className="vp-muted-note">Installed</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
