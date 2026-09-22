import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";

/**
 * Arrows and position dots over a feed card's picture, for a post that carries several.
 *
 * Dots rather than mini previews: the feed card has to stay compact, and the dots still say how
 * many pictures there are and which one is showing. The opened post viewer is where the thumbnail
 * strip belongs.
 */
export function SlpPostImageNav({
  total,
  index,
  onSelect,
}: {
  total: number;
  index: number;
  onSelect: (next: number) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (total <= 1) return null;
  const step = (offset: 1 | -1) => (index + offset + total) % total;
  return (
    <>
      <span className="pointer-events-none absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between">
        <button
          type="button"
          aria-label={localizeUi("ui.slurp.post.previousImage")}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(step(-1));
          }}
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-black/65 text-white"
        >
          <ChevronLeft size={20} className="rtl:rotate-180" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={localizeUi("ui.slurp.post.nextImage")}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(step(1));
          }}
          className="pointer-events-auto grid size-10 place-items-center rounded-full bg-black/65 text-white"
        >
          <ChevronRight size={20} className="rtl:rotate-180" aria-hidden="true" />
        </button>
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1.5">
        {Array.from({ length: total }, (_, position) => (
          <span
            key={position}
            className={`size-1.5 rounded-full ring-1 ring-black/40 ${position === index ? "bg-white" : "bg-white/45"}`}
          />
        ))}
        <span className="sr-only">
          {localizeUi("ui.slurp.post.imageCounter", {
            index: index + 1,
            total,
            defaultValue: "{{index}} of {{total}}",
          })}
        </span>
      </span>
    </>
  );
}
