import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, MessageCircle } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";

/**
 * The stickers a Story can carry (3b): a countdown to a drop, a poll with its results, and the fan
 * comment a Story answers. Presentation only: props in, one callback out. Glass on the picture,
 * inline styles so nothing depends on a class only Slurp uses.
 */

const glass: CSSProperties = {
  background: "rgb(0 0 0 / 0.5)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.18), 0 10px 30px -12px rgb(0 0 0 / 0.6)",
  border: "1px solid rgb(255 255 255 / 0.16)",
  color: "white",
};

/** "2h 14m", "14m", or null once the time has come. */
export function slpDropCountdown(dropAt: string | undefined, now: number): { h: number; m: number } | null {
  const left = Date.parse(dropAt ?? "") - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  const minutes = Math.max(1, Math.ceil(left / 60_000));
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

export function SlpDropTime({ dropAt }: { dropAt?: string }) {
  const { t } = useTranslation();
  const left = slpDropCountdown(dropAt, useNow(30_000));
  if (!left) return <>{t("ui.slurp.purpose.dropSoon", { defaultValue: "Next drop any minute" })}</>;
  const time = left.h
    ? t("ui.slurp.purpose.hoursMinutes", { h: left.h, m: left.m, defaultValue: "{{h}}h {{m}}m" })
    : t("ui.slurp.purpose.minutes", { m: left.m, defaultValue: "{{m}}m" });
  return <>{t("ui.slurp.purpose.dropIn", { time, defaultValue: "Next drop in {{time}}" })}</>;
}

/** Counts down to the drop; once the drop is up it says so and links to it. */
export function SlpCountdownSticker({
  dropAt,
  linked,
  onSeePost,
}: {
  dropAt?: string;
  linked: boolean;
  onSeePost?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-slurp-sticker="countdown"
      className="flex flex-col items-center gap-2 text-center"
      style={{ ...glass, borderRadius: 22, padding: "14px 20px", minWidth: 200 }}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "rgb(255 255 255 / 0.78)" }}>
        <Clock3 size={14} aria-hidden="true" />
        {t("ui.slurp.purpose.countdownLabel", { defaultValue: "Countdown" })}
      </span>
      <span className="text-lg font-black tabular-nums" aria-live="polite">
        {linked ? t("ui.slurp.purpose.dropUp", { defaultValue: "The drop is up" }) : <SlpDropTime dropAt={dropAt} />}
      </span>
      {linked && onSeePost && (
        <button
          type="button"
          onClick={onSeePost}
          className="min-h-10 rounded-full px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ background: "var(--noodle-accent)", color: "var(--slurp-on-accent, white)" }}
        >
          {t("ui.slurp.purpose.seeIt", { defaultValue: "See it" })}
        </button>
      )}
    </div>
  );
}

export type SlpPollStickerOption = { id: string; label: string; count: number };

/** Tap a choice to vote; after that (or for the Creator) the bars show how the vote stands. */
export function SlpPollSticker({
  options,
  selected,
  showResults,
  disabled,
  onVote,
}: {
  options: SlpPollStickerOption[];
  selected: string | null;
  showResults: boolean;
  disabled: boolean;
  onVote?: (optionId: string) => void;
}) {
  const { t } = useTranslation();
  const total = options.reduce((sum, option) => sum + option.count, 0);
  const results = showResults || selected !== null;
  return (
    <div
      data-slurp-sticker="poll"
      role="group"
      aria-label={t("ui.slurp.purpose.pollLabel", { defaultValue: "Poll" })}
      className="flex flex-col gap-2"
      style={{ ...glass, borderRadius: 22, padding: 12, width: "min(18rem, 78vw)" }}
    >
      {options.map((option) => {
        const share = total > 0 ? Math.round((option.count / total) * 100) : 0;
        const mine = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled || results || !onVote}
            aria-pressed={mine}
            onClick={() => onVote?.(option.id)}
            className="relative flex min-h-11 items-center justify-between gap-3 overflow-hidden text-left text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default"
            style={{
              borderRadius: 14,
              padding: "0 14px",
              background: "rgb(255 255 255 / 0.14)",
              boxShadow: mine ? "inset 0 0 0 2px var(--noodle-accent)" : undefined,
            }}
          >
            {results && (
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 motion-reduce:transition-none"
                style={{
                  width: `${share}%`,
                  background: mine ? "var(--noodle-accent)" : "rgb(255 255 255 / 0.22)",
                  opacity: mine ? 0.55 : 1,
                  transition: "width 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              />
            )}
            <span className="relative flex min-w-0 items-center gap-1.5">
              {mine && <SlpSparkleGlyph size={12} aria-hidden="true" />}
              <span className="min-w-0 truncate">{option.label}</span>
            </span>
            {results && <span className="relative shrink-0 tabular-nums">{share}%</span>}
          </button>
        );
      })}
      {results && (
        <span className="text-center text-[11px] font-semibold" style={{ color: "rgb(255 255 255 / 0.7)" }}>
          {t("ui.slurp.purpose.pollVotes", { count: total, defaultValue: "{{count}} votes" })}
        </span>
      )}
    </div>
  );
}

/** The fan comment a Story answers, quoted like a reply sticker. */
export function SlpCommentSticker({ handle, text }: { handle: string; text: string }) {
  const { t } = useTranslation();
  return (
    <figure
      data-slurp-sticker="comment"
      className="flex flex-col gap-1"
      style={{ ...glass, borderRadius: 18, padding: "10px 14px", maxWidth: "min(18rem, 78vw)" }}
    >
      <figcaption
        className="flex items-center gap-1.5 text-[11px] font-bold"
        style={{ color: "rgb(255 255 255 / 0.72)" }}
      >
        <MessageCircle size={12} aria-hidden="true" />
        {handle
          ? t("ui.slurp.purpose.commentFrom", { handle, defaultValue: "Reply to @{{handle}}" })
          : t("ui.slurp.purpose.commentFan", { defaultValue: "Reply to a comment" })}
      </figcaption>
      <blockquote className="text-sm font-semibold" style={{ margin: 0, lineHeight: "20px", overflowWrap: "anywhere" }}>
        {text}
      </blockquote>
    </figure>
  );
}
