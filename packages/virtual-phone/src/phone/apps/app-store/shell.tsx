import React from "react";
import { AtSign, BookUser, Camera, Flame, Images, Lock, Mail, MessageCircle, MessagesSquare, Search, Settings, StickyNote, Store } from "lucide-react";
import type { AppManifest } from "../../platform/app-manifest";
import { modelUseLabel } from "./manifest";
import { PhoneAppHeader } from "../../platform/app-header";

const styledAppIds = new Set(["settings", "app-store", "goodle", "messages", "notes", "noodler", "contacts", "mail", "gallery", "tindler", "noodler-r", "forum", "camera"]);
const appGlyphs: Record<string, typeof Store> = {
  settings: Settings,
  goodle: Search,
  messages: MessageCircle,
  notes: StickyNote,
  noodler: AtSign,
  contacts: BookUser,
  mail: Mail,
  gallery: Images,
  tindler: Flame,
  "noodler-r": Lock,
  forum: MessagesSquare,
  camera: Camera,
};

function appIconClass(appId: string) {
  return styledAppIds.has(appId) ? `vp-app-icon--${appId}` : "vp-app-icon--default";
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
            <span className={`vp-card-icon ${appIconClass(manifest.id)}`} aria-hidden="true">{React.createElement(appGlyphs[manifest.id] ?? Store, { size: "1rem" })}</span>
            <div className="vp-card-body">
              <h3>{manifest.name}</h3>
              <p>{manifest.category[0]?.toUpperCase()}{manifest.category.slice(1)} · {modelUseLabel(manifest.modelUse)}</p>
            </div>
            {manifest.removable ? <button type="button" onClick={() => onInstalledChange(manifest.id, !installed)} className="vp-accent-btn">{installed ? "Remove" : "Install"}</button> : <span className="vp-muted-note">Installed</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
