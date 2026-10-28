import { Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { readSlpPurpose } from "../../../../../shared/src/slp/slp-post-purpose.js";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { slpDrawAllCards } from "../../base/ui/slp-drawn-count";
import { SlpDropTime } from "../story/SlpStoryStickers";

/**
 * The one line under a post's name that says what it leads to (3b): "From the poll · Gym day" on a
 * post fans picked in a Story poll, "Next drop in 2h 14m" on a tease, and "See the drop" once the
 * drop it teased is up. Nothing on any other post.
 */
export function SlpPostPurposeNote({
  metadata,
  onShowPost,
}: {
  metadata?: Record<string, unknown> | null;
  onShowPost?: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const purpose = readSlpPurpose(metadata);
  const lineClass =
    "mt-1 flex min-w-0 items-center gap-1 text-xs font-medium leading-4 text-[var(--slurp-muted)] [&_svg]:!text-current";
  if (purpose?.kind === "poll_answer" && purpose.answer) {
    return (
      <p data-slurp-purpose="poll_answer" className={lineClass}>
        <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0" />
        <span className="shrink-0">{t("ui.slurp.purpose.fromPoll", { defaultValue: "From the poll" })}</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 truncate font-semibold text-[var(--noodle-accent-foreground)]">{purpose.answer}</span>
      </p>
    );
  }
  if (purpose?.kind !== "tease") return null;
  if (purpose.postId) {
    const dropId = purpose.postId;
    return (
      <p data-slurp-purpose="tease" className={lineClass}>
        <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0" />
        <button
          type="button"
          disabled={!onShowPost}
          onClick={() => onShowPost?.(dropId)}
          className="min-w-0 truncate rounded font-semibold text-[var(--noodle-accent-foreground)] enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:cursor-default"
        >
          {t("ui.slurp.purpose.seeDrop", { defaultValue: "See the drop" })}
        </button>
      </p>
    );
  }
  if (!purpose.dropAt) return null;
  return (
    <p data-slurp-purpose="tease" className={lineClass}>
      <Clock3 size={12} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">
        <SlpDropTime dropAt={purpose.dropAt} />
      </span>
    </p>
  );
}

/**
 * Bring a post into view where it is already on screen (the feed or a profile), with a short
 * highlight. False when it is not there, so the caller can open the Creator's page instead.
 */
export function slpShowPostInPlace(postId: string): boolean {
  const find = () => document.querySelector<HTMLElement>(`[data-noodle-post-id="${CSS.escape(postId)}"]`);
  // A long list draws its cards a few at a time (0.3.6): draw the rest before giving up on the post.
  if (!find()) slpDrawAllCards();
  const card = find();
  if (!card) return false;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const behavior = reduce ? "auto" : "smooth";
  card.scrollIntoView({ block: "center", behavior });
  card.focus({ preventScroll: true });
  // Cards off screen are measured only when they come near, so the feed shrinks while it scrolls and
  // the first scroll falls short: one correction once it settles, then the highlight.
  window.setTimeout(() => {
    const box = card.getBoundingClientRect();
    if (Math.abs(box.top + box.height / 2 - window.innerHeight / 2) > 48)
      card.scrollIntoView({ block: "center", behavior });
    card.animate?.([{ boxShadow: "0 0 0 3px var(--noodle-accent)" }, { boxShadow: "0 0 0 0 transparent" }], {
      duration: reduce ? 1 : 1400,
      delay: reduce ? 0 : 350,
      easing: "ease-out",
    });
  }, 700);
  return true;
}

/** Waits for the author's page to render the post, then brings it into view (up to ~4 s). */
export function slpShowPostWhenRendered(postId: string, tries = 16) {
  if (slpShowPostInPlace(postId) || tries <= 0) return;
  window.setTimeout(() => slpShowPostWhenRendered(postId, tries - 1), 250);
}
