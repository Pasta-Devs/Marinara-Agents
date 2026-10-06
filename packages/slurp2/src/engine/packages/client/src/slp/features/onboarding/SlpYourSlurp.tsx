// "Your Slurp" in Settings › Overview (docs/OPENING-DAY.md, S5): the phone from the opening day, built
// from today's settings, and "Run setup again" to change it the same way.
import { RefreshCw } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SLP_GROUP_CLASS, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { cn } from "../../../lib/utils";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { SlpPhonePreview } from "../../modules/preview/SlpPhonePreview";
import { useSlpRailContext } from "./slp-rail-hooks";
import { slpRailAnswers, slpRailPhoneInput, type SlpRailState } from "./slp-site-welcome";

// Today's values for every question, the fun part included.
const TODAY: SlpRailState = { answers: { fun: "sure" }, events: [], seen: [] };

export function SlpYourSlurp({ onRunSetupAgain }: { onRunSetupAgain?: () => void }) {
  const { t } = useUiTranslation();
  const context = useSlpRailContext("again", true);
  return (
    <section aria-labelledby="slp-your-slurp" className={cn(SLP_GROUP_CLASS, "flex flex-wrap items-center gap-4 p-4")}>
      <div className="w-full max-w-[13rem] shrink-0 max-sm:mx-auto">
        {context ? (
          <SlpPhonePreview
            input={{
              ...slpRailPhoneInput(slpRailAnswers(TODAY, context), context, true),
              creators: true,
              locked: false,
            }}
          />
        ) : (
          <div className="aspect-[9/19] rounded-[2rem] bg-[var(--slurp-surface)]" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-[12rem] flex-1 space-y-2">
        <h3 id="slp-your-slurp" className={SLP_TYPE.title}>
          {t("ui.slurp.opening.yours.title")}
        </h3>
        <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>{t("ui.slurp.opening.yours.detail")}</p>
        {onRunSetupAgain && (
          <SlpButton variant="secondary" onClick={onRunSetupAgain}>
            <RefreshCw size={16} aria-hidden="true" />
            {t("ui.slurp.site.again")}
          </SlpButton>
        )}
      </div>
    </section>
  );
}
