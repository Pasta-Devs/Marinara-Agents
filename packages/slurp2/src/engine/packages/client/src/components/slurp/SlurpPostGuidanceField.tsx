import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useGenerateSlurpPostGuidance,
  useUpdateSlurpPostGuidance,
  type SlurpPostAccess,
  type SlurpPostGuidance,
} from "../../hooks/use-slurp";
import { errorMessage, PromptCard, PromptEditor } from "./SlurpBackstageWorkflow";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";
const quietButton = `inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] disabled:opacity-50 ${focusRing}`;

export const SLURP_POST_GUIDANCE_MAX_LENGTH = 4000;

/**
 * One editable direction for public or locked posts, with a button that writes it using the model.
 *
 * Used twice: once for the global field and once for a Creator's override. Empty means inherit,
 * so the placeholder shows what applies instead, and the field is never pre-filled with the
 * inherited text — filling it in would turn a live default into a frozen copy.
 */
export function SlurpPostGuidanceField({
  access,
  creatorId = null,
  guidance,
  inherited,
  label,
  detail,
  generateLabel,
  clearLabel,
  savedMessage,
  disabled = false,
}: {
  access: SlurpPostAccess;
  creatorId?: string | null;
  guidance: SlurpPostGuidance | undefined;
  /** Shown as the placeholder: the text that applies while this field is empty. */
  inherited: string;
  label: string;
  detail: string;
  generateLabel: string;
  clearLabel: string;
  savedMessage: string;
  disabled?: boolean;
}) {
  const saved = (creatorId ? guidance?.creators[creatorId] : guidance?.defaults)?.[access] ?? "";
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const update = useUpdateSlurpPostGuidance();
  const generate = useGenerateSlurpPostGuidance();
  // Switching Creator or tab must not carry the previous field's unsaved text across.
  useEffect(() => {
    setDraft("");
    setOpen(false);
  }, [access, creatorId]);
  const effective = saved || inherited;

  const save = async (next: string) => {
    if (next === saved) return;
    await update.mutateAsync(
      { creatorId, [access]: next },
      {
        onSuccess: () => toast.success(savedMessage),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-[var(--slurp-muted)]">{detail}</p>
      <PromptCard
        title={label}
        value={effective}
        isDefault={!saved}
        onEdit={() => {
          setDraft(effective);
          setOpen(true);
        }}
        onRestore={() => void save("")}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || generate.isPending || update.isPending}
          onClick={() =>
            generate.mutate(
              { access, creatorId, currentDraft: draft || effective },
              {
                onSuccess: (result) => {
                  setDraft(result.guidance);
                  setOpen(true);
                },
                onError: (error) => toast.error(errorMessage(error)),
              },
            )
          }
          className={quietButton}
        >
          {generate.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} className="text-[var(--noodle-accent)]" />
          )}
          {generateLabel}
        </button>
      </div>
      <PromptEditor
        open={open}
        title={label}
        value={draft}
        onChange={(value) => setDraft(value.slice(0, SLURP_POST_GUIDANCE_MAX_LENGTH))}
        onClose={() => setOpen(false)}
        onSave={async () => {
          await save(draft.trim());
          setOpen(false);
        }}
        onRestore={() => {
          void save("").then(() => {
            setDraft(inherited);
            setOpen(false);
          });
        }}
        restoreLabel={clearLabel}
        pending={disabled || update.isPending || generate.isPending}
      />
    </div>
  );
}
