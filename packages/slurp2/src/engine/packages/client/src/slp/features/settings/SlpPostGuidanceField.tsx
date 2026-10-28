import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useGenerateSlurpPostGuidance, useUpdateSlurpPostGuidance } from "./slp-post-guidance-contract";
import type { SlurpPostAccess, SlurpPostGuidance } from "./slp-post-guidance-contract";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { PromptCard, PromptEditor } from "../../modules/settings/SlpBackstageKit";

import { SlpTextAssist } from "../assist/slp-assist-contract";

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
  clearLabel,
  savedMessage,
  disabled = false,
  draftValue,
  onStage,
}: {
  /** `menu` is a Creator's private content menu: same card, no model draft. */
  access: SlurpPostAccess | "menu";
  creatorId?: string | null;
  guidance: SlurpPostGuidance | undefined;
  /** The text that applies while this field has no override of its own. */
  inherited: string;
  label: string;
  detail: string;
  clearLabel: string;
  savedMessage: string;
  disabled?: boolean;
  /** When supplied, edits join the Backstage draft instead of saving this separate document now. */
  draftValue?: string;
  onStage?: (value: string) => void;
}) {
  const { t } = useTranslation();
  const persisted = (creatorId ? guidance?.creators[creatorId] : guidance?.defaults)?.[access] ?? "";
  const saved = draftValue ?? persisted;
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
    if (onStage) {
      onStage(next);
      return true;
    }
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
        // The shared assist with this field's own writer; the answer opens in the editor for review.
        <div className="flex flex-wrap items-center">
          <SlpTextAssist
            value={draft || effective}
            disabled={disabled || update.isPending}
            run={async ({ note }) =>
              (
                await generate.mutateAsync({
                  access,
                  creatorId,
                  currentDraft: draft || effective,
                  ...(note ? { guidance: note } : {}),
                })
              ).guidance
            }
            onApply={(text) => {
              setDraft(text);
              setOpen(true);
            }}
          />
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
        saveLabel={t("ui.slurp.settings.prompts.applyDraft", { defaultValue: "Apply to draft" })}
      />
    </div>
  );
}
