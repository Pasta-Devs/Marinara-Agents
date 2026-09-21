import { useTranslation } from "react-i18next";
import { useSlurpUIStore } from "../state/slp-package-store";

/** Jumps to one Creator's continuity editor in Backstage. */
export function SlpOpenContinuityButton({
  creatorAccountId,
  className,
}: {
  creatorAccountId: string;
  className: string;
}) {
  const { t } = useTranslation();
  const setNavigation = useSlurpUIStore((state) => state.setNavigation);
  return (
    <button
      type="button"
      className={className}
      onClick={() =>
        setNavigation({
          mode: "creator-settings",
          tab: "creator",
          section: "creators",
          target: "creators",
          continuityCreatorId: creatorAccountId,
        })
      }
    >
      {t("ui.slurp.messages.requests.openContinuity", { defaultValue: "Open continuity" })}
    </button>
  );
}
