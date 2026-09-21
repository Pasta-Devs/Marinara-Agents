import { Check, Code2, Copy, Play, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride, SlurpReusablePromptInstruction } from "../../base/state/slp-state-types";
import type { SlurpPromptDefinition, SlurpPromptResultPreviewInput } from "./slp-settings-contract";
import { useSlurpPromptBlockPreview, useSlurpPromptResultPreview } from "./slp-settings-hooks";
import { promptName } from "./slp-prompt-studio-model";

type CreatorOption = { id: string; displayName: string };

export function SlpPromptPreviewInspector({
  prompt,
  creatorOptions,
  activeCreatorId,
  onCreatorChange,
  draftBlocks,
  currentBlocks,
  draftInstructions,
  currentInstructions,
}: {
  prompt: SlurpPromptDefinition;
  creatorOptions: CreatorOption[];
  activeCreatorId: string;
  onCreatorChange: (id: string) => void;
  draftBlocks: Record<string, SlurpPromptBlockOverride[]>;
  currentBlocks: Record<string, SlurpPromptBlockOverride[]>;
  draftInstructions: SlurpReusablePromptInstruction[];
  currentInstructions: SlurpReusablePromptInstruction[];
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<"result" | "prompt">("result");
  const [access, setAccess] = useState<"public" | "locked">("public");
  const [format, setFormat] = useState<"caption" | "announcement" | "long_form">("caption");
  const [direction, setDirection] = useState("");
  const [promptCopied, setPromptCopied] = useState(false);
  const promptPreview = useSlurpPromptBlockPreview();
  const resultPreview = useSlurpPromptResultPreview();
  const currentPreview = useSlurpPromptResultPreview();
  const isPost = prompt.id === "post";
  const canCompare =
    JSON.stringify(draftBlocks[prompt.id] ?? []) !== JSON.stringify(currentBlocks[prompt.id] ?? []) ||
    JSON.stringify(draftInstructions) !== JSON.stringify(currentInstructions);

  useEffect(() => {
    promptPreview.reset();
    resultPreview.reset();
    currentPreview.reset();
    setPromptCopied(false);
    setView(prompt.id === "post" ? "result" : "prompt");
    // Mutation handles are stable and including them resets on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.id, activeCreatorId]);

  useEffect(() => {
    promptPreview.reset();
    resultPreview.reset();
    currentPreview.reset();
    setPromptCopied(false);
    // An edited draft makes every previous result stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftBlocks, draftInstructions, access, format, direction]);

  const resultInput = (
    blocks: Record<string, SlurpPromptBlockOverride[]>,
    instructions: SlurpReusablePromptInstruction[],
  ): SlurpPromptResultPreviewInput => ({
    promptId: "post",
    creatorAccountId: activeCreatorId,
    promptBlocks: blocks,
    promptInstructions: instructions,
    access,
    format,
    direction: direction.trim() || undefined,
  });

  const runPreview = () => {
    if (!activeCreatorId) return;
    if (view === "result" && isPost) {
      resultPreview.mutate(resultInput(draftBlocks, draftInstructions));
      return;
    }
    promptPreview.mutate({
      promptId: prompt.id,
      creatorAccountId: activeCreatorId,
      promptBlocks: draftBlocks,
      promptInstructions: draftInstructions,
    });
  };

  const pending = promptPreview.isPending || resultPreview.isPending;
  const error = promptPreview.error ?? resultPreview.error;
  const compiledPrompt = resultPreview.data?.compiledPrompt ?? promptPreview.data?.compiledText ?? "";

  return (
    <aside
      aria-labelledby="slurp-prompt-preview-title"
      className="min-w-0 space-y-4 rounded-xl bg-[var(--slurp-surface-raised)] p-4 ring-1 ring-inset ring-[var(--slurp-outline)] xl:sticky xl:top-3 xl:max-h-[calc(100dvh-1.5rem)] xl:overflow-y-auto"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
          {t("ui.slurp.settings.prompts.previewInspector", { defaultValue: "Try your changes" })}
        </p>
        <h3 id="slurp-prompt-preview-title" className="mt-1 text-lg font-black text-balance">
          {promptName(prompt.id)}
        </h3>
        <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)] text-pretty">
          {t("ui.slurp.settings.prompts.previewDraftOnly", {
            defaultValue: "Preview uses your draft. Nothing is published or applied.",
          })}
        </p>
      </div>

      {creatorOptions.length > 0 ? (
        <label className="block text-xs font-semibold">
          {t("ui.slurp.settings.prompts.previewCreator", { defaultValue: "Preview as" })}
          <select
            value={activeCreatorId}
            onChange={(event) => onCreatorChange(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
          >
            {creatorOptions.map((creator) => (
              <option key={creator.id} value={creator.id}>
                {creator.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          {t("ui.slurp.settings.prompts.previewNoCreator")}
        </p>
      )}

      {isPost && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="block text-xs font-semibold">
            {t("ui.slurp.settings.prompts.previewAccess", { defaultValue: "Access" })}
            <select
              value={access}
              onChange={(event) => setAccess(event.target.value as "public" | "locked")}
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
            >
              <option value="public">{t("ui.slurp.settings.prompts.previewPublic", { defaultValue: "Public" })}</option>
              <option value="locked">{t("ui.slurp.settings.prompts.previewLocked", { defaultValue: "Locked" })}</option>
            </select>
          </label>
          <label className="block text-xs font-semibold">
            {t("ui.slurp.settings.prompts.previewFormat", { defaultValue: "Format" })}
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as typeof format)}
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] px-3 text-base font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
            >
              <option value="caption">
                {t("ui.slurp.settings.prompts.previewCaption", { defaultValue: "Caption" })}
              </option>
              <option value="announcement">
                {t("ui.slurp.settings.prompts.previewAnnouncement", { defaultValue: "Announcement" })}
              </option>
              <option value="long_form">
                {t("ui.slurp.settings.prompts.previewLongForm", { defaultValue: "Long form" })}
              </option>
            </select>
          </label>
        </div>
      )}

      {isPost && (
        <label className="block text-xs font-semibold">
          {t("ui.slurp.settings.prompts.previewDirection", { defaultValue: "Additional direction (optional)" })}
          <textarea
            value={direction}
            maxLength={2000}
            onChange={(event) => setDirection(event.target.value)}
            placeholder={t("ui.slurp.settings.prompts.previewDirectionExample", {
              defaultValue: "For example: a quiet morning routine, kept short.",
            })}
            className="mt-1 min-h-24 w-full resize-y rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] p-3 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
          />
        </label>
      )}

      <div
        className="grid grid-cols-2 rounded-lg bg-[var(--slurp-canvas)] p-1"
        aria-label={t("ui.slurp.settings.prompts.previewView", { defaultValue: "Preview view" })}
      >
        <button
          type="button"
          aria-pressed={view === "result"}
          disabled={!isPost}
          onClick={() => setView("result")}
          className={`min-h-10 rounded-md px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40 ${view === "result" ? "bg-[var(--slurp-surface)] shadow-sm" : "text-[var(--slurp-muted)]"}`}
        >
          {t("ui.slurp.settings.prompts.previewResultTab", { defaultValue: "Result" })}
        </button>
        <button
          type="button"
          aria-pressed={view === "prompt"}
          onClick={() => setView("prompt")}
          className={`min-h-10 rounded-md px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${view === "prompt" ? "bg-[var(--slurp-surface)] shadow-sm" : "text-[var(--slurp-muted)]"}`}
        >
          {t("ui.slurp.settings.prompts.compiledPrompt", { defaultValue: "Compiled prompt" })}
        </button>
      </div>

      <button
        type="button"
        disabled={!activeCreatorId || pending}
        onClick={runPreview}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-black text-zinc-950 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-45 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {view === "result" ? <Play size={16} aria-hidden="true" /> : <Code2 size={16} aria-hidden="true" />}
        {pending
          ? t("ui.slurp.settings.prompts.previewRunning", { defaultValue: "Running preview…" })
          : view === "result"
            ? t("ui.slurp.settings.prompts.runPreview", { defaultValue: "Run preview" })
            : t("ui.slurp.settings.prompts.inspectPrompt", { defaultValue: "Compile prompt" })}
      </button>

      <div role="status" aria-live="polite" className="sr-only">
        {pending ? t("ui.slurp.settings.prompts.previewRunning", { defaultValue: "Running preview…" }) : ""}
      </div>
      {error && (
        <p role="alert" className="text-sm leading-6 text-[var(--destructive)]">
          {error instanceof Error
            ? error.message
            : t("ui.slurp.settings.prompts.resultError", { defaultValue: "Could not generate a preview result." })}
        </p>
      )}

      {view === "result" && resultPreview.data && (
        <div className={`grid gap-3 ${currentPreview.data ? "2xl:grid-cols-2" : ""}`}>
          <PreviewResultCard
            label={t("ui.slurp.settings.prompts.draftResult", { defaultValue: "Draft" })}
            data={resultPreview.data}
          />
          {currentPreview.data && (
            <PreviewResultCard
              label={t("ui.slurp.settings.prompts.currentResult", { defaultValue: "Currently applied" })}
              data={currentPreview.data}
            />
          )}
        </div>
      )}

      {view === "result" && resultPreview.data && canCompare && !currentPreview.data && (
        <button
          type="button"
          disabled={currentPreview.isPending}
          onClick={() => currentPreview.mutate(resultInput(currentBlocks, currentInstructions))}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-45"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {currentPreview.isPending
            ? t("ui.slurp.settings.prompts.comparingCurrent", { defaultValue: "Generating current result…" })
            : t("ui.slurp.settings.prompts.compareCurrent", { defaultValue: "Compare with current" })}
        </button>
      )}

      {currentPreview.error && (
        <p role="alert" className="text-sm leading-6 text-[var(--destructive)]">
          {currentPreview.error instanceof Error
            ? currentPreview.error.message
            : t("ui.slurp.settings.prompts.compareError", {
                defaultValue: "Could not generate the currently applied result.",
              })}
        </p>
      )}

      {view === "prompt" && compiledPrompt && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(compiledPrompt)
                  .then(() => setPromptCopied(true))
                  .catch(() => setPromptCopied(false));
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
            >
              {promptCopied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {promptCopied
                ? t("ui.slurp.settings.prompts.promptCopied", { defaultValue: "Copied" })
                : t("ui.slurp.settings.prompts.copyPrompt", { defaultValue: "Copy prompt" })}
            </button>
          </div>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--slurp-canvas)] p-3 text-xs leading-5 text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--slurp-outline)]">
            {compiledPrompt}
          </pre>
        </div>
      )}
    </aside>
  );
}

function PreviewResultCard({
  label,
  data,
}: {
  label: string;
  data: { title: string | null; content: string; imagePrompt: string | null };
}) {
  const { t } = useTranslation();
  return (
    <article className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]">
      <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--noodle-accent)]">
        <Sparkles size={13} aria-hidden="true" /> {label}
      </p>
      {data.title && <h4 className="mt-2 text-sm font-bold text-balance">{data.title}</h4>}
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{data.content}</p>
      {data.imagePrompt && (
        <details className="mt-3 rounded-md bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
          <summary className="min-h-10 cursor-pointer px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]">
            {t("ui.slurp.settings.prompts.previewImagePrompt", { defaultValue: "Image prompt" })}
          </summary>
          <p className="border-t border-[var(--slurp-outline)] p-3 text-xs leading-5 text-[var(--slurp-muted)]">
            {data.imagePrompt}
          </p>
        </details>
      )}
    </article>
  );
}
