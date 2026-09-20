import { ChevronDown, ChevronUp, GripVertical, LockKeyhole, RotateCcw, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride, SlurpReusablePromptInstruction } from "../../base/state/slp-state-types";
import type { SlurpPromptDefinition } from "./slp-settings-contract";
import { blockDefinition, blockName, blockPurpose } from "./slp-prompt-studio-model";

export function SlpPromptPipeline({
  prompt,
  layout,
  instructions,
  selectedBlockId,
  onSelectBlock,
  onUpdate,
  onMove,
  focusSelectedOnSmallScreens = false,
}: {
  prompt: SlurpPromptDefinition;
  layout: SlurpPromptBlockOverride[];
  instructions: SlurpReusablePromptInstruction[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onUpdate: (next: SlurpPromptBlockOverride[]) => void;
  onMove: (index: number, offset: -1 | 1) => void;
  focusSelectedOnSmallScreens?: boolean;
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
          hiddenOnSmallScreens={Boolean(focusSelectedOnSmallScreens && selectedBlockId && selectedBlockId !== entry.id)}
          onSelect={() => onSelectBlock(selectedBlockId === entry.id ? null : entry.id)}
          onCancel={() => onSelectBlock(null)}
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

function SlpPromptPipelineBlock({
  prompt,
  entry,
  index,
  total,
  instructions,
  selected,
  onSelect,
  onCancel,
  onUpdate,
  onMove,
  hiddenOnSmallScreens,
}: {
  prompt: SlurpPromptDefinition;
  entry: SlurpPromptBlockOverride;
  index: number;
  total: number;
  instructions: SlurpReusablePromptInstruction[];
  selected: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onUpdate: (entry: SlurpPromptBlockOverride) => void;
  onMove: (offset: -1 | 1) => void;
  hiddenOnSmallScreens: boolean;
}) {
  const { t } = useTranslation();
  const block = blockDefinition(prompt, entry.id);
  const enabled = !block.optional || entry.enabled !== false;
  const editable = block.kind === "editable";
  const customized = entry.text !== undefined || entry.instructionId !== undefined || entry.enabled === false;
  const sharedInstruction = instructions.find((instruction) => instruction.id === entry.instructionId);
  const resolvedText = sharedInstruction?.text ?? entry.text ?? block.defaultText;
  const [text, setText] = useState(entry.text ?? block.defaultText);
  const [instructionId, setInstructionId] = useState(entry.instructionId ?? "");

  useEffect(() => {
    setText(entry.text ?? block.defaultText);
    setInstructionId(entry.instructionId ?? "");
  }, [block.defaultText, entry.instructionId, entry.text, selected]);

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
      className={`${hiddenOnSmallScreens ? "hidden lg:block" : "block"} relative overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] shadow-[0_14px_35px_-32px_rgba(0,0,0,0.9)] ring-1 ring-inset ${selected ? "ring-2 ring-[var(--noodle-accent)]" : "ring-[var(--slurp-outline)]"} ${enabled ? "" : "opacity-60"}`}
    >
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--slurp-canvas)] text-sm font-black tabular-nums ring-1 ring-inset ring-[var(--slurp-outline)]">
          {index + 1}
        </span>
        <button
          type="button"
          aria-expanded={selected}
          onClick={onSelect}
          className="min-w-0 flex-1 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--slurp-surface-raised)]"
        >
          <span className="flex flex-wrap items-center gap-2">
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
          </span>
          <span className="mt-1 block max-w-2xl text-xs leading-5 text-[var(--slurp-muted)] text-pretty">
            {blockPurpose(block)}
          </span>
        </button>
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

      {!selected && (
        <div className="mx-3 mb-3 rounded-lg bg-[var(--slurp-canvas)] px-3 py-2.5 ring-1 ring-inset ring-[var(--slurp-outline)] sm:mx-4 sm:mb-4">
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-[var(--slurp-muted)]">
            {enabled
              ? resolvedText ||
                t("ui.slurp.settings.prompts.previewEmpty", {
                  defaultValue: "This block adds nothing until runtime context is available.",
                })
              : t("ui.slurp.settings.prompts.blockDisabled", { defaultValue: "Disabled" })}
          </p>
        </div>
      )}

      {selected && (
        <div className="space-y-4 border-t border-[var(--slurp-outline)] bg-[var(--slurp-canvas)]/45 p-3 sm:p-4">
          {editable ? (
            <>
              <label className="block text-xs font-bold">
                {t("ui.slurp.settings.prompts.blockSource", { defaultValue: "Source" })}
                <select
                  value={instructionId}
                  onChange={(event) => setInstructionId(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
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
              {instructionId ? (
                <div className="rounded-lg bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
                  <p className="text-xs font-bold">
                    {instructions.find((instruction) => instruction.id === instructionId)?.name}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--slurp-muted)]">
                    {instructions.find((instruction) => instruction.id === instructionId)?.text}
                  </p>
                </div>
              ) : (
                <label className="block text-xs font-bold">
                  {t("ui.slurp.settings.prompts.blockInstruction", { defaultValue: "Instruction" })}
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className="mt-1 min-h-36 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
                  />
                  <span className="mt-1 block text-end text-[0.7rem] font-normal tabular-nums text-[var(--slurp-muted)]">
                    {t("ui.slurp.settings.prompts.characterCount", {
                      count: text.length,
                      defaultValue: "{{count}} characters",
                    })}
                  </span>
                </label>
              )}
              <div>
                <p className="text-xs font-bold">
                  {t("ui.slurp.settings.prompts.blockReceives", { defaultValue: "What this block receives" })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    t("ui.slurp.settings.prompts.inputCreator", { defaultValue: "Creator" }),
                    t("ui.slurp.settings.prompts.inputRecipe", { defaultValue: "Recipe context" }),
                    t("ui.slurp.settings.prompts.inputDirection", { defaultValue: "Runtime direction" }),
                  ].map((input) => (
                    <span
                      key={input}
                      className="rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 text-xs text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]"
                    >
                      {input}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                >
                  <X size={15} aria-hidden="true" /> {t("ui.slurp.actions.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!instructionId && !text.trim()}
                  onClick={() => {
                    onUpdate({
                      ...entry,
                      instructionId: instructionId || undefined,
                      text: instructionId ? undefined : text.trim(),
                    });
                    onCancel();
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Save size={15} aria-hidden="true" />
                  {t("ui.slurp.settings.prompts.applyDraft", { defaultValue: "Apply to draft" })}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="max-w-2xl text-sm leading-6 text-[var(--slurp-muted)] text-pretty">
                {block.kind === "context"
                  ? t("ui.slurp.settings.prompts.runtimeBlockDetail", {
                      defaultValue: "Slurp resolves this block from the selected Creator when the recipe runs.",
                    })
                  : t("ui.slurp.settings.prompts.requiredBlockDetail", {
                      defaultValue:
                        "This block protects privacy or output integrity. You can inspect it, but not edit it.",
                    })}
              </p>
              {block.defaultText && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--slurp-surface-raised)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
                  {block.defaultText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

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
