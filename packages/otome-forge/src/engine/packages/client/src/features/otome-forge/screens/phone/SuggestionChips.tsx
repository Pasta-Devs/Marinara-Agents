// ──────────────────────────────────────────────
// Otome Forge: two or three short replies the model suggested with his last message. A tap sends one as it is; the
// player can always write her own instead.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";

interface SuggestionChipsProps {
  suggestions: string[];
  disabled: boolean;
  onPick: (text: string) => void;
}

export function SuggestionChips({ suggestions, disabled, onPick }: SuggestionChipsProps) {
  const { t } = useTranslation();
  const shown = suggestions.map((text) => text.trim()).filter(Boolean);
  if (shown.length === 0) return null;
  return (
    <ul className="of-suggestions" aria-label={t("ui.otomeForge.phone.suggestions")}>
      {shown.map((text) => (
        <li key={text}>
          <button
            type="button"
            className="of-suggestion of-glass"
            aria-disabled={disabled}
            onClick={() => !disabled && onPick(text)}
          >
            {text}
          </button>
        </li>
      ))}
    </ul>
  );
}
