import { Check, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { SlpWardrobeImportDraft, SlpWardrobeLookInput } from "../../../../../shared/src/slp/slp-wardrobe.js";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { errorMessage } from "../../modules/settings/slp-backstage-format";
import { fieldClass, textareaClass } from "../../modules/post/SlpPostHelpers";
import {
  usePreviewSlurpWardrobeImport,
  useSlurpWardrobe,
  useSlurpWardrobeLorebookEntries,
  useSlurpWardrobeLorebooks,
  useSlurpWardrobeMutations,
} from "./slp-wardrobe-hooks";

type ImportKind = "character" | "lorebook" | "text" | "legacy";
type ReviewLook = SlpWardrobeImportDraft & { selected: boolean };

const blankLook = (): SlpWardrobeLookInput => ({
  name: "",
  summary: "",
  description: "",
  tags: [],
  suitability: "both",
  enabled: true,
});

function LookFields({
  value,
  disabled,
  onChange,
}: {
  value: SlpWardrobeLookInput;
  disabled: boolean;
  onChange: (next: SlpWardrobeLookInput) => void;
}) {
  const { t } = useTranslation();
  const patch = (next: Partial<SlpWardrobeLookInput>) => onChange({ ...value, ...next });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1">
        <span className="text-xs font-semibold">{t("ui.slurp.wardrobe.name", { defaultValue: "Look name" })}</span>
        <input
          className={fieldClass}
          value={value.name}
          maxLength={80}
          disabled={disabled}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold">
          {t("ui.slurp.wardrobe.suitability", { defaultValue: "Where it fits" })}
        </span>
        <select
          className={fieldClass}
          value={value.suitability}
          disabled={disabled}
          onChange={(event) => patch({ suitability: event.target.value as SlpWardrobeLookInput["suitability"] })}
        >
          <option value="both">{t("ui.slurp.wardrobe.both", { defaultValue: "Public and locked" })}</option>
          <option value="public">{t("ui.slurp.wardrobe.public", { defaultValue: "Public only" })}</option>
          <option value="locked">{t("ui.slurp.wardrobe.locked", { defaultValue: "Locked only" })}</option>
        </select>
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs font-semibold">
          {t("ui.slurp.wardrobe.summary", { defaultValue: "Short closet summary" })}
        </span>
        <input
          className={fieldClass}
          value={value.summary}
          maxLength={180}
          disabled={disabled}
          onChange={(event) => patch({ summary: event.target.value })}
          placeholder={t("ui.slurp.wardrobe.summaryPlaceholder", {
            defaultValue: "A compact choice the post writer can understand.",
          })}
        />
      </label>
      <label className="space-y-1 sm:col-span-2">
        <span className="text-xs font-semibold">
          {t("ui.slurp.wardrobe.description", { defaultValue: "Exact visual description" })}
        </span>
        <textarea
          className={`${textareaClass} !min-h-24`}
          value={value.description}
          maxLength={800}
          disabled={disabled}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder={t("ui.slurp.wardrobe.descriptionPlaceholder", {
            defaultValue: "Clothes and accessories exactly as the image model should render them.",
          })}
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs font-semibold">{t("ui.slurp.wardrobe.tags", { defaultValue: "Tags" })}</span>
        <input
          className={fieldClass}
          value={value.tags.join(", ")}
          disabled={disabled}
          onChange={(event) =>
            patch({
              tags: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
                .slice(0, 12),
            })
          }
          placeholder="casual, bedroom, black"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 self-end text-sm font-semibold">
        <input
          type="checkbox"
          checked={value.enabled}
          disabled={disabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
        />
        {t("ui.slurp.wardrobe.enabled", { defaultValue: "Let automatic posts use this look" })}
      </label>
    </div>
  );
}

export function SlpWardrobeManager({ creatorId, legacyWardrobe }: { creatorId: string; legacyWardrobe: string }) {
  const { t } = useTranslation();
  const wardrobe = useSlurpWardrobe(creatorId);
  const lorebooks = useSlurpWardrobeLorebooks();
  const mutations = useSlurpWardrobeMutations(creatorId);
  const previewImport = usePreviewSlurpWardrobeImport(creatorId);
  const [editor, setEditor] = useState<SlpWardrobeLookInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importKind, setImportKind] = useState<ImportKind>(legacyWardrobe.trim() ? "legacy" : "character");
  const [importText, setImportText] = useState(legacyWardrobe);
  const [lorebookIds, setLorebookIds] = useState<string[]>([]);
  const [lorebookScope, setLorebookScope] = useState<"books" | "entries">("books");
  const [lorebookEntryIds, setLorebookEntryIds] = useState<string[]>([]);
  const lorebookEntries = useSlurpWardrobeLorebookEntries(lorebookIds, importKind === "lorebook");
  const [review, setReview] = useState<ReviewLook[]>([]);
  const [reviewSource, setReviewSource] = useState<{ kind: ImportKind; label: string } | null>(null);
  const looks = wardrobe.data?.looks ?? [];
  const pending = mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;
  const selectedCount = useMemo(() => review.filter((look) => look.selected).length, [review]);

  const fail = (error: unknown) =>
    toast.error(errorMessage(error, t("ui.slurp.wardrobe.error", { defaultValue: "Could not update the wardrobe." })));

  const saveEditor = () => {
    if (!editor) return;
    const mutation = editingId ? mutations.update : mutations.create;
    mutation.mutate(editingId ? { ...editor, id: editingId } : editor, {
      onSuccess: () => {
        toast.success(t("ui.slurp.wardrobe.saved", { defaultValue: "Look saved." }));
        setEditor(null);
        setEditingId(null);
      },
      onError: fail,
    });
  };

  const runPreview = () => {
    const source =
      importKind === "lorebook"
        ? {
            kind: "lorebook" as const,
            lorebookIds,
            ...(lorebookScope === "entries" ? { entryIds: lorebookEntryIds } : {}),
          }
        : importKind === "text"
          ? { kind: "text" as const, text: importText }
          : importKind === "legacy"
            ? { kind: "legacy" as const, text: importText }
            : { kind: "character" as const };
    previewImport.mutate(
      { source },
      {
        onSuccess: (data) => {
          setReviewSource(data.source);
          setReview(data.looks.map((look) => ({ ...look, selected: true })));
          if (data.looks.length === 0)
            toast.info(t("ui.slurp.wardrobe.noneFound", { defaultValue: "No complete clothing looks were found." }));
        },
        onError: fail,
      },
    );
  };

  const saveReview = () => {
    if (!reviewSource) return;
    const accepted = review
      .filter((look) => look.selected)
      .map(({ selected: _selected, evidence: _evidence, ...look }) => look);
    mutations.saveImport.mutate(
      { source: reviewSource, looks: accepted },
      {
        onSuccess: () => {
          toast.success(
            t("ui.slurp.wardrobe.imported", { defaultValue: "Imported {{count}} looks.", count: accepted.length }),
          );
          setReview([]);
          setReviewSource(null);
        },
        onError: fail,
      },
    );
  };

  return (
    <section className="space-y-4 rounded-xl bg-[var(--slurp-surface-raised)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black">{t("ui.slurp.wardrobe.title", { defaultValue: "Wardrobe looks" })}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.wardrobe.detail", {
              defaultValue:
                "Automatic posts see every enabled look, choose one by ID, and Slurp expands its exact clothing description for the image model.",
            })}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--slurp-canvas)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--slurp-outline)] focus-visible:outline focus-visible:outline-2"
          onClick={() => {
            setEditingId(null);
            setEditor(blankLook());
          }}
          disabled={looks.length >= (wardrobe.data?.limit ?? 64)}
        >
          <Plus size={15} /> {t("ui.slurp.wardrobe.add", { defaultValue: "Add look" })}
        </button>
      </div>

      {wardrobe.isLoading ? (
        <div
          className="flex justify-center py-8"
          role="status"
          aria-label={t("ui.slurp.wardrobe.loading", { defaultValue: "Loading wardrobe" })}
        >
          <Loader2 className="animate-spin motion-reduce:animate-none" size={20} />
        </div>
      ) : looks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--slurp-outline)] p-4 text-sm text-[var(--muted-foreground)]">
          {t("ui.slurp.wardrobe.empty", {
            defaultValue:
              "No saved looks yet. The legacy wardrobe note remains the fallback until you add or import one.",
          })}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {looks.map((look) => (
            <li
              key={look.id}
              className="rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{look.name}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{look.summary}</p>
                  <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {look.suitability} · {look.enabled ? "enabled" : "disabled"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-lg hover:bg-[var(--slurp-surface-raised)] focus-visible:outline focus-visible:outline-2"
                    aria-label={t("ui.slurp.wardrobe.edit", { defaultValue: "Edit look" })}
                    onClick={() => {
                      setEditingId(look.id);
                      setEditor({
                        name: look.name,
                        summary: look.summary,
                        description: look.description,
                        tags: look.tags,
                        suitability: look.suitability,
                        enabled: look.enabled,
                      });
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-lg text-[var(--destructive)] hover:bg-[var(--slurp-surface-raised)] focus-visible:outline focus-visible:outline-2"
                    aria-label={t("ui.slurp.wardrobe.delete", { defaultValue: "Delete look" })}
                    onClick={() =>
                      void showConfirmDialog({
                        title: t("ui.slurp.wardrobe.deleteTitle", { defaultValue: "Delete this look?" }),
                        detail: t("ui.slurp.wardrobe.deleteDetail", {
                          defaultValue:
                            "Existing posts keep their recorded look, but automatic posts cannot choose it again.",
                        }),
                        confirmLabel: t("ui.slurp.wardrobe.deleteAction", { defaultValue: "Delete" }),
                        destructive: true,
                      }).then((confirmed) => confirmed && mutations.remove.mutate(look.id, { onError: fail }))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editor && (
        <div className="space-y-3 rounded-lg border border-[var(--slurp-outline)] p-3">
          <h4 className="text-sm font-bold">
            {editingId
              ? t("ui.slurp.wardrobe.editTitle", { defaultValue: "Edit look" })
              : t("ui.slurp.wardrobe.newTitle", { defaultValue: "New look" })}
          </h4>
          <LookFields value={editor} disabled={pending} onChange={setEditor} />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg px-3 text-xs font-bold"
              onClick={() => setEditor(null)}
            >
              {t("ui.slurp.wardrobe.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-black text-white disabled:opacity-50"
              disabled={pending || !editor.name.trim() || !editor.summary.trim() || !editor.description.trim()}
              onClick={saveEditor}
            >
              {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}
              {t("ui.slurp.wardrobe.save", { defaultValue: "Save" })}
            </button>
          </div>
        </div>
      )}

      <details className="rounded-lg border border-[var(--slurp-outline)] p-3">
        <summary className="cursor-pointer text-sm font-bold focus-visible:outline focus-visible:outline-2">
          {t("ui.slurp.wardrobe.importTitle", { defaultValue: "Import looks with AI" })}
        </summary>
        <div className="mt-4 space-y-4">
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            {t("ui.slurp.wardrobe.importDetail", {
              defaultValue:
                "AI extracts only looks supported by the source. Review the evidence, edit each result, and choose what to save.",
            })}
          </p>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <label className="space-y-1">
              <span className="text-xs font-semibold">{t("ui.slurp.wardrobe.source", { defaultValue: "Source" })}</span>
              <select
                className={fieldClass}
                value={importKind}
                onChange={(event) => setImportKind(event.target.value as ImportKind)}
              >
                <option value="character">
                  {t("ui.slurp.wardrobe.sourceCharacter", { defaultValue: "Linked character" })}
                </option>
                <option value="lorebook">{t("ui.slurp.wardrobe.sourceLorebook", { defaultValue: "Lorebooks" })}</option>
                <option value="text">{t("ui.slurp.wardrobe.sourceText", { defaultValue: "Pasted text" })}</option>
                <option value="legacy" disabled={!legacyWardrobe.trim()}>
                  {t("ui.slurp.wardrobe.sourceLegacy", { defaultValue: "Legacy wardrobe note" })}
                </option>
              </select>
            </label>
            {importKind === "lorebook" ? (
              <div className="space-y-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold">
                    {t("ui.slurp.wardrobe.chooseLorebooks", { defaultValue: "Choose lorebooks" })}
                  </span>
                  <select
                    multiple
                    size={Math.min(5, Math.max(2, lorebooks.data?.items.length ?? 2))}
                    className={`${fieldClass} min-h-24`}
                    value={lorebookIds}
                    onChange={(event) => {
                      setLorebookIds([...event.target.selectedOptions].map((option) => option.value));
                      setLorebookEntryIds([]);
                    }}
                  >
                    {(lorebooks.data?.items ?? []).map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name}
                      </option>
                    ))}
                  </select>
                </label>
                {lorebookIds.length > 0 && (
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold">
                      {t("ui.slurp.wardrobe.lorebookScope", { defaultValue: "What to scan" })}
                    </legend>
                    <label className="flex min-h-10 items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name={`wardrobe-lorebook-scope-${creatorId}`}
                        checked={lorebookScope === "books"}
                        onChange={() => setLorebookScope("books")}
                      />
                      {t("ui.slurp.wardrobe.wholeLorebooks", { defaultValue: "Every enabled entry in these books" })}
                    </label>
                    <label className="flex min-h-10 items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name={`wardrobe-lorebook-scope-${creatorId}`}
                        checked={lorebookScope === "entries"}
                        onChange={() => setLorebookScope("entries")}
                      />
                      {t("ui.slurp.wardrobe.selectedEntries", { defaultValue: "Only selected entries" })}
                    </label>
                  </fieldset>
                )}
                {lorebookScope === "entries" && lorebookIds.length > 0 && (
                  <label className="space-y-1">
                    <span className="text-xs font-semibold">
                      {t("ui.slurp.wardrobe.chooseEntries", { defaultValue: "Choose entries" })}
                    </span>
                    <select
                      multiple
                      size={Math.min(7, Math.max(3, lorebookEntries.data?.items.length ?? 3))}
                      className={`${fieldClass} min-h-32`}
                      value={lorebookEntryIds}
                      onChange={(event) =>
                        setLorebookEntryIds([...event.target.selectedOptions].map((option) => option.value))
                      }
                    >
                      {(lorebookEntries.data?.items ?? []).map((entry) => (
                        <option key={`${entry.lorebookId}:${entry.id}`} value={entry.id}>
                          {entry.lorebookName} — {entry.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            ) : importKind === "text" || importKind === "legacy" ? (
              <label className="space-y-1">
                <span className="text-xs font-semibold">
                  {t("ui.slurp.wardrobe.sourceMaterial", { defaultValue: "Source material" })}
                </span>
                <textarea
                  className={`${textareaClass} !min-h-24`}
                  value={importText}
                  readOnly={importKind === "legacy"}
                  maxLength={24_000}
                  onChange={(event) => setImportText(event.target.value)}
                />
              </label>
            ) : (
              <p className="self-end pb-2 text-xs text-[var(--muted-foreground)]">
                {t("ui.slurp.wardrobe.characterDetail", {
                  defaultValue: "Uses the character or persona linked to this Creator.",
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--slurp-canvas)] px-3 text-xs font-bold ring-1 ring-inset ring-[var(--slurp-outline)] disabled:opacity-50"
            disabled={
              previewImport.isPending ||
              (importKind === "lorebook" && lorebookIds.length === 0) ||
              (importKind === "lorebook" && lorebookScope === "entries" && lorebookEntryIds.length === 0) ||
              ((importKind === "text" || importKind === "legacy") && !importText.trim())
            }
            onClick={runPreview}
          >
            {previewImport.isPending ? (
              <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Sparkles size={15} />
            )}
            {t("ui.slurp.wardrobe.preview", { defaultValue: "Extract review draft" })}
          </button>

          {review.length > 0 && (
            <div className="space-y-3" aria-live="polite">
              <h4 className="text-sm font-black">
                {t("ui.slurp.wardrobe.reviewTitle", { defaultValue: "Review extracted looks" })}
              </h4>
              {review.map((look, index) => (
                <div
                  key={`${look.name}-${index}`}
                  className="space-y-3 rounded-lg bg-[var(--slurp-canvas)] p-3 ring-1 ring-inset ring-[var(--slurp-outline)]"
                >
                  <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={look.selected}
                      onChange={(event) =>
                        setReview((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, selected: event.target.checked } : entry,
                          ),
                        )
                      }
                    />
                    {t("ui.slurp.wardrobe.include", { defaultValue: "Include this look" })}
                  </label>
                  <LookFields
                    value={look}
                    disabled={!look.selected || mutations.saveImport.isPending}
                    onChange={(next) =>
                      setReview((current) =>
                        current.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...next } : entry)),
                      )
                    }
                  />
                  <p className="rounded-md bg-[var(--slurp-surface-raised)] p-2 text-xs leading-5 text-[var(--muted-foreground)]">
                    <strong>{t("ui.slurp.wardrobe.evidence", { defaultValue: "Source evidence:" })}</strong>{" "}
                    {look.evidence}
                  </p>
                </div>
              ))}
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-3 text-xs font-black text-white disabled:opacity-50"
                disabled={selectedCount === 0 || mutations.saveImport.isPending || looks.length + selectedCount > 64}
                onClick={saveReview}
              >
                {mutations.saveImport.isPending ? (
                  <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Check size={15} />
                )}
                {t("ui.slurp.wardrobe.saveSelected", {
                  defaultValue: "Save {{count}} selected",
                  count: selectedCount,
                })}
              </button>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
