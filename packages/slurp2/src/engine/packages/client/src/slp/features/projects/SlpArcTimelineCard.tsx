// Arc timeline card, split out of components/slurp/SlurpProjectsPanel.tsx in Slice 10.

import { SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpArcEffects, SlurpArcTimeline } from "./slp-projects-contract";

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
  // Effects are stored as the chapter wrote them and shown as they apply under the current cap.
  const cap = { off: 0, small: 10, big: 50 }[useSlurpSettings().data?.arcStatEffects ?? "small"];
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
  const current = arcs.find((arc) => arc.status === "active") ?? arcs.find((arc) => arc.status === "paused");
  const past = arcs.filter((arc) => arc.status === "complete");
  const shown = current ?? past[0];
  if (!shown) return null;
  const postsFor = (index: number) =>
    shown.history.filter((entry) => entry.chapter === index).flatMap((entry) => entry.postIds);
  const complete = shown.status === "complete";
  return (
    <section className="border-b border-[var(--noodle-divider)] bg-[var(--slurp-surface)] px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs font-bold">
          <span className="text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.arcs.heading", { defaultValue: "Arc" })}:{" "}
          </span>
          {shown.title}
        </p>
        <span className="flex shrink-0 gap-1 text-[0.65rem] font-semibold">
          {shown.tone && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5">{shown.tone}</span>}
          {complete && (
            <span className="rounded-full bg-[var(--noodle-accent)]/15 px-2 py-0.5 text-[var(--noodle-accent)]">
              ✓ {localizeUi("ui.slurp.arcs.done", { defaultValue: "Finished" })}
            </span>
          )}
          {shown.status === "paused" && (
            <span className="rounded-full bg-[var(--accent)] px-2 py-0.5">
              {localizeUi("ui.slurp.arcs.paused", { defaultValue: "Paused" })}
            </span>
          )}
        </span>
      </div>
      {shown.partners?.length ? (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.arcs.with", { defaultValue: "With" })}
          {shown.partners.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onClick={() => onOpenProfile?.(partner.id)}
              className="inline-flex items-center gap-1 font-semibold underline"
            >
              {partner.avatarUrl && (
                <SlurpMediaImg src={partner.avatarUrl} alt="" className="size-4 rounded-full object-cover" />
              )}
              {partner.displayName}
            </button>
          ))}
        </p>
      ) : null}
      {shown.chapters.length > 0 && (
        <ol className="mt-2 flex flex-col gap-1">
          {shown.chapters.map((label, index) => {
            const state = complete || index < shown.chapter ? "done" : index === shown.chapter ? "current" : "upcoming";
            const postIds = postsFor(index);
            return (
              <li key={index} className="flex items-start gap-2 text-[0.7rem]" data-arc-chapter={state}>
                <span
                  aria-hidden
                  className={`mt-1 size-2 shrink-0 rounded-full ${
                    state === "done"
                      ? "bg-[var(--noodle-accent)]"
                      : state === "current"
                        ? "bg-[var(--noodle-accent)] ring-2 ring-[var(--noodle-accent)]/30"
                        : "border border-[var(--noodle-divider)]"
                  }`}
                />
                <span className="min-w-0">
                  <span
                    className={
                      state === "upcoming"
                        ? "text-[var(--muted-foreground)]"
                        : state === "current"
                          ? "font-bold"
                          : undefined
                    }
                  >
                    {/* What follows an open choice depends on the vote. */}
                    {shown.openChoice && index > shown.chapter ? "?" : label}
                  </span>
                  {state === "current" && shown.openChoice && (
                    <span className="block text-[var(--noodle-accent)]">
                      {localizeUi("ui.slurp.arcs.voting", {
                        defaultValue: "Fans are voting: {{question}}",
                        question: shown.openChoice.question,
                      })}
                    </span>
                  )}
                  {shown.history
                    .filter((entry) => entry.chapter === index && entry.poll)
                    .map((entry) => (
                      <span key={entry.startedAt} className="block text-[var(--muted-foreground)]">
                        {localizeUi("ui.slurp.arcs.pollResult", {
                          defaultValue: "{{question}} → {{winner}} ({{votes}})",
                          question: entry.poll!.question,
                          winner: entry.poll!.winner,
                          votes: entry.poll!.votes.map((vote) => `${vote.label}: ${vote.count}`).join(", "),
                        })}
                      </span>
                    ))}
                  {(() => {
                    const line = effectLine(shown.history.findLast((entry) => entry.chapter === index)?.effects);
                    return line ? <span className="block text-[var(--noodle-accent)]">{line}</span> : null;
                  })()}
                  {postIds.length > 0 && onOpenPost && (
                    <span className="ml-2 inline-flex flex-wrap gap-2">
                      {postIds.map((postId, postIndex) => (
                        <button
                          key={postId}
                          type="button"
                          onClick={() => onOpenPost(postId)}
                          className="underline text-[var(--muted-foreground)]"
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
      {past.filter((arc) => arc !== shown).length > 0 && (
        <p className="mt-2 truncate text-[0.7rem] text-[var(--muted-foreground)]">
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

/**
 * This Creator's overrides of the arc settings. Every select starts with "Global (value)", which
 * stores nothing, so a later change to the global setting still reaches this Creator.
 */
