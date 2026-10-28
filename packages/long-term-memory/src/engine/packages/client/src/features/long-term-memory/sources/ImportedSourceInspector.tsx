import { Sparkles } from "lucide-react";
import { Button, lockedActionProps } from "../shared-controls";
import { useLtmTranslation } from "../localization";
import type { SourceOperation } from "./source-shared";

export function ImportedSourceInspector({
  source,
  disabled,
  lockReasonId,
  bulkActive,
  onOpenMemory,
  onOpenReview,
  onReextract,
  onManage,
}: {
  source: { id: string; title: string };
  disabled: boolean;
  lockReasonId?: string;
  bulkActive: boolean;
  onOpenMemory?: (id: string) => void;
  onOpenReview?: (id: string) => void;
  onReextract: (id: string) => void;
  onManage: (id: string, title: string, operation: SourceOperation, trigger: HTMLElement) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  if (bulkActive) return null;
  return (
    <div className="space-y-3" data-ltm-source-inspector>
      <div className="space-y-2">
        <Button onClick={() => onOpenMemory?.(source.id)} data-ltm-source-inspector-action="open-memory">
          {localizeUi("ui.longTermMemory.sourcesworkspace.openSourceMemory")}
        </Button>
        <Button onClick={() => onOpenReview?.(source.id)} data-ltm-source-inspector-action="review-drafts">
          {localizeUi("ui.longTermMemory.memoryvault.reviewRelatedDrafts")}
        </Button>
        <Button
          {...lockedActionProps(disabled, lockReasonId)}
          onClick={() => {
            if (!disabled) onReextract(source.id);
          }}
          data-ltm-source-inspector-action="re-extract"
        >
          <Sparkles aria-hidden="true" size="0.75rem" />
          {localizeUi("ui.longTermMemory.sourcesworkspace.reExtract")}
        </Button>
      </div>
      <details data-ltm-source-management>
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold">
          {localizeUi("ui.longTermMemory.sourceoperation.manageSource")}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["copy", "move", "archive", "delete"] as const).map((operation) => (
            <Button
              key={operation}
              {...lockedActionProps(disabled, lockReasonId)}
              destructive={operation === "delete"}
              onClick={(event) => {
                if (!disabled) onManage(source.id, source.title, operation, event.currentTarget);
              }}
              data-ltm-source-management-action={operation}
            >
              {localizeUi(`ui.longTermMemory.sourceoperation.${operation}`)}
            </Button>
          ))}
        </div>
      </details>
    </div>
  );
}
