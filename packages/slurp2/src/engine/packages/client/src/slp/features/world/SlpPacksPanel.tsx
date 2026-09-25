import { BackstagePageHeader } from "../../modules/settings/SlpSettingsKit";
import type { SlpBackstagePageProps } from "../backstage/slp-backstage-contract";
import { SlpStoryPacksPanel } from "./SlpStoryPacksPanel";

export function SlpPacksPanel({ settings }: SlpBackstagePageProps) {
  return (
    <div className="space-y-6">
      <BackstagePageHeader detail="Optional, reusable content. Import a Pack to review its Events and Storyline types before you add them." />
      <SlpStoryPacksPanel arcs={settings.arcLibrary} events={settings.platformEvents} />
    </div>
  );
}
