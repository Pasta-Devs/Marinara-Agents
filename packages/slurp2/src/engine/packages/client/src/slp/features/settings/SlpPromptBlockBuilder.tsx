import { ArrowLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SlurpPromptBlockOverride, SlurpReusablePromptInstruction } from "../../base/state/slp-state-types";
import type { SlurpPromptDefinition } from "./slp-settings-contract";
import { useSlurpPromptBlocks } from "./slp-settings-hooks";
import { useCreatorAccounts } from "../creators/slp-creators-contract";
import { SlpPromptPipeline } from "./SlpPromptPipeline";
import { SlpPromptPreviewInspector } from "./SlpPromptPreviewInspector";
import { SlpReusableInstructions } from "./SlpReusableInstructions";
import {
  completePromptLayout,
  blockDefinition,
  blockName,
  promptCustomizationCount,
  promptGroupName,
  promptGroupPurpose,
  promptName,
  promptPurpose,
  SLP_PROMPT_GROUP_ORDER,
} from "./slp-prompt-studio-model";

type PromptBlockBuilderProps = {
  value: Record<string, SlurpPromptBlockOverride[]>;
  savedValue: Record<string, SlurpPromptBlockOverride[]>;
  onChange: (value: Record<string, SlurpPromptBlockOverride[]>) => void;
  instructions: SlurpReusablePromptInstruction[];
  savedInstructions: SlurpReusablePromptInstruction[];
  onChangeInstructions: (value: SlurpReusablePromptInstruction[]) => void;
  overviewContent?: ReactNode;
};

export function SlurpPromptBlockBuilder({
  value,
  savedValue,
  onChange,
  instructions,
  savedInstructions,
  onChangeInstructions,
  overviewContent,
}: PromptBlockBuilderProps) {
  const { t } = useTranslation();
  const definitions = useSlurpPromptBlocks();
  const creators = useCreatorAccounts();
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewCreatorId, setPreviewCreatorId] = useState("");
  const [mobileView, setMobileView] = useState<"build" | "preview">("build");
  const [query, setQuery] = useState("");
  const creatorOptions = creators.data ?? [];
  const activeCreatorId = previewCreatorId || creatorOptions[0]?.id || "";
  const prompts = definitions.data?.prompts ?? [];
  const selectedPrompt = prompts.find((prompt) => prompt.id === selectedPromptId) ?? null;
  const previewPrompt = selectedPrompt ?? prompts.find((prompt) => prompt.id === "post") ?? prompts[0] ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visiblePrompts = useMemo(
    () =>
      normalizedQuery
        ? prompts.filter((prompt) =>
            `${promptName(prompt.id)} ${promptPurpose(prompt.id)} ${promptGroupName(prompt.group)}`
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
        : prompts,
    [normalizedQuery, prompts],
  );

  const updateLayout = (prompt: SlurpPromptDefinition, layout: SlurpPromptBlockOverride[]) => {
    onChange({ ...value, [prompt.id]: layout });
  };

  const moveBlock = (prompt: SlurpPromptDefinition, index: number, offset: -1 | 1) => {
    const layout = completePromptLayout(prompt, value[prompt.id]);
    const target = index + offset;
    if (target < 0 || target >= layout.length) return;
    [layout[index], layout[target]] = [layout[target]!, layout[index]!];
    updateLayout(prompt, layout);
  };

  const resetRecipe = (promptId: string) => {
    const next = { ...value };
    delete next[promptId];
    onChange(next);
    setSelectedBlockId(null);
  };

  if (definitions.isLoading)
    return (
      <p className="text-sm text-[var(--slurp-muted)]">
        {t("ui.slurp.settings.prompts.blocksLoading", { defaultValue: "Loading prompt recipes…" })}
      </p>
    );
  if (definitions.isError)
    return (
      <p role="alert" className="text-sm text-[var(--destructive)]">
        {t("ui.slurp.settings.prompts.blocksLoadError", { defaultValue: "Could not load prompt recipes." })}
      </p>
    );
  if (!previewPrompt) return null;

  if (selectedPrompt) {
    const layout = completePromptLayout(selectedPrompt, value[selectedPrompt.id]);
    const customCount = promptCustomizationCount(selectedPrompt, value[selectedPrompt.id]);
    return (
      <section aria-labelledby="slurp-recipe-workspace-title" className="space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            aria-label={t("ui.slurp.settings.prompts.backToRecipes", { defaultValue: "Back to prompt recipes" })}
            onClick={() => {
              setSelectedPromptId(null);
              setSelectedBlockId(null);
              setMobileView("build");
            }}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
          >
            <ArrowLeft size={18} className="rtl:rotate-180" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--noodle-accent)]">
              {t("ui.slurp.settings.prompts.studioTitle", { defaultValue: "Prompt Studio" })} /{" "}
              {promptGroupName(selectedPrompt.group)}
            </p>
            <h2 id="slurp-recipe-workspace-title" className="mt-1 text-xl font-black text-balance sm:text-2xl">
              {promptName(selectedPrompt.id)}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)] text-pretty">
              {promptPurpose(selectedPrompt.id)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 ring-1 ring-inset ring-[var(--slurp-outline)] tabular-nums">
                {t("ui.slurp.settings.prompts.blockCount", {
                  count: layout.length,
                  defaultValue: "{{count}} blocks",
                })}
              </span>
              <span className="rounded-full bg-[var(--slurp-surface-raised)] px-2.5 py-1 text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/30 tabular-nums">
                {customCount > 0
                  ? t("ui.slurp.settings.prompts.customCount", {
                      count: customCount,
                      defaultValue: "{{count}} custom",
                    })
                  : t("ui.slurp.settings.prompts.default", { defaultValue: "Default" })}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={!value[selectedPrompt.id]}
            onClick={() => resetRecipe(selectedPrompt.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t("ui.slurp.settings.prompts.restoreRecipe", { defaultValue: "Restore recipe" })}
          </button>
        </div>

        <div
          className="grid grid-cols-2 rounded-lg bg-[var(--slurp-surface-raised)] p-1 xl:hidden"
          aria-label={t("ui.slurp.settings.prompts.recipeView", { defaultValue: "Recipe view" })}
        >
          <button
            type="button"
            aria-pressed={mobileView === "build"}
            onClick={() => setMobileView("build")}
            className={`min-h-11 rounded-md px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${mobileView === "build" ? "bg-[var(--noodle-accent)] text-zinc-950" : "text-[var(--slurp-muted)]"}`}
          >
            {t("ui.slurp.settings.prompts.buildTab", { defaultValue: "Build" })}
          </button>
          <button
            type="button"
            aria-pressed={mobileView === "preview"}
            onClick={() => setMobileView("preview")}
            className={`min-h-11 rounded-md px-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${mobileView === "preview" ? "bg-[var(--noodle-accent)] text-zinc-950" : "text-[var(--slurp-muted)]"}`}
          >
            {t("ui.slurp.settings.prompts.previewResultTab", { defaultValue: "Preview" })}
          </button>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
          <BlockOutline
            prompt={selectedPrompt}
            layout={layout}
            selectedBlockId={selectedBlockId}
            onSelect={(blockId) => {
              setSelectedBlockId(blockId);
              window.requestAnimationFrame(() => {
                document
                  .getElementById(`slurp-prompt-block-${selectedPrompt.id}-${blockId}`)
                  ?.scrollIntoView({ block: "center", behavior: "smooth" });
              });
            }}
          />
          <div className={`${mobileView === "preview" ? "hidden" : "block"} min-w-0 xl:block`}>
            {selectedBlockId && (
              <button
                type="button"
                onClick={() => setSelectedBlockId(null)}
                className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-[var(--noodle-accent)] ring-1 ring-inset ring-[var(--noodle-accent)]/35 lg:hidden"
              >
                <ArrowLeft size={14} className="rtl:rotate-180" aria-hidden="true" />
                {t("ui.slurp.settings.prompts.backToBlocks", { defaultValue: "Back to blocks" })}
              </button>
            )}
            <SlpPromptPipeline
              prompt={selectedPrompt}
              layout={layout}
              instructions={instructions}
              selectedBlockId={selectedBlockId}
              onSelectBlock={setSelectedBlockId}
              onUpdate={(next) => updateLayout(selectedPrompt, next)}
              onMove={(index, offset) => moveBlock(selectedPrompt, index, offset)}
              focusSelectedOnSmallScreens
            />
          </div>
          <div className={`${mobileView === "preview" ? "block" : "hidden"} min-w-0 xl:block`}>
            <SlpPromptPreviewInspector
              prompt={selectedPrompt}
              creatorOptions={creatorOptions}
              activeCreatorId={activeCreatorId}
              onCreatorChange={setPreviewCreatorId}
              draftBlocks={value}
              currentBlocks={savedValue}
              draftInstructions={instructions}
              currentInstructions={savedInstructions}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="slurp-prompt-recipes-title" className="space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-8">
          {overviewContent}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--noodle-accent)]">
                {t("ui.slurp.settings.prompts.producePipeline", { defaultValue: "Produce pipeline" })}
              </p>
              <h2 id="slurp-prompt-recipes-title" className="mt-1 text-lg font-black text-balance">
                {t("ui.slurp.settings.prompts.recipesTitle", { defaultValue: "Prompt recipes" })}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--slurp-muted)] text-pretty">
                {t("ui.slurp.settings.prompts.recipesDetail", {
                  defaultValue: "Open a recipe to see exactly how Slurp builds that kind of content.",
                })}
              </p>
            </div>
            <label className="relative block sm:w-64">
              <span className="sr-only">
                {t("ui.slurp.settings.prompts.searchRecipes", { defaultValue: "Search prompt recipes" })}
              </span>
              <Search
                size={16}
                className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--slurp-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("ui.slurp.settings.prompts.searchRecipesPlaceholder", {
                  defaultValue: "Search recipes…",
                })}
                className="min-h-11 w-full rounded-lg border border-[var(--slurp-outline)] bg-[var(--slurp-canvas)] pe-3 ps-10 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
              />
            </label>
            {/* Draft only: the player still saves or discards it like any other edit. */}
            <button
              type="button"
              disabled={!definitions.data?.classicPreset}
              onClick={() => definitions.data && onChange(definitions.data.classicPreset)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-40"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t("ui.slurp.settings.prompts.loadClassicPreset", { defaultValue: "Load Classic prompts" })}
            </button>
          </div>
          {SLP_PROMPT_GROUP_ORDER.map((group) => {
            const groupPrompts = visiblePrompts.filter((prompt) => prompt.group === group);
            if (groupPrompts.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`slurp-recipe-group-${group}`}>
                <h3 id={`slurp-recipe-group-${group}`} className="text-sm font-bold">
                  {promptGroupName(group)}
                </h3>
                <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">{promptGroupPurpose(group)}</p>
                <div className="mt-3 overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
                  {groupPrompts.map((prompt) => (
                    <RecipeCard
                      key={prompt.id}
                      prompt={prompt}
                      value={value[prompt.id]}
                      onOpen={() => {
                        setSelectedPromptId(prompt.id);
                        setSelectedBlockId(null);
                        setMobileView("build");
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
          {visiblePrompts.length === 0 && (
            <div className="rounded-xl bg-[var(--slurp-surface-raised)] p-5 text-center ring-1 ring-inset ring-[var(--slurp-outline)]">
              <p className="text-sm font-bold">
                {t("ui.slurp.settings.prompts.noRecipes", { defaultValue: "No matching recipes" })}
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-2 min-h-10 px-3 text-sm font-bold text-[var(--noodle-accent)]"
              >
                {t("ui.slurp.settings.prompts.clearRecipeSearch", { defaultValue: "Clear search" })}
              </button>
            </div>
          )}
          <SlpReusableInstructions value={instructions} onChange={onChangeInstructions} />
        </div>
        <SlpPromptPreviewInspector
          prompt={previewPrompt}
          creatorOptions={creatorOptions}
          activeCreatorId={activeCreatorId}
          onCreatorChange={setPreviewCreatorId}
          draftBlocks={value}
          currentBlocks={savedValue}
          draftInstructions={instructions}
          currentInstructions={savedInstructions}
        />
      </div>
    </section>
  );
}

function RecipeCard({
  prompt,
  value,
  onOpen,
}: {
  prompt: SlurpPromptDefinition;
  value: SlurpPromptBlockOverride[] | undefined;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const count = completePromptLayout(prompt, value).length;
  const customCount = promptCustomizationCount(prompt, value);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-20 w-full items-center gap-3 border-b border-[var(--slurp-outline)] p-3 text-start transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--noodle-accent)_6%,var(--slurp-surface-raised))] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slurp-focus)] sm:p-4"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--slurp-canvas)] text-[var(--noodle-accent)]">
        <SlidersHorizontal size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <span>
          <span className="block text-sm font-bold text-balance">{promptName(prompt.id)}</span>
          <span className="mt-1 block text-xs leading-5 text-[var(--slurp-muted)] text-pretty">
            {promptPurpose(prompt.id)}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold sm:mt-0 sm:justify-end">
          <span className="tabular-nums text-[var(--slurp-muted)]">
            {t("ui.slurp.settings.prompts.blockCount", { count, defaultValue: "{{count}} blocks" })}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--slurp-canvas)] px-2 py-1 ring-1 ring-inset ring-[var(--slurp-outline)]">
            <span
              className={`size-1.5 rounded-full ${customCount > 0 ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-muted)]"}`}
              aria-hidden="true"
            />
            {customCount > 0
              ? t("ui.slurp.settings.prompts.custom", { defaultValue: "Custom" })
              : t("ui.slurp.settings.prompts.default", { defaultValue: "Default" })}
          </span>
        </span>
      </span>
      <ChevronRight
        size={17}
        className="shrink-0 text-[var(--slurp-muted)] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );
}

function BlockOutline({
  prompt,
  layout,
  selectedBlockId,
  onSelect,
}: {
  prompt: SlurpPromptDefinition;
  layout: SlurpPromptBlockOverride[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("ui.slurp.settings.prompts.recipeBlocks", { defaultValue: "Recipe blocks" })}
      className="hidden min-w-0 xl:block"
    >
      <div className="overflow-hidden rounded-xl bg-[var(--slurp-surface-raised)] ring-1 ring-inset ring-[var(--slurp-outline)]">
        <p className="border-b border-[var(--slurp-outline)] px-3 py-3 text-xs font-black">
          {t("ui.slurp.settings.prompts.recipeBlocks", { defaultValue: "Recipe blocks" })}
        </p>
        <ol className="p-1.5">
          {layout.map((entry, index) => {
            const block = blockDefinition(prompt, entry.id);
            const selected = selectedBlockId === entry.id;
            const custom = entry.text !== undefined || entry.instructionId !== undefined || entry.enabled === false;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={selected ? "step" : undefined}
                  onClick={() => onSelect(entry.id)}
                  className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-start text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] ${selected ? "bg-[var(--slurp-nav-active)] text-[var(--slurp-text)]" : "text-[var(--slurp-muted)] hover:bg-[var(--slurp-canvas)] hover:text-[var(--slurp-text)]"}`}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--slurp-canvas)] text-[0.68rem] font-black tabular-nums ring-1 ring-inset ring-[var(--slurp-outline)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{blockName(block.id)}</span>
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${custom ? "bg-[var(--noodle-accent)]" : "bg-[var(--slurp-outline)]"}`}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
