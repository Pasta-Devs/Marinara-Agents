import { useState } from "react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { SlurpStudioCreator } from "../../features/economy/slp-economy-contract";
import {
  useSetSlurpGoal,
  useSlurpPayout,
  useSlurpStudio,
} from "../../features/economy/slp-economy-hooks";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { NoodlerFrame } from "./SlpHomeHelpers";
import { formatTime } from "../../base/ui/slp-date-time";
import { BroadcastPanel } from "../../features/messages/SlpMessages";
import { SlurpProjectsPanel } from "../../features/projects/SlpProjectsBoard";
import { SlurpCoin, SlurpCoinAmount, SlurpCoinBurst } from "../../modules/coin/SlpCoin";
import { errorMessage } from "./SlpHomeHelpers";

function SlurpStudioView({
  personaId,
  onBack,
  onOpenProfile,
}: {
  personaId: string | null;
  onBack: () => void;
  onOpenProfile: (accountId: string) => void;
}) {
  const { t: localizeUi, i18n } = useUiTranslation();
  const studioQuery = useSlurpStudio(personaId);
  // Diegetic by default, optimisation behind a door.
  //
  // A Creator would check her earnings, her followers, and who keeps showing up — those are in
  // character. A milestone progress bar and a per-post performance breakdown are a game HUD, and
  // leaving them on screen invites playing the meta instead of the character. They stay one tap
  // away for when that is what you want.
  const [showPerformance, setShowPerformance] = useState(false);
  const creators = studioQuery.data?.creators ?? [];
  const since = studioQuery.data?.since ?? null;

  const delta = (value: number | null) => {
    if (value === null || value === 0) return null;
    return (
      <span
        className={cn(
          "text-xs font-bold tabular-nums",
          value > 0 ? "text-[var(--noodle-accent)]" : "text-[var(--muted-foreground)]",
        )}
      >
        {value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString()}
      </span>
    );
  };

  return (
    <NoodlerFrame onBack={onBack} title={localizeUi("ui.slurp.navigation.studio")} action={<span />}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3 px-1">
          {since ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.studio.since", {
                defaultValue: "Changes since {{date}}",
                date: formatTime(since, i18n.language),
              })}
            </p>
          ) : (
            <span />
          )}
          {creators.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPerformance((open) => !open)}
              aria-expanded={showPerformance}
              className="text-xs font-bold text-[var(--noodle-accent)] hover:underline"
            >
              {showPerformance
                ? localizeUi("ui.slurp.studio.hidePerformance", { defaultValue: "Hide performance" })
                : localizeUi("ui.slurp.studio.showPerformance", { defaultValue: "Show performance" })}
            </button>
          )}
        </div>

        {studioQuery.isPending ? (
          <p className="px-1 text-sm text-[var(--muted-foreground)]">
            {localizeUi("ui.slurp.studio.loading", { defaultValue: "Loading…" })}
          </p>
        ) : creators.length === 0 ? (
          <div className="rounded-xl bg-[var(--slurp-surface)] px-6 py-14 text-center ring-1 ring-inset ring-[var(--noodle-divider)]">
            <p className="text-sm font-bold">
              {localizeUi("ui.slurp.studio.emptyTitle", { defaultValue: "No Creators yet" })}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.slurp.studio.emptyDetail", {
                defaultValue: "Make this persona a Creator to see how its posts are doing.",
              })}
            </p>
          </div>
        ) : (
          creators.map((creator) => (
            <section
              key={creator.id}
              aria-labelledby={`slurp-studio-${creator.id}`}
              className="flex flex-col gap-4 rounded-xl bg-[var(--slurp-surface)] p-4 ring-1 ring-inset ring-[var(--noodle-divider)]"
            >
              <button
                type="button"
                onClick={() => onOpenProfile(creator.id)}
                className="flex items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-[var(--noodle-accent)]/[0.06]"
              >
                <Avatar account={{ displayName: creator.displayName, avatarUrl: creator.avatarUrl }} size="md" />
                <span className="min-w-0">
                  <span id={`slurp-studio-${creator.id}`} className="block truncate text-sm font-bold">
                    {creator.displayName}
                  </span>
                  <span className="block truncate text-xs text-[var(--muted-foreground)]">@{creator.handle}</span>
                </span>
              </button>

              {personaId && <BroadcastPanel creatorAccountId={creator.id} personaId={personaId} />}

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: localizeUi("ui.slurp.studio.followers", { defaultValue: "Followers" }),
                    value: creator.followers,
                    change: creator.followersDelta,
                  },
                  {
                    label: localizeUi("ui.slurp.studio.subscribers", { defaultValue: "Subscribers" }),
                    value: creator.subscribers,
                    change: null,
                  },
                  {
                    label: localizeUi("ui.slurp.studio.earned", { defaultValue: "Earned" }),
                    value: creator.earnings.lifetime,
                    change: creator.earningsDelta,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-[var(--accent)] p-3">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                      {stat.label}
                    </p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-black tabular-nums">{stat.value.toLocaleString()}</span>
                      {delta(stat.change)}
                    </p>
                  </div>
                ))}
              </div>

              {showPerformance && creator.milestone.next !== null && (
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-xs font-bold">
                      {localizeUi("ui.slurp.studio.nextMilestone", {
                        defaultValue: "Next milestone: {{target}} followers",
                        target: creator.milestone.next.toLocaleString(),
                      })}
                    </p>
                    <p className="text-xs tabular-nums text-[var(--muted-foreground)]">
                      {localizeUi("ui.slurp.studio.remaining", {
                        defaultValue: "{{count}} to go",
                        count: creator.milestone.remaining.toLocaleString(),
                      })}
                    </p>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--accent)]">
                    <div
                      className="h-full rounded-full bg-[var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
                      style={{ width: `${Math.round(creator.milestone.progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {creator.payoutAllowance > 0 && personaId && <SlurpPayoutRow creator={creator} personaId={personaId} />}

              <SlurpGoalEditor creator={creator} personaId={personaId} />

              {creator.milestonesCrossed.length > 0 && (
                <p className="rounded-lg bg-[var(--noodle-accent)]/10 px-3 py-2 text-xs font-bold text-[var(--noodle-accent)]">
                  {localizeUi("ui.slurp.studio.crossed", {
                    defaultValue: "Passed {{targets}} followers since your last visit.",
                    targets: creator.milestonesCrossed.map((value) => value.toLocaleString()).join(", "),
                  })}
                </p>
              )}

              {/* What this Creator is posting about, above who is reading it: the thread is the
                  thing the player steers, and the audience is the result. */}
              {personaId && (
                <SlurpProjectsPanel
                  personaId={personaId}
                  creatorAccountId={creator.id}
                  otherCreators={creators.filter((other) => other.id !== creator.id)}
                />
              )}

              {creator.topFans.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    {localizeUi("ui.slurp.studio.topFans", { defaultValue: "Who is showing up" })}
                  </h3>
                  <ul className="mt-2 flex flex-col divide-y divide-[var(--noodle-divider)]">
                    {creator.topFans.map((fan) => (
                      <li key={fan.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {fan.displayName}
                            {fan.handle && (
                              <span className="ml-1 font-normal text-[var(--muted-foreground)]">@{fan.handle}</span>
                            )}
                          </span>
                          {/* A name with no history is still wallpaper, so say what they have done. */}
                          <span className="block truncate text-[0.7rem] text-[var(--muted-foreground)]">
                            {[
                              localizeUi(`ui.slurp.studio.stage.${fan.stage}`, { defaultValue: fan.stage }),
                              // Steady is the default and says nothing worth a line.
                              fan.audienceArc && fan.audienceArc !== "steady"
                                ? localizeUi(`ui.slurp.studio.audienceArc.${fan.audienceArc}`)
                                : null,
                              fan.spent > 0
                                ? localizeUi("ui.slurp.studio.fanSpent", {
                                    defaultValue: "{{count}}",
                                    count: fan.spent,
                                  })
                                : null,
                              ...fan.traits,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <time
                          dateTime={fan.firstSeenAt}
                          className="shrink-0 text-[0.65rem] tabular-nums text-[var(--muted-foreground)]"
                        >
                          {formatTime(fan.firstSeenAt, i18n.language)}
                        </time>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {showPerformance && creator.posts.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    {localizeUi("ui.slurp.studio.recentPosts", { defaultValue: "Recent posts" })}
                  </h3>
                  <ul className="mt-2 flex flex-col divide-y divide-[var(--noodle-divider)]">
                    {creator.posts.map((post) => (
                      <li key={post.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            {post.title || localizeUi("ui.slurp.studio.untitled", { defaultValue: "Untitled post" })}
                          </span>
                          <span className="block text-[0.7rem] text-[var(--muted-foreground)]">
                            {[
                              formatTime(post.createdAt, i18n.language),
                              post.locked ? localizeUi("ui.slurp.studio.locked", { defaultValue: "locked" }) : null,
                              post.hasImage ? localizeUi("ui.slurp.studio.withImage", { defaultValue: "image" }) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-xs font-bold tabular-nums">
                            {localizeUi("ui.slurp.studio.reached", {
                              defaultValue: "{{count}} reached",
                              count: post.reach.toLocaleString(),
                            })}
                          </span>
                          <span className="block text-[0.7rem] tabular-nums text-[var(--muted-foreground)]">
                            {[
                              localizeUi("ui.slurp.studio.likes", {
                                defaultValue: "{{count}} likes",
                                count: post.likeCount.toLocaleString(),
                              }),
                              localizeUi("ui.slurp.studio.comments", {
                                defaultValue: "{{count}} comments",
                                count: post.replyCount.toLocaleString(),
                              }),
                              post.unlockCount !== null
                                ? localizeUi("ui.slurp.studio.unlocks", {
                                    defaultValue: "{{count}} unlocks",
                                    count: post.unlockCount.toLocaleString(),
                                  })
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))
        )}
      </div>
    </NoodlerFrame>
  );
}

/**
 * The tip goal on the Creator home: show progress, or open one.
 *
 * A milestone is a target the player aims at privately. A tip goal is one the Creator shows the
 * audience, which is the only thing that gives anyone a reason to tip rather than just watch.
 * Progress is measured from the lifetime earnings recorded when the goal opened, so a payout
 * never drags the bar backwards.
 */
function SlurpGoalEditor({ creator, personaId }: { creator: SlurpStudioCreator; personaId: string | null }) {
  const { t: localizeUi } = useUiTranslation();
  const setGoal = useSetSlurpGoal();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(creator.goal?.label ?? "");
  const [target, setTarget] = useState(creator.goal?.target ?? 500);

  const submit = (nextLabel: string | null) => {
    if (!personaId) return;
    setGoal.mutate(
      { creatorAccountId: creator.id, personaId, label: nextLabel, target },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => toast.error(errorMessage(error, "Failed to save goal")),
      },
    );
  };

  if (!editing) {
    return creator.goal ? (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-bold">{creator.goal.label}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs font-bold text-[var(--noodle-accent)] hover:underline"
          >
            {localizeUi("ui.slurp.studio.goalEdit", { defaultValue: "Edit" })}
          </button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--accent)]">
          <div
            className="h-full rounded-full bg-[var(--noodle-accent)] transition-[width] motion-reduce:transition-none"
            style={{ width: `${Math.round(creator.goal.progress * 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs tabular-nums text-[var(--muted-foreground)]">
          {creator.goal.met
            ? localizeUi("ui.slurp.studio.goalMet", { defaultValue: "Goal met." })
            : localizeUi("ui.slurp.studio.goalProgress", {
                defaultValue: "{{raised}} of {{target}}",
                raised: creator.goal.raised.toLocaleString(),
                target: creator.goal.target.toLocaleString(),
              })}{" "}
          <SlurpCoin size={14} />
        </p>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="self-start rounded-lg px-2 py-1 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 hover:bg-[var(--noodle-accent)]/10"
      >
        {localizeUi("ui.slurp.studio.goalAdd", { defaultValue: "Set a tip goal" })}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[var(--accent)] p-3">
      <label className="sr-only" htmlFor={`slurp-goal-label-${creator.id}`}>
        {localizeUi("ui.slurp.studio.goalLabel", { defaultValue: "Goal" })}
      </label>
      <input
        id={`slurp-goal-label-${creator.id}`}
        value={label}
        maxLength={80}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={localizeUi("ui.slurp.studio.goalPlaceholder", { defaultValue: "New set on Friday…" })}
        className="h-10 w-full rounded-lg bg-[var(--slurp-canvas,var(--background))] px-3 text-sm outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
      />
      <div className="flex items-center gap-2">
        <label htmlFor={`slurp-goal-target-${creator.id}`} className="text-xs font-bold text-[var(--muted-foreground)]">
          {localizeUi("ui.slurp.studio.goalTarget", { defaultValue: "Target" })}
        </label>
        <input
          id={`slurp-goal-target-${creator.id}`}
          type="number"
          min={1}
          max={1_000_000}
          value={target}
          onChange={(event) => setTarget(Math.max(1, Math.floor(Number(event.target.value) || 0)))}
          className="h-9 w-28 rounded-lg bg-[var(--slurp-canvas,var(--background))] px-2 text-sm tabular-nums outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus:ring-2 focus:ring-[var(--noodle-accent)]"
        />
        <div className="ml-auto flex gap-2">
          {creator.goal && (
            <button
              type="button"
              disabled={setGoal.isPending}
              onClick={() => submit(null)}
              className="min-h-9 rounded-lg px-3 text-xs font-bold text-[var(--muted-foreground)] ring-1 ring-inset ring-[var(--noodle-divider)] disabled:opacity-50"
            >
              {localizeUi("ui.slurp.studio.goalClear", { defaultValue: "Clear" })}
            </button>
          )}
          <button
            type="button"
            disabled={setGoal.isPending || !label.trim()}
            onClick={() => submit(label.trim())}
            className="min-h-9 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50"
          >
            {localizeUi("ui.slurp.studio.goalSave", { defaultValue: "Save goal" })}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Move earnings into spending money.
 *
 * This is the step that connects the two seats the player occupies: a Creator who does well funds
 * their habit as a fan. Without it earnings are a scoreboard attached to nothing.
 *
 * The daily allowance is shown rather than the balance, because the allowance is the number that
 * decides what you can actually do today.
 */
function SlurpPayoutRow({ creator, personaId }: { creator: SlurpStudioCreator; personaId: string }) {
  const { t: localizeUi } = useUiTranslation();
  const payout = useSlurpPayout();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--accent)] p-3">
      <span className="min-w-0">
        <span className="block text-xs font-bold">
          {localizeUi("ui.slurp.studio.payoutTitle", { defaultValue: "Available to withdraw today" })}
        </span>
        <span className="block text-[0.7rem] text-[var(--muted-foreground)]">
          <SlurpCoinAmount amount={creator.payoutAllowance.toLocaleString()} />
          {", from "}
          <SlurpCoinAmount amount={creator.earnings.coins.toLocaleString()} watchAmount={creator.earnings.coins} />
          {" earned and unspent."}
        </span>
      </span>
      <button
        type="button"
        disabled={payout.isPending}
        onClick={() =>
          payout.mutate(
            { creatorAccountId: creator.id, personaId, amount: creator.payoutAllowance },
            { onError: (error) => toast.error(errorMessage(error, "Withdrawal failed")) },
          )
        }
        className="relative min-h-10 shrink-0 overflow-visible rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 [&_svg]:!text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <SlurpCoinBurst active={payout.isPending} direction="earn" />
        {payout.isPending
          ? localizeUi("ui.slurp.studio.payoutPending", { defaultValue: "Withdrawing…" })
          : localizeUi("ui.slurp.studio.payout", { defaultValue: "Withdraw" })}
      </button>
    </div>
  );
}

export { SlurpStudioView, SlurpGoalEditor, SlurpPayoutRow };
