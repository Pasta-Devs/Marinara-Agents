import { Fragment, useState } from "react";
import { CalendarClock, CheckCircle2, ListChecks, Loader2, Search, Sparkles, Trash2, UsersRound } from "lucide-react";
import type { NoodlerManagedStageProfile } from "@marinara-engine/shared";
import { Field, SettingsGroup, Toggle } from "./SlurpSettingsControls";
import { SlurpCreatorBulkEdit } from "./SlurpCreatorBulkEdit";
import { toast } from "sonner";
import { formatDateTime } from "./SlurpDateTime";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Avatar } from "./SlurpShell";
import { SlurpCreatorImprover } from "./SlurpCreatorImprover";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { errorMessage, CreatorMessagingGroup } from "./SlurpBackstageWorkflow";
import { BackstagePageHeader, SettingAnchor } from "./SlurpBackstageKit";
import { SlurpPostGuidanceField } from "./SlurpPostGuidanceField";
import { SlurpCreatorProfileEditor } from "./SlurpCreatorProfileEditor";
import { useSlurpCreatorMetrics, useSlurpPostGuidance, type SlurpCreatorMetrics } from "../../hooks/use-slurp";

type CreatorFilter = "all" | "active" | "paused" | "attention";
type CreatorTab = "profile" | "publishing" | "images" | "messages" | "danger";

const CREATOR_FILTERS: readonly CreatorFilter[] = ["all", "active", "paused", "attention"];
const CREATOR_TABS: readonly CreatorTab[] = ["profile", "publishing", "images", "messages", "danger"];

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";
const quietButton = `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] disabled:opacity-50 ${focusRing}`;
const accentButton = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50 ${focusRing}`;
const selectClass = `min-h-11 w-full rounded-lg bg-[var(--slurp-canvas)] px-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50 sm:text-sm ${focusRing}`;
const noteClass =
  "rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]";

function needsAttention(creator: NoodlerManagedStageProfile) {
  return (
    creator.sourceStatus.state === "missing" ||
    creator.sourceStatus.state === "changed" ||
    creator.scheduleStatus?.state === "stale"
  );
}

/** Creators: a searchable directory, bulk edit, a tabbed detail panel, and Improve with AI. */
export function SlurpBackstageCreators(page: SlurpBackstagePageProps) {
  const {
    navigation,
    onNavigate,
    onAddCreators,
    onRedraftCreator,
    t,
    i18n,
    updateSettings,
    target,
    settings,
    setScheduleCreatorId,
    setSelectedCreatorId,
    bulkCreatorIds,
    setBulkCreatorIds,
    update,
    accountsQuery,
    imageSettingsQuery,
    reserveStatusQuery,
    updateAuto,
    refreshConversationSchedule,
    updateImages,
    deleteCreator,
    setCreatorMessaging,
    setCreatorPrice,
    adoptSourceIdentity,
    dismissSourceChanges,
    connectionsQuery,
    imageConnections,
    imageSettings,
    personaCreator,
    viewerPersonaId,
    selectedCreator,
    creators,
    confirmDeleteCreator,
  } = page;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CreatorFilter>("all");
  const [tab, setTab] = useState<CreatorTab>("profile");
  // The list is the overview; one Creator at a time opens under its own row.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const metricsQuery = useSlurpCreatorMetrics(target === "creators");
  const metricsById = new Map((metricsQuery.data?.creators ?? []).map((entry) => [entry.id, entry]));
  const postGuidanceQuery = useSlurpPostGuidance(target === "creators");

  if (target === "improve") return <SlurpCreatorImprover creators={creators} settings={settings} />;
  if (target !== "creators") return null;

  const needle = query.trim().toLowerCase();
  const visibleCreators = creators.filter((creator) => {
    if (needle && !`${creator.displayName} ${creator.handle}`.toLowerCase().includes(needle)) return false;
    if (filter === "active") return creator.autoPosting.enabled;
    if (filter === "paused") return !creator.autoPosting.enabled;
    if (filter === "attention") return needsAttention(creator);
    return true;
  });
  const filterCount = (value: CreatorFilter) =>
    value === "all"
      ? creators.length
      : value === "active"
        ? creators.filter((creator) => creator.autoPosting.enabled).length
        : value === "paused"
          ? creators.filter((creator) => !creator.autoPosting.enabled).length
          : creators.filter(needsAttention).length;
  const openImprove = () => onNavigate({ ...navigation, section: "creators", target: "improve" });

  const detailPanel = selectedCreator ? (
    <section
      className="min-w-0 overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--slurp-outline)]"
      aria-labelledby="slurp-selected-creator-title"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--slurp-outline)] bg-[linear-gradient(135deg,var(--slurp-surface-raised),color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised)))] p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar account={selectedCreator} />
          <div className="min-w-0 flex-1">
            <h2 id="slurp-selected-creator-title" className="truncate text-lg font-bold">
              {selectedCreator.displayName}
            </h2>
            <p className="truncate text-xs text-[var(--slurp-muted)]">
              @{selectedCreator.handle} ·{" "}
              {t(`ui.slurp.settings.creators.sourceStatus.${selectedCreator.sourceStatus.state}`)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:ms-auto sm:flex">
          <button
            type="button"
            onClick={() =>
              onNavigate({
                mode: "creator",
                view: "profile",
                accountId: selectedCreator.id,
                returnToSettings: navigation,
              })
            }
            className={quietButton}
          >
            {t("ui.slurp.settings.creators.viewProfile")}
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t("ui.slurp.settings.creators.tabsLabel", { defaultValue: "Creator settings" })}
        className="flex gap-1 overflow-x-auto border-b border-[var(--slurp-outline)] px-3 [scrollbar-width:none]"
      >
        {CREATOR_TABS.map((value) => (
          <button
            key={value}
            id={`slurp-creator-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls="slurp-creator-tabpanel"
            onClick={() => setTab(value)}
            className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold ${focusRing} ${tab === value ? "border-[var(--noodle-accent)] text-[var(--slurp-text)]" : "border-transparent text-[var(--slurp-muted)] hover:text-[var(--slurp-text)]"}`}
          >
            {t(`ui.slurp.settings.creators.tabs.${value}`)}
          </button>
        ))}
      </div>

      <div
        id="slurp-creator-tabpanel"
        role="tabpanel"
        aria-labelledby={`slurp-creator-tab-${tab}`}
        className="space-y-5 p-4 sm:p-5"
      >
        {tab === "profile" && (
          <>
            {/* The whole profile lives here. A settings tab that could only reach half the
                fields sent people to a second page for the other half. */}
            <SlurpCreatorProfileEditor
              key={selectedCreator.id}
              creator={selectedCreator}
              onRedraft={() => onRedraftCreator(selectedCreator)}
            />
            {selectedCreator.sourceStatus.state === "missing" && (
              <p className="rounded-lg bg-[var(--slurp-danger)]/10 p-3 text-xs text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/25">
                {t("ui.slurp.settings.creators.sourceMissing")}
              </p>
            )}
            {selectedCreator.sourceStatus.state === "changed" && (
              <div className="rounded-lg bg-[var(--slurp-warning)]/10 p-3 ring-1 ring-inset ring-[var(--slurp-warning)]/25">
                <p className="text-xs font-semibold">{t("ui.slurp.settings.creators.sourceChanged")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedCreator.disclosureMode === "open" && (
                    <button
                      type="button"
                      disabled={adoptSourceIdentity.isPending}
                      onClick={() =>
                        adoptSourceIdentity.mutate(selectedCreator.id, {
                          onError: (error) => toast.error(errorMessage(error)),
                        })
                      }
                      className={accentButton}
                    >
                      {t("ui.slurp.settings.creators.acceptIdentity")}
                    </button>
                  )}
                  <button type="button" onClick={() => onRedraftCreator(selectedCreator)} className={quietButton}>
                    {t("ui.slurp.settings.creators.reviewRedraft")}
                  </button>
                  <button
                    type="button"
                    disabled={dismissSourceChanges.isPending}
                    onClick={() =>
                      dismissSourceChanges.mutate(selectedCreator.id, {
                        onSuccess: () => toast.success(t("ui.slurp.settings.creators.acceptedChanges")),
                        onError: (error) => toast.error(errorMessage(error)),
                      })
                    }
                    className={quietButton}
                  >
                    {t("ui.slurp.settings.creators.acceptChanges")}
                  </button>
                </div>
              </div>
            )}
            <button type="button" onClick={openImprove} className={quietButton}>
              <Sparkles size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
              {t("ui.slurp.settings.creators.improve", { defaultValue: "Improve with AI" })}
            </button>
          </>
        )}

        {tab === "publishing" && (
          <>
            <SettingsGroup title={t("ui.slurp.settings.creators.postingGroup")}>
              {!personaCreator(selectedCreator) ? (
                <Toggle
                  label={t("ui.slurp.settings.creators.autoPost")}
                  value={selectedCreator.autoPosting.enabled}
                  onChange={(value) =>
                    updateAuto.mutate(
                      { accountId: selectedCreator.id, enabled: value },
                      { onError: (error) => toast.error(errorMessage(error)) },
                    )
                  }
                />
              ) : (
                <p className={noteClass}>{t("ui.slurp.settings.creators.personaAutomationDetail")}</p>
              )}
              <button type="button" onClick={() => setScheduleCreatorId(selectedCreator.id)} className={quietButton}>
                <CalendarClock size={15} aria-hidden="true" />
                {t("ui.slurp.settings.creators.postingSchedule")}
              </button>
            </SettingsGroup>
            {/* A creator who fishes for subscribers in public and pays it off behind the
                paywall needs their own two directions; empty means the global ones apply. */}
            <SettingsGroup title={t("ui.slurp.settings.creators.guidanceGroup")}>
              <p className={noteClass}>{t("ui.slurp.settings.creators.guidanceDetail")}</p>
              {(["public", "locked"] as const).map((access) => (
                <SlurpPostGuidanceField
                  key={access}
                  access={access}
                  creatorId={selectedCreator.id}
                  guidance={postGuidanceQuery.data}
                  inherited={
                    postGuidanceQuery.data
                      ? postGuidanceQuery.data.defaults[access] || postGuidanceQuery.data.builtIn[access]
                      : ""
                  }
                  label={t(`ui.slurp.settings.prompts.${access}Guidance`)}
                  detail={t("ui.slurp.settings.creators.guidanceInherits")}
                  generateLabel={t("ui.slurp.settings.prompts.guidanceGenerate")}
                  clearLabel={t("ui.slurp.settings.creators.guidanceInherit")}
                  savedMessage={t("ui.slurp.settings.prompts.guidanceSavedAccess")}
                  disabled={postGuidanceQuery.isLoading || postGuidanceQuery.isError}
                />
              ))}
            </SettingsGroup>
            <SettingsGroup title={t("ui.slurp.settings.creators.collabsGroup", { defaultValue: "Collabs" })}>
              <SettingAnchor settingKey="creatorCollabs">
                <CreatorCollabsEditor
                  creator={selectedCreator}
                  creators={creators}
                  collabs={settings.creatorCollabs}
                  onSave={(next) => update("creatorCollabs", next)}
                  t={t}
                />
              </SettingAnchor>
            </SettingsGroup>
            <SettingsGroup title={t("ui.slurp.settings.creators.contentMenuGroup", { defaultValue: "Content menu" })}>
              <SlurpPostGuidanceField
                access="menu"
                creatorId={selectedCreator.id}
                guidance={postGuidanceQuery.data}
                inherited=""
                label={t("ui.slurp.settings.creators.contentMenu", { defaultValue: "What this Creator offers" })}
                detail={t("ui.slurp.settings.creators.contentMenuDetail", {
                  defaultValue:
                    "Private. List what this Creator offers and what they will not do. Posts, comment replies, and messages follow it. Fans never see it.",
                })}
                generateLabel=""
                clearLabel={t("ui.slurp.settings.creators.contentMenuClear", { defaultValue: "Clear menu" })}
                savedMessage={t("ui.slurp.settings.creators.contentMenuSaved", {
                  defaultValue: "Content menu saved.",
                })}
                disabled={postGuidanceQuery.isLoading || postGuidanceQuery.isError}
              />
            </SettingsGroup>
            {selectedCreator.scheduleStatus && selectedCreator.scheduleStatus.state !== "not-applicable" && (
              /* A stale or missing schedule is an attention state, so it uses the same
                 tinted callout as a missing or changed source instead of a plain note. */
              <div
                className={
                  selectedCreator.scheduleStatus.state === "active"
                    ? `space-y-3 ${noteClass}`
                    : "space-y-3 rounded-lg bg-[var(--slurp-warning)]/10 p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--slurp-warning)]/25"
                }
              >
                <p>
                  <span className="font-semibold text-[var(--slurp-text)]">
                    {t("ui.slurp.settings.creators.conversationSchedule")}
                  </span>{" "}
                  {t(`ui.slurp.settings.creators.schedule.${selectedCreator.scheduleStatus.state}`)}
                </p>
                {(selectedCreator.scheduleStatus.state === "stale" ||
                  selectedCreator.scheduleStatus.state === "missing") && (
                  <button
                    type="button"
                    disabled={refreshConversationSchedule.isPending}
                    onClick={() => {
                      void showConfirmDialog({
                        title: t("ui.slurp.settings.creators.refreshConversationSchedule"),
                        message: t("ui.slurp.settings.creators.refreshConversationScheduleConfirm"),
                        confirmLabel: t("ui.slurp.settings.creators.refreshConversationSchedule"),
                        cancelLabel: t("ui.slurp.actions.cancel"),
                      }).then((confirmed) => {
                        if (!confirmed) return;
                        refreshConversationSchedule.mutate(selectedCreator.id);
                      });
                    }}
                    className={accentButton}
                  >
                    {refreshConversationSchedule.isPending ? (
                      <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <CalendarClock size={14} aria-hidden="true" />
                    )}
                    {/* The work happens on the server, so the button says so while it waits.
                        The result itself arrives as a toast and as the status line above. */}
                    {refreshConversationSchedule.isPending
                      ? t("ui.slurp.settings.creators.refreshingConversationSchedule", {
                          defaultValue: "Rebuilding the schedule…",
                        })
                      : t("ui.slurp.settings.creators.refreshConversationSchedule")}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {tab === "images" && (
          <SettingsGroup title={t("ui.slurp.settings.creators.imagesGroup")}>
            <Toggle
              label={t("ui.slurp.settings.creators.images")}
              value={selectedCreator.autoPosting.imagesEnabled}
              onChange={(value) =>
                updateAuto.mutate(
                  { accountId: selectedCreator.id, imagesEnabled: value },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
            />
            <Field
              label={t("ui.slurp.settings.creators.imageConnection")}
              detail={t("ui.slurp.settings.creators.imageConnectionDetail")}
            >
              <select
                disabled={
                  imageSettingsQuery.isLoading ||
                  imageSettingsQuery.isError ||
                  connectionsQuery.isLoading ||
                  connectionsQuery.isError ||
                  updateImages.isPending
                }
                value={imageSettings?.creatorConnectionIds[selectedCreator.id] ?? ""}
                onChange={(event) =>
                  updateImages.mutate(
                    { creatorId: selectedCreator.id, connectionId: event.target.value || null },
                    { onError: (error) => toast.error(errorMessage(error)) },
                  )
                }
                className={selectClass}
              >
                <option value="">{t("ui.slurp.settings.creators.inheritImageConnection")}</option>
                {imageConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name ?? connection.model ?? connection.id}
                  </option>
                ))}
              </select>
            </Field>
            {selectedCreator.sourceAccountId && !personaCreator(selectedCreator) && (
              <Field
                settingKey="characterImageInstructions"
                label={t("ui.slurp.settings.creators.imageInstructions")}
                detail={t("ui.slurp.settings.creators.imageInstructionsDetail")}
              >
                <select
                  disabled={updateSettings.isPending}
                  value={String(settings.characterImageInstructions[selectedCreator.sourceAccountId] ?? "engine")}
                  onChange={(event) => {
                    const characterId = selectedCreator.sourceAccountId!;
                    const { [characterId]: _previous, ...rest } = settings.characterImageInstructions;
                    void update(
                      "characterImageInstructions",
                      event.target.value === "engine"
                        ? rest
                        : { ...rest, [characterId]: event.target.value === "true" },
                    );
                  }}
                  className={selectClass}
                >
                  <option value="engine">{t("ui.slurp.settings.creators.imageInstructionsEngine")}</option>
                  <option value="true">{t("ui.slurp.settings.creators.imageInstructionsOn")}</option>
                  <option value="false">{t("ui.slurp.settings.creators.imageInstructionsOff")}</option>
                </select>
              </Field>
            )}
          </SettingsGroup>
        )}

        {tab === "messages" &&
          /* Every Creator's policy and prices are the player's to set, world-run ones
             included: Slurp is single-player and this panel is where Creators are managed.
             An unset value still falls back to the world default. The persona identifies the
             viewer to the route and nothing else: a Creator's own source account is not a
             persona, so passing that made the request 404. */
          (viewerPersonaId ? (
            <CreatorMessagingGroup
              creatorId={selectedCreator.id}
              personaId={viewerPersonaId}
              setMessaging={setCreatorMessaging}
              setPrice={setCreatorPrice}
              worldRulesAction={
                <button
                  type="button"
                  onClick={() => onNavigate({ ...navigation, section: "world", target: "messaging" })}
                  className={quietButton}
                >
                  {t("ui.slurp.settings.creators.openWorldMessaging")}
                </button>
              }
            />
          ) : (
            <p className={noteClass}>{t("ui.slurp.settings.creators.messagesWorldRules")}</p>
          ))}

        {tab === "danger" && (
          <div className="space-y-3 rounded-lg p-3 ring-1 ring-inset ring-[var(--slurp-danger)]/30">
            <p className="text-xs font-semibold text-[var(--slurp-danger)]">
              {t("ui.slurp.settings.creators.moreActions")}
            </p>
            <button
              type="button"
              disabled={deleteCreator.isPending}
              onClick={() => void confirmDeleteCreator(selectedCreator)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/50 hover:bg-[var(--slurp-danger)]/10 disabled:opacity-50 ${focusRing}`}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t("ui.slurp.settings.creators.delete")}
            </button>
          </div>
        )}
      </div>
    </section>
  ) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BackstagePageHeader
          title={t("ui.slurp.settings.creators.title")}
          detail={t("ui.slurp.settings.creators.detail")}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={openImprove} className={quietButton}>
            <Sparkles size={14} className="text-[var(--noodle-accent)]" aria-hidden="true" />
            {t("ui.slurp.settings.creators.improve", { defaultValue: "Improve with AI" })}
          </button>
          <button
            type="button"
            aria-pressed={bulkCreatorIds !== null}
            onClick={() => setBulkCreatorIds((ids) => (ids ? null : new Set()))}
            className={quietButton}
          >
            <ListChecks size={14} aria-hidden="true" />
            {t(bulkCreatorIds ? "ui.slurp.settings.creators.selectDone" : "ui.slurp.settings.creators.select")}
          </button>
          <button type="button" onClick={onAddCreators} className={accentButton}>
            <UsersRound size={14} aria-hidden="true" />
            {t("ui.slurp.settings.creators.add")}
          </button>
        </div>
      </div>

      {bulkCreatorIds && creators.length ? (
        <div className="space-y-3">
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--slurp-surface-raised)] p-3 text-xs ring-1 ring-inset ring-[var(--slurp-outline)]"
            aria-live="polite"
          >
            <span className="me-auto font-semibold">
              {t("ui.slurp.settings.creators.selectedCount", { count: bulkCreatorIds.size })}
            </span>
            <button
              type="button"
              onClick={() => setBulkCreatorIds(new Set(visibleCreators.map((creator) => creator.id)))}
              className={quietButton}
            >
              {t("ui.slurp.settings.creators.selectAll")}
            </button>
            <button
              type="button"
              disabled={bulkCreatorIds.size === 0}
              onClick={() => setBulkCreatorIds(new Set())}
              className={quietButton}
            >
              {t("ui.slurp.settings.creators.bulk.clear")}
            </button>
          </div>
          {bulkCreatorIds.size > 0 && (
            <SlurpCreatorBulkEdit
              creators={creators.filter((creator) => bulkCreatorIds.has(creator.id))}
              tagOptions={settings.discoveryTags.map((entry) => entry.tag)}
            />
          )}
        </div>
      ) : null}

      {accountsQuery.isLoading ? (
        <div className="flex justify-center py-10 text-[var(--slurp-muted)]" role="status">
          <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
        </div>
      ) : accountsQuery.isError ? (
        <div className="rounded-xl bg-[var(--slurp-danger)]/10 p-5 text-sm ring-1 ring-inset ring-[var(--slurp-danger)]/25">
          <p>{t("ui.slurp.settings.creators.loadError")}</p>
          <button type="button" onClick={() => void accountsQuery.refetch()} className={`mt-3 ${quietButton}`}>
            {t("capabilities.actions.tryAgain")}
          </button>
        </div>
      ) : creators.length && selectedCreator ? (
        <div className="min-w-0 space-y-3">
          <CreatorMetricsTotals metrics={metricsQuery.data?.creators ?? []} t={t} />
          <label className="relative block">
            <span className="sr-only">
              {t("ui.slurp.settings.creators.search", { defaultValue: "Search Creators" })}
            </span>
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("ui.slurp.settings.creators.search", { defaultValue: "Search Creators" })}
              className={`min-h-11 w-full rounded-lg bg-[var(--slurp-surface-raised)] ps-9 pe-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] sm:text-sm ${focusRing}`}
            />
          </label>
          <div
            className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]"
            role="group"
            aria-label={t("ui.slurp.settings.creators.filterLabel", { defaultValue: "Filter Creators" })}
          >
            {CREATOR_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-inset ${focusRing} ${filter === value ? "bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent-foreground)] ring-[var(--noodle-accent)]/50" : "ring-[var(--slurp-outline)] hover:bg-[var(--slurp-surface-raised)]"}`}
              >
                {t(`ui.slurp.settings.creators.filters.${value}`)}
                <span className="tabular-nums text-[var(--slurp-muted)]">{filterCount(value)}</span>
              </button>
            ))}
          </div>
          <div
            className="rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]"
            aria-label={t("ui.slurp.settings.creators.listLabel")}
          >
            {visibleCreators.length === 0 && (
              <p className="p-5 text-center text-xs text-[var(--slurp-muted)]">
                {t("ui.slurp.settings.creators.noMatches", { defaultValue: "No Creators match." })}
              </p>
            )}
            {visibleCreators.map((creator) => {
              const status = reserveStatusQuery.data?.creators.find((entry) => entry.accountId === creator.id);
              const expanded = expandedId === creator.id && creator.id === selectedCreator.id;
              const selected = bulkCreatorIds ? bulkCreatorIds.has(creator.id) : expanded;
              const attention = needsAttention(creator);
              return (
                <Fragment key={creator.id}>
                  <button
                    type="button"
                    aria-pressed={bulkCreatorIds ? selected : undefined}
                    aria-expanded={bulkCreatorIds ? undefined : expanded}
                    onClick={() =>
                      bulkCreatorIds
                        ? setBulkCreatorIds((ids) => {
                            const next = new Set(ids ?? []);
                            if (next.has(creator.id)) next.delete(creator.id);
                            else next.add(creator.id);
                            return next;
                          })
                        : (() => {
                            if (expandedId === creator.id) {
                              setExpandedId(null);
                              return;
                            }
                            setSelectedCreatorId(creator.id);
                            setExpandedId(creator.id);
                            setTab("profile");
                          })()
                    }
                    className={`flex min-h-16 w-full items-center gap-3 border-b border-[var(--slurp-outline)] px-3 py-2.5 text-start transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none ${selected ? "bg-[var(--noodle-accent)]/10" : "hover:bg-[var(--slurp-canvas)]"}`}
                  >
                    {bulkCreatorIds && (
                      <CheckCircle2
                        size={18}
                        aria-hidden="true"
                        className={selected ? "text-[var(--noodle-accent)]" : "text-[var(--slurp-muted)]/40"}
                      />
                    )}
                    <Avatar account={creator} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{creator.displayName}</span>
                      <span className="block truncate text-xs text-[var(--slurp-muted)]">
                        {status?.nextPreparedAt
                          ? t("ui.slurp.settings.creators.nextPost", {
                              date: formatDateTime(status.nextPreparedAt, i18n.language),
                            })
                          : `@${creator.handle}`}
                      </span>
                      {/* A stale schedule stops applying silently: the Creator loses their
                          daily rhythm and their message pacing, and it just looks like the
                          writing got worse. Say so where the Creator is managed. */}
                      {creator.scheduleStatus?.state === "stale" && (
                        <span className="mt-0.5 block truncate text-[0.68rem] font-semibold text-[var(--slurp-warning)]">
                          {t("ui.slurp.settings.creators.scheduleStale")}
                        </span>
                      )}
                    </span>
                    <CreatorMetricsRow metrics={metricsById.get(creator.id)} t={t} />
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ring-1 ring-inset ${attention ? "text-[var(--slurp-warning)] ring-[var(--slurp-warning)]/30" : creator.autoPosting.enabled ? "text-[var(--slurp-success)] ring-[var(--slurp-success)]/30" : "text-[var(--slurp-muted)] ring-[var(--slurp-outline)]"}`}
                    >
                      {attention
                        ? t("ui.slurp.settings.creators.filters.attention")
                        : creator.autoPosting.enabled
                          ? t("ui.slurp.settings.creators.filters.active")
                          : t("ui.slurp.settings.creators.filters.paused")}
                    </span>
                  </button>
                  {expanded && !bulkCreatorIds && detailPanel}
                </Fragment>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-8 text-center text-sm text-[var(--slurp-muted)] ring-1 ring-inset ring-dashed ring-[var(--slurp-outline)]">
          {t("ui.slurp.settings.creators.none")}
        </div>
      )}
    </div>
  );
}

type Translate = SlurpBackstagePageProps["t"];
const METRIC_KEYS = ["posts", "followers", "subscribers", "likes", "replies", "earnings", "unread", "arcs"] as const;
const metricLabel = (t: Translate, key: (typeof METRIC_KEYS)[number]) =>
  t(`ui.slurp.settings.creators.metrics.${key}`, {
    defaultValue: {
      posts: "Posts",
      followers: "Followers",
      subscribers: "Subs",
      likes: "Likes",
      replies: "Replies",
      earnings: "Earned",
      unread: "Unread",
      arcs: "Arcs",
    }[key],
  });
const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** Totals across every Creator, so running many of them stays manageable. */
function CreatorMetricsTotals({ metrics, t }: { metrics: SlurpCreatorMetrics[]; t: Translate }) {
  if (metrics.length === 0) return null;
  return (
    <dl className="grid grid-cols-4 gap-2 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)] sm:grid-cols-8">
      {METRIC_KEYS.map((key) => (
        <div key={key} className="min-w-0">
          <dt className="truncate text-[0.68rem] font-semibold text-[var(--slurp-muted)]">{metricLabel(t, key)}</dt>
          <dd className="text-sm font-bold tabular-nums">
            {compact.format(metrics.reduce((sum, entry) => sum + entry[key], 0))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CreatorMetricsRow({ metrics, t }: { metrics: SlurpCreatorMetrics | undefined; t: Translate }) {
  if (!metrics) return null;
  return (
    <span className="hidden shrink-0 gap-4 text-end md:flex">
      {METRIC_KEYS.map((key) => (
        <span key={key} className="w-12">
          <span className="block text-sm font-bold tabular-nums">{compact.format(metrics[key])}</span>
          <span className="block truncate text-[0.62rem] text-[var(--slurp-muted)]">{metricLabel(t, key)}</span>
        </span>
      ))}
    </span>
  );
}

type Collab = SlurpBackstagePageProps["settings"]["creatorCollabs"][number];
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/**
 * Which other Creators this one may collab with, and what each pair makes. A collab happens as a
 * shared arc: automatic crossovers pick a listed partner first.
 */
function CreatorCollabsEditor({
  creator,
  creators,
  collabs,
  onSave,
  t,
}: {
  creator: NoodlerManagedStageProfile;
  creators: NoodlerManagedStageProfile[];
  collabs: Collab[];
  onSave: (next: Collab[]) => unknown;
  t: Translate;
}) {
  const others = creators.filter((entry) => entry.id !== creator.id);
  const byPair = new Map(collabs.map((collab) => [pairKey(collab.creatorIds[0], collab.creatorIds[1]), collab]));
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const toggle = (partnerId: string) => {
    const key = pairKey(creator.id, partnerId);
    void onSave(
      byPair.has(key)
        ? collabs.filter((collab) => pairKey(collab.creatorIds[0], collab.creatorIds[1]) !== key)
        : [...collabs, { creatorIds: [creator.id, partnerId], content: "" }],
    );
  };
  const saveContent = (partnerId: string) => {
    const key = pairKey(creator.id, partnerId);
    const content = drafts[key];
    if (content === undefined || content === byPair.get(key)?.content) return;
    void onSave(
      collabs.map((collab) =>
        pairKey(collab.creatorIds[0], collab.creatorIds[1]) === key ? { ...collab, content } : collab,
      ),
    );
  };
  if (others.length === 0)
    return (
      <p className={noteClass}>
        {t("ui.slurp.settings.creators.collabsNone", { defaultValue: "Add another Creator to set up collabs." })}
      </p>
    );
  return (
    <div className="space-y-2">
      <p className={noteClass}>
        {t("ui.slurp.settings.creators.collabsDetail", {
          defaultValue:
            "Pick who this Creator may collab with and what they make together. Collabs happen as shared arcs; automatic crossovers choose a partner from this list first.",
        })}
      </p>
      {others.map((partner) => {
        const key = pairKey(creator.id, partner.id);
        const collab = byPair.get(key);
        return (
          <div key={partner.id} className="space-y-2 rounded-lg p-2 ring-1 ring-inset ring-[var(--slurp-outline)]">
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(collab)}
                onChange={() => toggle(partner.id)}
                className="size-4 accent-[var(--noodle-accent)]"
              />
              <Avatar account={partner} size="sm" />
              <span className="min-w-0 flex-1 truncate">{partner.displayName}</span>
            </label>
            {collab && (
              <input
                value={drafts[key] ?? collab.content}
                maxLength={600}
                onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                onBlur={() => saveContent(partner.id)}
                placeholder={t("ui.slurp.settings.creators.collabContent", {
                  defaultValue: "What they make together, e.g. joint photo sets, shoutouts, a cooking stream",
                })}
                aria-label={t("ui.slurp.settings.creators.collabContentLabel", {
                  defaultValue: "Collab content with {{name}}",
                  name: partner.displayName,
                })}
                className={selectClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
