import { CalendarClock, CheckCircle2, ListChecks, Loader2, Pencil, Trash2, UsersRound } from "lucide-react";
import { Field, SectionTitle, SettingsGroup, Toggle } from "./SlurpSettingsControls";
import { SlurpCreatorBulkEdit } from "./SlurpCreatorBulkEdit";
import { SlurpDiscoveryProfileEditor } from "./SlurpDiscoveryProfileEditor";
import { toast } from "sonner";
import { formatDateTime } from "./SlurpDateTime";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Avatar } from "./SlurpShell";
import { SlurpCreatorImprover } from "./SlurpCreatorImprover";
import type { SlurpBackstagePageProps } from "./SlurpSettings";
import { errorMessage, CreatorMessagingGroup } from "./SlurpBackstageWorkflow";

/** Creators: management, bulk edit, and Improve with AI. */
export function SlurpBackstageCreators(page: SlurpBackstagePageProps) {
  const {
    navigation,
    onNavigate,
    onAddCreators,
    onEditCreator,
    onRedraftCreator,
    t,
    i18n,
    updateSettings,
    section,
    target,
    settings,
    setScheduleCreatorId,
    setSelectedCreatorId,
    bulkCreatorIds,
    setBulkCreatorIds,
    bulkUpdateCreators,
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
    selectedCreator,
    creators,
    confirmDeleteCreator,
  } = page;
  return (
    <>
      {target === "creators" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle
              title={t("ui.slurp.settings.creators.title")}
              detail={t("ui.slurp.settings.creators.detail")}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={bulkCreatorIds !== null}
                onClick={() => setBulkCreatorIds((ids) => (ids ? null : new Set()))}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
              >
                <ListChecks size={14} aria-hidden="true" />
                {t(bulkCreatorIds ? "ui.slurp.settings.creators.selectDone" : "ui.slurp.settings.creators.select")}
              </button>
              <button
                type="button"
                onClick={onAddCreators}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--noodle-accent)]/40 px-3 text-xs font-semibold text-[var(--noodle-accent)] hover:bg-[var(--noodle-accent)]/10"
              >
                <UsersRound size={14} />
                {t("ui.slurp.settings.creators.add")}
              </button>
            </div>
          </div>
          {bulkCreatorIds && accountsQuery.data?.length ? (
            <div className="space-y-3">
              <div
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3 text-xs"
                aria-live="polite"
              >
                <span className="me-auto font-semibold">
                  {t("ui.slurp.settings.creators.selectedCount", { count: bulkCreatorIds.size })}
                </span>
                <button
                  type="button"
                  onClick={() => setBulkCreatorIds(new Set(accountsQuery.data.map((creator) => creator.id)))}
                  className="min-h-10 rounded-lg border border-[var(--border)] px-3 font-semibold hover:bg-[var(--accent)]"
                >
                  {t("ui.slurp.settings.creators.selectAll")}
                </button>
                <button
                  type="button"
                  disabled={bulkCreatorIds.size === 0}
                  onClick={() => setBulkCreatorIds(new Set())}
                  className="min-h-10 rounded-lg border border-[var(--border)] px-3 font-semibold hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  {t("ui.slurp.settings.creators.bulk.clear")}
                </button>
              </div>
              {bulkCreatorIds.size > 0 && (
                <SlurpCreatorBulkEdit
                  creators={accountsQuery.data.filter((creator) => bulkCreatorIds.has(creator.id))}
                  tagOptions={settings.discoveryTags.map((entry) => entry.tag)}
                />
              )}
            </div>
          ) : null}
          {accountsQuery.isLoading ? (
            <div className="flex justify-center py-10 text-[var(--muted-foreground)]" role="status">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : accountsQuery.isError ? (
            <div className="rounded-lg border border-red-400/30 p-5 text-sm">
              <p>{t("ui.slurp.settings.creators.loadError")}</p>
              <button
                type="button"
                onClick={() => void accountsQuery.refetch()}
                className="mt-3 min-h-11 rounded-lg border border-[var(--border)] px-3 font-semibold"
              >
                {t("capabilities.actions.tryAgain")}
              </button>
            </div>
          ) : accountsQuery.data?.length && selectedCreator ? (
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(13rem,0.78fr)_minmax(0,1.7fr)]">
              <div
                className="grid snap-x grid-flow-col auto-cols-[minmax(13rem,1fr)] gap-2 overflow-x-auto rounded-xl pb-2 pe-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:sticky xl:top-4 xl:block xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:rounded-xl xl:bg-[var(--slurp-surface-raised,var(--background))] xl:pb-0 xl:pe-0 xl:ring-1 xl:ring-inset xl:ring-[var(--border)]"
                aria-label={t("ui.slurp.settings.creators.listLabel")}
              >
                {accountsQuery.data.map((creator) => {
                  const status = reserveStatusQuery.data?.creators.find((entry) => entry.accountId === creator.id);
                  const selected = bulkCreatorIds ? bulkCreatorIds.has(creator.id) : creator.id === selectedCreator.id;
                  return (
                    <button
                      key={creator.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        bulkCreatorIds
                          ? setBulkCreatorIds((ids) => {
                              const next = new Set(ids ?? []);
                              if (next.has(creator.id)) next.delete(creator.id);
                              else next.add(creator.id);
                              return next;
                            })
                          : setSelectedCreatorId(creator.id)
                      }
                      className={`flex min-h-20 w-full snap-start items-center gap-3 rounded-xl bg-[var(--slurp-surface-raised,var(--background))] px-3 py-3 text-left shadow-sm ring-1 ring-inset transition-[background-color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:active:scale-100 xl:rounded-none xl:border-b xl:border-[var(--border)] xl:shadow-none xl:last:border-b-0 ${selected ? "ring-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10 xl:ring-0" : "ring-[var(--border)] hover:bg-[var(--accent)] xl:ring-0"}`}
                    >
                      {bulkCreatorIds && (
                        <CheckCircle2
                          size={18}
                          aria-hidden="true"
                          className={selected ? "text-[var(--noodle-accent)]" : "text-[var(--muted-foreground)]/40"}
                        />
                      )}
                      <Avatar account={creator} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{creator.displayName}</span>
                        <span className="block truncate text-xs text-[var(--muted-foreground)]">@{creator.handle}</span>
                        <span className="mt-1 block truncate text-[0.68rem] text-[var(--muted-foreground)]">
                          {status?.nextPreparedAt
                            ? t("ui.slurp.settings.creators.nextPost", {
                                date: formatDateTime(status.nextPreparedAt, i18n.language),
                              })
                            : t(`ui.slurp.settings.creators.sourceStatus.${creator.sourceStatus.state}`)}
                        </span>
                        {/* A stale schedule stops applying silently: the Creator loses their
                                    daily rhythm and their message pacing, and it just looks like the
                                    writing got worse. Say so where the Creator is managed. */}
                        {creator.scheduleStatus?.state === "stale" && (
                          <span className="mt-1 block truncate text-[0.68rem] font-semibold text-amber-600 dark:text-amber-400">
                            {t("ui.slurp.settings.creators.scheduleStale")}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <section
                className="min-w-0 overflow-hidden rounded-xl bg-[var(--slurp-canvas,var(--background))] shadow-[var(--slurp-shadow-floating)] ring-1 ring-inset ring-[var(--border)]"
                aria-labelledby="slurp-selected-creator-title"
              >
                <div className="relative isolate flex flex-col gap-4 overflow-hidden border-b border-[var(--border)] bg-[linear-gradient(135deg,var(--slurp-surface-raised,var(--background)),color-mix(in_srgb,var(--noodle-accent)_9%,var(--slurp-surface-raised)))] p-4 sm:flex-row sm:items-center sm:p-5">
                  <span
                    className="pointer-events-none absolute -end-8 -top-14 -z-10 h-36 w-36 rounded-full bg-[var(--noodle-accent)]/10 blur-2xl"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar account={selectedCreator} />
                    <div className="min-w-0 flex-1">
                      <h2 id="slurp-selected-creator-title" className="truncate text-base font-bold">
                        {selectedCreator.displayName}
                      </h2>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">@{selectedCreator.handle}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex">
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
                      className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    >
                      {t("ui.slurp.settings.creators.viewProfile")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCreator(selectedCreator)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]"
                    >
                      <Pencil size={14} />
                      {t("ui.slurp.settings.creators.edit")}
                    </button>
                  </div>
                </div>

                <div className="space-y-5 p-4 sm:p-5">
                  {/* Quick edit: each change saves at once through the same route as bulk edit. */}
                  <SlurpDiscoveryProfileEditor
                    key={selectedCreator.id}
                    gender={selectedCreator.gender ?? null}
                    tags={selectedCreator.tags ?? []}
                    disabled={bulkUpdateCreators.isPending}
                    onChange={(patch) =>
                      bulkUpdateCreators.mutate(
                        {
                          ids: [selectedCreator.id],
                          patch: patch.tags ? { tags: patch.tags } : { gender: patch.gender ?? null },
                        },
                        { onError: (error) => toast.error(errorMessage(error)) },
                      )
                    }
                  />
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
                      <p className="rounded-lg border border-[var(--border)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
                        {t("ui.slurp.settings.creators.personaAutomationDetail")}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setScheduleCreatorId(selectedCreator.id)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold hover:bg-[var(--accent)]"
                    >
                      <CalendarClock size={15} />
                      {t("ui.slurp.settings.creators.postingSchedule")}
                    </button>
                  </SettingsGroup>

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
                        className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
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
                        label={t("ui.slurp.settings.creators.imageInstructions")}
                        detail={t("ui.slurp.settings.creators.imageInstructionsDetail")}
                      >
                        <select
                          disabled={updateSettings.isPending}
                          value={String(
                            settings.characterImageInstructions[selectedCreator.sourceAccountId] ?? "engine",
                          )}
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
                          className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--slurp-canvas,var(--background))] px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] disabled:opacity-50 sm:text-sm"
                        >
                          <option value="engine">{t("ui.slurp.settings.creators.imageInstructionsEngine")}</option>
                          <option value="true">{t("ui.slurp.settings.creators.imageInstructionsOn")}</option>
                          <option value="false">{t("ui.slurp.settings.creators.imageInstructionsOff")}</option>
                        </select>
                      </Field>
                    )}
                  </SettingsGroup>

                  {/* The message policy and prices had working, ownership-gated endpoints
                              and no UI at all, so every Creator was stuck on the shipped defaults
                              and the paid DM policy could never be chosen. Only the persona that
                              operates a Creator may set them, which is what the routes enforce. */}
                  {personaCreator(selectedCreator) && selectedCreator.sourceAccountId && (
                    <CreatorMessagingGroup
                      creatorId={selectedCreator.id}
                      personaId={selectedCreator.sourceAccountId}
                      setMessaging={setCreatorMessaging}
                      setPrice={setCreatorPrice}
                    />
                  )}

                  {selectedCreator.scheduleStatus && selectedCreator.scheduleStatus.state !== "not-applicable" && (
                    <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                      <p className="text-xs leading-5 text-[var(--slurp-muted)]">
                        <span className="font-semibold text-[var(--foreground)]">
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
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
                        >
                          {refreshConversationSchedule.isPending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CalendarClock size={14} />
                          )}
                          {t("ui.slurp.settings.creators.refreshConversationSchedule")}
                        </button>
                      )}
                    </div>
                  )}
                  {selectedCreator.sourceStatus.state === "missing" && (
                    <p className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 text-xs text-red-300">
                      {t("ui.slurp.settings.creators.sourceMissing")}
                    </p>
                  )}
                  {selectedCreator.sourceStatus.state === "changed" && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--accent)]/30 p-3">
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
                            className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-50"
                          >
                            {t("ui.slurp.settings.creators.acceptIdentity")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRedraftCreator(selectedCreator)}
                          className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold"
                        >
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
                          className="min-h-11 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
                        >
                          {t("ui.slurp.settings.creators.acceptChanges")}
                        </button>
                      </div>
                    </div>
                  )}

                  <details className="rounded-lg border border-red-400/25">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-xs font-semibold text-red-300 [&::-webkit-details-marker]:hidden">
                      {t("ui.slurp.settings.creators.moreActions")}
                    </summary>
                    <div className="border-t border-red-400/20 p-3">
                      <button
                        type="button"
                        disabled={deleteCreator.isPending}
                        onClick={() => void confirmDeleteCreator(selectedCreator)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-400/50 px-3 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        {t("ui.slurp.settings.creators.delete")}
                      </button>
                    </div>
                  </details>
                </div>
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
              {t("ui.slurp.settings.creators.none")}
            </div>
          )}
        </div>
      )}

      {target === "improve" && <SlurpCreatorImprover creators={accountsQuery.data ?? []} settings={settings} />}
    </>
  );
}
