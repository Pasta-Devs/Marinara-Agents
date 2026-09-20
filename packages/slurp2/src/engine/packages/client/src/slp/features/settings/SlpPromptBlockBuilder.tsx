import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, LockKeyhole, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride, SlurpReusablePromptInstruction } from "../../base/state/slp-state-types";
import type { SlurpPromptBlockDefinition, SlurpPromptDefinition, SlurpPromptMode } from "./slp-settings-contract";
import { useSlurpPromptBlockPreview, useSlurpPromptBlocks, useSlurpPromptResultPreview } from "./slp-settings-hooks";
import { useCreatorAccounts } from "../creators/slp-creators-contract";

type PromptBlockBuilderProps = {
  /** Which mode's inventory is being edited. The two modes declare different block ids. */
  mode: SlurpPromptMode;
  value: Record<string, SlurpPromptBlockOverride[]>;
  pending: boolean;
  onSave: (value: Record<string, SlurpPromptBlockOverride[]>) => Promise<boolean>;
  instructions: SlurpReusablePromptInstruction[];
  onSaveInstructions: (value: SlurpReusablePromptInstruction[]) => Promise<boolean>;
};

const promptName = (id: string) =>
  ({
    post: "Creator posts",
    dmReply: "Direct message replies",
    commentReply: "Comment replies",
    fanActivity: "Audience activity",
    stageProfile: "Creator profiles",
    ambientProfile: "Ambient profiles",
    arc: "Life arcs",
    pendingCommission: "Commission requests",
    pendingQuestion: "Post questions",
    pendingOpener: "First messages",
    pendingDelivery: "Commission delivery notes",
    postGuidance: "Post guidance writer",
    conversationSchedule: "Conversation schedules",
    invitedPost: "Invited post drafts",
    reactionBank: "Reusable audience comments",
    imageInterpretation: "Image prompt interpretation",
    imagePost: "Image prompt assembly",
    garnishAds: "Generated advertisements",
  })[id] ?? id;

const blockName = (id: string) =>
  id.replace(/([a-z])([A-Z])/gu, "$1 $2").replace(/^./u, (letter) => letter.toUpperCase());

const promptGroupOrder = ["writing", "messages", "audience", "profiles", "images", "world"] as const;

const promptGroupName = (group: SlurpPromptDefinition["group"]) =>
  ({
    writing: "Content and writing",
    messages: "Messages",
    audience: "Audience",
    profiles: "Creator profiles",
    images: "Images",
    world: "World and stories",
  })[group];

const promptPurpose = (id: string) =>
  ({
    post: "Plans and writes a Creator post.",
    dmReply: "Writes a reply in a direct message.",
    commentReply: "Writes a reply to a post comment.",
    fanActivity: "Creates background audience activity.",
    stageProfile: "Creates a Creator profile draft.",
    ambientProfile: "Creates background audience profiles.",
    arc: "Creates a continuing Creator story arc.",
    imageInterpretation: "Turns an image draft into a provider-ready prompt.",
    imagePost: "Assembles the image prompt for a post.",
  })[id] ?? "Controls one part of Slurp's content system.";

function completeLayout(prompt: SlurpPromptDefinition, value: SlurpPromptBlockOverride[] | undefined) {
  const known = new Set(prompt.blocks.map((block) => block.id));
  const configured = (value ?? []).filter((block) => known.has(block.id));
  const present = new Set(configured.map((block) => block.id));
  return [...configured, ...prompt.blocks.filter((block) => !present.has(block.id)).map((block) => ({ id: block.id }))];
}

function blockDefinition(prompt: SlurpPromptDefinition, id: string): SlurpPromptBlockDefinition {
  return prompt.blocks.find((block) => block.id === id)!;
}

export function SlurpPromptBlockBuilder({
  mode,
  value,
  pending,
  onSave,
  instructions,
  onSaveInstructions,
}: PromptBlockBuilderProps) {
  const { t } = useTranslation();
  const definitions = useSlurpPromptBlocks(mode);
  const creators = useCreatorAccounts();
  const preview = useSlurpPromptBlockPreview();
  const resultPreview = useSlurpPromptResultPreview();
  const [previewCreatorId, setPreviewCreatorId] = useState("");
  const [previewing, setPreviewing] = useState<{ promptId: string; blockId: string } | null>(null);
  const creatorOptions = creators.data ?? [];
  const activeCreatorId = previewCreatorId || creatorOptions[0]?.id || "";
  const [draft, setDraft] = useState(value);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ promptId: string; blockId: string } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [instructionDraft, setInstructionDraft] = useState(instructions);
  const [editingInstructionId, setEditingInstructionId] = useState<string | null>(null);
  const [newInstructionName, setNewInstructionName] = useState("");

  // Reset the editor view when the mode changes. Settings updates must not collapse the prompt that
  // is open, because saving an instruction or block gives the parent a new settings object.
  useEffect(() => {
    setDraft(value);
    setSelectedPromptId(null);
    setEditing(null);
    setPreviewing(null);
    setInstructionDraft(instructions);
    preview.reset();
    resultPreview.reset();
    // The mutation handles are stable; listing them would reset the panel on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    setInstructionDraft(instructions);
  }, [instructions]);

  useEffect(() => {
    setPreviewing(null);
    preview.reset();
    resultPreview.reset();
    // Preview output describes one exact draft. Any edit makes that output stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, instructionDraft]);

  const prompts = definitions.data?.prompts ?? [];
  const promptLabel = (id: string) => t(`ui.slurp.settings.prompts.prompt.${id}`, { defaultValue: promptName(id) });
  const blockLabel = (id: string) => t(`ui.slurp.settings.prompts.block.${id}`, { defaultValue: blockName(id) });
  const updateLayout = (prompt: SlurpPromptDefinition, next: SlurpPromptBlockOverride[]) =>
    setDraft((current) => ({ ...current, [prompt.id]: next }));
  const move = (prompt: SlurpPromptDefinition, index: number, offset: -1 | 1) => {
    const layout = completeLayout(prompt, draft[prompt.id]);
    const target = index + offset;
    if (target < 0 || target >= layout.length) return;
    [layout[index], layout[target]] = [layout[target]!, layout[index]!];
    updateLayout(prompt, layout);
  };
  const save = async () => {
    await onSave(draft);
  };
  // Required blocks could be reordered but never read, so the text protecting privacy and output
  // shape was the one text a player could not see. Rendered from the real builder for a real
  // Creator, so what the panel shows is what the model is actually sent.
  const showPreview = (promptId: string, blockId: string) => {
    setPreviewing({ promptId, blockId });
    if (activeCreatorId)
      preview.mutate({
        promptId,
        mode,
        creatorAccountId: activeCreatorId,
        promptBlocks: draft,
        promptInstructions: instructionDraft,
      });
  };
  const generateResultPreview = () => {
    if (!activeCreatorId) return;
    resultPreview.mutate({
      promptId: "post",
      mode,
      creatorAccountId: activeCreatorId,
      promptBlocks: draft,
      promptInstructions: instructionDraft,
    });
  };
  const selectPrompt = (promptId: string, open: boolean) => {
    setSelectedPromptId(open ? null : promptId);
  };
  const previewText = previewing
    ? (preview.data?.blocks.find((block) => block.id === previewing.blockId)?.text ?? "")
    : "";

  if (definitions.isLoading)
    return (
      <p className="text-sm text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.prompts.blocksLoading", { defaultValue: "Loading prompt blocks..." })}
      </p>
    );
  if (definitions.isError)
    return (
      <p role="alert" className="text-sm text-[var(--destructive)]">
        {t("ui.slurp.settings.prompts.blocksLoadError", { defaultValue: "Could not load prompt blocks." })}
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 sm:flex-row sm:items-end sm:justify-between sm:p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {t("ui.slurp.settings.prompts.builderQuickTitle", { defaultValue: "Quick setup" })}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.prompts.builderQuickDetail", {
              defaultValue: "Choose a prompt, inspect its result, and open advanced editing only when you need it.",
            })}
          </p>
        </div>
        {creatorOptions.length > 0 && (
          <label className="block text-xs font-semibold sm:w-56">
            {t("ui.slurp.settings.prompts.previewCreator", { defaultValue: "Preview as" })}
            <select
              value={activeCreatorId}
              onChange={(event) => {
                setPreviewCreatorId(event.target.value);
                setPreviewing(null);
                preview.reset();
                resultPreview.reset();
              }}
              className="mt-1 min-h-10 w-full rounded-lg border border-[var(--slurp-outline)] bg-transparent px-3 text-sm font-normal"
            >
              {creatorOptions.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {instructionDraft.length > 0 && (
        <section className="space-y-3 rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 sm:p-4">
          <div>
            <p className="text-sm font-semibold">
              {t("ui.slurp.settings.prompts.reusableTitle", { defaultValue: "Reusable instructions" })}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.prompts.reusableDetail", {
                defaultValue: "Edit shared guidance once, then select it inside any editable prompt block.",
              })}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {instructionDraft.map((instruction) => (
              <div key={instruction.id} className="rounded-lg border border-[var(--slurp-outline)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold">{instruction.name}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingInstructionId(editingInstructionId === instruction.id ? null : instruction.id)
                      }
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--slurp-outline)] px-2.5 text-xs font-semibold"
                    >
                      <Pencil size={13} aria-hidden="true" />
                      {t("ui.slurp.settings.prompts.edit", { defaultValue: "Edit" })}
                    </button>
                    {!instruction.builtin && (
                      <button
                        type="button"
                        onClick={() =>
                          void onSaveInstructions(instructionDraft.filter((entry) => entry.id !== instruction.id))
                        }
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--slurp-outline)] text-[var(--destructive)]"
                        aria-label={t("ui.slurp.settings.prompts.deleteInstructionAria", {
                          name: instruction.name,
                          defaultValue: "Delete {{name}}",
                        })}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                {editingInstructionId === instruction.id ? (
                  <>
                    <textarea
                      value={instruction.text}
                      onChange={(event) =>
                        setInstructionDraft((current) =>
                          current.map((entry) =>
                            entry.id === instruction.id ? { ...entry, text: event.target.value } : entry,
                          ),
                        )
                      }
                      className="mt-3 min-h-28 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-transparent p-3 text-sm leading-5"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setInstructionDraft(instructions)}
                        className="min-h-9 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold"
                      >
                        {t("ui.slurp.actions.cancel")}
                      </button>
                      <button
                        type="button"
                        disabled={pending || !instruction.text.trim()}
                        onClick={() => void onSaveInstructions(instructionDraft)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-45"
                      >
                        <Save size={13} aria-hidden="true" /> {t("ui.slurp.settings.prompts.save")}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
                    {instruction.text}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-[var(--slurp-outline)] pt-3 sm:flex-row">
            <input
              value={newInstructionName}
              onChange={(event) => setNewInstructionName(event.target.value)}
              placeholder={t("ui.slurp.settings.prompts.newInstructionPlaceholder", {
                defaultValue: "New instruction name",
              })}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--slurp-outline)] bg-transparent px-3 text-sm"
            />
            <button
              type="button"
              disabled={pending || !newInstructionName.trim()}
              onClick={() => {
                const id = `custom-${Date.now()}`;
                void onSaveInstructions([
                  ...instructionDraft,
                  { id, name: newInstructionName.trim(), text: "Add your instruction here.", builtin: false },
                ]).then((saved) => {
                  if (saved) {
                    setNewInstructionName("");
                    setEditingInstructionId(id);
                  }
                });
              }}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold disabled:opacity-45"
            >
              <Plus size={14} aria-hidden="true" />
              {t("ui.slurp.settings.prompts.addInstruction", { defaultValue: "Add instruction" })}
            </button>
          </div>
        </section>
      )}
      <div className="space-y-6">
        {promptGroupOrder.map((group) => {
          const groupPrompts = prompts.filter((prompt) => prompt.group === group);
          if (groupPrompts.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`slurp-prompt-group-${group}`} className="space-y-3">
              <div>
                <h3 id={`slurp-prompt-group-${group}`} className="text-sm font-bold">
                  {promptGroupName(group)}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                  {group === "writing"
                    ? "Shape what Creators make and how their posts read."
                    : group === "messages"
                      ? "Shape private conversations and paid interactions."
                      : group === "audience"
                        ? "Shape the activity around Creator content."
                        : group === "profiles"
                          ? "Shape how Creator and audience identities are formed."
                          : group === "images"
                            ? "Shape image interpretation and image creation."
                            : "Shape ongoing stories and scheduled context."}
                </p>
              </div>
              <div className="space-y-3">
                {groupPrompts.map((prompt) => {
                  const layout = completeLayout(prompt, draft[prompt.id]);
                  const changed = Boolean(value[prompt.id]?.length);
                  const selected = selectedPromptId === prompt.id;
                  return (
                    <section
                      key={prompt.id}
                      className={`rounded-xl border bg-[var(--slurp-canvas)] ${selected ? "border-[var(--noodle-accent)] ring-1 ring-[var(--noodle-accent)]/35" : "border-[var(--slurp-outline)]"}`}
                    >
                      <button
                        type="button"
                        aria-expanded={selected}
                        onClick={() => selectPrompt(prompt.id, selected)}
                        className="flex min-h-12 w-full items-start gap-3 rounded-xl px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{promptLabel(prompt.id)}</span>
                          <span className="block text-xs text-[var(--slurp-muted)]">
                            {t("ui.slurp.settings.prompts.blocksSummary", {
                              count: layout.length,
                              state: changed
                                ? t("ui.slurp.settings.prompts.blocksSummaryChanged", { defaultValue: "changed" })
                                : t("ui.slurp.settings.prompts.blocksSummaryDefault", { defaultValue: "default" }),
                              defaultValue: "{{count}} blocks · {{state}}",
                            })}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)]">
                            {promptPurpose(prompt.id)}
                          </span>
                        </span>
                        <ChevronDown size={17} aria-hidden="true" className={selected ? "rotate-180" : ""} />
                      </button>
                      {selected && (
                        <div className="space-y-4 border-t border-[var(--slurp-outline)] p-3 sm:p-4 lg:col-span-2">
                          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
                            <div className="min-w-0">
                              <p className="text-xs font-bold">
                                {t("ui.slurp.settings.prompts.recipeControls", { defaultValue: "Recipe controls" })}
                              </p>
                              <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
                                {t("ui.slurp.settings.prompts.recipeControlsDetail", {
                                  defaultValue:
                                    "Inspecting the prompt is free. Generate result makes one model request with the selected Creator.",
                                })}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!activeCreatorId || preview.isPending}
                                onClick={() => showPreview(prompt.id, layout[0]?.id ?? "")}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-45"
                              >
                                <Eye size={14} aria-hidden="true" />
                                {preview.isPending
                                  ? t("ui.slurp.settings.prompts.previewRendering", {
                                      defaultValue: "Rendering preview...",
                                    })
                                  : t("ui.slurp.settings.prompts.previewRecipe", {
                                      defaultValue: "Inspect prompt",
                                    })}
                              </button>
                              {prompt.id === "post" && (
                                <button
                                  type="button"
                                  disabled={!activeCreatorId || resultPreview.isPending}
                                  onClick={generateResultPreview}
                                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-45"
                                >
                                  <Plus size={14} aria-hidden="true" />
                                  {resultPreview.isPending
                                    ? t("ui.slurp.settings.prompts.generatingResult", {
                                        defaultValue: "Generating...",
                                      })
                                    : t("ui.slurp.settings.prompts.generateResult", {
                                        defaultValue: "Generate result",
                                      })}
                                </button>
                              )}
                            </div>
                          </div>
                          {prompt.id === "post" && resultPreview.isError && (
                            <p role="alert" className="text-sm text-[var(--destructive)]">
                              {resultPreview.error instanceof Error
                                ? resultPreview.error.message
                                : t("ui.slurp.settings.prompts.resultError", {
                                    defaultValue: "Could not generate a preview result.",
                                  })}
                            </p>
                          )}
                          {prompt.id === "post" && resultPreview.data && (
                            <section
                              aria-labelledby="slurp-prompt-result-title"
                              className="space-y-3 rounded-lg bg-[var(--slurp-canvas)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)]"
                            >
                              <div>
                                <p className="text-xs font-semibold text-[var(--slurp-muted)]">
                                  {t("ui.slurp.settings.prompts.generatedResult", {
                                    defaultValue: "Generated result",
                                  })}
                                </p>
                                <h4 id="slurp-prompt-result-title" className="mt-1 text-base font-bold">
                                  {resultPreview.data.title ||
                                    t("ui.slurp.settings.prompts.untitledResult", { defaultValue: "Untitled post" })}
                                </h4>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6">{resultPreview.data.content}</p>
                              {resultPreview.data.imagePrompt && (
                                <div className="rounded-lg bg-[var(--slurp-surface-raised)] p-3">
                                  <p className="text-xs font-bold">
                                    {t("ui.slurp.settings.prompts.imagePromptResult", {
                                      defaultValue: "Image prompt",
                                    })}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
                                    {resultPreview.data.imagePrompt}
                                  </p>
                                </div>
                              )}
                              <details className="rounded-lg border border-[var(--slurp-outline)]">
                                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
                                  {t("ui.slurp.settings.prompts.promptUsed", { defaultValue: "Prompt used" })}
                                </summary>
                                <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-[var(--slurp-outline)] p-3 text-xs leading-5 text-[var(--slurp-muted)]">
                                  {resultPreview.data.compiledPrompt}
                                </pre>
                              </details>
                            </section>
                          )}
                          <div className="space-y-3">
                            <ol className="space-y-2">
                              {layout.map((entry, index) => {
                                const block = blockDefinition(prompt, entry.id);
                                const editable = block.kind === "editable";
                                const enabled = !block.optional || entry.enabled !== false;
                                const renderedText =
                                  previewing?.promptId === prompt.id
                                    ? preview.data?.blocks.find((previewBlock) => previewBlock.id === block.id)?.text
                                    : undefined;
                                const blockText =
                                  renderedText !== undefined
                                    ? renderedText
                                    : (entry.instructionId
                                        ? instructions.find((instruction) => instruction.id === entry.instructionId)
                                            ?.text
                                        : entry.text) || block.defaultText;
                                return (
                                  <li
                                    key={block.id}
                                    className={`overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ${enabled ? "ring-[var(--slurp-outline)]" : "opacity-60 ring-[var(--slurp-outline)]"}`}
                                  >
                                    <div className="flex items-start gap-3 border-b border-[var(--slurp-outline)] px-3 py-3">
                                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--slurp-canvas)] text-xs font-bold tabular-nums text-[var(--slurp-muted)]">
                                        {index + 1}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                          <span className="text-sm font-semibold">{blockLabel(block.id)}</span>
                                          <span className="flex items-center gap-1 text-[0.68rem] font-medium text-[var(--slurp-muted)]">
                                            {block.kind === "required" && <LockKeyhole size={11} aria-hidden="true" />}
                                            {block.kind === "required"
                                              ? t("ui.slurp.settings.prompts.blockRequired", {
                                                  defaultValue: "Required",
                                                })
                                              : block.kind === "context"
                                                ? t("ui.slurp.settings.prompts.blockContext", {
                                                    defaultValue: "Runtime context",
                                                  })
                                                : t("ui.slurp.settings.prompts.blockEditable", {
                                                    defaultValue: "Editable",
                                                  })}
                                          </span>
                                        </div>
                                        {entry.instructionId && (
                                          <span className="mt-1 block text-[0.68rem] text-[var(--noodle-accent)]">
                                            {
                                              instructions.find((instruction) => instruction.id === entry.instructionId)
                                                ?.name
                                            }
                                          </span>
                                        )}
                                      </div>
                                      {block.optional && (
                                        <label className="flex min-h-9 shrink-0 items-center gap-2 text-xs font-medium">
                                          <input
                                            type="checkbox"
                                            checked={enabled}
                                            onChange={(event) => {
                                              const next = layout.slice();
                                              next[index] = { ...entry, enabled: event.target.checked };
                                              updateLayout(prompt, next);
                                            }}
                                          />
                                          {t("ui.slurp.settings.prompts.blockUse", { defaultValue: "Use" })}
                                        </label>
                                      )}
                                    </div>
                                    <div className="px-3 py-3">
                                      {editing && editing.promptId === prompt.id && editing.blockId === block.id ? (
                                        <div className="space-y-2">
                                          <textarea
                                            aria-label={blockLabel(block.id)}
                                            value={textDraft}
                                            onChange={(event) => setTextDraft(event.target.value)}
                                            className="min-h-32 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-sm leading-5"
                                          />
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setEditing(null)}
                                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold"
                                            >
                                              <X size={13} aria-hidden="true" /> {t("ui.slurp.actions.cancel")}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={!textDraft.trim()}
                                              onClick={() => {
                                                const next = layout.slice();
                                                next[index] = { ...entry, text: textDraft.trim() };
                                                updateLayout(prompt, next);
                                                setEditing(null);
                                              }}
                                              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-bold text-zinc-950 disabled:opacity-45"
                                            >
                                              <Save size={13} aria-hidden="true" />{" "}
                                              {t("ui.slurp.settings.prompts.apply", { defaultValue: "Apply" })}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--slurp-text)]">
                                          {enabled
                                            ? preview.isPending && previewing?.promptId === prompt.id
                                              ? t("ui.slurp.settings.prompts.previewRendering", {
                                                  defaultValue: "Rendering preview...",
                                                })
                                              : blockText ||
                                                t("ui.slurp.settings.prompts.previewEmpty", {
                                                  defaultValue: "This block adds nothing for this Creator right now.",
                                                })
                                            : t("ui.slurp.settings.prompts.blockDisabled", {
                                                defaultValue: "Disabled",
                                              })}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--slurp-outline)] px-3 py-2">
                                      <button
                                        type="button"
                                        aria-label={t("ui.slurp.settings.prompts.previewBlockAria", {
                                          block: blockLabel(block.id),
                                          defaultValue: "Refresh preview of {{block}}",
                                        })}
                                        onClick={() => showPreview(prompt.id, block.id)}
                                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--slurp-outline)] px-2.5 text-xs font-semibold text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                                      >
                                        <Eye size={14} aria-hidden="true" />
                                        {t("ui.slurp.settings.prompts.refreshPreview", {
                                          defaultValue: "Refresh preview",
                                        })}
                                      </button>
                                      {editable &&
                                        !(editing?.promptId === prompt.id && editing.blockId === block.id) && (
                                          <div className="flex flex-wrap gap-2">
                                            {instructions.length > 0 && (
                                              <select
                                                aria-label={t("ui.slurp.settings.prompts.useInstructionAria", {
                                                  block: blockLabel(block.id),
                                                  defaultValue: "Use shared instruction for {{block}}",
                                                })}
                                                value={entry.instructionId ?? ""}
                                                onChange={(event) => {
                                                  const next = layout.slice();
                                                  next[index] = {
                                                    ...entry,
                                                    instructionId: event.target.value || undefined,
                                                    text: undefined,
                                                  };
                                                  updateLayout(prompt, next);
                                                }}
                                                className="min-h-9 max-w-full rounded-md border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-2 text-xs"
                                              >
                                                <option value="">
                                                  {t("ui.slurp.settings.prompts.localInstruction", {
                                                    defaultValue: "Prompt-specific text",
                                                  })}
                                                </option>
                                                {instructions.map((instruction) => (
                                                  <option key={instruction.id} value={instruction.id}>
                                                    {instruction.name}
                                                  </option>
                                                ))}
                                              </select>
                                            )}
                                            <button
                                              type="button"
                                              aria-label={t("ui.slurp.settings.prompts.editBlockAria", {
                                                block: blockLabel(block.id),
                                                defaultValue: "Edit {{block}}",
                                              })}
                                              onClick={() => {
                                                setEditing({ promptId: prompt.id, blockId: block.id });
                                                setTextDraft(entry.text ?? block.defaultText);
                                              }}
                                              className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                                            >
                                              <Pencil size={14} aria-hidden="true" />
                                            </button>
                                          </div>
                                        )}
                                      <span className="flex-1" />
                                      <button
                                        type="button"
                                        aria-label={t("ui.slurp.settings.prompts.moveUpAria", {
                                          block: blockLabel(block.id),
                                          defaultValue: "Move {{block}} up",
                                        })}
                                        disabled={index === 0}
                                        onClick={() => move(prompt, index, -1)}
                                        className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--slurp-outline)] disabled:opacity-35"
                                      >
                                        <ChevronUp size={15} aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={t("ui.slurp.settings.prompts.moveDownAria", {
                                          block: blockLabel(block.id),
                                          defaultValue: "Move {{block}} down",
                                        })}
                                        disabled={index === layout.length - 1}
                                        onClick={() => move(prompt, index, 1)}
                                        className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--slurp-outline)] disabled:opacity-35"
                                      >
                                        <ChevronDown size={15} aria-hidden="true" />
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={!draft[prompt.id] || pending}
                              onClick={() =>
                                setDraft((current) => {
                                  const next = { ...current };
                                  delete next[prompt.id];
                                  return next;
                                })
                              }
                              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--slurp-outline)] px-3 text-xs font-semibold disabled:opacity-40"
                            >
                              <RotateCcw size={14} aria-hidden="true" />{" "}
                              {t("ui.slurp.settings.prompts.blockReset", { defaultValue: "Reset" })}
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => void save()}
                              className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-45"
                            >
                              {pending ? "Saving..." : t("ui.slurp.settings.prompts.save")}
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {previewing && (
        <div className="rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold">
              {t("ui.slurp.settings.prompts.renderedBlock", { defaultValue: "Rendered block" })}
            </p>
            <button
              type="button"
              onClick={() => setPreviewing(null)}
              className="text-xs font-semibold text-[var(--slurp-muted)]"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
          </div>
          {preview.isPending ? (
            <p className="text-xs text-[var(--slurp-muted)]">
              {t("ui.slurp.settings.prompts.previewLoading", { defaultValue: "Rendering..." })}
            </p>
          ) : (
            <>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
                {previewText ||
                  t("ui.slurp.settings.prompts.previewEmpty", {
                    defaultValue: "This block adds nothing for this Creator right now.",
                  })}
              </pre>
              {preview.data?.compiledText && (
                <details className="mt-3 rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-surface-raised)]">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
                    {t("ui.slurp.settings.prompts.compiledPrompt", { defaultValue: "Compiled prompt" })}
                  </summary>
                  <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-[var(--slurp-outline)] p-3 text-xs leading-5 text-[var(--slurp-muted)]">
                    {preview.data.compiledText}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
