// The chat half of the role-play sign-up: the scene's lines in real message bubbles, a chip under
// every page change (with Undo), the typing dots, and the composer.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_IMG_FRAME_CLASS, SLP_TYPE, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { SlpButton } from "../../modules/chrome/SlpButton";
import { playSlpBurst } from "../../modules/sparkle/SlpSparkle";
import { slurpBubbleSurface } from "../messages/slp-messages-contract";
import { slpScenePatchHeadline, type SlpSceneChip, type SlpSceneItem } from "./slp-scene-draft";
import type { SlpSceneModel } from "./slp-scene-model";

/** What one page change says, in the chat and on the phone's page peek: "Name set: Velvet Moth". */
export function slpScenePatchNote(
  t: (key: string, options?: Record<string, unknown>) => string,
  item: { fields: readonly SlpSceneChip["fields"][number][]; redraft: boolean },
  chip: SlpSceneChip | undefined,
) {
  if (item.redraft) return t("ui.slurp.scene.patchRedraft");
  const headline = chip ? slpScenePatchHeadline(item.fields, chip.after) : null;
  if (headline)
    return t("ui.slurp.scene.patchSet", { field: t(`ui.slurp.scene.field.${headline.field}`), value: headline.value });
  return t("ui.slurp.scene.patch", {
    fields: item.fields.map((field) => t(`ui.slurp.scene.field.${field}`)).join(", "),
  });
}

/** Chapter notes that already had their sparkle: a re-render or remount never plays it again. */
const celebratedNotes = new Set<string>();

/** A chapter got done: "Name done! Next: Photo", with a small Burst the first time it shows. */
function ChapterNote({ item }: { item: Extract<SlpSceneItem, { kind: "chapter" }> }) {
  const { t } = useUiTranslation();
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!ref.current || celebratedNotes.has(item.id)) return;
    celebratedNotes.add(item.id);
    playSlpBurst(ref.current, 8);
  }, [item.id]);
  const done = t("ui.slurp.scene.chapter.done", {
    chapters: item.chapters.map((chapter) => t(`ui.slurp.scene.chapter.${chapter}`)).join(", "),
  });
  const next =
    !item.next || item.next === "live"
      ? t("ui.slurp.scene.chapter.ready")
      : t("ui.slurp.scene.chapter.next", { chapter: t(`ui.slurp.scene.chapter.${item.next}`) });
  return (
    <div
      ref={ref}
      data-slp-scene-chapter=""
      className="slp-chapter-in my-2 flex max-w-full shrink-0 items-center gap-2 self-center rounded-full bg-[image:var(--slurp-nav-active)] py-1.5 ps-2 pe-3.5 shadow-[var(--slurp-glow),var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-accent)]/45"
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)]">
        <SlpSparkleGlyph size={13} filled aria-hidden="true" className="!text-current" />
      </span>
      <span className="min-w-0 truncate text-xs font-bold text-[var(--slurp-text)]">{done}</span>
      <span className="shrink-0 text-xs text-[var(--slurp-muted)]">{next}</span>
    </div>
  );
}

export type SlpSceneSpeakerView = { name: string; avatarUrl: string | null; mine: boolean };

export function SlpSceneChat({
  model,
  host,
  newcomer,
  placeholder,
  children,
}: {
  model: SlpSceneModel;
  host: SlpSceneSpeakerView;
  newcomer: SlpSceneSpeakerView;
  placeholder: string;
  /** Rows between the chat and the composer (suggested actions). */
  children?: ReactNode;
}) {
  const { t } = useUiTranslation();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const chips = new Map(model.chips.map((chip) => [chip.id, chip]));
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [model.items.length, model.talking, model.error]);
  const typing = model.talking ? (model.setup.preset === "seat" ? host : newcomer) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("ui.slurp.scene.chatLabel")}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-2"
      >
        {model.items.map((item, index) => {
          if (item.kind === "chapter") return <ChapterNote key={item.id} item={item} />;
          if (item.kind === "note")
            return (
              <p
                key={item.id}
                className={cn(SLP_TYPE.meta, "self-center px-3 py-1 text-center text-[var(--slurp-muted)]")}
              >
                {item.text}
              </p>
            );
          if (item.kind === "whisper")
            return (
              <p
                key={item.id}
                className={cn(SLP_TYPE.meta, "max-w-[86%] self-end px-2 text-end italic text-[var(--slurp-muted)]")}
              >
                {t("ui.slurp.scene.whispered", { name: host.name, text: item.text })}
              </p>
            );
          if (item.kind === "photo")
            return (
              <figure
                key={item.id}
                className={cn(
                  SLP_IMG_FRAME_CLASS,
                  "relative my-1.5 shrink-0 self-center overflow-hidden rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]",
                  item.photo === "avatar" ? "aspect-square w-40" : "aspect-[3/1] w-full max-w-sm",
                )}
              >
                <SlurpMediaImg src={item.imageUrl} alt="" className="slp-crop-top h-full w-full object-cover" />
                <figcaption
                  className={cn(
                    SLP_TYPE.caption,
                    "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-1.5 pt-4 text-white",
                  )}
                >
                  {t(`ui.slurp.scene.photo.${item.photo}`)}
                </figcaption>
              </figure>
            );
          if (item.kind === "patch") {
            const chip = chips.get(item.chipId);
            return (
              <div
                key={item.id}
                className="my-1 flex min-h-9 max-w-full items-center gap-1 self-center rounded-full bg-[var(--slurp-tint)] ps-3 pe-1 text-xs font-semibold text-[var(--slurp-text)] shadow-[var(--slurp-highlight)]"
              >
                <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
                <span className={cn("min-w-0 truncate px-1", chip?.undone && "text-[var(--slurp-muted)] line-through")}>
                  {slpScenePatchNote(t, item, chip)}
                </span>
                {chip && !chip.undone ? (
                  <SlpButton variant="tertiary" className="min-h-9 px-2.5 text-xs" onClick={() => model.undo(chip.id)}>
                    {t("ui.slurp.scene.undo")}
                  </SlpButton>
                ) : (
                  <span className="px-2 text-[var(--slurp-muted)]">{t("ui.slurp.scene.undone")}</span>
                )}
              </div>
            );
          }
          const who = item.speaker === "host" ? host : newcomer;
          const previous = model.items[index - 1];
          const first = previous?.kind !== "line" || previous.speaker !== item.speaker;
          return (
            <div
              key={item.id}
              className={cn(
                "flex max-w-[86%] items-end gap-2 sm:max-w-[78%]",
                who.mine ? "flex-row-reverse self-end" : "self-start",
                first && "mt-1.5",
              )}
            >
              {!who.mine && (
                <span className={cn("w-8 shrink-0", !first && "invisible")} aria-hidden={!first}>
                  <Avatar account={{ displayName: who.name, avatarUrl: who.avatarUrl }} size="sm" />
                </span>
              )}
              <div className="min-w-0">
                {first && !who.mine && (
                  <p className={cn(SLP_TYPE.caption, "mb-0.5 px-2 text-[var(--slurp-muted)]")}>{who.name}</p>
                )}
                <p
                  className={cn(
                    "whitespace-pre-wrap break-words rounded-[1.25rem] px-3.5 py-2 text-[0.95rem] leading-snug sm:text-sm sm:leading-relaxed",
                    slurpBubbleSurface(who.mine),
                  )}
                >
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
        {typing && (
          <p className={cn(SLP_TYPE.meta, "mt-1 flex items-center gap-2 self-start px-2 text-[var(--slurp-muted)]")}>
            <span aria-hidden="true" className="flex gap-0.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1.5 animate-bounce rounded-full bg-[var(--noodle-accent)] motion-reduce:animate-none"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
            {t("ui.slurp.scene.typing", { name: typing.name })}
          </p>
        )}
        {model.error && !model.talking && (
          <div className="mt-1 flex items-center gap-2 self-center rounded-2xl bg-[color-mix(in_srgb,var(--slurp-danger)_10%,transparent)] py-1 ps-3 pe-1">
            <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-text)]")}>{model.error}</p>
            <SlpButton variant="tertiary" className="min-h-9 px-2.5 text-xs" onClick={() => void model.retry()}>
              <RotateCcw size={14} aria-hidden="true" />
              {t("ui.slurp.scene.retry")}
            </SlpButton>
          </div>
        )}
      </div>
      {children}
      <form
        className="flex items-center gap-2 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = text.trim();
          if (!value || model.talking) return;
          setText("");
          void model.send({ kind: "say", text: value });
        }}
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={1200}
          className="h-11 min-w-0 flex-1 rounded-full bg-[var(--slurp-surface-raised)] px-4 text-base text-[var(--slurp-text)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] outline-none placeholder:text-[var(--slurp-muted)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-sm"
        />
        <button
          type="submit"
          aria-label={t("ui.slurp.scene.send")}
          title={t("ui.slurp.scene.send")}
          disabled={!text.trim() || model.talking}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow),var(--slurp-highlight)] transition-transform duration-[var(--slurp-motion-fast)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] disabled:opacity-50 motion-reduce:transition-none [&_svg]:!text-[var(--slurp-on-accent)]"
        >
          <ArrowUp size={18} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
