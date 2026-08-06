import React from "react";
import { Search, Settings, Store } from "lucide-react";
import type { AppManifest } from "../../platform/app-manifest";
import { modelUseLabel } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";

function appIconClass(appId: string) {
  if (appId === "settings") return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
  if (appId === "app-store") return "bg-sky-500/20 text-sky-700 dark:text-sky-300";
  if (appId === "goodle") return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
  return "bg-[var(--vp-bg)] text-[var(--vp-text)]";
}

interface AppStoreShellProps {
  apps: Array<{ manifest: AppManifest; installed: boolean }>;
  onInstalledChange: (appId: string, installed: boolean) => void;
  onClose: () => void;
}

export function AppStoreShell({ apps, onInstalledChange, onClose }: AppStoreShellProps) {
  return (
    <section aria-labelledby="app-store-title" className="absolute inset-0 z-10 overflow-y-auto bg-[var(--vp-bg)] p-5">
      <PhoneAppHeader title="App Store" titleId="app-store-title" closeLabel="Close App Store" onClose={onClose} />
      <div className="space-y-2">
        {apps.map(({ manifest, installed }) => (
          <article key={manifest.id} className="flex min-h-20 items-center gap-3 rounded-lg border border-black/10 bg-[var(--vp-surface)] p-3">
            <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${appIconClass(manifest.id)}`} aria-hidden="true">{manifest.id === "settings" ? <Settings size="1rem" /> : manifest.id === "app-store" ? <Store size="1rem" /> : manifest.id === "goodle" ? <Search size="1rem" /> : <Store size="1rem" />}</span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-semibold">{manifest.name}</h3>
              <p className="mt-1 text-[0.6875rem] text-[var(--vp-muted)]">{modelUseLabel(manifest.modelUse)}</p>
            </div>
            {manifest.removable ? <button type="button" onClick={() => onInstalledChange(manifest.id, !installed)} className="min-h-9 rounded-md bg-[var(--vp-accent)] px-3 text-[0.6875rem] font-semibold text-white">{installed ? "Remove" : "Install"}</button> : <span className="text-[0.6875rem] font-medium text-[var(--vp-muted)]">Installed</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
