import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useGenerateSlurpPostGuidance,
  useUpdateSlurpPostGuidance,
  type SlurpPostAccess,
  type SlurpPostGuidance,
} from "../../hooks/use-slurp";
import { Field } from "./SlurpSettingsControls";
import { errorMessage } from "./SlurpBackstageWorkflow";

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
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateSlurpPostGuidance();
  const generate = useGenerateSlurpPostGuidance();
  // Switching Creator or tab must not carry the previous field's unsaved text across.
  useEffect(() => setDraft(null), [access, creatorId]);
  const value = draft ?? saved;

  const save = (next: string) => {
    if (next === saved) return;
    update.mutate(
      { creatorId, [access]: next },
      {
        onSuccess: () => toast.success(savedMessage),
        onError: (error) => {
          setDraft(null);
          toast.error(errorMessage(error));
        },
      },
    );
  };

  return (
    <Field label={label} detail={detail}>
      <textarea
        rows={4}
        value={value}
        maxLength={SLURP_POST_GUIDANCE_MAX_LENGTH}
        placeholder={inherited}
        disabled={disabled || update.isPending || generate.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = draft;
          setDraft(null);
          if (next !== null) save(next);
        }}
        className={`w-full rounded-lg bg-[var(--slurp-canvas)] p-3 text-base ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50 sm:text-sm ${focusRing}`}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || generate.isPending || update.isPending}
          onClick={() =>
            generate.mutate(
              { access, creatorId, currentDraft: value },
              {
                onSuccess: (result) => {
                  setDraft(result.guidance);
                  save(result.guidance);
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
        <button
          type="button"
          disabled={disabled || !saved || generate.isPending || update.isPending}
          onClick={() => {
            setDraft(null);
            save("");
          }}
          className={quietButton}
        >
          {clearLabel}
        </button>
      </div>
    </Field>
  );
}
