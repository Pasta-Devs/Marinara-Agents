import { type ReactNode } from "react";
import { BookOpen, CalendarDays, Coins, Megaphone, MessageCircle, Tags, UsersRound } from "lucide-react";
import { BackstagePageHeader, SummaryRow, type SummaryTone } from "../../modules/settings/SlpSettingsKit";
import { outcomeSummary } from "./SlpBackstagePreview";
import type { SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";






import { slurpActivePlatformEvents } from "../../../../../shared/src/slp/slp-platform-events.js";









import type { SlpBackstagePageProps } from "./slp-backstage-contract";



/** Features landing page: one row per area, plus the libraries that live behind them. */
export function SlpBackstageWorldPanel(page: SlpBackstagePageProps) {
  const {
    t,
    target,
    adPool,
    settings,
    creators,
  } = page;
  const go = (next: SlpBackstageTarget) => page.onNavigate({ ...page.navigation, section: "world", target: next });
  const onOff = (value: boolean) => (value ? t("ui.slurp.settings.overview.on") : t("ui.slurp.settings.overview.off"));
  const worldRows: Array<{
    target: SlpBackstageTarget;
    icon: ReactNode;
    title: string;
    status: string;
    tone: SummaryTone;
  }> = [
    {
      target: "audience",
      icon: <UsersRound size={20} />,
      title: t("ui.slurp.settings.backstage.landing.audience", { defaultValue: "Audience" }),
      status: onOff(settings.fanActivityEnabled),
      tone: settings.fanActivityEnabled ? "ok" : "off",
    },
    {
      target: "arcs",
      icon: <BookOpen size={20} />,
      title: t("ui.slurp.settings.backstage.landing.stories", { defaultValue: "Arcs" }),
      status: t(
        `ui.slurp.settings.arcAutoMode${settings.arcAutoMode === "off" ? "Off" : settings.arcAutoMode === "suggest" ? "Suggest" : "Auto"}`,
      ),
      tone: settings.arcAutoMode === "off" ? "off" : "info",
    },
    {
      target: "tags",
      icon: <Tags size={20} />,
      title: t("ui.slurp.settings.backstage.landing.discovery", { defaultValue: "Discovery tags" }),
      status: String(settings.discoveryTags.length),
      tone: settings.discoveryTags.length ? "info" : "warning",
    },
    {
      target: "events",
      icon: <CalendarDays size={20} />,
      title: t("ui.slurp.settings.backstage.landing.events", { defaultValue: "Events and holidays" }),
      status: String(slurpActivePlatformEvents(settings.platformEvents, new Date()).length),
      tone: slurpActivePlatformEvents(settings.platformEvents, new Date()).length ? "ok" : "off",
    },
    {
      target: "messaging",
      icon: <MessageCircle size={20} />,
      title: t("ui.slurp.settings.backstage.landing.messaging", { defaultValue: "Messaging rules" }),
      status: t(
        `ui.slurp.settings.messaging.dmPolicy${settings.messagesDefaultDmPolicy.charAt(0).toUpperCase()}${settings.messagesDefaultDmPolicy.slice(1)}`,
      ),
      tone: "info",
    },
    {
      target: "wallet",
      icon: <Coins size={20} />,
      title: t("ui.slurp.settings.backstage.landing.coins", { defaultValue: "Coins and access" }),
      status: onOff(settings.walletEnabled),
      tone: settings.walletEnabled ? "ok" : "off",
    },
    {
      target: "ads",
      icon: <Megaphone size={20} />,
      title: t("ui.slurp.settings.backstage.landing.ads", { defaultValue: "Ads" }),
      status: onOff(settings.inlineAdsEnabled),
      tone: settings.inlineAdsEnabled ? "ok" : "off",
    },
  ];
  const libraries: Array<{ target: SlpBackstageTarget; label: string; count: number }> = [
    {
      target: "audience",
      label: t("ui.slurp.settings.backstage.landing.fanTypes", { defaultValue: "Fan types" }),
      count: settings.fanTypes.length,
    },
    {
      target: "audience",
      label: t("ui.slurp.settings.backstage.landing.reactions", { defaultValue: "Reaction bank" }),
      count: settings.audienceReactionBank.shared.length,
    },
    {
      target: "arcs",
      label: t("ui.slurp.settings.backstage.landing.arcLibrary", { defaultValue: "Arc library" }),
      count: settings.arcLibrary.length,
    },
    {
      target: "tags",
      label: t("ui.slurp.settings.backstage.landing.tagLibrary", { defaultValue: "Tags" }),
      count: settings.discoveryTags.length,
    },
    {
      target: "ads",
      label: t("ui.slurp.settings.backstage.landing.adPool", { defaultValue: "Ad pool" }),
      count: adPool.data?.items.length ?? 0,
    },
  ];
  return (
        <div className="space-y-4">
          <BackstagePageHeader
            title={t("ui.slurp.settings.backstage.sections.world")}
            detail={t("ui.slurp.settings.backstage.landing.worldDetail", {
              defaultValue: "Shape how your Slurp feels. Open an area to change it.",
            })}
            scope="all-slurp"
          />
          {worldRows.map((row) => (
            <SummaryRow
              key={row.target}
              icon={row.icon}
              title={row.title}
              status={row.status}
              tone={row.tone}
              value={outcomeSummary(t, row.target, settings, creators.length)}
              onOpen={() => go(row.target)}
            />
          ))}
          <section
            className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
            aria-labelledby="slurp-world-libraries"
          >
            <h2 id="slurp-world-libraries" className="text-sm font-black">
              {t("ui.slurp.settings.backstage.landing.libraries", { defaultValue: "Libraries" })}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {libraries.map((library) => (
                <button
                  key={library.label}
                  type="button"
                  onClick={() => go(library.target)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--slurp-canvas)] px-4 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                >
                  {library.label}
                  <span className="tabular-nums text-[var(--slurp-muted)]">{library.count}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
  );
}
