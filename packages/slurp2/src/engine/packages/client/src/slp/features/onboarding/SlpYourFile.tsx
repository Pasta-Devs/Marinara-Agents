// "Your file": the welcome ticket, kept as the first entry of the Support desk (docs/ONBOARDING-RAIL.md).
// It reads today's settings, so it always shows what is set now; "Run setup again" reopens the ticket
// at the questions.
import { useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_GROUP_CLASS } from "../../base/chrome/SlpChrome";
import { SlpChip } from "../../modules/chrome/SlpButton";
import { useSlpRailContext } from "./slp-rail-hooks";
import { SlpRailFileRows } from "./SlpRailCards";
import { slpRailFileRows, type SlpRailState } from "./slp-site-welcome";

// Every fun-part row shows, with today's value.
const FILE: SlpRailState = { answers: { fun: "sure" }, events: [], seen: [] };

export function SlpYourFile({ onRunSetupAgain }: { onRunSetupAgain?: () => void }) {
  const { t } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const context = useSlpRailContext("again", open);
  const panelId = "slp-desk-your-file";
  return (
    <div className={SLP_GROUP_CLASS}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] motion-reduce:transition-none"
      >
        <Avatar account={{ displayName: t("ui.slurp.scene.host.support"), avatarUrl: null }} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-5">{t("ui.slurp.site.yourFile")}</span>
          <span className="block truncate text-xs leading-4 text-[var(--slurp-muted)]">
            {t("ui.slurp.site.ticket", { status: t("ui.slurp.site.status.resolved") })}
          </span>
        </span>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-[var(--slurp-muted)] transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={panelId} className="space-y-3 px-3 pb-3 pt-1">
          {context ? (
            <SlpRailFileRows rows={slpRailFileRows(FILE, context)} state={FILE} context={context} />
          ) : (
            <p className="px-1 text-xs text-[var(--slurp-muted)]">{t("ui.slurp.state.loading")}</p>
          )}
          {onRunSetupAgain && (
            <SlpChip selected onClick={onRunSetupAgain}>
              <RefreshCw size={14} aria-hidden="true" />
              {t("ui.slurp.site.again")}
            </SlpChip>
          )}
        </div>
      )}
    </div>
  );
}
