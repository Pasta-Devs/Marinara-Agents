// ──────────────────────────────────────────────
// Otome Forge: the Tells journal. What she has learned to read in each love interest (the small things that give
// their mask away), in her own hand. Only tells she has learned are listed; the rest stay hidden. Release 2 grows it
// into each one's Dossier.
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../../components/Avatar";
import { accentOf } from "../../lib/accent";
import type { LiId, RunView } from "../../shared/api-types";

export function Tells({ view, tells }: { view: RunView; tells: Record<LiId, string[]> }) {
  const { t } = useTranslation();
  return (
    <div className="of-tells">
      {view.lis.map((li) => {
        const learned = Array.isArray(tells[li.id]) ? tells[li.id]! : [];
        const accent = accentOf(li);
        return (
          <section
            key={li.id}
            className="of-tells-page of-glass"
            aria-labelledby={`of-tells-${li.id}`}
            style={{ "--of-li-accent": accent } as CSSProperties}
          >
            <div className="of-tells-head">
              <Avatar name={li.name} url={li.portrait} accent={accent} size={38} />
              <h3 id={`of-tells-${li.id}`} className="of-tells-name">
                {li.name}
              </h3>
            </div>
            {learned.length ? (
              <ul className="of-tells-list">
                {learned.map((tell, index) => (
                  <li key={`${index}-${tell}`} className="of-tells-item">
                    {tell}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="of-hint">{t("ui.otomeForge.album.tellsNone", { name: li.name })}</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
