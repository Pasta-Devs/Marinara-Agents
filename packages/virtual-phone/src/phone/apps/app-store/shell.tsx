import React from "react";
import { Settings, Store, X } from "lucide-react";
import type { AppManifest } from "../../platform/app-manifest";
import { modelUseLabel } from "./manifest";

interface AppStoreShellProps {
  apps: Array<{ manifest: AppManifest; installed: boolean }>;
  onInstalledChange: (appId: string, installed: boolean) => void;
  onClose: () => void;
}

export function AppStoreShell({ apps, onInstalledChange, onClose }: AppStoreShellProps) {
  return (
    <section aria-labelledby="app-store-title" className="absolute inset-0 z-10 overflow-y-auto bg-[var(--vp-bg)] p-5">
      <header className="mb-5 flex min-h-11 items-center justify-between">
        <h2 id="app-store-title" className="text-sm font-semibold">App Store</h2>
        <button type="button" aria-label="Close App Store" onClick={onClose} className="inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-accent)]"><X size="1rem" aria-hidden="true" /></button>
      </header>
      <div className="space-y-2">
        {apps.map(({ manifest, installed }) => (
          <article key={manifest.id} className="flex min-h-20 items-center gap-3 rounded-lg border border-black/10 bg-[var(--vp-surface)] p-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--vp-bg)]" aria-hidden="true">{manifest.id === "settings" ? <Settings size="1rem" /> : <Store size="1rem" />}</span>
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
