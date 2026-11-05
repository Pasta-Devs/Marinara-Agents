// ──────────────────────────────────────────────
// Otome Forge Settings → Stories: the way to the active story's cast (the forge's cast list and each bible) and to
// Your stories. OtomeForgeView leaves out a section with nowhere to lead: the cast without a story, and either one when
// Settings' Back already leads to its screen.
// ──────────────────────────────────────────────
import { useTranslation } from "react-i18next";
import { BookHeart, UsersRound } from "lucide-react";
import { Section } from "../setup/parts";

interface StoriesSettingsProps {
  onOpenCast: (() => void) | undefined;
  onOpenStories: (() => void) | undefined;
}

export function StoriesSettings({ onOpenCast, onOpenStories }: StoriesSettingsProps) {
  const { t } = useTranslation();
  return (
    <div className="of-step-body">
      {onOpenCast ? (
        <Section title={t("ui.otomeForge.setup.forgeCastTitle")} hint={t("ui.otomeForge.settings.castHint")}>
          <button type="button" className="of-button of-button--quiet of-glass of-button--small" onClick={onOpenCast}>
            <UsersRound size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.settings.openCast")}
          </button>
        </Section>
      ) : null}
      {onOpenStories ? (
        <Section title={t("ui.otomeForge.common.screenPicker")} hint={t("ui.otomeForge.settings.storiesHint")}>
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            onClick={onOpenStories}
          >
            <BookHeart size={15} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.settings.openStories")}
          </button>
        </Section>
      ) : null}
    </div>
  );
}
