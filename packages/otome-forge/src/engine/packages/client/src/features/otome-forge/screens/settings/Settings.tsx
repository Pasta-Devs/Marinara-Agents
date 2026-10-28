// ──────────────────────────────────────────────
// Otome Forge: Settings. Tabs for the look, the current story's content, connections, images and audio, Privacy &
// data, and Debug. Story settings edit the active run; the look and the 18+ confirmation are the player's own.
// ──────────────────────────────────────────────
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioLines,
  Bug,
  Images,
  Palette,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { LookSwitch } from "../../components/LookSwitch";
import type { LookPreference } from "../../hooks/use-look";
import type { RunView } from "../../shared/api-types";
import { AudioSettings } from "./Audio";
import { ConnectionsSettings } from "./Connections";
import { ContentSettings } from "./ContentSettings";
import { DebugSettings } from "./Debug";
import { ImagesSettings } from "./Images";
import { PrivacyData } from "./PrivacyData";

const TABS = ["look", "content", "connections", "images", "audio", "privacy", "debug"] as const;
type Tab = (typeof TABS)[number];

const TAB_META: Record<Tab, { labelKey: string; Icon: LucideIcon }> = {
  look: { labelKey: "ui.otomeForge.settings.tabLook", Icon: Palette },
  content: { labelKey: "ui.otomeForge.settings.tabContent", Icon: SlidersHorizontal },
  connections: { labelKey: "ui.otomeForge.settings.tabConnections", Icon: PlugZap },
  images: { labelKey: "ui.otomeForge.settings.tabImages", Icon: Images },
  audio: { labelKey: "ui.otomeForge.audio.tab", Icon: AudioLines },
  privacy: { labelKey: "ui.otomeForge.settings.tabPrivacy", Icon: ShieldCheck },
  debug: { labelKey: "ui.otomeForge.settings.tabDebug", Icon: Bug },
};

interface SettingsProps {
  /** The active story, or null when there is none (story tabs then say so). */
  run: RunView | null;
  lookPreference: LookPreference;
  onLookPreference: (preference: LookPreference) => void;
}

export function Settings({ run, lookPreference, onLookPreference }: SettingsProps) {
  const { t } = useTranslation();
  const id = useId();
  const [tab, setTab] = useState<Tab>("look");
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  // Arrow keys move between tabs (and select them), Home and End jump to the ends.
  const onKeyDown = (event: KeyboardEvent) => {
    const index = TABS.indexOf(tab);
    const rtl = (event.currentTarget as HTMLElement).closest("[dir]")?.getAttribute("dir") === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    const next =
      event.key === forward
        ? TABS[(index + 1) % TABS.length]
        : event.key === backward
          ? TABS[(index - 1 + TABS.length) % TABS.length]
          : event.key === "Home"
            ? TABS[0]
            : event.key === "End"
              ? TABS[TABS.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const panel =
    tab === "look" ? (
      <LookSwitch preference={lookPreference} onChange={onLookPreference} />
    ) : tab === "content" ? (
      <ContentSettings run={run} />
    ) : tab === "connections" ? (
      <ConnectionsSettings run={run} />
    ) : tab === "images" ? (
      <ImagesSettings run={run} />
    ) : tab === "audio" ? (
      <AudioSettings run={run} />
    ) : tab === "privacy" ? (
      <PrivacyData />
    ) : (
      <DebugSettings run={run} />
    );

  return (
    <div className="of-page of-settings">
      <div className="of-page-head of-page-head--compact">
        <h1 className="of-title of-title--page" tabIndex={-1}>
          {t("ui.otomeForge.common.screenSettings")}
        </h1>
        {run?.world.title ? (
          <p className="of-hint">{t("ui.otomeForge.settings.forStory", { title: run.world.title })}</p>
        ) : null}
      </div>
      <div
        className="of-tabs of-glass"
        role="tablist"
        aria-label={t("ui.otomeForge.common.screenSettings")}
        onKeyDown={onKeyDown}
      >
        {TABS.map((name) => {
          const { labelKey, Icon } = TAB_META[name];
          const selected = name === tab;
          return (
            <button
              key={name}
              ref={(element) => {
                tabRefs.current[name] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-${name}-tab`}
              className="of-tab"
              aria-selected={selected}
              aria-controls={`${id}-${name}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(name)}
            >
              <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </button>
          );
        })}
      </div>
      <div
        key={tab}
        id={`${id}-${tab}-panel`}
        className="of-tab-panel"
        role="tabpanel"
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
      >
        {panel}
      </div>
    </div>
  );
}
