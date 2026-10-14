// Arc timeline card, split out of components/slurp/SlurpProjectsPanel.tsx in Slice 10.

import { Check, Vote } from "lucide-react";
import { SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { cn } from "../../../lib/utils";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpArcEffects, SlurpArcTimeline } from "./slp-projects-contract";

/** The arc a profile shows: the running (or paused) one, else the latest finished one. */
function shownArc(arcs: SlurpArcTimeline[]) {
  const current = arcs.find((arc) => arc.status === "active") ?? arcs.find((arc) => arc.status === "paused");
  const past = arcs.filter((arc) => arc.status === "complete");
  return { shown: current ?? past[0], past };
}

/**
 * The storyline as fans see it (04 §17): the beats, where the Creator is now, and the open vote
 * with a way to take part. The simulation effects are operator data, so they live in Creator tools
 * (`SlurpArcEffectsList`), not here.
 */
export function SlurpArcTimelineCard({
  arcs,
  onOpenPost,
  onOpenProfile,
}: {
  arcs: SlurpArcTimeline[];
  onOpenPost?: (postId: string) => void;
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { shown, past } = shownArc(arcs);
  if (!shown) return null;
  const postsFor = (index: number) =>
    shown.history.filter((entry) => entry.chapter === index).flatMap((entry) => entry.postIds);
  const complete = shown.status === "complete";
  const total = shown.chapters.length;
  const at = complete ? total : Math.min(shown.chapter, total - 1);
  // The open vote's own poll post. Until it is posted there is nothing to vote on, so the card says
  // nothing about voting (R1-067).
  const votePostId = shown.openChoice?.pollPostId ?? undefined;
  return (
    <section className="rounded-2xl bg-[var(--slurp-surface-raised)] px-4 py-3.5 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--slurp-muted)]">
            {localizeUi("ui.slurp.arcs.heading", { defaultValue: "Storyline" })}
            {total > 0 && !complete && (
              <>
                {" · "}
                {localizeUi("ui.slurp.arcs.chapterOf", {
                  defaultValue: "chapter {{index}} of {{total}}",
                  index: at + 1,
                  total,
                })}
              </>
            )}
          </p>
          <p className="mt-0.5 truncate text-[15px] font-bold leading-5">{shown.title}</p>
        </div>
        <span className="flex shrink-0 gap-1 text-[11px] font-semibold">
          {shown.tone && (
            <span className="rounded-full bg-[var(--slurp-tint)] px-2 py-0.5 text-[var(--slurp-ink)]">
              {shown.tone}
            </span>
          )}
          {complete && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--slurp-tint)] px-2 py-0.5 text-[var(--slurp-ink)]">
              <Check size={11} aria-hidden="true" className="!text-current" />
              {localizeUi("ui.slurp.arcs.done", { defaultValue: "Finished" })}
            </span>
          )}
          {shown.status === "paused" && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5">
              {localizeUi("ui.slurp.arcs.paused", { defaultValue: "Paused" })}
            </span>
          )}
        </span>
      </div>
      {total > 0 && (
        // The progress rail: one segment per chapter, pink up to where the story is.
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {shown.chapters.map((_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                index < at || complete
                  ? "bg-[var(--noodle-accent)]"
                  : index === at
                    ? "bg-[var(--noodle-accent)] shadow-[0_0_8px_var(--noodle-accent)]"
                    : "bg-[color-mix(in_srgb,var(--slurp-text)_12%,transparent)]",
              )}
            />
          ))}
        </div>
      )}
      {shown.chapters.length > 0 && (
        <ol className="mt-3 flex flex-col gap-1.5 text-[13px] leading-[19px]">
          {shown.chapters.map((label, index) => {
            const state = complete || index < shown.chapter ? "done" : index === shown.chapter ? "current" : "upcoming";
            const postIds = postsFor(index);
            return (
              <li
                key={index}
                className={cn(
                  "flex items-start gap-2.5",
                  state === "current" && "-mx-2 rounded-xl bg-[var(--slurp-tint)] px-2 py-1.5",
                )}
                data-arc-chapter={state}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-[5px] size-2.5 shrink-0 rounded-full",
                    state === "done" && "bg-[var(--noodle-accent)]",
                    state === "current" && "bg-[var(--noodle-accent)] ring-[3px] ring-[var(--noodle-accent)]/30",
                    state === "upcoming" && "ring-1 ring-inset ring-[var(--noodle-divider)]",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      state === "upcoming" && "text-[var(--slurp-muted)]",
                      state === "current" && "font-bold",
                    )}
                  >
                    {/* What follows an open choice depends on the vote. */}
                    {shown.openChoice && index > shown.chapter
                      ? localizeUi("ui.slurp.arcs.decidedByVote", { defaultValue: "Decided by the vote" })
                      : label}
                  </span>
                  {state === "current" && shown.openChoice && votePostId && (
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 flex-1 text-[var(--slurp-ink)]">
                        {localizeUi("ui.slurp.arcs.voting", {
                          defaultValue: "Fans are voting: {{question}}",
                          question: shown.openChoice.question,
                        })}
                      </span>
                      {votePostId && onOpenPost && (
                        <button
                          type="button"
                          onClick={() => onOpenPost(votePostId)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--noodle-accent)] px-3.5 text-xs font-bold text-[var(--slurp-on-accent)] shadow-[var(--slurp-highlight)] transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:active:scale-100 [&_svg]:!text-current"
                        >
                          <Vote size={14} aria-hidden="true" />
                          {localizeUi("ui.slurp.arcs.vote", { defaultValue: "Vote" })}
                        </button>
                      )}
                    </span>
                  )}
                  {shown.history
                    .filter((entry) => entry.chapter === index && entry.poll)
                    .map((entry) => (
                      <span key={entry.startedAt} className="block text-xs text-[var(--slurp-muted)]">
                        {localizeUi("ui.slurp.arcs.pollWinner", {
                          defaultValue: "{{question}} Fans chose: {{winner}}",
                          question: entry.poll!.question,
                          winner: entry.poll!.winner,
                        })}
                      </span>
                    ))}
                  {state !== "current" && postIds.length > 0 && onOpenPost && (
                    <span className="flex flex-wrap gap-x-3 text-xs">
                      {postIds.map((postId, postIndex) => (
                        <button
                          key={postId}
                          type="button"
                          onClick={() => onOpenPost(postId)}
                          className="min-h-7 font-semibold text-[var(--slurp-ink)] underline-offset-2 hover:underline"
                        >
                          {localizeUi("ui.slurp.arcs.post", { defaultValue: "Post {{index}}", index: postIndex + 1 })}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {shown.partners?.length ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.arcs.with", { defaultValue: "With" })}
          {shown.partners.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onClick={() => onOpenProfile?.(partner.id)}
              className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-[var(--slurp-tint)] py-0.5 pe-2.5 ps-0.5 font-semibold text-[var(--slurp-text)]"
            >
              {partner.avatarUrl && (
                <SlurpMediaImg
                  src={partner.avatarUrl}
                  mediaWidth={96}
                  alt=""
                  className="size-6 rounded-full object-cover"
                />
              )}
              {partner.displayName}
            </button>
          ))}
        </p>
      ) : null}
      {past.filter((arc) => arc !== shown).length > 0 && (
        <p className="mt-2 truncate text-xs text-[var(--slurp-muted)]">
          {localizeUi("ui.slurp.arcs.past", { defaultValue: "Past arcs" })}:{" "}
          {past
            .filter((arc) => arc !== shown)
            .map((arc) => `${arc.title} ✓`)
            .join(", ")}
        </p>
      )}
    </section>
  );
}

/** Operator view of the storyline: what each chapter did to the numbers, under the current cap. */
export function SlurpArcEffectsList({ arcs, heading }: { arcs: SlurpArcTimeline[]; heading?: string }) {
  const { t: localizeUi } = useUiTranslation();
  // Effects are stored as the chapter wrote them and shown as they apply under the current cap.
  const cap = { off: 0, small: 10, big: 50 }[useSlurpSettings().data?.arcStatEffects ?? "small"];
  const { shown } = shownArc(arcs);
  if (!shown) return null;
  const effectLine = (effects: SlurpArcEffects | undefined) =>
    (["growth", "earnings", "loyalty"] as const)
      .map((stat) => [stat, Math.max(-cap, Math.min(cap, effects?.[stat] ?? 0))] as const)
      .filter(([, pct]) => pct !== 0)
      .map(([stat, pct]) =>
        localizeUi(`ui.slurp.arcs.effect.${stat}`, {
          defaultValue: `{{pct}} ${stat}`,
          pct: `${pct > 0 ? "+" : ""}${pct}%`,
        }),
      )
      .join(" · ");
  const rows = shown.chapters.flatMap((label, index) => {
    const entry = shown.history.findLast((item) => item.chapter === index);
    const line = effectLine(entry?.effects);
    const votes = entry?.poll?.votes.map((vote) => `${vote.label} ${vote.count}`).join(" · ");
    return line || votes ? [{ index, label, line, votes }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <div>
      {/* The heading comes with the rows, so it never stands over nothing (R1-079). */}
      {heading && <p className="mb-1.5 text-xs font-semibold text-[var(--slurp-muted)]">{heading}</p>}
      <ul className="space-y-1.5 text-xs leading-4">
        {rows.map((row) => (
          <li key={row.index} className="flex gap-2">
            <span className="w-4 shrink-0 font-bold tabular-nums text-[var(--slurp-muted)]">{row.index + 1}</span>
            <span className="min-w-0">
              <span className="block font-semibold">{row.label}</span>
              {row.line && <span className="block text-[var(--slurp-muted)]">{row.line}</span>}
              {row.votes && <span className="block text-[var(--slurp-muted)]">{row.votes}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * This Creator's overrides of the arc settings. Every select starts with "Global (value)", which
 * stores nothing, so a later change to the global setting still reaches this Creator.
 */
