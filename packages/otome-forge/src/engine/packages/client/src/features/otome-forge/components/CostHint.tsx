// ──────────────────────────────────────────────
// Otome Forge: the cost line shown before anything that paints (images are paid, labelled, and never retried by
// themselves)
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Paintbrush } from "lucide-react";

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
