// ──────────────────────────────────────────────
// Otome Forge: the exact pity count ("5★ in 23"), shared by a banner kind's current banner and its Echoes. The
// numbers are the server's (SH/wish.ts pityView): the pull that is certain to be a 5★, and the 4★ likewise.
// ──────────────────────────────────────────────
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { FOUR_STAR_EVERY, HARD_PITY, type PityView } from "../../shared/wish";

interface PityCounterProps {
  pity: PityView;
}

/** One counter as a ring that fills as the guarantee nears. */
function Ring({ label, value, of, rarity }: { label: string; value: number; of: number; rarity: "gold" | "violet" }) {
  const filled = Math.min(1, Math.max(0, (of - value + 1) / of));
  return (
    <span className="of-pity-ring" data-rarity={rarity} style={{ "--of-pity": filled } as CSSProperties}>
      <span className="of-pity-value">{value}</span>
      <span className="of-pity-label">{label}</span>
    </span>
  );
}

export function PityCounter({ pity }: PityCounterProps) {
  const { t } = useTranslation();
  return (
    <div className="of-pity" role="group" aria-label={t("ui.otomeForge.wish.pityLabel")}>
      <p className="of-pity-text">
        <span className="of-pity-five">{t("ui.otomeForge.wish.pityFive", { value: pity.fiveIn })}</span>
        <span className="of-pity-dot" aria-hidden="true">
          ·
        </span>
        <span>{t("ui.otomeForge.wish.pityFour", { value: pity.fourIn })}</span>
      </p>
      <span className="of-pity-rings" aria-hidden="true">
        <Ring label="5★" value={pity.fiveIn} of={HARD_PITY} rarity="gold" />
        <Ring label="4★" value={pity.fourIn} of={FOUR_STAR_EVERY} rarity="violet" />
      </span>
    </div>
  );
}
