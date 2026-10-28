import { useEffect, useState, type ReactNode } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import {
  normalizeSlpCreatorPage,
  SLP_CREATOR_PAGE_BLOCK_KINDS,
  SLP_CREATOR_PAGE_COLLAGE_LAYOUTS,
  SLP_CREATOR_PAGE_LIMITS as L,
  SLP_CREATOR_PAGE_THEMES,
  type SlpCreatorPage,
  type SlpCreatorPageBlock,
  type SlpCreatorPageBlockKind,
} from "../../../../../shared/src/slp/slp-creator-page.js";
import { cn } from "../../../lib/utils";
import { SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { SlpButton, SlpChip, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpSheet } from "../../modules/chrome/SlpSheet";
import type { SlpPagePicture } from "../../modules/creator/slp-creator-page-data";
import { useComposeSlurpCreatorPage, useSaveSlurpCreatorPage } from "./slp-creator-page-hooks";

const FIELD =
  "w-full rounded-xl bg-[var(--slurp-surface)] px-3 py-2.5 text-base outline-none ring-1 ring-inset ring-[var(--noodle-divider)] placeholder:text-[var(--slurp-muted)] focus:ring-2 focus:ring-[var(--slurp-focus)] sm:text-sm";
const LABEL = "mb-1.5 block text-xs font-semibold text-[var(--slurp-muted)]";
const ICON_BUTTON =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--slurp-muted)] hover:bg-[var(--accent)] hover:text-[var(--slurp-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-35";

/** The block a player adds, before they type anything into it. */
function emptyBlock(kind: SlpCreatorPageBlockKind, id: string): SlpCreatorPageBlock {
  switch (kind) {
    case "quote":
      return { id, kind, text: "" };
    case "now":
      return { id, kind, text: "", at: new Date().toISOString() };
    case "collage":
      return { id, kind, title: "", layout: "bento", postIds: [] };
    case "list":
      return { id, kind, title: "", style: "bullets", items: [""] };
    case "thisOrThat":
      return { id, kind, title: "", pairs: [{ left: "", right: "", pick: "left" }] };
    case "qa":
      return { id, kind, title: "", items: [{ question: "", answer: "" }] };
    default:
      return { id, kind, title: "" };
  }
}

const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The Page editor: pick a look, add, order, fill and remove blocks, or let the Creator design it.
 * Works on a draft; nothing is saved until Save. Words only: facts, prices, people and the poll are
 * filled from real data, so those blocks keep just a title here.
 */
export function SlpCreatorPageEditor({
  open,
  onClose,
  accountId,
  name,
  page,
  pictures,
  canCompose,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  name: string;
  page: SlpCreatorPage | null;
  /** The Creator's own pictures, for a hand-picked collage. */
  pictures: SlpPagePicture[];
  canCompose: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const save = useSaveSlurpCreatorPage();
  const compose = useComposeSlurpCreatorPage();
  const [theme, setTheme] = useState<SlpCreatorPage["theme"]>(page?.theme ?? "slurp");
  const [blocks, setBlocks] = useState<SlpCreatorPageBlock[]>(page?.blocks ?? []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTheme(page?.theme ?? "slurp");
    setBlocks(page?.blocks ?? []);
    setOpenId(null);
    setConfirmRemove(false);
    // Reset only when the sheet opens: a background refetch must not wipe what the player typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const kindLabel = (kind: SlpCreatorPageBlockKind) => localizeUi(`ui.slurp.page.kind.${kind}`, { defaultValue: kind });
  const update = (id: string, patch: Partial<SlpCreatorPageBlock>) =>
    setBlocks((current) =>
      current.map((block) => (block.id === id ? ({ ...block, ...patch } as SlpCreatorPageBlock) : block)),
    );
  const move = (index: number, by: number) =>
    setBlocks((current) => {
      const next = [...current];
      const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const add = (kind: SlpCreatorPageBlockKind) => {
    const block = emptyBlock(kind, newId());
    setBlocks((current) => [...current, block]);
    setOpenId(block.id);
  };
  const busy = save.isPending || compose.isPending;
  const onSave = () => {
    const now = new Date().toISOString();
    const draft = normalizeSlpCreatorPage({ theme, blocks, composedBy: "player", updatedAt: now });
    if (!draft) {
      toast.error(localizeUi("ui.slurp.page.emptyError", { defaultValue: "Add at least one block with words in it." }));
      return;
    }
    save.mutate(
      { accountId, page: draft },
      {
        onSuccess: () => {
          const dropped = blocks.length - draft.blocks.length;
          if (dropped > 0)
            toast(
              localizeUi("ui.slurp.page.droppedEmpty", { defaultValue: "Empty blocks were left out.", count: dropped }),
            );
          onClose();
        },
        onError: () =>
          toast.error(localizeUi("ui.slurp.page.saveError", { defaultValue: "The page could not be saved." })),
      },
    );
  };
  // Two taps: the first arms it, so one stray tap cannot throw away a page the player wrote.
  const onRemovePage = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    save.mutate(
      { accountId, page: null },
      {
        onSuccess: onClose,
        onError: () =>
          toast.error(localizeUi("ui.slurp.page.saveError", { defaultValue: "The page could not be saved." })),
      },
    );
  };
  const onCompose = () =>
    compose.mutate(accountId, {
      onSuccess: (result) => {
        setTheme(result.page.theme);
        setBlocks(result.page.blocks);
        setOpenId(null);
        toast(localizeUi("ui.slurp.page.composed", { defaultValue: "{{name}} redesigned the page.", name }));
      },
      onError: (error) =>
        toast.error(
          error instanceof Error && error.message
            ? error.message
            : localizeUi("ui.slurp.page.composeError", { defaultValue: "The page could not be designed. Try again." }),
        ),
    });

  return (
    <SlpSheet
      open={open}
      onClose={onClose}
      closeDisabled={busy}
      size="full"
      width="max-w-lg"
      title={localizeUi("ui.slurp.page.editTitle", { defaultValue: "Edit {{name}}'s page", name })}
      footer={
        <div className="flex items-center gap-2">
          {page && (
            <SlpButton variant="danger" disabled={busy} onClick={onRemovePage} className="min-h-11 px-4 text-sm">
              <Trash2 size={16} aria-hidden="true" />
              {confirmRemove
                ? localizeUi("ui.slurp.page.removeConfirm", { defaultValue: "Tap again to remove" })
                : localizeUi("ui.slurp.page.remove", { defaultValue: "Remove page" })}
            </SlpButton>
          )}
          <SlpPrimaryButton disabled={busy} onClick={onSave} className="ms-auto min-h-11 px-6">
            {save.isPending ? localizeUi("ui.noodle.noodlehome.saving") : localizeUi("ui.noodle.noodlehome.save")}
          </SlpPrimaryButton>
        </div>
      }
    >
      <div className="space-y-6 pb-4">
        {canCompose && (
          <div className="rounded-2xl bg-[var(--slurp-surface-raised)] p-4 shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
            <p className="text-sm font-bold">
              {localizeUi("ui.slurp.page.composeTitle", { defaultValue: "Let {{name}} design it", name })}
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--slurp-muted)]">
              {localizeUi("ui.slurp.page.composeHint", {
                defaultValue:
                  "{{name}} picks a look and writes the page in their own voice. It replaces this page and uses one AI call.",
                name,
              })}
            </p>
            <SlpButton disabled={busy} onClick={onCompose} className="mt-3 min-h-11 px-4 text-sm">
              {compose.isPending
                ? localizeUi("ui.slurp.page.composing", { defaultValue: "{{name}} is designing…", name })
                : localizeUi("ui.slurp.page.compose", { defaultValue: "Let {{name}} design it", name })}
            </SlpButton>
          </div>
        )}

        <section>
          <h3 className="mb-2 text-sm font-bold">{localizeUi("ui.slurp.page.look", { defaultValue: "Look" })}</h3>
          <div
            role="group"
            aria-label={localizeUi("ui.slurp.page.look", { defaultValue: "Look" })}
            className="grid grid-cols-3 gap-2"
          >
            {SLP_CREATOR_PAGE_THEMES.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={theme === id}
                data-theme={id}
                onClick={() => setTheme(id)}
                className="slp-page slp-page-swatch"
              >
                <span className="slp-page-swatch-name">
                  {localizeUi(`ui.slurp.page.theme.${id}`, { defaultValue: id })}
                </span>
                <span className="slp-page-swatch-dots" aria-hidden="true">
                  <span />
                  <span />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-bold">{localizeUi("ui.slurp.page.blocks", { defaultValue: "Blocks" })}</h3>
          {blocks.length === 0 && (
            <p className="rounded-xl px-3 py-4 text-center text-sm text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--noodle-divider)]">
              {localizeUi("ui.slurp.page.noBlocks", { defaultValue: "No blocks yet. Add one below." })}
            </p>
          )}
          <ol className="space-y-2">
            {blocks.map((block, index) => {
              const expanded = openId === block.id;
              return (
                <li
                  key={block.id}
                  className="rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]"
                >
                  <div className="flex items-center gap-1 ps-2">
                    <button
                      type="button"
                      onClick={() => setOpenId(expanded ? null : block.id)}
                      aria-expanded={expanded}
                      className="flex min-h-12 min-w-0 flex-1 flex-col justify-center rounded-xl px-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
                    >
                      <span className="text-sm font-bold">{kindLabel(block.kind)}</span>
                      <span className="truncate text-xs text-[var(--slurp-muted)]">{blockSummary(block) || "—"}</span>
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={localizeUi("ui.slurp.page.moveUp", { defaultValue: "Move up" })}
                    >
                      <ChevronUp size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      disabled={index === blocks.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={localizeUi("ui.slurp.page.moveDown", { defaultValue: "Move down" })}
                    >
                      <ChevronDown size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={ICON_BUTTON}
                      onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}
                      aria-label={localizeUi("ui.slurp.page.removeBlock", {
                        defaultValue: "Remove {{kind}}",
                        kind: kindLabel(block.kind),
                      })}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {expanded && (
                    <div className="space-y-3 border-t border-[var(--noodle-divider)] p-3">
                      <BlockFields
                        block={block}
                        onChange={(patch) => update(block.id, patch)}
                        pictures={pictures}
                        name={name}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {blocks.length < L.blocks && (
            <div className="mt-3">
              <p className={LABEL}>{localizeUi("ui.slurp.page.addBlock", { defaultValue: "Add a block" })}</p>
              <div className="flex flex-wrap gap-2">
                {SLP_CREATOR_PAGE_BLOCK_KINDS.map((kind) => (
                  <SlpChip key={kind} onClick={() => add(kind)}>
                    <Plus size={14} aria-hidden="true" />
                    {kindLabel(kind)}
                  </SlpChip>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </SlpSheet>
  );
}

function blockSummary(block: SlpCreatorPageBlock): string {
  switch (block.kind) {
    case "quote":
    case "now":
      return block.text;
    case "list":
      return block.title || block.items.filter(Boolean).join(" · ");
    case "thisOrThat":
      return block.title || block.pairs.map((pair) => `${pair.left} / ${pair.right}`).join(" · ");
    case "qa":
      return block.title || block.items[0]?.question || "";
    default:
      return block.title;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function BlockFields({
  block,
  onChange,
  pictures,
  name,
}: {
  block: SlpCreatorPageBlock;
  onChange: (patch: Partial<SlpCreatorPageBlock>) => void;
  pictures: SlpPagePicture[];
  name: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const title =
    "title" in block ? (
      <Field label={localizeUi("ui.slurp.page.field.title", { defaultValue: "Title" })}>
        <input
          className={FIELD}
          value={block.title}
          maxLength={L.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Field>
    ) : null;
  switch (block.kind) {
    case "quote":
    case "now":
      return (
        <Field
          label={
            block.kind === "quote"
              ? localizeUi("ui.slurp.page.field.quote", { defaultValue: "The line" })
              : localizeUi("ui.slurp.page.field.now", { defaultValue: "What's new (hides after 10 days)" })
          }
        >
          <textarea
            className={cn(FIELD, "min-h-20 resize-y")}
            value={block.text}
            maxLength={block.kind === "quote" ? L.quote : L.now}
            onChange={(event) =>
              onChange(
                block.kind === "now"
                  ? { text: event.target.value, at: new Date().toISOString() }
                  : { text: event.target.value },
              )
            }
          />
        </Field>
      );
    case "list":
      return (
        <>
          {title}
          <div className="flex gap-2">
            {(["bullets", "numbered"] as const).map((style) => (
              <SlpChip key={style} selected={block.style === style} onClick={() => onChange({ style })}>
                {localizeUi(`ui.slurp.page.style.${style}`, { defaultValue: style })}
              </SlpChip>
            ))}
          </div>
          <Field
            label={localizeUi("ui.slurp.page.field.items", {
              defaultValue: "One line each (up to {{count}})",
              count: L.listItems,
            })}
          >
            <textarea
              className={cn(FIELD, "min-h-28 resize-y")}
              value={block.items.join("\n")}
              onChange={(event) => onChange({ items: event.target.value.split("\n").slice(0, L.listItems) })}
            />
          </Field>
        </>
      );
    case "thisOrThat":
      return (
        <>
          {title}
          {block.pairs.map((pair, index) => {
            const set = (patch: Partial<typeof pair>) =>
              onChange({ pairs: block.pairs.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
            return (
              <div key={index} className="flex items-center gap-2">
                {(["left", "right"] as const).map((side) => (
                  <input
                    key={side}
                    className={cn(FIELD, "min-w-0 flex-1", pair.pick === side && "ring-2 ring-[var(--noodle-accent)]")}
                    value={pair[side]}
                    maxLength={L.pairSide}
                    onChange={(event) => set({ [side]: event.target.value })}
                    aria-label={localizeUi(`ui.slurp.page.field.${side}`, { defaultValue: side })}
                  />
                ))}
                <SlpChip
                  onClick={() => set({ pick: pair.pick === "left" ? "right" : "left" })}
                  aria-label={localizeUi("ui.slurp.page.field.pickIs", {
                    defaultValue: "Picked: {{side}}. Switch the pick",
                    side: pair.pick === "left" ? pair.left : pair.right,
                  })}
                >
                  {pair.pick === "left" ? "◀" : "▶"}
                </SlpChip>
              </div>
            );
          })}
          {block.pairs.length < L.pairs && (
            <SlpButton
              variant="tertiary"
              className="min-h-11 text-sm"
              onClick={() => onChange({ pairs: [...block.pairs, { left: "", right: "", pick: "left" }] })}
            >
              <Plus size={14} aria-hidden="true" />
              {localizeUi("ui.slurp.page.addPair", { defaultValue: "Add a pair" })}
            </SlpButton>
          )}
        </>
      );
    case "qa":
      return (
        <>
          {title}
          {block.items.map((item, index) => {
            const set = (patch: Partial<typeof item>) =>
              onChange({ items: block.items.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)) });
            return (
              <div key={index} className="space-y-2 rounded-xl p-2 ring-1 ring-inset ring-[var(--noodle-divider)]">
                <input
                  className={FIELD}
                  value={item.question}
                  maxLength={L.question}
                  placeholder={localizeUi("ui.slurp.page.field.question", { defaultValue: "A fan's question" })}
                  aria-label={localizeUi("ui.slurp.page.field.question", { defaultValue: "A fan's question" })}
                  onChange={(event) => set({ question: event.target.value })}
                />
                <textarea
                  className={cn(FIELD, "min-h-16 resize-y")}
                  value={item.answer}
                  maxLength={L.answer}
                  placeholder={localizeUi("ui.slurp.page.field.answer", { defaultValue: "The answer" })}
                  aria-label={localizeUi("ui.slurp.page.field.answer", { defaultValue: "The answer" })}
                  onChange={(event) => set({ answer: event.target.value })}
                />
              </div>
            );
          })}
          {block.items.length < L.qaItems && (
            <SlpButton
              variant="tertiary"
              className="min-h-11 text-sm"
              onClick={() => onChange({ items: [...block.items, { question: "", answer: "" }] })}
            >
              <Plus size={14} aria-hidden="true" />
              {localizeUi("ui.slurp.page.addQuestion", { defaultValue: "Add a question" })}
            </SlpButton>
          )}
        </>
      );
    case "collage": {
      const picked = block.postIds;
      const toggle = (postId: string) =>
        onChange({
          postIds: picked.includes(postId)
            ? picked.filter((id) => id !== postId)
            : [...picked, postId].slice(0, L.collagePosts),
        });
      return (
        <>
          {title}
          <div className="flex flex-wrap gap-2">
            {SLP_CREATOR_PAGE_COLLAGE_LAYOUTS.map((layout) => (
              <SlpChip key={layout} selected={block.layout === layout} onClick={() => onChange({ layout })}>
                {localizeUi(`ui.slurp.page.layout.${layout}`, { defaultValue: layout })}
              </SlpChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <SlpChip selected={picked.length === 0} onClick={() => onChange({ postIds: [] })}>
              {localizeUi("ui.slurp.page.autoPictures", { defaultValue: "Best pictures, picked for {{name}}", name })}
            </SlpChip>
          </div>
          {pictures.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {pictures.slice(0, 24).map((picture) => {
                const order = picked.indexOf(picture.postId);
                return (
                  <button
                    key={picture.postId}
                    type="button"
                    aria-pressed={order >= 0}
                    onClick={() => toggle(picture.postId)}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]",
                      order >= 0 && "ring-2 ring-[var(--noodle-accent)]",
                    )}
                    aria-label={localizeUi("ui.slurp.page.pickPicture", { defaultValue: "Use this picture" })}
                  >
                    <SlurpMediaImg
                      src={picture.imageUrl}
                      alt=""
                      className="slp-crop-top h-full w-full object-cover"
                      loading="lazy"
                    />
                    {order >= 0 && (
                      <span className="absolute end-1 top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--noodle-accent)] px-1 text-xs font-bold text-[var(--slurp-on-accent)]">
                        {order + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      );
    }
    default:
      return (
        <>
          {title}
          <p className="text-xs leading-5 text-[var(--slurp-muted)]">
            {localizeUi("ui.slurp.page.filledIn", {
              defaultValue: "Filled in from {{name}}'s real data. It hides while there is nothing to show.",
              name,
            })}
          </p>
        </>
      );
  }
}
