import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpStoryPacksPanel } from "./SlpStoryPacksPanel";

export function SlpPacksPanel({ settings }: SlpBackstagePageProps) {
  return (
    <div className="space-y-6">
      <BackstagePageHeader
        title="Packs"
        detail="Optional, reusable content. Import a Pack to review its Occasions and Plan templates before you add them."
        scope="all-slurp"
      />
      <SlpStoryPacksPanel arcs={settings.arcLibrary} events={settings.platformEvents} />
    </div>
  );
}
