import { Sparkles } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { SlurpCreatorProfileCard } from "../../modules/creator/SlpCreatorProfileCard";
import type { SlurpViewerCreator } from "./SlpHomeHelpers";

export function SlurpInlineSuggestedCreators({
  creators,
  onOpenProfile,
}: {
  creators: SlurpViewerCreator[];
  onOpenProfile?: (accountId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  if (creators.length === 0) return null;
  return (
    <aside
      data-component="SlurpHome.InlineSuggestedCreators"
      aria-labelledby="slurp-inline-suggested-creators"
      className="overflow-hidden rounded-xl bg-[var(--slurp-surface)] px-3 py-3 ring-1 ring-inset ring-[var(--noodle-divider)]"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="slurp-inline-suggested-creators" className="text-sm font-bold">
          {localizeUi("ui.slurp.suggestedCreators")}
        </h2>
        <Sparkles size={15} className="shrink-0 text-[var(--noodle-accent)]" aria-hidden="true" />
      </div>
      <div className="mt-2 flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {creators.map((creator) => (
          <SlurpCreatorProfileCard
            key={creator.profile.id}
            creator={creator}
            onOpenProfile={onOpenProfile}
            className="w-64 shrink-0 snap-start"
          />
        ))}
      </div>
    </aside>
  );
}
