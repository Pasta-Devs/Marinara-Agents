// ──────────────────────────────────────────────
// Otome Forge: "{name} noticed: …", a love interest's line about the look she wears now (P19, M4), in their colour.
// The Wardrobe's Me view and Home's Me side show it; the server keeps only a line about the look worn now.
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { accentOf } from "../lib/accent";
import type { Noticed, RunView } from "../shared/api-types";

/** The line, from `noticed` when given (the Wardrobe's and Home's own answers), else the run view's. */
export function HeNoticed({ view, noticed }: { view: RunView; noticed?: Noticed | null }) {
  const { t } = useTranslation();
  const line = noticed === undefined ? (view.player.noticed ?? null) : noticed;
  const li = line ? view.lis.find((item) => item.id === line.li) : null;
  if (!line || !li) return null;
  return (
    <figure className="of-noticed of-glass" style={{ "--of-li-accent": accentOf(li) } as CSSProperties}>
      <figcaption className="of-noticed-who">{t("ui.otomeForge.wardrobe.noticed", { name: li.name })}</figcaption>
      <blockquote className="of-noticed-line">“{line.text}”</blockquote>
    </figure>
  );
}
