import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, LockKeyhole, Pencil, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride } from "../../base/state/slp-state-types";
import type { SlurpPromptBlockDefinition, SlurpPromptDefinition } from "./slp-settings-contract";
import { useSlurpPromptBlocks } from "./slp-settings-hooks";
import { Modal } from "../../../components/ui/Modal";

type PromptBlockBuilderProps = {
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

export function SlurpPromptBlockBuilder({ value, pending, onSave }: PromptBlockBuilderProps) {
  const { t } = useTranslation();
  const definitions = useSlurpPromptBlocks();
  const [draft, setDraft] = useState(value);
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ promptId: string; blockId: string } | null>(null);
  const [textDraft, setTextDraft] = useState("");

  useEffect(() => setDraft(value), [value]);

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
    if (await onSave(draft)) setOpenPromptId(null);
  };

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
      <p className="text-xs leading-5 text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.prompts.blocksDetail", {
          defaultValue:
            "Reorder every part of a prompt. Required blocks protect privacy, safety, and readable model output. They move with the other blocks, but they cannot be removed or edited.",
        })}
      </p>
      {prompts.map((prompt) => {
        const layout = completeLayout(prompt, draft[prompt.id]);
        const changed = Boolean(value[prompt.id]?.length);
        const open = openPromptId === prompt.id;
        return (
          <section key={prompt.id} className="rounded-xl border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)]">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenPromptId(open ? null : prompt.id)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
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
              </span>
              <ChevronDown size={17} aria-hidden="true" className={open ? "rotate-180" : ""} />
            </button>
            {open && (
              <div className="space-y-3 border-t border-[var(--slurp-outline)] p-3 sm:p-4">
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
                        {editable && (
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
                        )}
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
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={
          editing
            ? t("ui.slurp.settings.prompts.editBlockTitle", {
                block: blockLabel(editing.blockId),
                defaultValue: "Edit {{block}}",
              })
            : t("ui.slurp.settings.prompts.editBlock", { defaultValue: "Edit prompt block" })
        }
        width="max-w-3xl"
      >
        <div className="space-y-4">
          <label className="block text-sm font-semibold">
            {t("ui.slurp.settings.prompts.instructions", { defaultValue: "Instructions" })}
            <textarea
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
              className="mt-2 min-h-64 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-transparent p-3 text-base leading-6 sm:text-sm"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="min-h-10 rounded-lg border border-[var(--slurp-outline)] px-4 text-xs font-semibold"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={!textDraft.trim()}
              onClick={() => {
                if (!editing) return;
                const prompt = prompts.find((entry) => entry.id === editing.promptId);
                if (!prompt) return;
                const layout = completeLayout(prompt, draft[prompt.id]);
                const index = layout.findIndex((entry) => entry.id === editing.blockId);
                layout[index] = { ...layout[index]!, text: textDraft.trim() };
                updateLayout(prompt, layout);
                setEditing(null);
              }}
              className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold text-zinc-950 disabled:opacity-45"
            >
              {t("ui.slurp.settings.prompts.apply", { defaultValue: "Apply" })}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
