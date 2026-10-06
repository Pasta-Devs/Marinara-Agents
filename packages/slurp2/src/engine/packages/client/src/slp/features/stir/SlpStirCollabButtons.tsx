import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { useSlurpTiesMutations } from "../projects/slp-projects-contract";

/**
 * An agreed collab stays until its host posts it, past its day too (0.3.17): post it now, or call it
 * off without blocking the pair.
 */
export function SlpStirCollabButtons({ collabId, personaId }: { collabId: string; personaId: string }) {
  const { t } = useTranslation();
  const ties = useSlurpTiesMutations(personaId);
  const run = (how: "postNow" | "drop") =>
    ties[how].mutate(collabId, {
      onSuccess: () =>
        void toast.success(t(how === "drop" ? "ui.slurp.stir.now.collabDropped" : "ui.slurp.stir.now.collabPosting")),
      onError: (error) => void toast.error(errorMessage(error)),
    });
  const busy = ties.postNow.isPending || ties.drop.isPending;
  return (
    <span className="flex shrink-0 gap-1">
      <SlpButton variant="quiet" disabled={busy} onClick={() => run("postNow")} className="min-h-11 px-3 text-xs">
        {t("ui.slurp.stir.now.postCollab")}
      </SlpButton>
      <SlpButton variant="quiet" disabled={busy} onClick={() => run("drop")} className="min-h-11 px-3 text-xs">
        {t("ui.slurp.stir.now.dropCollab")}
      </SlpButton>
    </span>
  );
}
