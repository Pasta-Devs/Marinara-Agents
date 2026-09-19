import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useGenerateSlurpPostGuidance,
  useUpdateSlurpPostGuidance,
} from "../../slp/features/settings/slp-post-guidance-contract";
import type { SlurpPostAccess, SlurpPostGuidance } from "../../slp/features/settings/slp-post-guidance-contract";
import { errorMessage } from "../../slp/modules/settings/slp-backstage-format";
import { PromptCard, PromptEditor } from "../../slp/modules/settings/SlpBackstageKit";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]";
const quietButton = `inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] hover:bg-[var(--slurp-canvas)] disabled:opacity-50 ${focusRing}`;

export const SLURP_POST_GUIDANCE_MAX_LENGTH = 4000;

/**
 * One editable direction for public or locked posts, using the same explicit edit/review/save
 * interaction as the other Backstage prompts. Model output is only a draft until it is saved.
 *
 * Used twice: once for the global field and once for a Creator's override. Empty means inherit,
 * so the card shows what currently applies without turning an inherited value into a frozen copy.
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
  /** `menu` is a Creator's private content menu: same card, no model draft. */
  access: SlurpPostAccess | "menu";
  creatorId?: string | null;
  guidance: SlurpPostGuidance | undefined;
  /** The text that applies while this field has no override of its own. */
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

  const save = async (next: string): Promise<boolean> => {
    if (next === saved) return true;
    try {
      await update.mutateAsync({ creatorId, [access]: next });
      toast.success(savedMessage);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-5 text-[var(--slurp-muted)]">{detail}</p>
      <PromptCard
        title={label}
        value={effective}
        isDefault={!saved}
        disabled={disabled || update.isPending || generate.isPending}
        restoreLabel={clearLabel}
        onEdit={() => {
          setDraft(effective);
          setOpen(true);
        }}
        onRestore={() => void save("")}
      />
      {access !== "menu" && (
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
      )}
      <PromptEditor
        open={open}
        title={label}
        value={draft}
        onChange={(value) => setDraft(value.slice(0, SLURP_POST_GUIDANCE_MAX_LENGTH))}
        onClose={() => setOpen(false)}
        onSave={async () => {
          if (await save(draft.trim())) setOpen(false);
        }}
        onRestore={() => {
          void save("").then((didSave) => {
            if (didSave) {
              setDraft(inherited);
              setOpen(false);
            }
          });
        }}
        restoreLabel={clearLabel}
        pending={disabled || update.isPending || generate.isPending}
      />
    </div>
  );
}
