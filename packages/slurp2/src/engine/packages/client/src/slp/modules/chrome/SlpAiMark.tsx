import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";

type Localize = (key: string, options?: Record<string, unknown>) => string;

const AI_NOTE_SEEN_KEY = "slurp2:ai-cost-note-seen";

/**
 * The small "✦ AI" mark on an action that runs the player's AI connection right away (Run audience,
 * Get reply now, Guide with AI). One tap still runs it; the mark is how the player knows it costs.
 */
export function SlpUsesAiMark({ className }: { className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const label = localizeUi("ui.slurp.ai.usesAi", { defaultValue: "Uses AI" });
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-[var(--slurp-tint)] px-1.5 text-[11px] font-semibold leading-none text-[var(--slurp-ink)] [&_svg]:!text-current",
        className,
      )}
    >
      <SlpSparkleGlyph size={10} aria-hidden="true" />
      AI
    </span>
  );
}

/**
 * The real cost note, once: the first time the player taps an AI action, Slurp says what the mark
 * means. The action runs either way (no confirmation, design language §7); later taps stay quiet.
 */
export function noteSlpAiUseOnce(localizeUi: Localize) {
  try {
    if (window.localStorage.getItem(AI_NOTE_SEEN_KEY)) return;
    window.localStorage.setItem(AI_NOTE_SEEN_KEY, "1");
  } catch {
    // Private mode: say it every time rather than never.
  }
  toast(localizeUi("ui.slurp.ai.costNoteTitle", { defaultValue: "Quick note from Slurp" }), {
    description: localizeUi("ui.slurp.ai.costNote", {
      defaultValue:
        "Anything marked AI runs on your own AI connection, so your provider may bill each run. I'll only say this once.",
    }),
    duration: 8000,
  });
}
