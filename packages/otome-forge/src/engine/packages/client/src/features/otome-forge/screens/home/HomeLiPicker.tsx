// ──────────────────────────────────────────────
// Otome Forge: "Who's home?": the cast, each with his portrait (or initials) and affection level; picking one makes
// him the love interest on Home. The cast and bibles, and the other stories, open from Settings → Stories.
// ──────────────────────────────────────────────
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Avatar } from "../../components/Avatar";
import { Dialog } from "../../components/Dialog";
import { ImageDescription } from "../../components/ImageDescription";
import { accentOf } from "../../lib/accent";
import type { LiId, RunLiView } from "../../shared/api-types";

interface HomeLiPickerProps {
  lis: RunLiView[];
  current: LiId | null;
  onPick: (li: LiId) => void;
  onClose: () => void;
}

export function HomeLiPicker({ lis, current, onPick, onClose }: HomeLiPickerProps) {
  const { t } = useTranslation();
  const currentRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      title={t("ui.otomeForge.home.whoIsHome")}
      onClose={onClose}
      initialFocus={currentRef}
      actions={
        <button type="button" className="of-button of-button--primary of-button--small" onClick={onClose}>
          {t("ui.otomeForge.home.close")}
        </button>
      }
    >
      <p className="of-hint">{t("ui.otomeForge.home.pickHint")}</p>
      <ul className="of-home-picks">
        {lis.map((li) => {
          const chosen = li.id === current;
          return (
            <li key={li.id}>
              <button
                ref={chosen ? currentRef : undefined}
                type="button"
                className="of-home-pick of-glass"
                aria-current={chosen ? "true" : undefined}
                onClick={() => onPick(li.id)}
              >
                <Avatar name={li.name} url={li.portrait} accent={accentOf(li)} size={44} />
                <span className="of-home-pick-text">
                  <span className="of-home-pick-name">{li.name}</span>
                  <span className="of-hint">{t("ui.otomeForge.home.level", { level: li.level })}</span>
                </span>
                {chosen ? <Check className="of-home-pick-mark" size={18} strokeWidth={2.4} aria-hidden="true" /> : null}
              </button>
              <ImageDescription text={[li.look?.identityLine, li.look?.outfitLine].filter(Boolean).join("\n")} />
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
