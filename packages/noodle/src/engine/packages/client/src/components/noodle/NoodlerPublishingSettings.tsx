import { RefreshCw, Trash2, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  useNoodle,
  useNoodlerAccounts,
  useNoodlerReserveStatus,
  useNoodlerImageConnections,
  useNoodlerFanActivityStatus,
  useRefreshAllNoodlerCreatorsNow,
  useRefreshNoodlerFanActivityNow,
  useUpdateNoodleSettings,
  useUpdateNoodlerAutoPosting,
  useUpdateNoodlerImageConnections,
  useDeleteNoodlerStageProfile,
  useRemoveNoodleCharacter,
} from "../../hooks/use-noodle";
import { useConnections } from "../../hooks/use-connections";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Avatar } from "./NoodleShell";
import { summarizeRefreshOutcomes } from "./noodle-auto-post";
import type { NoodleSettingsUpdateInput, NoodlerFanArchetypeWeights } from "@marinara-engine/shared";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const FAN_ARCHETYPES = ["ordinary", "eccentric", "crossFandom", "raider", "organicDiscovery", "freeResource"] as const;

function BoundedNumberInput({
  value,
  min,
  max,
  onCommit,
  onInvalid,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number, revert: () => void) => void;
  onInvalid?: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      setDraft(String(value));
      onInvalid?.();
      return;
    }
    onCommit(parsed, () => setDraft(String(value)));
  };
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
      className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"
    />
  );
}

interface NoodlerPublishingSettingsProps {
  active: boolean;
  view: "publishing" | "creators" | "audience";
  onOpenCreator?: (accountId: string) => void;
}

export function NoodlerPublishingSettings({ active, view, onOpenCreator }: NoodlerPublishingSettingsProps) {
  const { t } = useUiTranslation();
  const { data } = useNoodle();
  const settings = data?.settings;
  const accountsQuery = useNoodlerAccounts(settings?.enableNoodler === true);
  const accounts = accountsQuery.data ?? [];
  const connectionsQuery = useConnections();
  const connections = connectionsQuery.data ?? [];
  const textConnection = connections.find(
    (connection) => connection.id === settings?.generationConnectionId,
  );
  const imageConnections = connections.filter((connection) => connection.provider === "image_generation");
  const imageSettingsQuery = useNoodlerImageConnections(active && settings?.enableNoodler === true);
  const imageSettings = imageSettingsQuery.data;
  const imageConnection = imageConnections.find(
    (connection) => connection.id === imageSettings?.defaultConnectionId,
  );
  const statusQuery = useNoodlerReserveStatus(active && settings?.enableNoodler === true);
  const fanStatusQuery = useNoodlerFanActivityStatus(active && settings?.enableNoodler === true);
  const status = statusQuery.data;
  const updateSettings = useUpdateNoodleSettings();
  const updateAuto = useUpdateNoodlerAutoPosting();
  const updateImageConnections = useUpdateNoodlerImageConnections();
  const deleteCreator = useDeleteNoodlerStageProfile();
  const removeCharacter = useRemoveNoodleCharacter();
  const refreshAll = useRefreshAllNoodlerCreatorsNow();
  const refreshFans = useRefreshNoodlerFanActivityNow();
  // Toggles roll back on rejection, which is silent on its own: say so, or the user reads the
  // reverted switch as the server having accepted a different value.
  const toastToggleFailure = (error: unknown) =>
    toast.error(errorMessage(error, t("ui.noodle.noodlerschedulemanagermodal.couldNotUpdateAutomation")));
  const nextByAccount = new Map(status?.creators.map((entry) => [entry.accountId, entry.nextPreparedAt]) ?? []);

  return (
    <div className="space-y-4">
      {view === "publishing" && <section className="space-y-3 border-b border-[var(--border)] pb-4">
        <label className="block max-w-md space-y-1.5 text-xs font-semibold">
          <span className="block text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.defaultImageConnection")}
          </span>
          <select
            value={imageSettings?.defaultConnectionId ?? ""}
            disabled={updateImageConnections.isPending}
            onChange={(event) =>
              updateImageConnections.mutate(
                { defaultConnectionId: event.target.value || null },
                { onError: toastToggleFailure },
              )
            }
            className="h-9 w-full rounded-md border border-[var(--border)] bg-transparent px-2 text-sm"
          >
            <option value="">{t("ui.noodle.noodlerschedulemanagermodal.defaultImageModel")}</option>
            {imageConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name ?? connection.model ?? connection.id}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3 text-xs leading-5">
          <p className="font-semibold">
            {t("ui.noodle.noodlerschedulemanagermodal.generationRuntime")}
          </p>
          <p className="mt-1 text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.textModelValue", {
              model:
                textConnection?.model ??
                t("ui.noodle.noodlerschedulemanagermodal.notConfigured"),
            })}
          </p>
          <p className="text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.imageModelValue", {
              model:
                imageConnection?.model ??
                t("ui.noodle.noodlerschedulemanagermodal.defaultImageModel"),
            })}
          </p>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.lifecycleHelp")}
          </p>
        </div>
      </section>}
      {view === "audience" && <section className="space-y-3 border-b border-[var(--border)] pb-4">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{t("ui.noodle.noodlerfanactivity.enabled")}</span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerfanactivity.help")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings?.fanActivityEnabled ?? false}
            disabled={updateSettings.isPending || !settings}
            onChange={(event) =>
              updateSettings.mutate({ fanActivityEnabled: event.target.checked }, { onError: toastToggleFailure })
            }
            className="h-5 w-5 accent-[var(--noodle-accent)]"
          />
        </label>
        <label className="block space-y-1 text-xs font-semibold">
          <span className="block text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerfanactivity.runsPerDay")}
          </span>
          <BoundedNumberInput
            value={settings?.fanActivityRunsPerDay ?? 4}
            min={1}
            max={24}
            onInvalid={() =>
              toast.error(t("ui.noodle.noodlerfanactivity.boundedValueInvalid", { min: 1, max: 24 }))
            }
            onCommit={(value, revert) =>
              updateSettings.mutate(
                { fanActivityRunsPerDay: value },
                {
                  onError: (error) => {
                    toastToggleFailure(error);
                    revert();
                  },
                },
              )
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(
            [
              ["fanLikesPerRefresh", "likes", 0, 24],
              ["fanRepliesPerRefresh", "replies", 0, 12],
              ["fanRepostsPerRefresh", "reposts", 0, 12],
            ] as const
          ).map(([key, label, min, max]) => (
            <label key={key} className="space-y-1 text-xs font-semibold">
              <span className="block text-[var(--muted-foreground)]">{t(`ui.noodle.noodlerfanactivity.${label}`)}</span>
              <BoundedNumberInput
                value={settings?.[key] ?? 0}
                min={min}
                max={max}
                onInvalid={() =>
                  toast.error(t("ui.noodle.noodlerfanactivity.boundedValueInvalid", { min, max }))
                }
                onCommit={(value, revert) =>
                  updateSettings.mutate({ [key]: value } as NoodleSettingsUpdateInput, {
                    onError: (error) => {
                      toastToggleFailure(error);
                      revert();
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FAN_ARCHETYPES.map((archetype) => (
            <label key={archetype} className="space-y-1 text-xs font-semibold">
              <span className="block text-[var(--muted-foreground)]">
                {t(`ui.noodle.noodlerfanactivity.archetype.${archetype}`)}
              </span>
              <BoundedNumberInput
                value={settings?.fanArchetypeWeights[archetype] ?? 0}
                min={0}
                max={100}
                onInvalid={() =>
                  toast.error(t("ui.noodle.noodlerfanactivity.boundedValueInvalid", { min: 0, max: 100 }))
                }
                onCommit={(value, revert) => {
                  if (!settings) return;
                  const fanArchetypeWeights: NoodlerFanArchetypeWeights = {
                    ...settings.fanArchetypeWeights,
                    [archetype]: value,
                  };
                  if (!Object.values(fanArchetypeWeights).some((weight) => weight > 0)) {
                    revert();
                    toast.error(t("ui.noodle.noodlerfanactivity.allWeightsZero"));
                    return;
                  }
                  updateSettings.mutate(
                    { fanArchetypeWeights },
                    {
                      onError: (error) => {
                        toastToggleFailure(error);
                        revert();
                      },
                    },
                  );
                }}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {fanStatusQuery.data
            ? t("ui.noodle.noodlerfanactivity.dailyUsage", {
                used: fanStatusQuery.data.usedRuns,
                limit: fanStatusQuery.data.runLimit,
              })
            : t("ui.noodle.noodlerfanactivity.dailyLimit")}
        </p>
        {fanStatusQuery.data?.lastRun && (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerfanactivity.lastRun", { status: fanStatusQuery.data.lastRun.status })}
          </p>
        )}
        <button
          type="button"
          disabled={refreshFans.isPending || !settings?.fanActivityEnabled}
          onClick={() =>
            refreshFans.mutate(undefined, {
              onSuccess: (result) =>
                result.status === "no_eligible_posts" || result.created === 0
                  ? toast.info(t("ui.noodle.noodlerfanactivity.noEligiblePosts"))
                  : toast.success(t("ui.noodle.noodlerfanactivity.created", result)),
              onError: (error) => toast.error(errorMessage(error, t("ui.noodle.noodlerfanactivity.failed"))),
            })
          }
          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold transition-[background-color,scale] hover:bg-[var(--accent)] active:scale-[0.96] disabled:opacity-40"
        >
          <UsersRound size={13} className={refreshFans.isPending ? "animate-pulse" : undefined} />
          {refreshFans.isPending
            ? t("ui.noodle.noodlerfanactivity.running")
            : t("ui.noodle.noodlerfanactivity.refreshNow")}
        </button>
      </section>}
      {view === "publishing" && <section className="space-y-4 border-b border-[var(--border)] pb-4">
        <label className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {t("ui.noodle.noodlerschedulemanagermodal.automaticPostingSchedule")}
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.upToPostsPerDay", { count: settings?.postsPerDay ?? 4 })}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--noodle-accent)]">
              {t("ui.noodle.noodlerschedulemanagermodal.limitsTemporary")}
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings?.autoPostingScheduleEnabled ?? true}
            disabled={updateSettings.isPending || !settings}
            onChange={(event) =>
              updateSettings.mutate(
                { autoPostingScheduleEnabled: event.target.checked },
                { onError: toastToggleFailure },
              )
            }
            className="h-5 w-5 accent-[var(--noodle-accent)]"
          />
        </label>
        <label className="block max-w-40 space-y-1 text-xs font-semibold">
          <span className="block text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.postsPerDay")}
          </span>
          <BoundedNumberInput
            value={settings?.postsPerDay ?? 4}
            min={1}
            max={24}
            onInvalid={() =>
              toast.error(t("ui.noodle.noodlerfanactivity.boundedValueInvalid", { min: 1, max: 24 }))
            }
            onCommit={(value, revert) =>
              updateSettings.mutate(
                { postsPerDay: value },
                {
                  onError: (error) => {
                    toastToggleFailure(error);
                    revert();
                  },
                },
              )
            }
          />
        </label>
        {/* Counters read as authoritative, so a cold or failed status query must not render as zero. */}
        {statusQuery.isError ? (
          <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadStatus")}
            <button
              type="button"
              onClick={() => void statusQuery.refetch()}
              className="min-h-8 font-semibold text-[var(--noodle-accent)]"
            >
              {t("capabilities.actions.tryAgain")}
            </button>
          </p>
        ) : !status ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("ui.noodle.noodlerschedulemanagermodal.loadingStatus")}
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-[var(--muted-foreground)]">
                {t("ui.noodle.noodlerschedulemanagermodal.textClaimsLabel")}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {t("ui.noodle.noodlerschedulemanagermodal.providerClaims", {
                  used: status?.textAttemptsUsed ?? 0,
                  limit: status?.postsPerDay ?? settings?.postsPerDay ?? 4,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-foreground)]">
                {t("ui.noodle.noodlerschedulemanagermodal.imageClaimsLabel")}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {t("ui.noodle.noodlerschedulemanagermodal.providerClaims", {
                  used: status?.imageAttemptsUsed ?? 0,
                  limit: status?.postsPerDay ?? settings?.postsPerDay ?? 4,
                })}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-[var(--muted-foreground)]">
                {t("ui.noodle.noodlerschedulemanagermodal.preparedPostsLabel")}
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums">
                {status?.preparedThrough
                  ? t("ui.noodle.noodlerschedulemanagermodal.reserveThrough", {
                      count: status.preparedCount,
                      time: new Date(status.preparedThrough).toLocaleString(),
                    })
                  : t("ui.noodle.noodlerschedulemanagermodal.reserveEmpty")}
              </dd>
            </div>
          </dl>
        )}
        <p className="text-xs leading-5 text-[var(--muted-foreground)]">
          {t("ui.noodle.noodlerschedulemanagermodal.attemptsHelp")}
        </p>
        <button
          type="button"
          disabled={refreshAll.isPending}
          onClick={() =>
            refreshAll.mutate(undefined, {
              onSuccess: ({ outcomes }) => {
                const summary = summarizeRefreshOutcomes(outcomes);
                (summary.ok ? toast.success : toast.error)(t(summary.key, summary.params));
              },
              onError: (error) =>
                toast.error(errorMessage(error, t("ui.noodle.noodlerschedulemanagermodal.couldNotRefreshCreators"))),
            })
          }
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs font-semibold transition-[background-color,scale] hover:bg-[var(--accent)] active:scale-[0.96] disabled:opacity-40"
        >
          <RefreshCw size={13} className={refreshAll.isPending ? "animate-spin" : undefined} />{" "}
          {t("ui.noodle.noodlerschedulemanagermodal.refreshAllNow")}
        </button>
      </section>}

      {view === "creators" && <div className="space-y-2">
        {accounts.map((profile) => (
          <div
            key={profile.id}
            className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-1 py-3 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onOpenCreator?.(profile.id)}
              disabled={!onOpenCreator}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left disabled:cursor-default"
            >
              <Avatar account={profile} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{profile.displayName}</span>
                <span className="block truncate text-xs text-[var(--muted-foreground)]">
                  {/* "No prepared post" is a fact about the reserve, so it waits for the reserve
                      status to load rather than speaking for a query that never answered. */}
                  {!status
                    ? statusQuery.isError
                      ? t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadStatus")
                      : t("ui.noodle.noodlerschedulemanagermodal.loadingStatus")
                    : nextByAccount.get(profile.id)
                      ? t("ui.noodle.noodlerschedulemanagermodal.nextValue1", {
                          value1: new Date(nextByAccount.get(profile.id)!).toLocaleString(),
                        })
                      : t("ui.noodle.noodlerschedulemanagermodal.noPreparedPost")}
                </span>
              </span>
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold">
              {t("ui.noodle.noodlerschedulemanagermodal.automatic")}
              <input
                type="checkbox"
                checked={profile.autoPosting.enabled}
                disabled={updateAuto.isPending}
                onChange={(event) =>
                  updateAuto.mutate(
                    { accountId: profile.id, enabled: event.target.checked },
                    { onError: toastToggleFailure },
                  )
                }
                className="h-4 w-4 accent-[var(--noodle-accent)]"
              />
            </label>
            <select
              value={imageSettings?.creatorConnectionIds[profile.id] ?? ""}
              disabled={updateImageConnections.isPending}
              onChange={(event) =>
                updateImageConnections.mutate(
                  {
                    creatorId: profile.id,
                    connectionId: event.target.value || null,
                  },
                  { onError: toastToggleFailure },
                )
              }
              aria-label={t("ui.noodle.noodlerschedulemanagermodal.creatorImageConnection", {
                creator: profile.displayName,
              })}
              className="h-8 min-w-36 rounded-md border border-[var(--border)] bg-transparent px-2 text-xs"
            >
              <option value="">{t("ui.noodle.noodlerschedulemanagermodal.useDefault")}</option>
              {imageConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.name ?? connection.model ?? connection.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                const confirmed = await showConfirmDialog({
                  title: t("ui.noodle.noodlerschedulemanagermodal.deleteCreator", { creator: profile.displayName }),
                  message: t("ui.noodle.noodlerschedulemanagermodal.deleteCreatorConfirm", {
                    creator: profile.displayName,
                  }),
                  confirmLabel: t("ui.noodle.noodlerschedulemanagermodal.deleteCreator", { creator: profile.displayName }),
                  tone: "destructive",
                });
                if (!confirmed) return;
                try {
                  // Delete the creator profile first: if the character-removal step
                  // below then fails, the user still sees a consistent state (the
                  // profile is gone) instead of a silently uninvited character with
                  // a creator profile that still exists.
                  const source = data?.accounts.find((account) => account.id === profile.noodleAccountId);
                  await deleteCreator.mutateAsync(profile.id);
                  if (source?.kind === "character" && source.invited) {
                    await removeCharacter.mutateAsync(source.entityId);
                  }
                } catch (error) {
                  toast.error(errorMessage(error, t("ui.noodle.noodlerschedulemanagermodal.deleteCreatorFailed")));
                }
              }}
              disabled={deleteCreator.isPending || removeCharacter.isPending}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--destructive)]/40 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-40"
              aria-label={t("ui.noodle.noodlerschedulemanagermodal.deleteCreator", { creator: profile.displayName })}
            >
              <Trash2 size={14} />
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold">
              {t("ui.noodle.noodlerschedulemanagermodal.images")}
              <input
                type="checkbox"
                checked={profile.autoPosting.imagesEnabled}
                disabled={updateAuto.isPending}
                onChange={(event) =>
                  updateAuto.mutate(
                    { accountId: profile.id, imagesEnabled: event.target.checked },
                    { onError: toastToggleFailure },
                  )
                }
                className="h-4 w-4 accent-[var(--noodle-accent)]"
              />
            </label>
          </div>
        ))}
        {/* "No creators yet" is only true after a successful load; a cold or failed query must not
            claim the user's existing creators are gone. */}
        {accounts.length === 0 &&
          (accountsQuery.isError ? (
            <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.couldNotLoadCreators")}
              <button
                type="button"
                onClick={() => void accountsQuery.refetch()}
                className="min-h-8 font-semibold text-[var(--noodle-accent)]"
              >
                {t("capabilities.actions.tryAgain")}
              </button>
            </p>
          ) : accountsQuery.isSuccess ? (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.noCreatorsYetAddSomeFromTheNoodlerHub")}
            </p>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              {t("ui.noodle.noodlerschedulemanagermodal.loadingCreators")}
            </p>
          ))}
      </div>}
    </div>
  );
}
