// ──────────────────────────────────────────────
// Otome Forge: the cost line shown before anything that paints (images are paid, labelled, and never retried by
// themselves)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Paintbrush } from "lucide-react";
import { useOtomeProps } from "../props";
import type { ImageSettings } from "../shared/api-types";

interface CostHintProps {
  /** How many images the action paints. */
  images: number;
  /** An estimate ("about N images"), not an exact count. */
  about?: boolean;
  /** When they are painted, e.g. "later, in the background". */
  note?: string;
}

export function CostHint({ images, about = false, note }: CostHintProps) {
  const { t } = useTranslation();
  const count = about
    ? t("ui.otomeForge.setup.costImagesAbout", { count: images })
    : t("ui.otomeForge.setup.costImages", { count: images });
  return (
    <p className="of-cost">
      <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
      <span>
        {count}
        {note ? <span className="of-cost-note"> · {note}</span> : null}
      </span>
    </p>
  );
}

/**
 * True when a written scene paints its places and key image by itself: an image connection, with neither Ask before
 * painting nor the Engine's prompt review holding them for a tap (S/art/places.ts, S/art/cg.ts).
 */
export function usePaintsByItself(images: Pick<ImageSettings, "connectionId" | "ask">): boolean {
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  return !!images.connectionId && !images.ask && !reviewImagePromptsBeforeSend;
}

/**
 * The paints reading a chapter may start (each new place, at most two key moments), shown before it is planned; with
 * Ask before painting or prompt review they wait for a tap instead. Nothing without an image connection.
 */
export function ChapterPaintCost({ images }: { images: Pick<ImageSettings, "connectionId" | "ask"> }) {
  const { t } = useTranslation();
  const byItself = usePaintsByItself(images);
  if (!images.connectionId) return null;
  return (
    <p className="of-cost">
      <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
      <span>
        {t("ui.otomeForge.story.paintCost")}
        <span className="of-cost-note">
          {" "}
          · {byItself ? t("ui.otomeForge.story.paintCostNote") : t("ui.otomeForge.story.paintCostHeld")}
        </span>
      </span>
    </p>
  );
}
