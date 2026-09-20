import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Eye, GripVertical, LockKeyhole, Pencil, RotateCcw, Save, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride } from "../../base/state/slp-state-types";
import type { SlurpPromptBlockDefinition, SlurpPromptDefinition, SlurpPromptMode } from "./slp-settings-contract";
import { useSlurpPromptBlockPreview, useSlurpPromptBlocks } from "./slp-settings-hooks";
import { useCreatorAccounts } from "../creators/slp-creators-contract";

type PromptBlockBuilderProps = {
  /** Which mode's inventory is being edited. The two modes declare different block ids. */
  mode: SlurpPromptMode;
  value: Record<string, SlurpPromptBlockOverride[]>;
  pending: boolean;
  onSave: (value: Record<string, SlurpPromptBlockOverride[]>) => Promise<boolean>;
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

function completeLayout(prompt: SlurpPromptDefinition, value: SlurpPromptBlockOverride[] | undefined) {
  const known = new Set(prompt.blocks.map((block) => block.id));
  const configured = (value ?? []).filter((block) => known.has(block.id));
  const present = new Set(configured.map((block) => block.id));
  return [...configured, ...prompt.blocks.filter((block) => !present.has(block.id)).map((block) => ({ id: block.id }))];
}

function blockDefinition(prompt: SlurpPromptDefinition, id: string): SlurpPromptBlockDefinition {
  return prompt.blocks.find((block) => block.id === id)!;
}

export function SlurpPromptBlockBuilder({ mode, value, pending, onSave }: PromptBlockBuilderProps) {
  const { t } = useTranslation();
  const definitions = useSlurpPromptBlocks(mode);
  const creators = useCreatorAccounts();
  const preview = useSlurpPromptBlockPreview();
  const [previewCreatorId, setPreviewCreatorId] = useState("");
  const [previewing, setPreviewing] = useState<{ promptId: string; blockId: string } | null>(null);
  const creatorOptions = creators.data ?? [];
  const activeCreatorId = previewCreatorId || creatorOptions[0]?.id || "";
  const [draft, setDraft] = useState(value);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ promptId: string; blockId: string } | null>(null);
  const [textDraft, setTextDraft] = useState("");

  // Reset when the mode changes as well as when the value does. Without the mode in the
  // dependency list a half-finished classic layout stayed in the draft after switching to produce
  // and was saved against produce's block ids.
  useEffect(() => {
    setDraft(value);
    setSelectedPromptId(null);
    setEditing(null);
    setPreviewing(null);
    preview.reset();
    // `preview` is a stable mutation handle; listing it would reset the panel on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

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
    if (activeCreatorId) preview.mutate({ promptId, mode, creatorAccountId: activeCreatorId });
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
              onChange={(event) => setPreviewCreatorId(event.target.value)}
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
      <div className="grid gap-3 lg:grid-cols-2">
        {prompts.map((prompt) => {
          const layout = completeLayout(prompt, draft[prompt.id]);
          const changed = Boolean(value[prompt.id]?.length);
          const selected = selectedPromptId === prompt.id;
          const blockPreview = layout
            .map((entry) => {
              const block = blockDefinition(prompt, entry.id);
              if (block.optional && entry.enabled === false) return "";
              return entry.text?.trim() || block.defaultText.trim();
            })
            .filter(Boolean)
            .join("\n");
          return (
            <section
              key={prompt.id}
              className={`rounded-xl border bg-[var(--slurp-canvas)] ${selected ? "border-[var(--noodle-accent)] ring-1 ring-[var(--noodle-accent)]/35" : "border-[var(--slurp-outline)]"}`}
            >
              <button
                type="button"
                aria-expanded={selected}
                onClick={() => setSelectedPromptId(selected ? null : prompt.id)}
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
                  <span className="mt-3 block line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
                    {blockPreview || t("ui.slurp.settings.prompts.previewEmpty", { defaultValue: "No prompt text." })}
                  </span>
                </span>
                <ChevronDown size={17} aria-hidden="true" className={selected ? "rotate-180" : ""} />
              </button>
              {selected && (
                <div className="space-y-4 border-t border-[var(--slurp-outline)] p-3 sm:p-4 lg:col-span-2">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
                    <ol className="space-y-2">
                      {layout.map((entry, index) => {
                        const block = blockDefinition(prompt, entry.id);
                        const editable = block.kind === "editable";
                        const enabled = !block.optional || entry.enabled !== false;
                        return (
                          <li
                            key={block.id}
                            className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--slurp-surface-raised)] p-2 ring-1 ring-inset ring-[var(--slurp-outline)]"
                          >
                            <GripVertical size={16} aria-hidden="true" className="text-[var(--slurp-muted)]" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">{blockLabel(block.id)}</span>
                              <span className="flex items-center gap-1 text-xs text-[var(--slurp-muted)]">
                                {block.kind === "required" && <LockKeyhole size={12} aria-hidden="true" />}
                                {block.kind === "required"
                                  ? t("ui.slurp.settings.prompts.blockRequired", { defaultValue: "Required" })
                                  : block.kind === "context"
                                    ? t("ui.slurp.settings.prompts.blockContext", { defaultValue: "Runtime context" })
                                    : t("ui.slurp.settings.prompts.blockEditable", { defaultValue: "Editable" })}
                              </span>
                            </span>
                            {block.optional && (
                              <label className="flex min-h-10 items-center gap-2 px-1 text-xs font-medium">
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
                            <button
                              type="button"
                              aria-label={t("ui.slurp.settings.prompts.previewBlockAria", {
                                block: blockLabel(block.id),
                                defaultValue: "Preview {{block}}",
                              })}
                              onClick={() => showPreview(prompt.id, block.id)}
                              className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                            >
                              <Eye size={15} aria-hidden="true" />
                            </button>
                            {editable && editing?.promptId === prompt.id && editing.blockId === block.id ? (
                              <div className="basis-full space-y-2 pt-2">
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
                              editable && (
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
                                  className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                                >
                                  <Pencil size={15} aria-hidden="true" />
                                </button>
                              )
                            )}
                            <span className="basis-full whitespace-pre-wrap border-t border-[var(--slurp-outline)] pt-2 text-xs leading-5 text-[var(--slurp-muted)]">
                              {enabled
                                ? entry.text?.trim() || block.defaultText
                                : t("ui.slurp.settings.prompts.blockDisabled", { defaultValue: "Disabled" })}
                            </span>
                            <button
                              type="button"
                              aria-label={t("ui.slurp.settings.prompts.moveUpAria", {
                                block: blockLabel(block.id),
                                defaultValue: "Move {{block}} up",
                              })}
                              disabled={index === 0}
                              onClick={() => move(prompt, index, -1)}
                              className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--slurp-outline)] disabled:opacity-35"
                            >
                              <ChevronUp size={16} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={t("ui.slurp.settings.prompts.moveDownAria", {
                                block: blockLabel(block.id),
                                defaultValue: "Move {{block}} down",
                              })}
                              disabled={index === layout.length - 1}
                              onClick={() => move(prompt, index, 1)}
                              className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--slurp-outline)] disabled:opacity-35"
                            >
                              <ChevronDown size={16} aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                    <aside className="space-y-2 rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold">
                          {t("ui.slurp.settings.prompts.assembledTitle", { defaultValue: "Assembled prompt" })}
                        </p>
                        <button
                          type="button"
                          onClick={() => showPreview(prompt.id, layout[0]?.id ?? "")}
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--slurp-outline)]"
                          aria-label={t("ui.slurp.settings.prompts.previewPromptAria", {
                            defaultValue: "Preview assembled prompt",
                          })}
                        >
                          <Eye size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
                        {blockPreview}
                      </p>
                    </aside>
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
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--slurp-muted)]">
              {previewText ||
                t("ui.slurp.settings.prompts.previewEmpty", {
                  defaultValue: "This block adds nothing for this Creator right now.",
                })}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
