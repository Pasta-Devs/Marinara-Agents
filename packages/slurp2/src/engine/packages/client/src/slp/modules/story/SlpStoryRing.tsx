import { createContext, useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SlpRingGlint } from "../sparkle/SlpSparkle";
import type { SlpStoryRingState } from "./slp-story-rings";

/*
 * The Story ring on a Creator's avatar, the way Instagram does it: `new` = hero ring with the glint,
 * `seen` = still, muted ring, no live Story = no ring (see `slp-story-rings.ts`).
 */

export type SlpStoryRings = {
  ringOf: (creatorId: string) => SlpStoryRingState | null;
  /** Asks for that Creator's Stories. Absent where no Story viewer can open. */
  open?: (creatorId: string) => void;
  /**
   * The Creator whose Stories were asked for and not shown yet. The screen that has a Story viewer
   * with them (the hub, or their profile) shows them and calls `taken`.
   */
  pending?: string | null;
  taken?: () => void;
  /** The Story a tap starts on: the Creator's oldest unwatched live Story, else their oldest live one. */
  startOf?: (creatorId: string) => string | null;
};

export const SLP_NO_STORY_RINGS: SlpStoryRings = { ringOf: () => null };

const SlpStoryRingContext = createContext<SlpStoryRings>(SLP_NO_STORY_RINGS);

/** Screens that know the live Stories provide this; every avatar under them reads it. */
export const SlpStoryRingProvider = SlpStoryRingContext.Provider;

export function useSlpStoryRings(): SlpStoryRings {
  return useContext(SlpStoryRingContext);
}

/**
 * Puts the Story ring round any avatar and makes a ringed avatar open the Stories. The ring sits
 * just outside the avatar, so ringed and plain avatars line up.
 *
 * Inside a button or link (a post header, a card, an inbox row) the tap is taken in the capture
 * phase, so the parent's own action (open the profile) only runs where there is no ring. Where the
 * avatar stands alone, `standalone` makes the ring its own keyboard-reachable button.
 * ponytail: nested in a parent button, keyboard users reach the Stories through the shelf and the
 * profile's Stories tab rather than the avatar; give those parents a separate Story button if needed.
 */
export function SlpStoryRingAvatar({
  creatorId,
  name,
  children,
  standalone = false,
  outset = 4,
  className,
}: {
  creatorId: string | null | undefined;
  /** For the "Open a Story from …" label. */
  name?: string;
  children: ReactNode;
  standalone?: boolean;
  /** How far outside the avatar the ring sits (px). */
  outset?: number;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { ringOf, open } = useSlpStoryRings();
  const ring = creatorId ? ringOf(creatorId) : null;
  if (!ring || !creatorId) return <>{children}</>;
  const openStories = open
    ? (event: MouseEvent | KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        open(creatorId);
      }
    : undefined;
  const label = localizeUi("ui.slurp.moments.open", { name: name ?? "" });
  return (
    <span
      className={cn("relative isolate block w-fit shrink-0 rounded-full", openStories && "cursor-pointer", className)}
      data-slp-story-ring={ring}
      onClickCapture={openStories}
      {...(standalone && openStories
        ? {
            role: "button",
            tabIndex: 0,
            "aria-label": label,
            onKeyDown: (event: KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") openStories(event);
            },
          }
        : { title: openStories ? label : undefined })}
    >
      {children}
      <SlpRingGlint seen={ring === "seen"} outset={outset} />
    </span>
  );
}
