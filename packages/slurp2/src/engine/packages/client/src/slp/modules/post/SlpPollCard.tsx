import { Check } from "lucide-react";
import { useState } from "react";
import type { NoodleAccount, NoodleInteraction, NoodlePoll } from "@marinara-engine/shared";
import { cn } from "../../../lib/utils";
import { Avatar } from "../../base/chrome/SlpChrome";
import { useTranslation as useUiTranslation } from "react-i18next";

export function NoodlePollCard({
  poll,
  votes,
  accountById,
  selectedOptionId,
  disabled,
  pending,
  onVote,
  onOpenProfile,
}: {
  poll: NoodlePoll;
  votes: NoodleInteraction[];
  accountById: Map<string, NoodleAccount>;
  selectedOptionId: string | null;
  disabled: boolean;
  pending: boolean;
  onVote: (optionId: string) => void;
  onOpenProfile: (account: NoodleAccount) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const totalVotes = votes.length;
  const [showVoters, setShowVoters] = useState(false);
  return (
    <section
      className="mt-3"
      aria-label={localizeUi("ui.noodle.noodlepollcard.pollValue1", {
        value1: poll.question,
      })}
      data-noodle-poll
    >
      <h3 className="text-sm font-bold leading-5">{poll.question}</h3>
      <div className="mt-2 space-y-2">
        {poll.options.map((option) => {
          const matchingVotes = votes.filter((vote) => vote.content === option.id);
          const optionVotes = matchingVotes.length;
          const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const selected = selectedOptionId === option.id;
          return (
            <div key={option.id} className="space-y-1.5">
              <button
                type="button"
                onClick={() => onVote(option.id)}
                disabled={disabled || pending}
                aria-pressed={selected}
                aria-label={localizeUi("ui.noodle.noodlepollcard.value1Value2Value3Value4", {
                  value1: option.label,
                  value2: optionVotes,
                  value3:
                    optionVotes === 1
                      ? localizeUi("ui.noodle.noodlepollcard.vote")
                      : localizeUi("ui.noodle.noodlepollcard.votes"),
                  value4: percentage,
                })}
                className={cn(
                  "relative flex min-h-10 w-full items-center overflow-hidden rounded-lg border px-3 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:cursor-not-allowed",
                  selected
                    ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                    : "border-[var(--noodle-divider)] hover:border-[var(--noodle-accent)]/55 hover:bg-[var(--noodle-accent)]/5",
                )}
                data-noodle-poll-option={option.id}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 origin-left bg-[var(--noodle-accent)]/15 transition-transform duration-300 ease-out"
                  style={{ transform: `scaleX(${percentage / 100})` }}
                />
                <span className="relative flex min-w-0 flex-1 items-center gap-2">
                  {selected && <Check size={14} className="shrink-0 text-[var(--noodle-accent)]" />}
                  <span className="min-w-0 flex-1 break-words">{option.label}</span>
                  <span className="shrink-0 text-[var(--muted-foreground)]">{percentage}%</span>
                </span>
              </button>
              {showVoters && optionVotes > 0 && (
                <div
                  className="flex flex-wrap gap-1 px-2"
                  aria-label={localizeUi("ui.noodle.noodlepollcard.votersForValue1", { value1: option.label })}
                >
                  {matchingVotes.map((vote) => {
                    const voterAccount = accountById.get(vote.actorAccountId) ?? null;
                    const voter = voterAccount ?? vote.actorSnapshot;
                    return voter ? (
                      <button
                        key={vote.id}
                        type="button"
                        onClick={() => {
                          if (voterAccount) onOpenProfile(voterAccount);
                        }}
                        disabled={!voterAccount}
                        className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full bg-[var(--noodle-accent)]/8 pr-2 text-[0.6875rem] font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--noodle-accent)]/15 hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70 disabled:cursor-default"
                      >
                        <Avatar account={voter} size="sm" />
                        <span className="max-w-32 truncate">@{voter.handle}</span>
                      </button>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setShowVoters((visible) => !visible)}
        aria-expanded={showVoters}
        className="mt-2 rounded-lg text-[0.68rem] text-[var(--muted-foreground)] transition-colors hover:text-[var(--noodle-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--noodle-accent)]/70"
      >
        {totalVotes}{" "}
        {totalVotes === 1 ? localizeUi("ui.noodle.noodlepollcard.vote") : localizeUi("ui.noodle.noodlepollcard.votes")}
        {selectedOptionId ? localizeUi("ui.noodle.noodlepollcard.youVoted_80cf257") : ""}
        {pending ? localizeUi("ui.noodle.poll.savingSuffix") : ""}
        {totalVotes > 0
          ? showVoters
            ? localizeUi("ui.noodle.poll.hideVotersSuffix")
            : localizeUi("ui.noodle.poll.viewVotersSuffix")
          : ""}
      </button>
    </section>
  );
}
