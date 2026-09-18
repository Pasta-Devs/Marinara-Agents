import { useState, type ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Coins,
  Image,
  Megaphone,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Tags,
  Trash2,
  UsersRound,
} from "lucide-react";
import { BackstagePageHeader, BackstageWizard, FineTune, SummaryRow, type SummaryTone } from "./SlurpBackstageKit";
import { outcomeSummary } from "./SlurpBackstageChrome";
import type { SlurpBackstageTarget } from "./slurp-backstage";
import { Field, GuidanceBox, NumberSetting, SettingsGroup, Toggle } from "./SlurpSettingsControls";
import { SlurpSimulationSettings } from "./SlurpSimulationSettings";
import { SlurpFanTypesSettings } from "./SlurpFanTypesSettings";
import { SlurpAudienceConfigSettings } from "./SlurpAudienceConfigSettings";
import { SlurpTagsSettings } from "./SlurpTagsSettings";
import { SlurpPlatformEventsSettings } from "./SlurpPlatformEventsSettings";
import { slurpActivePlatformEvents } from "../../../../server/src/services/slurp/slurp-platform-events.js";
import { api } from "../../lib/api-client";
import { toast } from "sonner";
import { SettingAnchor } from "./SlurpBackstageKit";
import {
  type SlurpSettings,
  type SlurpContentRating,
  type SlurpAudienceCharacterGroup,
  type SlurpAudienceCharacterSummary,
  useSlurpAudienceCharacters,
  useSlurpAudienceCharacterGroups,
} from "../../hooks/use-slurp";
import { SlurpMediaImg } from "./SlurpShell";
import {
  SLURP_AUDIENCE_PRESETS,
  slurpAudiencePresetPatch,
} from "../../../../server/src/services/slurp/slurp-tuning.js";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { errorMessage, ChoiceRow, ArcLibraryEditor, AmbientProfilesPanel } from "./SlurpBackstageWorkflow";

/** Slurp world: discovery, stories, messaging, coins, ads, and audience. */
export function SlurpBackstageWorld(page: SlurpBackstagePageProps) {
  const {
    viewerPersonaId,
    t,
    updateSettings,
    target,
    resetAds,
    adPool,
    generateAds,
    importAds,
    createAd,
    customAdOpen,
    setCustomAdOpen,
    customAd,
    setCustomAd,
    adsImportRef,
    adState,
    unhideBrand,
    deleteAd,
    updateAd,
    editingAd,
    setEditingAd,
    generateAdImage,
    adLorebooks,
    syncAdLorebook,
    imageConnections,
    settings,
    selectedCreatorId,
    adsWorldDraft,
    setAdsWorldDraft,
    reactionBankDraft,
    setReactionBankDraft,
    update,
    updatePatch,
    fanStatusQuery,
    refreshFans,
    connectionsQuery,
    creators,
    audiencePreset,
  } = page;
  const audienceCharactersQuery = useSlurpAudienceCharacters();
  const audienceCharacterGroupsQuery = useSlurpAudienceCharacterGroups();
  const audienceCharacters =
    audienceCharactersQuery.data?.pages.flatMap(
      (page: { characters: SlurpAudienceCharacterSummary[] }) => page.characters,
    ) ?? [];
  const audienceCharacterGroups = audienceCharacterGroupsQuery.data?.groups ?? [];
  const [audienceWizardOpen, setAudienceWizardOpen] = useState(false);
  const [audienceDraft, setAudienceDraft] = useState<{
    preset: (typeof SLURP_AUDIENCE_PRESETS)[number];
    platformScale: SlurpSettings["platformScale"];
    audienceTone: SlurpSettings["audienceTone"];
  } | null>(null);
  const [messagingWizardOpen, setMessagingWizardOpen] = useState(false);
  const [messagingDraft, setMessagingDraft] = useState<Pick<
    SlurpSettings,
    | "messagesAwayRepliesEnabled"
    | "messagesDefaultDmPolicy"
    | "messagesReplyBubbleLimit"
    | "messagesMaxReplyDelayMinutes"
  > | null>(null);
  const go = (next: SlurpBackstageTarget) => page.onNavigate({ ...page.navigation, section: "world", target: next });
  const onOff = (value: boolean) => (value ? t("ui.slurp.settings.overview.on") : t("ui.slurp.settings.overview.off"));
  const worldRows: Array<{
    target: SlurpBackstageTarget;
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
  const libraries: Array<{ target: SlurpBackstageTarget; label: string; count: number }> = [
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
    <>
      {target === "world" && (
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
      )}

      {target === "tags" && (
        <SettingAnchor settingKey="discoveryTags">
          <SlurpTagsSettings
            tags={settings.discoveryTags}
            saving={updateSettings.isPending}
            onSave={(tags) => update("discoveryTags", tags)}
          />
        </SettingAnchor>
      )}

      {target === "events" && (
        <SettingAnchor settingKey="platformEvents">
          <SlurpPlatformEventsSettings
            events={settings.platformEvents}
            saving={updateSettings.isPending}
            onSave={(events) => update("platformEvents", events)}
          />
        </SettingAnchor>
      )}

      {target === "arcs" && (
        <div className="space-y-6">
          <BackstagePageHeader title={t("ui.slurp.settings.arcs.title")} detail={t("ui.slurp.settings.arcs.detail")} />
          <GuidanceBox
            title={t("ui.slurp.settings.arcs.guideTitle", { defaultValue: "Set the story rules once" })}
            detail={t("ui.slurp.settings.arcs.guideDetail", {
              defaultValue:
                "These settings apply to every Creator. Use the Creator arc settings to make one profile different.",
            })}
          />
          <SettingsGroup title={t("ui.slurp.settings.arcs.behaviorGroup", { defaultValue: "Story behavior" })}>
            <Field
              settingKey="projectRate"
              label={t("ui.slurp.settings.projectRate")}
              detail={t("ui.slurp.settings.projectRateDetail")}
            >
              <select
                value={settings.projectRate}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("projectRate", event.target.value as SlurpSettings["projectRate"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="off">{t("ui.slurp.settings.projectRateOff")}</option>
                <option value="rare">{t("ui.slurp.settings.projectRateRare")}</option>
                <option value="regular">{t("ui.slurp.settings.projectRateRegular")}</option>
                <option value="often">{t("ui.slurp.settings.projectRateOften")}</option>
              </select>
            </Field>
            <Field
              settingKey="arcPace"
              label={t("ui.slurp.settings.arcPace")}
              detail={t("ui.slurp.settings.arcPaceDetail")}
            >
              <select
                value={settings.arcPace}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("arcPace", event.target.value as SlurpSettings["arcPace"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="slow">{t("ui.slurp.settings.arcPaceSlow")}</option>
                <option value="normal">{t("ui.slurp.settings.arcPaceNormal")}</option>
                <option value="fast">{t("ui.slurp.settings.arcPaceFast")}</option>
              </select>
            </Field>
            <Field
              settingKey="arcPollHours"
              label={t("ui.slurp.settings.arcPollHours")}
              detail={t("ui.slurp.settings.arcPollHoursDetail")}
            >
              <NumberSetting
                value={settings.arcPollHours}
                min={1}
                max={168}
                onSave={(value) => update("arcPollHours", value)}
              />
            </Field>
            <Field
              settingKey="arcStatEffects"
              label={t("ui.slurp.settings.arcStatEffects")}
              detail={t("ui.slurp.settings.arcStatEffectsDetail")}
            >
              <select
                value={settings.arcStatEffects}
                disabled={updateSettings.isPending}
                onChange={(event) =>
                  void update("arcStatEffects", event.target.value as SlurpSettings["arcStatEffects"])
                }
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="off">{t("ui.slurp.settings.arcStatEffectsOff")}</option>
                <option value="small">{t("ui.slurp.settings.arcStatEffectsSmall")}</option>
                <option value="big">{t("ui.slurp.settings.arcStatEffectsBig")}</option>
              </select>
            </Field>
            <Toggle
              settingKey="arcAffectsMood"
              label={t("ui.slurp.settings.arcAffectsMood")}
              detail={t("ui.slurp.settings.arcAffectsMoodDetail")}
              value={settings.arcAffectsMood}
              onChange={(value) => update("arcAffectsMood", value)}
            />
            <Toggle
              settingKey="arcDirectorMode"
              label={t("ui.slurp.settings.arcDirectorMode")}
              detail={t("ui.slurp.settings.arcDirectorModeDetail")}
              value={settings.arcDirectorMode}
              onChange={(value) => update("arcDirectorMode", value)}
            />
            <Toggle
              settingKey="arcFanReactions"
              label={t("ui.slurp.settings.arcFanReactions")}
              detail={t("ui.slurp.settings.arcFanReactionsDetail")}
              value={settings.arcFanReactions}
              onChange={(value) => update("arcFanReactions", value)}
            />
            <Toggle
              settingKey="arcCrossovers"
              label={t("ui.slurp.settings.arcCrossovers")}
              detail={t("ui.slurp.settings.arcCrossoversDetail")}
              value={settings.arcCrossovers}
              onChange={(value) => update("arcCrossovers", value)}
            />
          </SettingsGroup>
          <SettingsGroup title={t("ui.slurp.settings.arcs.automaticGroup", { defaultValue: "Automatic arcs" })}>
            <Field
              settingKey="arcAutoMode"
              label={t("ui.slurp.settings.arcAutoMode")}
              detail={t("ui.slurp.settings.arcAutoModeDetail")}
            >
              <select
                value={settings.arcAutoMode}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("arcAutoMode", event.target.value as SlurpSettings["arcAutoMode"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="off">{t("ui.slurp.settings.arcAutoModeOff")}</option>
                <option value="suggest">{t("ui.slurp.settings.arcAutoModeSuggest")}</option>
                <option value="auto">{t("ui.slurp.settings.arcAutoModeAuto")}</option>
              </select>
            </Field>
            {settings.arcAutoMode !== "off" && (
              <>
                <Field
                  settingKey="arcSource"
                  label={t("ui.slurp.settings.arcSource")}
                  detail={t("ui.slurp.settings.arcSourceDetail")}
                >
                  <select
                    value={settings.arcSource}
                    disabled={updateSettings.isPending}
                    onChange={(event) => void update("arcSource", event.target.value as SlurpSettings["arcSource"])}
                    className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                  >
                    <option value="library">{t("ui.slurp.projects.config.sourceLibrary")}</option>
                    <option value="generated">{t("ui.slurp.projects.config.sourceGenerated")}</option>
                    <option value="mixed">{t("ui.slurp.projects.config.sourceMixed")}</option>
                  </select>
                </Field>
                <Field
                  settingKey="arcCooldownWeeks"
                  label={t("ui.slurp.settings.arcCooldownWeeks")}
                  detail={t("ui.slurp.settings.arcCooldownWeeksDetail")}
                >
                  <NumberSetting
                    value={settings.arcCooldownWeeks}
                    min={1}
                    max={8}
                    onSave={(value) => update("arcCooldownWeeks", value)}
                  />
                </Field>
                <Field
                  settingKey="arcMaxConcurrentAuto"
                  label={t("ui.slurp.settings.arcMaxConcurrentAuto")}
                  detail={t("ui.slurp.settings.arcMaxConcurrentAutoDetail")}
                >
                  <NumberSetting
                    value={settings.arcMaxConcurrentAuto}
                    min={1}
                    max={20}
                    onSave={(value) => update("arcMaxConcurrentAuto", value)}
                  />
                </Field>
              </>
            )}
          </SettingsGroup>
          <div className="space-y-4 border-t border-[var(--slurp-outline)] pt-5">
            <div>
              <h3 className="text-base font-black">
                {t("ui.slurp.settings.arcLibrary", { defaultValue: "Arc library" })}
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.arcLibraryDetail", {
                  defaultValue: "Reusable story patterns for new arcs. Running arcs keep their current plan.",
                })}
              </p>
            </div>
            <SettingAnchor settingKey="arcLibrary">
              <ArcLibraryEditor
                library={settings.arcLibrary}
                tags={settings.discoveryTags.map((entry) => entry.tag)}
                busy={updateSettings.isPending}
                creatorAccountId={selectedCreatorId}
                personaId={viewerPersonaId}
                onChange={(arcLibrary) => update("arcLibrary", arcLibrary)}
              />
            </SettingAnchor>
          </div>
        </div>
      )}

      {target === "messaging" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <BackstagePageHeader
              title={t("ui.slurp.settings.messaging.title")}
              detail={t("ui.slurp.settings.messaging.detail")}
            />
            <button
              type="button"
              aria-expanded={messagingWizardOpen}
              onClick={() => {
                setMessagingDraft({
                  messagesAwayRepliesEnabled: settings.messagesAwayRepliesEnabled,
                  messagesDefaultDmPolicy: settings.messagesDefaultDmPolicy,
                  messagesReplyBubbleLimit: settings.messagesReplyBubbleLimit,
                  messagesMaxReplyDelayMinutes: settings.messagesMaxReplyDelayMinutes,
                });
                setMessagingWizardOpen((open) => !open);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <MessageCircle size={14} aria-hidden="true" />
              {t("ui.slurp.settings.backstage.wizard.messagingTitle", { defaultValue: "Set up messages" })}
            </button>
          </div>
          {messagingWizardOpen && messagingDraft && (
            <BackstageWizard
              title={t("ui.slurp.settings.backstage.wizard.messagingTitle", { defaultValue: "Set up messages" })}
              preset={null}
              current={settings}
              proposed={{ ...settings, ...messagingDraft }}
              patch={messagingDraft}
              pending={updateSettings.isPending}
              onCancel={() => setMessagingWizardOpen(false)}
              onApply={(patch) => {
                void updatePatch(patch);
                setMessagingWizardOpen(false);
              }}
              steps={[
                {
                  id: "access",
                  title: t("ui.slurp.settings.backstage.wizard.messagingAccess", {
                    defaultValue: "Choose who can message",
                  }),
                  content: (
                    <Field label={t("ui.slurp.settings.messaging.dmPolicy")}>
                      <select
                        value={messagingDraft.messagesDefaultDmPolicy}
                        onChange={(event) =>
                          setMessagingDraft({
                            ...messagingDraft,
                            messagesDefaultDmPolicy: event.target.value as SlurpSettings["messagesDefaultDmPolicy"],
                          })
                        }
                        className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm"
                      >
                        <option value="open">{t("ui.slurp.settings.messaging.dmPolicyOpen")}</option>
                        <option value="subscribers">{t("ui.slurp.settings.messaging.dmPolicySubscribers")}</option>
                        <option value="paid">{t("ui.slurp.settings.messaging.dmPolicyPaid")}</option>
                        <option value="closed">{t("ui.slurp.settings.messaging.dmPolicyClosed")}</option>
                      </select>
                    </Field>
                  ),
                },
                {
                  id: "replies",
                  title: t("ui.slurp.settings.backstage.wizard.messagingReplies", {
                    defaultValue: "Choose reply behavior",
                  }),
                  content: (
                    <div className="space-y-3">
                      <Toggle
                        label={t("ui.slurp.settings.messaging.awayReplies")}
                        detail={t("ui.slurp.settings.messaging.awayRepliesDetail")}
                        value={messagingDraft.messagesAwayRepliesEnabled}
                        onChange={(value) =>
                          setMessagingDraft({ ...messagingDraft, messagesAwayRepliesEnabled: value })
                        }
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t("ui.slurp.settings.messaging.bubbleLimit")}>
                          <NumberSetting
                            value={messagingDraft.messagesReplyBubbleLimit}
                            min={1}
                            max={4}
                            onSave={(value) =>
                              setMessagingDraft({ ...messagingDraft, messagesReplyBubbleLimit: value })
                            }
                          />
                        </Field>
                        <Field label={t("ui.slurp.settings.messaging.maxReplyDelay")}>
                          <NumberSetting
                            value={messagingDraft.messagesMaxReplyDelayMinutes}
                            min={0}
                            max={1440}
                            onSave={(value) =>
                              setMessagingDraft({ ...messagingDraft, messagesMaxReplyDelayMinutes: value })
                            }
                          />
                        </Field>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          )}
          <SettingsGroup title={t("ui.slurp.settings.messaging.repliesTitle")}>
            <Toggle
              settingKey="messagesAwayRepliesEnabled"
              label={t("ui.slurp.settings.messaging.awayReplies")}
              detail={t("ui.slurp.settings.messaging.awayRepliesDetail")}
              value={settings.messagesAwayRepliesEnabled}
              onChange={(value) => update("messagesAwayRepliesEnabled", value)}
            />
            <Field
              settingKey="messagesReplyBubbleLimit"
              label={t("ui.slurp.settings.messaging.bubbleLimit")}
              detail={t("ui.slurp.settings.messaging.bubbleLimitDetail")}
            >
              <NumberSetting
                value={settings.messagesReplyBubbleLimit}
                min={1}
                max={4}
                onSave={(value) => update("messagesReplyBubbleLimit", value)}
              />
            </Field>
          </SettingsGroup>
          <SettingsGroup title={t("ui.slurp.settings.messaging.delaysTitle")}>
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.messaging.delaysDetail")}
            </p>
            <Toggle
              settingKey="messagesUnscheduledAlwaysReachable"
              label={t("ui.slurp.settings.messaging.unscheduledAlwaysReachable")}
              detail={t("ui.slurp.settings.messaging.unscheduledAlwaysReachableDetail")}
              value={settings.messagesUnscheduledAlwaysReachable}
              onChange={(value) => update("messagesUnscheduledAlwaysReachable", value)}
            />
            <FineTune
              summary={t("ui.slurp.settings.backstage.landing.delayFineTune", { defaultValue: "Exact reply delays" })}
              count={10}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  settingKey="messagesUnknownReturnDelayMinutes"
                  label={t("ui.slurp.settings.messaging.unknownReturnDelay")}
                  detail={t("ui.slurp.settings.messaging.unknownReturnDelayDetail")}
                >
                  <NumberSetting
                    value={settings.messagesUnknownReturnDelayMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesUnknownReturnDelayMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesMaxReplyDelayMinutes"
                  label={t("ui.slurp.settings.messaging.maxReplyDelay")}
                  detail={t("ui.slurp.settings.messaging.maxReplyDelayDetail")}
                >
                  <NumberSetting
                    value={settings.messagesMaxReplyDelayMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesMaxReplyDelayMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesHighRapportDelayMinMinutes"
                  label={t("ui.slurp.settings.messaging.highRapportDelayMin")}
                  detail={t("ui.slurp.settings.messaging.highRapportDelayMinDetail")}
                >
                  <NumberSetting
                    value={settings.messagesHighRapportDelayMinMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesHighRapportDelayMinMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesHighRapportDelayMaxMinutes"
                  label={t("ui.slurp.settings.messaging.highRapportDelayMax")}
                  detail={t("ui.slurp.settings.messaging.highRapportDelayMaxDetail")}
                >
                  <NumberSetting
                    value={settings.messagesHighRapportDelayMaxMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesHighRapportDelayMaxMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesMediumRapportDelayMinMinutes"
                  label={t("ui.slurp.settings.messaging.mediumRapportDelayMin")}
                  detail={t("ui.slurp.settings.messaging.mediumRapportDelayMinDetail")}
                >
                  <NumberSetting
                    value={settings.messagesMediumRapportDelayMinMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesMediumRapportDelayMinMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesMediumRapportDelayMaxMinutes"
                  label={t("ui.slurp.settings.messaging.mediumRapportDelayMax")}
                  detail={t("ui.slurp.settings.messaging.mediumRapportDelayMaxDetail")}
                >
                  <NumberSetting
                    value={settings.messagesMediumRapportDelayMaxMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesMediumRapportDelayMaxMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesRecentPostAwayMinMinutes"
                  label={t("ui.slurp.settings.messaging.recentPostAwayMin")}
                  detail={t("ui.slurp.settings.messaging.recentPostAwayMinDetail")}
                >
                  <NumberSetting
                    value={settings.messagesRecentPostAwayMinMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesRecentPostAwayMinMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesRecentPostAwayMaxMinutes"
                  label={t("ui.slurp.settings.messaging.recentPostAwayMax")}
                  detail={t("ui.slurp.settings.messaging.recentPostAwayMaxDetail")}
                >
                  <NumberSetting
                    value={settings.messagesRecentPostAwayMaxMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesRecentPostAwayMaxMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesStalePostAwayMinMinutes"
                  label={t("ui.slurp.settings.messaging.stalePostAwayMin")}
                  detail={t("ui.slurp.settings.messaging.stalePostAwayMinDetail")}
                >
                  <NumberSetting
                    value={settings.messagesStalePostAwayMinMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesStalePostAwayMinMinutes", value)}
                  />
                </Field>
                <Field
                  settingKey="messagesStalePostAwayMaxMinutes"
                  label={t("ui.slurp.settings.messaging.stalePostAwayMax")}
                  detail={t("ui.slurp.settings.messaging.stalePostAwayMaxDetail")}
                >
                  <NumberSetting
                    value={settings.messagesStalePostAwayMaxMinutes}
                    min={0}
                    max={1440}
                    onSave={(value) => update("messagesStalePostAwayMaxMinutes", value)}
                  />
                </Field>
              </div>
            </FineTune>
          </SettingsGroup>
          <SettingsGroup title={t("ui.slurp.settings.messaging.defaultsTitle")}>
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.messaging.defaultsDetail")}
            </p>
            <Field
              settingKey="messagesDefaultDmPolicy"
              label={t("ui.slurp.settings.messaging.dmPolicy")}
              detail={t("ui.slurp.settings.messaging.dmPolicyDetail")}
            >
              <select
                value={settings.messagesDefaultDmPolicy}
                disabled={updateSettings.isPending}
                onChange={(event) =>
                  void update("messagesDefaultDmPolicy", event.target.value as SlurpSettings["messagesDefaultDmPolicy"])
                }
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="open">{t("ui.slurp.settings.messaging.dmPolicyOpen")}</option>
                <option value="subscribers">{t("ui.slurp.settings.messaging.dmPolicySubscribers")}</option>
                <option value="paid">{t("ui.slurp.settings.messaging.dmPolicyPaid")}</option>
                <option value="closed">{t("ui.slurp.settings.messaging.dmPolicyClosed")}</option>
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                settingKey="messagesDefaultRequestFee"
                label={t("ui.slurp.settings.messaging.requestFee")}
                detail={t("ui.slurp.settings.messaging.requestFeeDetail")}
              >
                <NumberSetting
                  value={settings.messagesDefaultRequestFee}
                  min={0}
                  max={9999}
                  onSave={(value) => update("messagesDefaultRequestFee", value)}
                />
              </Field>
              <Field
                settingKey="messagesDefaultPpvPrice"
                label={t("ui.slurp.settings.messaging.ppvPrice")}
                detail={t("ui.slurp.settings.messaging.ppvPriceDetail")}
              >
                <NumberSetting
                  value={settings.messagesDefaultPpvPrice}
                  min={0}
                  max={9999}
                  onSave={(value) => update("messagesDefaultPpvPrice", value)}
                />
              </Field>
            </div>
          </SettingsGroup>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.settings.messaging.clearHint")}
          </p>
        </div>
      )}

      {target === "wallet" && (
        <div className="space-y-5">
          <BackstagePageHeader
            title={t("ui.slurp.settings.wallet.title", { defaultValue: "SlurpCoins" })}
            detail={t("ui.slurp.settings.wallet.detail", {
              defaultValue: "Prices, earning, and the daily stipend.",
            })}
          />
          <div className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <p>
              {t("ui.slurp.settings.wallet.explainer", {
                defaultValue:
                  "With SlurpCoins off, prices are decoration and nothing is ever charged. With them on, unlocking a post and subscribing to a creator both cost SlurpCoins, and running out has consequences: a subscription you cannot pay for lapses.",
              })}
            </p>
            <p className="mt-2">
              {t("ui.slurp.settings.wallet.explainerEarning", {
                defaultValue:
                  "The daily stipend tops your balance up to a floor rather than adding to it, so a spender is never stranded and a hoarder is never paid to hoard. Ad and posting rewards are capped per day, so nothing here can be farmed.",
              })}
            </p>
          </div>
          <Toggle
            settingKey="walletEnabled"
            label={t("ui.slurp.settings.wallet.enabled", {
              defaultValue: "SlurpCoins actually cost something",
            })}
            detail={t("ui.slurp.settings.wallet.enabledDetail", {
              defaultValue: "Off keeps prices as decoration, which is how Slurp has always behaved.",
            })}
            value={settings.walletEnabled}
            onChange={(value) => update("walletEnabled", value)}
          />
          <Field
            settingKey="teaserRate"
            label={t("ui.slurp.settings.wallet.teaserRate", { defaultValue: "Free teaser posts" })}
            detail={t("ui.slurp.settings.wallet.teaserRateDetail", {
              defaultValue:
                "How often an automatic post goes out free. Creators for whom it fits use it to win subscribers; the rest just post something free.",
            })}
          >
            <select
              value={settings.teaserRate}
              onChange={(event) => void update("teaserRate", event.target.value as SlurpSettings["teaserRate"])}
              className="min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
            >
              <option value="off">{t("ui.slurp.settings.storyRateOff")}</option>
              <option value="rare">{t("ui.slurp.settings.storyRateRare")}</option>
              <option value="regular">{t("ui.slurp.settings.storyRateRegular")}</option>
              <option value="often">{t("ui.slurp.settings.storyRateOften")}</option>
            </select>
          </Field>
          <Field
            settingKey="walletUnlockCost"
            label={t("ui.slurp.settings.wallet.unlockCost", { defaultValue: "Unlock a post" })}
            detail={t("ui.slurp.settings.wallet.unlockCostDetail", {
              defaultValue: "Default price for a locked post. A post keeps the price it was created with.",
            })}
          >
            <NumberSetting
              value={settings.walletUnlockCost}
              min={0}
              max={9999}
              onSave={(value) => update("walletUnlockCost", value)}
            />
          </Field>
          <Field
            settingKey="walletSubscriptionCost"
            label={t("ui.slurp.settings.wallet.subscriptionCost", { defaultValue: "Subscribe, per week" })}
            detail={t("ui.slurp.settings.wallet.subscriptionCostDetail", {
              defaultValue:
                "Default weekly price. A creator with its own price uses that instead. Subscriptions renew every seven days.",
            })}
          >
            <NumberSetting
              value={settings.walletSubscriptionCost}
              min={0}
              max={9999}
              onSave={(value) => update("walletSubscriptionCost", value)}
            />
          </Field>
          <Toggle
            settingKey="pricingDynamicCharacters"
            label={t("ui.slurp.settings.wallet.pricingDynamicCharacters", {
              defaultValue: "Character Creators set their own prices",
            })}
            detail={t("ui.slurp.settings.wallet.pricingDynamicCharactersDetail", {
              defaultValue:
                "Once a week, each character Creator moves its subscription, locked post, and commission prices with its popularity. Current subscribers keep their price.",
            })}
            value={settings.pricingDynamicCharacters}
            onChange={(value) => update("pricingDynamicCharacters", value)}
          />
          {settings.pricingDynamicCharacters && (
            <Field
              settingKey="pricingMaxWeeklyChangePercent"
              label={t("ui.slurp.settings.wallet.pricingMaxWeeklyChange", {
                defaultValue: "Largest weekly price change, %",
              })}
              detail={t("ui.slurp.settings.wallet.pricingMaxWeeklyChangeDetail", {
                defaultValue: "How far one weekly adjustment may move a price. Zero freezes prices.",
              })}
            >
              <NumberSetting
                value={settings.pricingMaxWeeklyChangePercent}
                min={0}
                max={100}
                onSave={(value) => update("pricingMaxWeeklyChangePercent", value)}
              />
            </Field>
          )}
          <FineTune
            summary={t("ui.slurp.settings.backstage.landing.earningFineTune", {
              defaultValue: "Earning, stipend, and revenue share",
            })}
            count={7}
          >
            <Field
              settingKey="walletStipendFloor"
              label={t("ui.slurp.settings.wallet.stipendFloor", { defaultValue: "Daily top-up floor" })}
              detail={t("ui.slurp.settings.wallet.stipendFloorDetail", {
                defaultValue:
                  "Once a day, a balance below this is topped up to it. Zero turns the stipend off entirely.",
              })}
            >
              <NumberSetting
                value={settings.walletStipendFloor}
                min={0}
                max={99_999}
                onSave={(value) => update("walletStipendFloor", value)}
              />
            </Field>
            <Field
              settingKey="walletDayStartHour"
              label={t("ui.slurp.settings.wallet.dayStartHour")}
              detail={t("ui.slurp.settings.wallet.dayStartHourDetail")}
            >
              <NumberSetting
                value={settings.walletDayStartHour}
                min={0}
                max={23}
                onSave={(value) => update("walletDayStartHour", value)}
              />
            </Field>
            <Field
              settingKey="walletAdReward"
              label={t("ui.slurp.settings.wallet.adReward", { defaultValue: "Paid per ad you act on" })}
              detail={t("ui.slurp.settings.wallet.adRewardDetail", {
                defaultValue: "Zero turns ad rewards off.",
              })}
            >
              <NumberSetting
                value={settings.walletAdReward}
                min={0}
                max={999}
                onSave={(value) => update("walletAdReward", value)}
              />
            </Field>
            <Field
              settingKey="walletAdDailyCap"
              label={t("ui.slurp.settings.wallet.adDailyCap", { defaultValue: "Most ad SlurpCoins per day" })}
              detail={t("ui.slurp.settings.wallet.adDailyCapDetail", {
                defaultValue: "The cap is what stops ad clicking from becoming a job.",
              })}
            >
              <NumberSetting
                value={settings.walletAdDailyCap}
                min={0}
                max={9999}
                onSave={(value) => update("walletAdDailyCap", value)}
              />
            </Field>
            <Field
              settingKey="walletEngagementReward"
              label={t("ui.slurp.settings.wallet.engagementReward", {
                defaultValue: "Paid per post or comment",
              })}
              detail={t("ui.slurp.settings.wallet.engagementRewardDetail", {
                defaultValue: "Zero turns posting rewards off.",
              })}
            >
              <NumberSetting
                value={settings.walletEngagementReward}
                min={0}
                max={999}
                onSave={(value) => update("walletEngagementReward", value)}
              />
            </Field>
            <Field
              settingKey="walletEngagementDailyCap"
              label={t("ui.slurp.settings.wallet.engagementDailyCap", {
                defaultValue: "Most posting SlurpCoins per day",
              })}
              detail={t("ui.slurp.settings.wallet.engagementDailyCapDetail", {
                defaultValue: "The cap is what stops posting from becoming a grind.",
              })}
            >
              <NumberSetting
                value={settings.walletEngagementDailyCap}
                min={0}
                max={9999}
                onSave={(value) => update("walletEngagementDailyCap", value)}
              />
            </Field>
            <Field
              settingKey="walletCreatorRevenueSharePercent"
              label={t("ui.slurp.settings.wallet.creatorShare", {
                defaultValue: "Creator keeps, in percent",
              })}
              detail={t("ui.slurp.settings.wallet.creatorShareDetail", {
                defaultValue:
                  "When a fan pays one of your own creators, this share reaches your wallet. Zero means your creators earn nothing.",
              })}
            >
              <NumberSetting
                value={settings.walletCreatorRevenueSharePercent}
                min={0}
                max={100}
                onSave={(value) => update("walletCreatorRevenueSharePercent", value)}
              />
            </Field>
          </FineTune>
        </div>
      )}

      {target === "ads" && (
        <div className="space-y-5">
          <BackstagePageHeader title={t("ui.slurp.settings.ads.title")} detail={t("ui.slurp.settings.ads.detail")} />
          <div className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <p>{t("ui.slurp.settings.ads.explainer")}</p>
            <p className="mt-2">{t("ui.slurp.settings.ads.explainerPool")}</p>
            {settings.walletEnabled && settings.walletAdReward > 0 && (
              <p className="mt-2">
                {t("ui.slurp.settings.ads.explainerEarning", {
                  defaultValue:
                    "Acting on an ad pays {{reward}} SlurpCoins, up to {{cap}} a day. Change either in SlurpCoins.",
                  reward: settings.walletAdReward,
                  cap: settings.walletAdDailyCap,
                })}
              </p>
            )}
          </div>
          <SettingsGroup title={t("ui.slurp.settings.ads.feedGroup", { defaultValue: "In your feed" })}>
            <Toggle
              settingKey="inlineAdsEnabled"
              label={t("ui.slurp.settings.inlinePromotions")}
              detail={t("ui.slurp.settings.inlinePromotionsDetail")}
              value={settings.inlineAdsEnabled}
              onChange={(value) => update("inlineAdsEnabled", value)}
            />
            <Field
              settingKey="inlineAdsFrequency"
              label={t("ui.slurp.settings.ads.frequency")}
              detail={t("ui.slurp.settings.ads.frequencyDetail")}
            >
              <select
                value={settings.inlineAdsFrequency}
                disabled={updateSettings.isPending}
                onChange={(event) =>
                  void update("inlineAdsFrequency", event.target.value as SlurpSettings["inlineAdsFrequency"])
                }
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="light">{t("ui.slurp.settings.ads.frequencyLight")}</option>
                <option value="standard">{t("ui.slurp.settings.ads.frequencyStandard")}</option>
                <option value="frequent">{t("ui.slurp.settings.ads.frequencyFrequent")}</option>
              </select>
            </Field>
            <Field
              settingKey="inlineAdsSteering"
              label={t("ui.slurp.settings.ads.steering")}
              detail={t("ui.slurp.settings.ads.steeringDetail")}
            >
              <select
                value={settings.inlineAdsSteering}
                disabled={updateSettings.isPending}
                onChange={(event) =>
                  void update("inlineAdsSteering", event.target.value as SlurpSettings["inlineAdsSteering"])
                }
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="personalized">{t("ui.slurp.settings.ads.steeringPersonalized")}</option>
                <option value="balanced">{t("ui.slurp.settings.ads.steeringBalanced")}</option>
                <option value="random">{t("ui.slurp.settings.ads.steeringRandom")}</option>
              </select>
            </Field>
            <Field
              settingKey="inlineAdsContentCeiling"
              label={t("ui.slurp.settings.ads.ceiling")}
              detail={t("ui.slurp.settings.ads.ceilingDetail")}
            >
              <select
                value={settings.inlineAdsContentCeiling}
                disabled={updateSettings.isPending}
                onChange={(event) =>
                  void update("inlineAdsContentCeiling", event.target.value as SlurpSettings["inlineAdsContentCeiling"])
                }
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="tame">{t("ui.slurp.settings.ads.ceilingTame")}</option>
                <option value="suggestive">{t("ui.slurp.settings.ads.ceilingSuggestive")}</option>
                <option value="explicit">{t("ui.slurp.settings.ads.ceilingExplicit")}</option>
              </select>
            </Field>
          </SettingsGroup>
          <SettingsGroup title={t("ui.slurp.settings.ads.voiceGroup", { defaultValue: "How ads read" })}>
            <Field
              settingKey="inlineAdsTone"
              label={t("ui.slurp.settings.ads.tone")}
              detail={t("ui.slurp.settings.ads.toneDetail")}
            >
              <select
                value={settings.inlineAdsTone}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("inlineAdsTone", event.target.value as SlurpSettings["inlineAdsTone"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="corporate">{t("ui.slurp.settings.ads.toneCorporate")}</option>
                <option value="scammy">{t("ui.slurp.settings.ads.toneScammy")}</option>
                <option value="local">{t("ui.slurp.settings.ads.toneLocal")}</option>
                <option value="luxury">{t("ui.slurp.settings.ads.toneLuxury")}</option>
                <option value="unhinged">{t("ui.slurp.settings.ads.toneUnhinged")}</option>
              </select>
            </Field>
            <Field
              settingKey="inlineAdsEra"
              label={t("ui.slurp.settings.ads.era")}
              detail={t("ui.slurp.settings.ads.eraDetail")}
            >
              <select
                value={settings.inlineAdsEra}
                disabled={updateSettings.isPending}
                onChange={(event) => void update("inlineAdsEra", event.target.value as SlurpSettings["inlineAdsEra"])}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="present">{t("ui.slurp.settings.ads.eraPresent")}</option>
                <option value="nineties">{t("ui.slurp.settings.ads.eraNineties")}</option>
                <option value="cyberpunk">{t("ui.slurp.settings.ads.eraCyberpunk")}</option>
                <option value="retrofuture">{t("ui.slurp.settings.ads.eraRetrofuture")}</option>
              </select>
            </Field>
            <Field
              settingKey="inlineAdsWorldContext"
              label={t("ui.slurp.settings.ads.world")}
              detail={t("ui.slurp.settings.ads.worldDetail")}
            >
              <textarea
                rows={3}
                value={adsWorldDraft ?? settings.inlineAdsWorldContext}
                maxLength={1200}
                onChange={(event) => setAdsWorldDraft(event.target.value)}
                onBlur={() => {
                  const next = adsWorldDraft;
                  setAdsWorldDraft(null);
                  if (next !== null && next !== settings.inlineAdsWorldContext)
                    void update("inlineAdsWorldContext", next);
                }}
                className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              />
            </Field>
            <Toggle
              settingKey="inlineAdsImagesEnabled"
              label={t("ui.slurp.settings.ads.images")}
              detail={t("ui.slurp.settings.ads.imagesDetail")}
              value={settings.inlineAdsImagesEnabled}
              onChange={(value) => update("inlineAdsImagesEnabled", value)}
            />
            <Field
              settingKey="inlineAdsImageConnectionId"
              label={t("ui.slurp.settings.ads.imageConnection")}
              detail={t("ui.slurp.settings.ads.imageConnectionDetail")}
            >
              <select
                value={settings.inlineAdsImageConnectionId ?? ""}
                disabled={updateSettings.isPending || connectionsQuery.isLoading}
                onChange={(event) => void update("inlineAdsImageConnectionId", event.target.value || null)}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
              >
                <option value="">{t("ui.slurp.settings.ads.imageConnectionDefault")}</option>
                {imageConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name ?? connection.model ?? connection.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              settingKey="inlineAdsLorebookId"
              label={t("ui.slurp.settings.ads.lorebook")}
              detail={t("ui.slurp.settings.ads.lorebookDetail")}
            >
              <div className="flex flex-wrap gap-2">
                <select
                  value={settings.inlineAdsLorebookId ?? ""}
                  disabled={updateSettings.isPending || adLorebooks.isLoading}
                  onChange={(event) =>
                    void updatePatch({
                      inlineAdsLorebookId: event.target.value || null,
                      // Clearing the fingerprint makes the next sync regenerate against
                      // the newly chosen book instead of treating it as already applied.
                      inlineAdsLorebookRevision: null,
                    })
                  }
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                >
                  <option value="">{t("ui.slurp.settings.ads.lorebookNone")}</option>
                  {(adLorebooks.data?.items ?? []).map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!settings.inlineAdsLorebookId || syncAdLorebook.isPending}
                  onClick={() =>
                    syncAdLorebook.mutate(true, {
                      onSuccess: (result) => toast.success(t(`ui.slurp.settings.ads.lorebookSync.${result.outcome}`)),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                  className="min-h-11 rounded-lg border border-[var(--slurp-outline)] px-4 text-sm font-bold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  {syncAdLorebook.isPending
                    ? t("ui.slurp.settings.ads.lorebookSyncing")
                    : t("ui.slurp.settings.ads.lorebookSyncNow")}
                </button>
              </div>
            </Field>
          </SettingsGroup>
          <div className="rounded-xl border border-[var(--slurp-outline)] p-4">
            <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.pool")}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.ads.poolDetail", { count: adPool.data?.items.length ?? 0 })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={generateAds.isPending}
                onClick={() =>
                  generateAds.mutate(undefined, {
                    onSuccess: (result) =>
                      toast.success(
                        t("ui.slurp.settings.ads.generated", {
                          count: result.items.length,
                          retired: result.retired.length,
                          images: result.images,
                        }),
                      ),
                    onError: (error) => toast.error(errorMessage(error)),
                  })
                }
                className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
              >
                {generateAds.isPending ? t("ui.slurp.settings.ads.generating") : t("ui.slurp.settings.ads.generate")}
              </button>
              <button
                type="button"
                onClick={() =>
                  void api
                    .download("/slurp2/noodler/ads/export", "slurp-ads.json")
                    .catch((error: unknown) => toast.error(errorMessage(error)))
                }
                className="min-h-9 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
              >
                {t("ui.slurp.settings.ads.export")}
              </button>
              <button
                type="button"
                disabled={importAds.isPending}
                onClick={() => adsImportRef.current?.click()}
                className="min-h-9 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-bold hover:bg-[var(--accent)] disabled:opacity-50"
              >
                {importAds.isPending ? t("ui.slurp.settings.ads.importing") : t("ui.slurp.settings.ads.import")}
              </button>
              <button
                type="button"
                onClick={() => setCustomAdOpen((open) => !open)}
                aria-expanded={customAdOpen}
                className="flex min-h-9 items-center gap-1 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-bold hover:bg-[var(--accent)]"
              >
                <Plus size={13} aria-hidden="true" />
                {t("ui.slurp.settings.ads.createOwn")}
              </button>
              <input
                ref={adsImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  void file
                    .text()
                    .then((text) => importAds.mutateAsync(JSON.parse(text)))
                    .then((result) => toast.success(t("ui.slurp.settings.ads.imported", { count: result.imported })))
                    .catch((error) => toast.error(errorMessage(error)));
                }}
              />
            </div>
            {customAdOpen && (
              <form
                className="mt-3 space-y-2 rounded-lg border border-[var(--slurp-outline)] p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  createAd.mutate(customAd, {
                    onSuccess: () => {
                      toast.success(t("ui.slurp.settings.ads.created", { brand: customAd.brand }));
                      setCustomAd({ brand: "", product: "", copy: "", contentRating: "tame" });
                      setCustomAdOpen(false);
                    },
                    onError: (error) => toast.error(errorMessage(error)),
                  });
                }}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    required
                    maxLength={80}
                    value={customAd.brand}
                    onChange={(event) => setCustomAd((prev) => ({ ...prev, brand: event.target.value }))}
                    placeholder={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                    aria-label={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                    className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  />
                  <input
                    required
                    maxLength={120}
                    value={customAd.product}
                    onChange={(event) => setCustomAd((prev) => ({ ...prev, product: event.target.value }))}
                    placeholder={t("ui.slurp.settings.ads.createProductPlaceholder")}
                    aria-label={t("ui.slurp.settings.ads.createProductPlaceholder")}
                    className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  />
                </div>
                <textarea
                  required
                  maxLength={600}
                  rows={2}
                  value={customAd.copy}
                  onChange={(event) => setCustomAd((prev) => ({ ...prev, copy: event.target.value }))}
                  placeholder={t("ui.slurp.settings.ads.createCopyPlaceholder")}
                  aria-label={t("ui.slurp.settings.ads.createCopyPlaceholder")}
                  className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={customAd.contentRating}
                    onChange={(event) =>
                      setCustomAd((prev) => ({
                        ...prev,
                        contentRating: event.target.value as SlurpContentRating,
                      }))
                    }
                    aria-label={t("ui.slurp.settings.ads.ceiling")}
                    className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                  >
                    <option value="tame">{t("ui.slurp.settings.ads.ceilingTame")}</option>
                    <option value="suggestive">{t("ui.slurp.settings.ads.ceilingSuggestive")}</option>
                    <option value="explicit">{t("ui.slurp.settings.ads.ceilingExplicit")}</option>
                  </select>
                  <button
                    type="submit"
                    disabled={createAd.isPending}
                    className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
                  >
                    {createAd.isPending ? t("ui.slurp.settings.ads.creating") : t("ui.slurp.settings.ads.createSubmit")}
                  </button>
                </div>
              </form>
            )}
            {/* The pool used to be a bare count, so a bad generated ad could only be
                        removed by resetting everything. */}
            <ul className="mt-4 space-y-2">
              {(adPool.data?.items ?? []).map((ad) => {
                const builtin = ad.origin === "builtin";
                return (
                  <li
                    key={ad.id}
                    className="flex items-start gap-3 rounded-lg bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
                  >
                    {ad.imageUrl ? (
                      <SlurpMediaImg
                        src={ad.imageUrl}
                        alt=""
                        loading="lazy"
                        className="h-14 w-20 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-[var(--slurp-canvas)] text-[var(--slurp-muted)]"
                      >
                        <Image size={16} />
                      </span>
                    )}
                    {editingAd?.id === ad.id ? (
                      <form
                        className="min-w-0 flex-1 space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          updateAd.mutate(editingAd, {
                            onSuccess: () => {
                              toast.success(t("ui.slurp.settings.ads.edited", { brand: editingAd.brand }));
                              setEditingAd(null);
                            },
                            onError: (error) => toast.error(errorMessage(error)),
                          });
                        }}
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            required
                            maxLength={80}
                            value={editingAd.brand}
                            onChange={(event) => setEditingAd({ ...editingAd, brand: event.target.value })}
                            placeholder={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                            aria-label={t("ui.slurp.settings.ads.createBrandPlaceholder")}
                            className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                          />
                          <input
                            required
                            maxLength={120}
                            value={editingAd.product}
                            onChange={(event) => setEditingAd({ ...editingAd, product: event.target.value })}
                            placeholder={t("ui.slurp.settings.ads.createProductPlaceholder")}
                            aria-label={t("ui.slurp.settings.ads.createProductPlaceholder")}
                            className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                          />
                        </div>
                        <textarea
                          required
                          maxLength={600}
                          rows={2}
                          value={editingAd.copy}
                          onChange={(event) => setEditingAd({ ...editingAd, copy: event.target.value })}
                          placeholder={t("ui.slurp.settings.ads.createCopyPlaceholder")}
                          aria-label={t("ui.slurp.settings.ads.createCopyPlaceholder")}
                          className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={editingAd.contentRating}
                            onChange={(event) =>
                              setEditingAd({
                                ...editingAd,
                                contentRating: event.target.value as SlurpContentRating,
                              })
                            }
                            aria-label={t("ui.slurp.settings.ads.ceiling")}
                            className="min-h-9 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                          >
                            <option value="tame">{t("ui.slurp.settings.ads.ceilingTame")}</option>
                            <option value="suggestive">{t("ui.slurp.settings.ads.ceilingSuggestive")}</option>
                            <option value="explicit">{t("ui.slurp.settings.ads.ceilingExplicit")}</option>
                          </select>
                          <button
                            type="submit"
                            disabled={updateAd.isPending}
                            className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 hover:opacity-90 disabled:opacity-50"
                          >
                            {t("ui.slurp.settings.ads.editSubmit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAd(null)}
                            className="min-h-9 rounded-lg px-3 text-xs font-bold text-[var(--slurp-muted)] hover:bg-[var(--accent)]"
                          >
                            {t("ui.slurp.settings.ads.editCancel")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{ad.brand}</p>
                        <p className="truncate text-xs font-semibold text-[var(--slurp-muted)]">{ad.product}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--slurp-muted)]">{ad.copy}</p>
                        <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--slurp-muted)]">
                          {t(
                            `ui.slurp.settings.ads.ceiling${ad.contentRating === "suggestive" ? "Suggestive" : ad.contentRating === "explicit" ? "Explicit" : "Tame"}`,
                          )}
                          {ad.retiredAt ? ` · ${t("ui.slurp.settings.ads.retired")}` : ""}
                        </p>
                      </div>
                    )}
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingAd({
                            id: ad.id,
                            brand: ad.brand,
                            product: ad.product,
                            copy: ad.copy,
                            contentRating: ad.contentRating ?? "tame",
                          })
                        }
                        aria-label={t("ui.slurp.settings.ads.editAd", { brand: ad.brand })}
                        title={t("ui.slurp.settings.ads.editAd", { brand: ad.brand })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)]"
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={generateAdImage.isPending}
                        onClick={() =>
                          generateAdImage.mutate(ad.id, {
                            onSuccess: () => toast.success(t("ui.slurp.settings.ads.imageGenerated")),
                            onError: (error) => toast.error(errorMessage(error)),
                          })
                        }
                        aria-label={t("ui.slurp.settings.ads.regenerateImage", { brand: ad.brand })}
                        title={t("ui.slurp.settings.ads.regenerateImage", { brand: ad.brand })}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] disabled:opacity-50"
                      >
                        <Image size={15} aria-hidden="true" />
                      </button>
                      {ad.retiredAt ? (
                        <button
                          type="button"
                          disabled={updateAd.isPending}
                          onClick={() =>
                            updateAd.mutate(
                              { id: ad.id, retiredAt: null },
                              {
                                onSuccess: () =>
                                  toast.success(t("ui.slurp.settings.ads.restored", { brand: ad.brand })),
                                onError: (error) => toast.error(errorMessage(error)),
                              },
                            )
                          }
                          aria-label={t("ui.slurp.settings.ads.restoreAd", { brand: ad.brand })}
                          title={t("ui.slurp.settings.ads.restoreAd", { brand: ad.brand })}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] disabled:opacity-50"
                        >
                          <RotateCcw size={15} aria-hidden="true" />
                        </button>
                      ) : null}
                      {!(builtin && ad.retiredAt) && (
                        <button
                          type="button"
                          disabled={deleteAd.isPending}
                          onClick={() =>
                            deleteAd.mutate(ad.id, {
                              onSuccess: () =>
                                toast.success(
                                  t(`ui.slurp.settings.ads.${builtin ? "hiddenBuiltin" : "deleted"}`, {
                                    brand: ad.brand,
                                  }),
                                ),
                              onError: (error) => toast.error(errorMessage(error)),
                            })
                          }
                          aria-label={t(`ui.slurp.settings.ads.${builtin ? "hideAd" : "deleteAd"}`, {
                            brand: ad.brand,
                          })}
                          title={t(`ui.slurp.settings.ads.${builtin ? "hideAd" : "deleteAd"}`, {
                            brand: ad.brand,
                          })}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-red-300 disabled:opacity-50"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {(adPool.data?.items.length ?? 0) === 0 && (
              <p className="mt-4 text-xs leading-5 text-[var(--slurp-muted)]">{t("ui.slurp.settings.ads.poolEmpty")}</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.themes")}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.ads.themesDetail")}
            </p>
            <SettingAnchor settingKey="inlineAdsPreferredTags">
              <div className="mt-3 flex flex-wrap gap-2">
                {["coffee", "beauty", "luxury", "nightlife", "fashion"].map((tag) => {
                  const selected = settings.inlineAdsPreferredTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={selected}
                      disabled={updateSettings.isPending}
                      onClick={() =>
                        void update(
                          "inlineAdsPreferredTags",
                          selected
                            ? settings.inlineAdsPreferredTags.filter((value) => value !== tag)
                            : [...settings.inlineAdsPreferredTags, tag],
                        )
                      }
                      className={`min-h-10 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 ${selected ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)] ring-[var(--slurp-outline)] hover:text-[var(--slurp-text)]"}`}
                    >
                      {t(`ui.slurp.settings.ads.theme.${tag}`)}
                    </button>
                  );
                })}
              </div>
            </SettingAnchor>
          </div>
          {viewerPersonaId && (adState.data?.hiddenBrands.length ?? 0) > 0 && (
            <div>
              <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.hiddenBrands")}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.ads.hiddenBrandsDetail")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {adState.data?.hiddenBrands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    disabled={unhideBrand.isPending}
                    onClick={() =>
                      unhideBrand.mutate(
                        { personaId: viewerPersonaId, brand },
                        {
                          onSuccess: () => toast.success(t("ui.slurp.settings.ads.brandUnhidden", { brand })),
                          onError: (error) => toast.error(errorMessage(error)),
                        },
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--slurp-surface-raised)] px-4 text-sm font-semibold text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)] transition-colors hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    {t("ui.slurp.settings.ads.unhideBrand", { brand })}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]">
            <div>
              <h2 className="text-sm font-bold">{t("ui.slurp.settings.ads.reset")}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.ads.resetDetail")}
              </p>
            </div>
            <button
              type="button"
              disabled={!viewerPersonaId || resetAds.isPending}
              onClick={() =>
                viewerPersonaId &&
                resetAds.mutate(viewerPersonaId, {
                  onSuccess: () => toast.success(t("ui.slurp.settings.ads.resetDone")),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-4 text-sm font-bold text-[var(--slurp-text)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t("ui.slurp.settings.ads.resetAction")}
            </button>
          </div>
        </div>
      )}

      {target === "audience" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <BackstagePageHeader
              title={t("ui.slurp.settings.audience.title")}
              detail={t("ui.slurp.settings.audience.detail")}
            />
            <button
              type="button"
              onClick={() =>
                refreshFans.mutate(undefined, {
                  onSuccess: (result) =>
                    toast.success(
                      result.created > 0
                        ? t("ui.slurp.settings.audience.created", { count: result.created })
                        : t("ui.slurp.settings.audience.createdNone"),
                    ),
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
              disabled={refreshFans.isPending || !settings.fanActivityEnabled}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshFans.isPending ? "animate-spin" : ""} />
              {t("ui.slurp.settings.audience.refresh")}
            </button>
            <button
              type="button"
              aria-expanded={audienceWizardOpen}
              onClick={() => {
                setAudienceDraft({
                  preset: audiencePreset === "custom" ? "realistic" : audiencePreset,
                  platformScale: settings.platformScale,
                  audienceTone: settings.audienceTone,
                });
                setAudienceWizardOpen((open) => !open);
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              <UsersRound size={14} aria-hidden="true" />
              {t("ui.slurp.settings.backstage.wizard.audienceTitle", { defaultValue: "Set up audience" })}
            </button>
          </div>
          {audienceWizardOpen &&
            audienceDraft &&
            (() => {
              const patch = {
                ...slurpAudiencePresetPatch(audienceDraft.preset, settings),
                platformScale: audienceDraft.platformScale,
                audienceTone: audienceDraft.audienceTone,
              } as Partial<SlurpSettings>;
              return (
                <BackstageWizard
                  title={t("ui.slurp.settings.backstage.wizard.audienceTitle", { defaultValue: "Set up audience" })}
                  preset={audienceDraft.preset}
                  presetLabel={(preset) => t(`ui.slurp.settings.simulation.presets.${preset}`)}
                  current={settings}
                  proposed={{ ...settings, ...patch }}
                  patch={patch}
                  pending={updateSettings.isPending}
                  onCancel={() => setAudienceWizardOpen(false)}
                  onApply={(next) => {
                    void updatePatch(next);
                    setAudienceWizardOpen(false);
                  }}
                  steps={[
                    {
                      id: "energy",
                      title: t("ui.slurp.settings.backstage.wizard.audienceEnergy", {
                        defaultValue: "Choose audience energy",
                      }),
                      content: (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {SLURP_AUDIENCE_PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              aria-pressed={audienceDraft.preset === preset}
                              onClick={() => setAudienceDraft({ ...audienceDraft, preset })}
                              className={`min-h-14 rounded-lg p-3 text-start text-sm font-semibold ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${audienceDraft.preset === preset ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-surface-raised)] ring-[var(--slurp-outline)]"}`}
                            >
                              {t(`ui.slurp.settings.simulation.presets.${preset}`)}
                            </button>
                          ))}
                        </div>
                      ),
                    },
                    {
                      id: "feel",
                      title: t("ui.slurp.settings.backstage.wizard.audienceFeel", {
                        defaultValue: "Choose size and tone",
                      }),
                      content: (
                        <div className="space-y-3">
                          <ChoiceRow
                            title={t("ui.slurp.settings.audience.scaleTitle")}
                            detail={t("ui.slurp.settings.audience.scaleDetail")}
                            options={(["intimate", "normal", "large"] as const).map((value) => ({
                              value,
                              label: t(`ui.slurp.settings.audience.scale.${value}`),
                            }))}
                            value={audienceDraft.platformScale}
                            onChange={(platformScale) => setAudienceDraft({ ...audienceDraft, platformScale })}
                          />
                          <ChoiceRow
                            title={t("ui.slurp.settings.audience.toneTitle")}
                            detail={t("ui.slurp.settings.audience.toneDetail")}
                            options={(["warm", "mixed", "unfiltered"] as const).map((value) => ({
                              value,
                              label: t(`ui.slurp.settings.audience.tone.${value}`),
                            }))}
                            value={audienceDraft.audienceTone}
                            onChange={(audienceTone) => setAudienceDraft({ ...audienceDraft, audienceTone })}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              );
            })()}
          <p className="text-xs text-[var(--muted-foreground)]" aria-live="polite">
            {fanStatusQuery.isError
              ? t("ui.slurp.settings.audience.statusError")
              : fanStatusQuery.data
                ? t("ui.slurp.settings.audience.statusUsed", {
                    used: fanStatusQuery.data.usedRuns,
                    limit: fanStatusQuery.data.runLimit,
                  })
                : t("ui.slurp.settings.audience.statusLoading")}
          </p>
          <ChoiceRow
            title={t("ui.slurp.settings.audience.presetTitle")}
            detail={
              audiencePreset === "custom"
                ? t("ui.slurp.settings.audience.presetCustom")
                : t(`ui.slurp.settings.simulation.presetDetail.${audiencePreset}`)
            }
            options={SLURP_AUDIENCE_PRESETS.map((preset) => ({
              value: preset,
              label: t(`ui.slurp.settings.simulation.presets.${preset}`),
            }))}
            value={audiencePreset}
            onChange={(preset) => void updatePatch(slurpAudiencePresetPatch(preset, settings))}
            extra={
              audiencePreset === "custom" ? (
                <span className="min-h-10 inline-flex items-center rounded-lg border border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 px-3 text-xs font-semibold text-[var(--noodle-accent)]">
                  {t("ui.slurp.settings.simulation.presets.custom")}
                </span>
              ) : null
            }
          />
          <SettingAnchor settingKey="platformScale">
            <ChoiceRow
              title={t("ui.slurp.settings.audience.scaleTitle")}
              detail={t("ui.slurp.settings.audience.scaleDetail")}
              options={(["intimate", "normal", "large"] as const).map((level) => ({
                value: level,
                label: t(`ui.slurp.settings.audience.scale.${level}`),
              }))}
              value={settings.platformScale}
              onChange={(level) => update("platformScale", level)}
            />
          </SettingAnchor>
          <SettingAnchor settingKey="audienceTone">
            <ChoiceRow
              title={t("ui.slurp.settings.audience.toneTitle")}
              detail={t("ui.slurp.settings.audience.toneDetail")}
              options={(["warm", "mixed", "unfiltered"] as const).map((tone) => ({
                value: tone,
                label: t(`ui.slurp.settings.audience.tone.${tone}`),
              }))}
              value={settings.audienceTone}
              onChange={(tone) => update("audienceTone", tone)}
            />
          </SettingAnchor>

          <SettingsGroup
            title={t("ui.slurp.settings.audience.characterFansTitle", {
              defaultValue: "Character audience",
            })}
          >
            <div className="space-y-4">
              <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                {t("ui.slurp.settings.audience.characterFansDetail", {
                  defaultValue: "Invite your Engine characters to read posts and join the audience simulation.",
                })}
              </p>
              <Field
                settingKey="audienceCharacterLimit"
                label={t("ui.slurp.settings.audience.characterLimit", {
                  defaultValue: "Character fans active at once",
                })}
                detail={t("ui.slurp.settings.audience.characterLimitDetail", {
                  defaultValue: "This limits prompt cost. Invited characters rotate when the list is larger.",
                })}
              >
                <NumberSetting
                  value={settings.audienceCharacterLimit}
                  min={0}
                  max={10}
                  onSave={(value) => void update("audienceCharacterLimit", value)}
                />
              </Field>

              {audienceCharactersQuery.isLoading || audienceCharacterGroupsQuery.isLoading ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t("ui.slurp.settings.audience.characterLoading", { defaultValue: "Loading characters…" })}
                </p>
              ) : audienceCharactersQuery.isError || audienceCharacterGroupsQuery.isError ? (
                <p role="alert" className="text-xs text-[var(--destructive)]">
                  {t("ui.slurp.settings.audience.characterError", { defaultValue: "Characters are unavailable." })}
                </p>
              ) : (
                <>
                  <Field
                    settingKey="audienceCharacterGroupIds"
                    label={t("ui.slurp.settings.audience.characterGroups", { defaultValue: "Invite character groups" })}
                    detail={t("ui.slurp.settings.audience.characterGroupsDetail", {
                      defaultValue: "A group invites every member. A character override below can remove one.",
                    })}
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      {audienceCharacterGroups.map((group: SlurpAudienceCharacterGroup) => {
                        const selected = settings.audienceCharacterGroupIds.includes(group.id);
                        return (
                          <label
                            key={group.id}
                            className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                void update(
                                  "audienceCharacterGroupIds",
                                  selected
                                    ? settings.audienceCharacterGroupIds.filter((id: string) => id !== group.id)
                                    : [...settings.audienceCharacterGroupIds, group.id],
                                )
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">{group.name}</span>
                            <span className="text-xs text-[var(--muted-foreground)]">{group.characterIds.length}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>

                  <Field
                    settingKey="audienceCharacters"
                    label={t("ui.slurp.settings.audience.characterOverrides", { defaultValue: "Character overrides" })}
                    detail={t("ui.slurp.settings.audience.characterOverridesDetail", {
                      defaultValue: "Choose a Fan Type, or leave a character on automatic.",
                    })}
                  >
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-[var(--slurp-outline)] p-2">
                      {audienceCharacters.map((character: SlurpAudienceCharacterSummary) => {
                        const value = settings.audienceCharacters[character.id];
                        const inGroup = audienceCharacterGroups.some(
                          (group: SlurpAudienceCharacterGroup) =>
                            settings.audienceCharacterGroupIds.includes(group.id) &&
                            group.characterIds.includes(character.id),
                        );
                        const enabled = value !== false && (value !== undefined || inGroup);
                        return (
                          <div
                            key={character.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--accent)]/30"
                          >
                            <input
                              type="checkbox"
                              aria-label={character.name}
                              checked={enabled}
                              onChange={() =>
                                void update("audienceCharacters", {
                                  ...settings.audienceCharacters,
                                  [character.id]: enabled ? false : true,
                                })
                              }
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{character.name}</span>
                            <select
                              aria-label={t("ui.slurp.settings.audience.characterFanType", {
                                defaultValue: "Fan Type for {{name}}",
                                name: character.name,
                              })}
                              disabled={!enabled}
                              value={typeof value === "string" ? value : ""}
                              onChange={(event) =>
                                void update("audienceCharacters", {
                                  ...settings.audienceCharacters,
                                  [character.id]: event.target.value || true,
                                })
                              }
                              className="min-h-9 max-w-44 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface)] px-2 text-xs disabled:opacity-50"
                            >
                              <option value="">
                                {t("ui.slurp.settings.audience.automatic", { defaultValue: "Automatic" })}
                              </option>
                              {settings.fanTypes
                                .filter((type) => type.enabled)
                                .map((type) => (
                                  <option key={type.id} value={type.id}>
                                    {type.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                    {audienceCharactersQuery.hasNextPage && (
                      <button
                        type="button"
                        disabled={audienceCharactersQuery.isFetchingNextPage}
                        onClick={() => void audienceCharactersQuery.fetchNextPage()}
                        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--slurp-outline)] text-sm font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                      >
                        {audienceCharactersQuery.isFetchingNextPage && <Loader2 size={15} className="animate-spin" />}
                        {audienceCharactersQuery.isFetchingNextPage
                          ? t("ui.slurp.settings.audience.characterLoadingMore", { defaultValue: "Loading more…" })
                          : t("ui.slurp.settings.audience.characterLoadMore", { defaultValue: "Load more characters" })}
                      </button>
                    )}
                  </Field>
                </>
              )}
            </div>
          </SettingsGroup>

          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block">{t("ui.slurp.settings.audience.fanTypesTitle")}</span>
                <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                  {t("ui.slurp.settings.audience.fanTypesSummary", {
                    enabled: settings.fanTypes.filter((type) => type.enabled).length,
                    count: settings.fanTypes.length,
                  })}
                </span>
              </span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              <SettingAnchor settingKey="allowRandomUsers">
                <AmbientProfilesPanel
                  allowRandomUsers={settings.allowRandomUsers}
                  onAllowRandomUsersChange={(value) => update("allowRandomUsers", value)}
                />
              </SettingAnchor>
              <Field
                settingKey="audienceReactionBank"
                label={t("ui.slurp.settings.audience.reactionBank")}
                detail={t("ui.slurp.settings.audience.reactionBankDetail", {
                  count: settings.audienceReactionBank.shared.length,
                })}
              >
                <textarea
                  rows={6}
                  value={reactionBankDraft ?? settings.audienceReactionBank.shared.join("\n")}
                  onChange={(event) => setReactionBankDraft(event.target.value)}
                  onBlur={() => {
                    const draft = reactionBankDraft;
                    setReactionBankDraft(null);
                    if (draft === null) return;
                    // Same rules the server applies, so what the box shows after a save is
                    // what was actually stored rather than a list that silently lost rows.
                    const seen = new Set<string>();
                    const next: string[] = [];
                    for (const line of draft.split("\n")) {
                      const body = line.trim().slice(0, 120);
                      const key = body.toLowerCase();
                      if (!body || seen.has(key) || next.length >= 400) continue;
                      seen.add(key);
                      next.push(body);
                    }
                    // The box edits the shared bank only; per-type banks have their own
                    // editor in the Fan Types panel.
                    if (next.join("\n") !== settings.audienceReactionBank.shared.join("\n"))
                      void update("audienceReactionBank", {
                        ...settings.audienceReactionBank,
                        shared: next,
                      });
                  }}
                  className="w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 sm:text-sm"
                />
              </Field>
              <SettingAnchor settingKey="fanTypes">
                <SlurpFanTypesSettings
                  fanTypes={settings.fanTypes}
                  bankCounts={settings.audienceReactionBank.byType}
                  crowdTone={settings.audienceTone}
                  onSave={(fanTypes) => update("fanTypes", fanTypes)}
                />
              </SettingAnchor>
            </div>
          </details>

          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block">{t("ui.slurp.settings.audience.aiTitle")}</span>
                <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                  {t("ui.slurp.settings.audience.aiSummary")}
                </span>
              </span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              <SettingAnchor settingKey="modelBudget">
                <SlurpAudienceConfigSettings
                  tuning={settings.simulationTuning}
                  fanTypes={settings.fanTypes}
                  budget={settings.modelBudget}
                  connections={connectionsQuery.data ?? []}
                  onSave={(patch) => updatePatch(patch)}
                />
              </SettingAnchor>
            </div>
          </details>

          <details className="group rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block">{t("ui.slurp.settings.audience.advancedTitle")}</span>
                <span className="block text-xs font-normal text-[var(--muted-foreground)]">
                  {t("ui.slurp.settings.audience.advancedDetail")}
                </span>
              </span>
              <ChevronRight
                size={17}
                className="transition-transform group-open:rotate-90 rtl:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 border-t border-[var(--slurp-outline)] p-4 sm:p-5">
              <Toggle
                settingKey="fanActivityEnabled"
                label={t("ui.slurp.settings.audience.enabled")}
                detail={t("ui.slurp.settings.audience.enabledDetail")}
                value={settings.fanActivityEnabled}
                onChange={(value) => update("fanActivityEnabled", value)}
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  settingKey="fanActivityRunsPerDay"
                  label={t("ui.slurp.settings.audience.runsPerDay")}
                  detail={t("ui.slurp.settings.audience.runsPerDayDetail")}
                >
                  <NumberSetting
                    value={settings.fanActivityRunsPerDay}
                    min={1}
                    max={96}
                    onSave={(value) => update("fanActivityRunsPerDay", value)}
                  />
                </Field>
                <Field settingKey="fanLikesPerRefresh" label={t("ui.slurp.settings.audience.likes")}>
                  <NumberSetting
                    value={settings.fanLikesPerRefresh}
                    min={0}
                    max={24}
                    onSave={(value) => update("fanLikesPerRefresh", value)}
                  />
                </Field>
                <Field settingKey="fanRepliesPerRefresh" label={t("ui.slurp.settings.audience.replies")}>
                  <NumberSetting
                    value={settings.fanRepliesPerRefresh}
                    min={0}
                    max={12}
                    onSave={(value) => update("fanRepliesPerRefresh", value)}
                  />
                </Field>
              </div>
              <SettingAnchor settingKey="worldActivity">
                <ChoiceRow
                  title={t("ui.slurp.settings.audience.activityTitle")}
                  detail={t("ui.slurp.settings.audience.activityDetail")}
                  options={(["off", "quiet", "normal", "busy"] as const).map((level) => ({
                    value: level,
                    label: t(`ui.slurp.settings.audience.activity.${level}`),
                  }))}
                  value={settings.worldActivity}
                  onChange={(level) => update("worldActivity", level)}
                />
              </SettingAnchor>
              {/* ponytail: the global archetype mix stays a hidden stored field that the server still
                          reads; drop it together with the per-Creator archetype UI. */}
              {Object.values(settings.fanArchetypeWeights).some((weight) => weight !== 1) && (
                <SettingAnchor settingKey="fanArchetypeWeights">
                  <div className="rounded-lg border border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)]">
                    <p>{t("ui.slurp.settings.audience.legacyMix")}</p>
                    <button
                      type="button"
                      onClick={() =>
                        void update(
                          "fanArchetypeWeights",
                          Object.fromEntries(Object.keys(settings.fanArchetypeWeights).map((key) => [key, 1])),
                        )
                      }
                      className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
                    >
                      {t("ui.slurp.settings.audience.legacyMixReset")}
                    </button>
                  </div>
                </SettingAnchor>
              )}
              {/* Every number the simulation runs on, in its own file. Keyed on the preset so an Activity click resets the local draft instead of saving stale tuning back. */}
              <SettingAnchor settingKey="simulationTuning">
                <SlurpSimulationSettings
                  key={settings.simulationTuning.preset}
                  tuning={settings.simulationTuning}
                  onSave={(next) => void update("simulationTuning", next)}
                />
              </SettingAnchor>
            </div>
          </details>
        </div>
      )}
    </>
  );
}
