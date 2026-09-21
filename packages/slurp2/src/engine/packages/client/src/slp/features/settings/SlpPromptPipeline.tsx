import { ChevronDown, ChevronUp, GripVertical, LockKeyhole, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride, SlurpReusablePromptInstruction } from "../../base/state/slp-state-types";
import type { SlurpPromptDefinition } from "./slp-settings-contract";
import { blockDefinition, blockName, blockPurpose } from "./slp-prompt-studio-model";

export function SlpPromptPipeline({
  prompt,
  layout,
  instructions,
  selectedBlockId,
  liveText,
  onUpdate,
  onMove,
}: {
  prompt: SlurpPromptDefinition;
  layout: SlurpPromptBlockOverride[];
  instructions: SlurpReusablePromptInstruction[];
  selectedBlockId: string | null;
  /** Each block as the selected Creator would get it right now. Absent until the preview loads. */
  liveText?: Record<string, string>;
  onUpdate: (next: SlurpPromptBlockOverride[]) => void;
  onMove: (index: number, offset: -1 | 1) => void;
}) {
  return (
    <ol className="relative space-y-3 before:absolute before:inset-y-5 before:start-[1.45rem] before:w-px before:bg-[var(--slurp-outline)] before:content-['']">
      {layout.map((entry, index) => (
        <SlpPromptPipelineBlock
          key={entry.id}
          prompt={prompt}
          entry={entry}
          index={index}
          total={layout.length}
          instructions={instructions}
          selected={selectedBlockId === entry.id}
          liveText={liveText?.[entry.id]}
          onUpdate={(nextEntry) => {
            const next = layout.slice();
            next[index] = nextEntry;
            onUpdate(next);
          }}
          onMove={(offset) => onMove(index, offset)}
        />
      ))}
    </ol>
  );
}

/**
 * One block, fully visible. Editable text is edited in place and goes straight into the Backstage
 * draft, so there is no open, apply, or cancel step; the draft bar saves or discards it with the
 * rest. Runtime and required blocks show what the selected Creator actually gets.
 */
function SlpPromptPipelineBlock({
  prompt,
  entry,
  index,
  total,
  instructions,
  selected,
  liveText,
  onUpdate,
  onMove,
}: {
  prompt: SlurpPromptDefinition;
  entry: SlurpPromptBlockOverride;
  index: number;
  total: number;
  instructions: SlurpReusablePromptInstruction[];
  selected: boolean;
  liveText?: string;
  onUpdate: (entry: SlurpPromptBlockOverride) => void;
  onMove: (offset: -1 | 1) => void;
}) {
  const { t } = useTranslation();
  const block = blockDefinition(prompt, entry.id);
  const enabled = !block.optional || entry.enabled !== false;
  const editable = block.kind === "editable";
  const customized = entry.text !== undefined || entry.instructionId !== undefined || entry.enabled === false;
  const sharedInstruction = instructions.find((instruction) => instruction.id === entry.instructionId);
  const text = entry.text ?? block.defaultText;
  const shownText = liveText ?? sharedInstruction?.text ?? text;
  const fieldId = `slurp-prompt-block-text-${prompt.id}-${entry.id}`;

  const category =
    block.kind === "required"
      ? t("ui.slurp.settings.prompts.blockRequired", { defaultValue: "Required" })
      : block.kind === "context"
        ? t("ui.slurp.settings.prompts.blockContext", { defaultValue: "Runtime context" })
        : entry.instructionId
          ? t("ui.slurp.settings.prompts.blockShared", { defaultValue: "Shared guidance" })
          : t("ui.slurp.settings.prompts.blockEditable", { defaultValue: "Editable" });

  return (
    <li
      id={`slurp-prompt-block-${prompt.id}-${entry.id}`}
      className={`relative scroll-mt-24 overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] shadow-[0_14px_35px_-32px_rgba(0,0,0,0.9)] ring-1 ring-inset ${selected ? "ring-2 ring-[var(--noodle-accent)]" : "ring-[var(--slurp-outline)]"} ${enabled ? "" : "opacity-60"}`}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--slurp-canvas)] text-sm font-black tabular-nums ring-1 ring-inset ring-[var(--slurp-outline)]">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{blockName(block.id)}</span>
            <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-[var(--slurp-canvas)] px-2 text-[0.7rem] font-semibold text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
              {block.kind === "required" && <LockKeyhole size={11} aria-hidden="true" />}
              {category}
            </span>
            {customized && (
              <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--noodle-accent)_12%,transparent)] px-2 text-[0.7rem] font-bold text-[var(--noodle-accent)]">
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {t("ui.slurp.settings.prompts.custom", { defaultValue: "Custom" })}
              </span>
            )}
          </h4>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--slurp-muted)] text-pretty">
            {blockPurpose(block)}
          </p>
        </div>
        {block.optional && (
          <label className="flex min-h-10 shrink-0 items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => onUpdate({ ...entry, enabled: event.target.checked })}
              className="size-4 accent-[var(--noodle-accent)]"
            />
            {t("ui.slurp.settings.prompts.blockUse", { defaultValue: "Use" })}
          </label>
        )}
      </div>

      <div className="space-y-2 px-3 pb-3 sm:px-4 sm:pb-4">
        {editable && enabled && instructions.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.prompts.blockSource", { defaultValue: "Source" })}
            <select
              value={entry.instructionId ?? ""}
              onChange={(event) =>
                onUpdate({
                  ...entry,
                  instructionId: event.target.value || undefined,
                  text: event.target.value ? undefined : entry.text,
                })
              }
              className="min-h-9 min-w-0 flex-1 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-2 text-base font-normal text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:flex-none sm:text-sm"
            >
              <option value="">
                {t("ui.slurp.settings.prompts.localInstruction", { defaultValue: "Prompt-specific text" })}
              </option>
              {instructions.map((instruction) => (
                <option key={instruction.id} value={instruction.id}>
                  {instruction.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {editable && enabled && !entry.instructionId ? (
          <>
            <label htmlFor={fieldId} className="sr-only">
              {t("ui.slurp.settings.prompts.blockInstruction", { defaultValue: "Instruction" })}
            </label>
            <textarea
              id={fieldId}
              value={text}
              rows={Math.min(14, Math.max(3, Math.ceil(text.length / 70) + text.split("\n").length))}
              onChange={(event) =>
                onUpdate({
                  ...entry,
                  // Back to the shipped text means back to default, so a later update reaches it.
                  text: event.target.value === block.defaultText ? undefined : event.target.value,
                })
              }
              className="w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
            />
            <p className="text-end text-[0.7rem] tabular-nums text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.prompts.characterCount", {
                count: text.length,
                defaultValue: "{{count}} characters",
              })}
            </p>
          </>
        ) : (
          <div className="rounded-lg bg-[var(--slurp-canvas)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            {liveText !== undefined && enabled && (
              <p className="border-b border-[var(--slurp-outline)] px-3 py-1.5 text-[0.7rem] font-semibold text-[var(--noodle-accent)]">
                {t("ui.slurp.settings.prompts.liveForCreator", { defaultValue: "As the preview Creator gets it" })}
              </p>
            )}
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3 py-2.5 font-sans text-xs leading-5 text-[var(--slurp-muted)]">
              {enabled
                ? shownText ||
                  t("ui.slurp.settings.prompts.previewEmpty", {
                    defaultValue: "This block adds nothing until runtime context is available.",
                  })
                : t("ui.slurp.settings.prompts.blockDisabled", { defaultValue: "Disabled" })}
            </pre>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-[var(--slurp-outline)] px-3 py-2 text-[var(--slurp-muted)]">
        <GripVertical size={15} aria-hidden="true" />
        <span className="me-auto text-[0.7rem] font-medium">
          {t("ui.slurp.settings.prompts.blockOrder", { defaultValue: "Order" })}
        </span>
        {customized && editable && (
          <button
            type="button"
            aria-label={t("ui.slurp.settings.prompts.resetBlockAria", {
              block: blockName(block.id),
              defaultValue: "Reset {{block}}",
            })}
            onClick={() => onUpdate({ id: entry.id, enabled: entry.enabled })}
            className="inline-flex size-10 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          aria-label={t("ui.slurp.settings.prompts.moveUpAria", {
            block: blockName(block.id),
            defaultValue: "Move {{block}} up",
          })}
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="inline-flex size-10 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-30"
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t("ui.slurp.settings.prompts.moveDownAria", {
            block: blockName(block.id),
            defaultValue: "Move {{block}} down",
          })}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="inline-flex size-10 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-30"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
