// ──────────────────────────────────────────────
// Otome Forge: his mood today, from the message of the day ("irritable · audit"): one word and a reason of four words
// at most, both written by the model in the world's language.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { Sparkle } from "lucide-react";
import type { NoteMood } from "../../shared/api-types";

export function MoodChip({ mood }: { mood: NoteMood }) {
  const { t } = useTranslation();
  const word = mood.word.trim();
  if (!word) return null;
  const reason = mood.reason.trim();
  return (
    <p className="of-mood-chip">
      <Sparkle size={12} strokeWidth={1.8} fill="currentColor" aria-hidden="true" />
      <span className="of-visually-hidden">{t("ui.otomeForge.home.moodLabel")}</span>
      <span>{reason ? t("ui.otomeForge.home.moodWithReason", { word, reason }) : word}</span>
    </p>
  );
}
