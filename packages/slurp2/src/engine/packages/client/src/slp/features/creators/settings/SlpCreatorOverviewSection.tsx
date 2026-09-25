import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { errorMessage } from "../../../modules/settings/slp-backstage-format";
import { formatDateTime } from "../../../base/ui/slp-date-time";
import { Avatar, SlurpMediaImg } from "../../../base/chrome/SlpChrome";
import { useCreatorReserveStatus, useUpdateCreatorAutoPosting } from "../../feed/slp-feed-contract";
import { useSlurpProjects } from "../../projects/slp-projects-contract";
import { useSlurpContinuity } from "../slp-continuity-hooks";
import { useSlpViewerPersonaId } from "../slp-creators-hooks";
import { focusRing, quietButton } from "../slp-creator-classes";
import type { SlpCreatorSettingsSectionProps } from "./slp-creator-settings-contract";
import { useSlpCreatorSettingsStore, type SlpCreatorSettingsBlock } from "./slp-creator-settings-store";

/** One status tile: what is true now, and a way into the block that changes it. */
function StatusTile({
  title,
  block,
  children,
}: {
  title: string;
  block: SlpCreatorSettingsBlock;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold">{title}</h4>
        <button
          type="button"
          onClick={() => useSlpCreatorSettingsStore.getState().setTab(block)}
          aria-label={t("ui.slurp.settings.creators.overview.openLabel", { name: title })}
          className={`-me-2 inline-flex size-11 items-center justify-center rounded-lg text-[var(--noodle-accent)] hover:bg-[var(--slurp-canvas)] ${focusRing}`}
        >
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-1 text-sm text-[var(--slurp-muted)]">{children}</div>
    </section>
  );
}

/**
 * The Creator at a glance: what needs review, whether they post, what runs and what is waiting.
 * Each tile opens the block that changes it. The modal opens here.
 */
export function SlpCreatorOverviewSection({ creator, active }: SlpCreatorSettingsSectionProps) {
  const { t, i18n } = useTranslation();
  const reserveStatus = useCreatorReserveStatus(active);
  const status = reserveStatus.data?.creators.find((entry) => entry.accountId === creator.id);
  const updateAuto = useUpdateCreatorAutoPosting();
  const personaId = useSlpViewerPersonaId();
  const projects = useSlurpProjects(personaId, creator.id, active).data?.projects ?? [];
  const continuity = useSlurpContinuity(active ? creator.id : null).data;
  const attention = [
    ...(creator.sourceStatus.state === "missing"
      ? [t("ui.slurp.settings.creators.sourceMissing")]
      : creator.sourceStatus.state === "changed"
        ? [t("ui.slurp.settings.creators.sourceChanged")]
        : []),
    ...(creator.appearanceState.source === "missing"
      ? [t("ui.slurp.appearance.missing")]
      : creator.appearanceState.needsReview
        ? [t("ui.slurp.appearance.reviewNeeded")]
        : []),
  ];

  const running = projects.filter((project) => project.status === "active").length;
  const suggested = projects.filter((project) => project.status === "suggested").length;

  return (
    <div className="space-y-6 pb-4">
      <section
        className="overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        aria-label={creator.displayName}
      >
        <div className="relative h-36 overflow-hidden bg-[linear-gradient(115deg,var(--slurp-coral),var(--slurp-violet))]">
          {creator.bannerUrl && <SlurpMediaImg src={creator.bannerUrl} alt="" className="h-full w-full object-cover" />}
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />
        </div>
        <div className="relative flex flex-wrap items-end gap-3 px-4 pb-4">
          <div className="-mt-10 rounded-full bg-[var(--slurp-surface-raised)] p-1 ring-1 ring-[var(--slurp-outline)]">
            <Avatar account={creator} size="lg" />
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <h3 className="truncate text-lg font-bold">{creator.displayName}</h3>
            <p className="truncate text-xs text-[var(--slurp-muted)]">@{creator.handle}</p>
          </div>
          <button
            type="button"
            onClick={() => useSlpCreatorSettingsStore.getState().setTab("profile")}
            className={quietButton}
          >
            {t("ui.slurp.settings.creators.tabs.profile", { defaultValue: "Edit profile" })}
            <ArrowUpRight size={15} aria-hidden="true" />
          </button>
          {creator.bio && <p className="w-full text-sm leading-6 text-[var(--slurp-muted)]">{creator.bio}</p>}
        </div>
      </section>

      <section
        className="space-y-2"
        aria-label={t("ui.slurp.settings.creators.overviewStatus", { defaultValue: "Status" })}
      >
        <h4 className="text-xs font-bold uppercase text-[var(--slurp-muted)]">
          {t("ui.slurp.settings.creators.overviewStatus", { defaultValue: "Status" })}
        </h4>
        {attention.length > 0 ? (
          <div className="rounded-lg bg-[var(--slurp-warning)]/10 p-3 text-sm ring-1 ring-inset ring-[var(--slurp-warning)]/30">
            <p className="font-semibold">
              {t("ui.slurp.settings.creators.overviewNeedsReview", { defaultValue: "Needs review" })}
            </p>
            <ul className="mt-1 list-inside list-disc text-xs leading-5">
              {attention.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg bg-[var(--slurp-success)]/10 p-3 text-sm text-[var(--slurp-success)]">
            {t("ui.slurp.settings.creators.overviewReady", { defaultValue: "No items need review." })}
          </p>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatusTile
          title={t("ui.slurp.settings.creators.tabs.posting", { defaultValue: "Posting" })}
          block="automation"
        >
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-[var(--slurp-text)]">
            <span className="font-semibold">
              {creator.autoPosting.enabled
                ? t("ui.slurp.settings.creators.filters.active")
                : t("ui.slurp.settings.creators.filters.paused")}
            </span>
            <input
              type="checkbox"
              role="switch"
              aria-label={t("ui.slurp.settings.creators.overview.autoPost")}
              checked={creator.autoPosting.enabled}
              disabled={updateAuto.isPending}
              onChange={(event) =>
                updateAuto.mutate(
                  { accountId: creator.id, enabled: event.target.checked },
                  { onError: (error) => toast.error(errorMessage(error)) },
                )
              }
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-6 w-10 shrink-0 rounded-full bg-[var(--muted-foreground)]/25 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[var(--noodle-accent)] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--noodle-accent)] motion-reduce:transition-none motion-reduce:after:transition-none"
            />
          </label>
          {status?.nextPreparedAt && (
            <p>
              {t("ui.slurp.settings.creators.nextPost", { date: formatDateTime(status.nextPreparedAt, i18n.language) })}
            </p>
          )}
          <p>{t("ui.slurp.settings.creators.overview.planned", { count: status?.slots.length ?? 0 })}</p>
        </StatusTile>
        <StatusTile
          title={t("ui.slurp.settings.creators.tabs.storylines", { defaultValue: "Storylines" })}
          block="storylines"
        >
          <p>{t("ui.slurp.settings.creators.overview.running", { count: running })}</p>
          {suggested > 0 && <p>{t("ui.slurp.settings.creators.overview.suggested", { count: suggested })}</p>}
        </StatusTile>
        <StatusTile title={t("ui.slurp.settings.creators.tabs.memory", { defaultValue: "Memory" })} block="continuity">
          <p className={continuity?.proposals.length ? "font-semibold text-[var(--slurp-text)]" : undefined}>
            {t("ui.slurp.settings.creators.overview.waiting", { count: continuity?.proposals.length ?? 0 })}
          </p>
          <p>{t("ui.slurp.settings.creators.overview.notes", { count: continuity?.facts.length ?? 0 })}</p>
        </StatusTile>
        <StatusTile
          title={t("ui.slurp.settings.creators.tabs.fans", { defaultValue: "Fans & messages" })}
          block="audience"
        >
          <p>{t("ui.slurp.settings.creators.overview.fansDetail")}</p>
        </StatusTile>
      </div>
    </div>
  );
}
