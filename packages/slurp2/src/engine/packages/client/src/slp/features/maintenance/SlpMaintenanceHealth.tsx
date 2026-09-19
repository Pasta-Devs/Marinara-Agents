import { AlertCircle, Database, HardDrive, Loader2, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlurpAutopurgePreview, SlurpMaintenanceSummary } from "./slp-maintenance-hooks";
import { formatBytes } from "../../modules/settings/slp-backstage-format";

export function SlurpMaintenanceHealth({
  summary,
  loading,
  error,
  preview,
}: {
  summary: SlurpMaintenanceSummary | undefined;
  loading: boolean;
  error: boolean;
  preview?: SlurpAutopurgePreview;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div
        className="flex min-h-24 items-center justify-center gap-2 rounded-xl bg-[var(--slurp-surface-raised)] text-sm text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        role="status"
      >
        <Loader2 size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {t("ui.slurp.settings.maintenance.health.measuring", { defaultValue: "Measuring Slurp storage…" })}
      </div>
    );
  if (error || !summary)
    return (
      <div
        className="flex min-h-20 items-center gap-3 rounded-xl bg-[var(--slurp-danger)]/10 p-4 text-sm text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/25"
        role="alert"
      >
        <AlertCircle size={18} aria-hidden="true" />
        {t("ui.slurp.settings.maintenance.health.unavailable", {
          defaultValue: "Storage health is not available now. No cleanup has run.",
        })}
      </div>
    );
  const busy = Object.values(summary.operations).some(Boolean);
  const unused =
    summary.unused.preparedPosts +
    summary.unused.attempts +
    summary.unused.runs +
    summary.unused.improvementJobs +
    summary.unused.improvementProposals;
  return (
    <section
      className="rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-5"
      aria-labelledby="slurp-maintenance-health-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
            {t("ui.slurp.settings.maintenance.health.eyebrow", { defaultValue: "Maintenance health" })}
          </p>
          <h2 id="slurp-maintenance-health-title" className="mt-1 text-lg font-black text-balance">
            {busy
              ? t("ui.slurp.settings.maintenance.health.busyTitle", { defaultValue: "An operation is running" })
              : t("ui.slurp.settings.maintenance.health.readyTitle", { defaultValue: "Slurp is ready" })}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.maintenance.health.countsNote", {
              defaultValue:
                "Counts are exact at scan time. The storage size is an estimate, because files can change before cleanup.",
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${busy ? "bg-[var(--slurp-warning)]/12 text-[var(--slurp-warning)]" : "bg-[var(--slurp-success)]/12 text-[var(--slurp-success)]"}`}
          aria-live="polite"
        >
          {busy
            ? t("ui.slurp.settings.maintenance.health.busy", { defaultValue: "Busy" })
            : t("ui.slurp.settings.maintenance.health.healthy", { defaultValue: "Healthy" })}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [
            UsersRound,
            summary.content.creators,
            t("ui.slurp.settings.maintenance.creators", { defaultValue: "Creators" }),
          ],
          [Database, summary.content.posts, t("ui.slurp.settings.maintenance.posts", { defaultValue: "Posts" })],
          [
            MessageCircle,
            summary.content.messages,
            t("ui.slurp.settings.maintenance.health.messages", { defaultValue: "Messages" }),
          ],
          [
            HardDrive,
            formatBytes(summary.media.bytes),
            t("ui.slurp.settings.maintenance.mediaFiles", {
              defaultValue: "{{count}} media files",
              count: summary.media.files,
            }),
          ],
        ].map(([Icon, value, label]) => (
          <div
            key={String(label)}
            className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
          >
            <Icon size={16} className="text-[var(--slurp-violet)]" aria-hidden="true" />
            <p className="mt-2 text-base font-black tabular-nums">{String(value)}</p>
            <p className="text-xs text-[var(--slurp-muted)]">{String(label)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--slurp-outline)]">
          {t("ui.slurp.settings.maintenance.health.unused", {
            defaultValue: "Unused work: {{count}} old prepared posts, attempts, and finished runs can be removed.",
            count: unused,
          })}
        </div>
        {preview && (
          <div className="rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-canvas))] p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--noodle-accent)]/25">
            <Sparkles size={13} className="inline align-[-2px] text-[var(--noodle-accent)]" aria-hidden="true" />{" "}
            {t("ui.slurp.settings.maintenance.purgePreview", {
              defaultValue: "This run removes {{posts}} posts and {{files}} media files, about {{size}}.",
              posts: preview.postsToDelete,
              files: preview.postMediaFiles + preview.messageMediaFiles,
              size: formatBytes(preview.estimatedReclaimableBytes),
            })}
          </div>
        )}
      </div>
    </section>
  );
}
