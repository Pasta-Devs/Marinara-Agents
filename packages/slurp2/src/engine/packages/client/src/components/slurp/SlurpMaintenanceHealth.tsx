import { AlertCircle, Database, HardDrive, Loader2, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import type { SlurpAutopurgePreview, SlurpMaintenanceSummary } from "../../hooks/use-slurp";

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

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
  if (loading)
    return (
      <div
        className="flex min-h-24 items-center justify-center gap-2 rounded-xl bg-[var(--slurp-surface-raised)] text-sm text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]"
        role="status"
      >
        <Loader2 size={17} className="animate-spin motion-reduce:animate-none" /> Measuring Slurp storage…
      </div>
    );
  if (error || !summary)
    return (
      <div
        className="flex min-h-20 items-center gap-3 rounded-xl bg-[var(--slurp-danger)]/10 p-4 text-sm text-[var(--slurp-danger)] ring-1 ring-inset ring-[var(--slurp-danger)]/25"
        role="alert"
      >
        <AlertCircle size={18} /> Storage health is temporarily unavailable. No cleanup has run.
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
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--noodle-accent)]">
            Maintenance health
          </p>
          <h2 id="slurp-maintenance-health-title" className="mt-1 text-lg font-black text-balance">
            {busy ? "An operation is working" : "Slurp is ready"}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
            Counts are exact at scan time. Storage reclaim is an estimate because files can change before cleanup.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${busy ? "bg-[var(--slurp-warning)]/12 text-[var(--slurp-warning)]" : "bg-[var(--slurp-success)]/12 text-[var(--slurp-success)]"}`}
        >
          {busy ? "Busy" : "Healthy"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [UsersRound, summary.content.creators, "Creators"],
          [Database, summary.content.posts, "Posts"],
          [MessageCircle, summary.content.messages, "Messages"],
          [HardDrive, bytes(summary.media.bytes), `${summary.media.files} media files`],
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
          <span className="font-bold">Unused work:</span> {unused} old prepared posts, attempts, and completed runs can
          be removed.
        </div>
        {preview && (
          <div className="rounded-lg bg-[color-mix(in_srgb,var(--noodle-accent)_8%,var(--slurp-canvas))] p-3 text-xs leading-5 ring-1 ring-inset ring-[var(--noodle-accent)]/25">
            <span className="inline-flex items-center gap-1 font-bold">
              <Sparkles size={13} /> Cleanup preview:
            </span>{" "}
            {preview.postsToDelete} posts and {preview.postMediaFiles + preview.messageMediaFiles} media files · about{" "}
            {bytes(preview.estimatedReclaimableBytes)}.
          </div>
        )}
      </div>
    </section>
  );
}
