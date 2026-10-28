// The live page of the role-play sign-up: a phone that shows the Creator page building up while the
// chat fills it (name, photo, bio, tags, limits, first post), the chapter rail that counts the way
// to a live page, and the page fields to edit by hand. A hand edit locks the field, so the chat
// keeps it; a locked field shows its lock and can be unlocked.
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Heart, Lock, Pencil } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  SLP_SCENE_FIELD_LIMITS,
  SLP_SCENE_SPICE,
  type SlpSceneDraft,
  type SlpSceneField,
} from "../../../../../shared/src/slp/slp-scene.js";
import { cn } from "../../../lib/utils";
import { Avatar, SLP_GROUP_CLASS, SLP_TYPE, SlurpMediaImg } from "../../base/chrome/SlpChrome";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import { slpPrefersReducedMotion } from "../../base/chrome/slp-motion";
import { SlpButton, SlpChip, SlpSegment } from "../../modules/chrome/SlpButton";
import { playSlpPop, SlpRingGlint } from "../../modules/sparkle/SlpSparkle";
import type { SlpSceneChapter, slpSceneChapters } from "./slp-scene-draft";

const ROWS: SlpSceneField[] = [
  "displayName",
  "handle",
  "bio",
  "stagePersonality",
  "appearance",
  "wardrobe",
  "locations",
  "gender",
  "tags",
  "spice",
  "turnOns",
  "hardNoes",
];
const LONG: SlpSceneField[] = ["bio", "stagePersonality", "appearance", "wardrobe", "locations"];

/**
 * The way to a live page: Name, Photo, Bio, Limits, Live. Done chapters are filled pink with a
 * check and pop when they get done; the one the chat is on now wears a ring.
 */
export function SlpSceneChapterRail({
  chapters,
  current,
}: {
  chapters: ReturnType<typeof slpSceneChapters>;
  current: SlpSceneChapter;
}) {
  const { t } = useUiTranslation();
  const dots = useRef(new Map<SlpSceneChapter, HTMLSpanElement>());
  const before = useRef(new Set(chapters.chapters.filter((chapter) => chapter.done).map((chapter) => chapter.id)));
  const doneKey = chapters.chapters.map((chapter) => (chapter.done ? chapter.id : "")).join(",");
  useEffect(() => {
    for (const chapter of chapters.chapters) {
      if (!chapter.done || before.current.has(chapter.id)) continue;
      before.current.add(chapter.id);
      const dot = dots.current.get(chapter.id);
      if (dot) playSlpPop(dot);
    }
    for (const id of [...before.current])
      if (!chapters.chapters.find((chapter) => chapter.id === id)?.done) before.current.delete(id);
    // Only a change in which chapters are done pops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey]);
  return (
    <ol
      aria-label={t("ui.slurp.scene.chapter.label", { done: chapters.done, total: chapters.total })}
      className="flex items-start"
    >
      {chapters.chapters.map((chapter, index) => {
        const now = chapter.id === current && !chapter.done;
        return (
          <li key={chapter.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index === 0 ? "invisible" : chapter.done ? "bg-[var(--noodle-accent)]" : "bg-[var(--noodle-divider)]",
                )}
              />
              <span
                ref={(node) => {
                  if (node) dots.current.set(chapter.id, node);
                }}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors duration-[var(--slurp-motion-base)] motion-reduce:transition-none",
                  chapter.done
                    ? "bg-[var(--noodle-accent)] text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow)]"
                    : now
                      ? "bg-[var(--slurp-tint)] text-[var(--slurp-ink)] ring-2 ring-[var(--noodle-accent)]"
                      : "text-[var(--slurp-muted)] ring-1 ring-inset ring-[var(--noodle-divider)]",
                )}
              >
                {chapter.done ? (
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" className="!text-current" />
                ) : chapter.id === "live" ? (
                  <SlpSparkleGlyph size={13} aria-hidden="true" className="!text-current" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index === chapters.chapters.length - 1
                    ? "invisible"
                    : chapters.chapters[index + 1]?.done
                      ? "bg-[var(--noodle-accent)]"
                      : "bg-[var(--noodle-divider)]",
                )}
              />
            </span>
            <span
              aria-current={now ? "step" : undefined}
              className={cn(
                "max-w-full truncate text-xs",
                chapter.done || now ? "font-semibold text-[var(--slurp-text)]" : "text-[var(--slurp-muted)]",
              )}
            >
              {t(`ui.slurp.scene.chapter.${chapter.id}`)}
              <span className="sr-only">{chapter.done ? ` ${t("ui.slurp.scene.progress.done")}` : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Where the first post is: not yet (before live), being written, up, or coming later. */
export type SlpSceneFirstPost = "none" | "writing" | "posted" | "later";

/** A placeholder bar for a part of the page the chat has not filled yet. */
function BlankBar({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("block h-2 rounded-full bg-[var(--noodle-divider)]", className)} />;
}

/**
 * The new Creator's page on a phone: every part shows a soft placeholder until the chat fills it,
 * then lights up. `live` puts the LIVE mark and the story ring on it for the finale.
 */
export function SlpScenePhone({
  draft,
  recent,
  recentKey,
  avatarUrl,
  bannerUrl,
  live = false,
  firstPost = "none",
  large = false,
  phoneRef,
}: {
  draft: SlpSceneDraft;
  recent: readonly SlpSceneField[];
  recentKey?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  live?: boolean;
  firstPost?: SlpSceneFirstPost;
  large?: boolean;
  phoneRef?: React.Ref<HTMLDivElement>;
}) {
  const { t } = useUiTranslation();
  const glow = (...fields: SlpSceneField[]) => fields.some((field) => recent.includes(field));
  // A part the newest patch changed remounts (new key), so its glow plays again for the next one.
  const partKey = (...fields: SlpSceneField[]) => (glow(...fields) ? `${fields[0]}-${recentKey}` : fields[0]);
  const partGlow = (...fields: SlpSceneField[]) => cn("rounded-lg", glow(...fields) && "slp-field-glow");
  // A live page has no placeholders: what the chat never filled is simply not there.
  const Blank = ({ className }: { className: string }) => (live ? null : <BlankBar className={className} />);
  const name = draft.displayName.trim();
  const limits = [draft.spice ? t(`ui.slurp.scene.spice.${draft.spice}`) : "", draft.turnOns.trim()]
    .filter(Boolean)
    .join(" · ");
  const postRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (firstPost === "posted" && postRef.current) playSlpPop(postRef.current);
  }, [firstPost]);
  return (
    <div
      ref={phoneRef}
      aria-hidden="true"
      className={cn(
        "relative mx-auto w-full shrink-0 rounded-[2.25rem] bg-[var(--slurp-canvas)] p-2 shadow-[var(--slurp-shadow-floating),var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-divider)]",
        large ? "max-w-[18rem]" : "max-w-[16.5rem]",
        live && "shadow-[var(--slurp-glow),var(--slurp-shadow-floating)]",
      )}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-[var(--slurp-surface)] pb-3">
        <span className="absolute left-1/2 top-1.5 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-[var(--slurp-canvas)]" />
        <div
          key={partKey("locations", "wardrobe")}
          className={cn(
            partGlow("locations", "wardrobe"),
            "relative h-24 rounded-none bg-[image:var(--slurp-nav-active)]",
          )}
        >
          {bannerUrl && (
            <SlurpMediaImg
              src={bannerUrl}
              alt=""
              className="slp-crop-top absolute inset-0 h-full w-full object-cover"
            />
          )}
          {live && (
            <span className="slp-live-in absolute end-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-[var(--noodle-accent)] px-2 py-0.5 text-[11px] font-bold text-[var(--slurp-on-accent)] shadow-[var(--slurp-glow)]">
              <span className="size-1.5 rounded-full bg-[var(--slurp-on-accent)]" />
              {t("ui.slurp.scene.phone.live")}
            </span>
          )}
        </div>
        <div className="-mt-9 flex flex-col items-center px-4 text-center">
          <span
            className={cn("relative rounded-full", glow("appearance") && "slp-field-glow")}
            key={glow("appearance") ? `look-${recentKey}` : "look"}
          >
            <Avatar
              account={{ displayName: name || "?", avatarUrl: avatarUrl ?? null }}
              className="h-[4.5rem] w-[4.5rem] ring-4 ring-[var(--slurp-surface)]"
            />
            {live && <SlpRingGlint />}
          </span>
          <div
            key={partKey("displayName", "handle")}
            className={cn(partGlow("displayName", "handle"), "mt-2 w-full px-1")}
          >
            {name ? (
              <p className={cn(SLP_TYPE.title, "truncate")}>{name}</p>
            ) : (
              <Blank className="mx-auto mt-1 h-3 w-28" />
            )}
            {draft.handle.trim() ? (
              <p className={cn(SLP_TYPE.meta, "truncate text-[var(--slurp-muted)]")}>@{draft.handle.trim()}</p>
            ) : (
              <Blank className="mx-auto mt-2 w-16" />
            )}
          </div>
          <div key={partKey("bio")} className={cn(partGlow("bio"), "mt-2 w-full px-1")}>
            {draft.bio.trim() ? (
              <p className={cn(SLP_TYPE.meta, "line-clamp-3 text-pretty text-[var(--slurp-text)]")}>
                {draft.bio.trim()}
              </p>
            ) : (
              <span className="flex flex-col items-center gap-1.5 py-1">
                <Blank className="w-44" />
                <Blank className="w-32" />
              </span>
            )}
          </div>
          <div
            key={partKey("tags", "gender")}
            className={cn(partGlow("tags", "gender"), "mt-2 flex w-full flex-wrap justify-center gap-1")}
          >
            {draft.tags.length ? (
              draft.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--slurp-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--slurp-text)]"
                >
                  {tag}
                </span>
              ))
            ) : (
              <>
                <Blank className="h-4 w-12" />
                <Blank className="h-4 w-10" />
                <Blank className="h-4 w-14" />
              </>
            )}
          </div>
          <div
            key={partKey("spice", "turnOns", "hardNoes")}
            className={cn(partGlow("spice", "turnOns", "hardNoes"), "mt-2 w-full px-1")}
          >
            {limits ? (
              <p className="truncate text-[11px] font-semibold text-[var(--slurp-ink)]">{limits}</p>
            ) : (
              <Blank className="mx-auto w-24" />
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 px-2">
          <span
            ref={postRef}
            className={cn(
              "relative grid aspect-square place-items-center overflow-hidden rounded-lg text-center text-[11px] font-semibold",
              firstPost === "posted"
                ? "bg-[image:var(--slurp-nav-active)] text-[var(--slurp-text)]"
                : firstPost === "writing"
                  ? "bg-[var(--slurp-surface-raised)] text-[var(--slurp-muted)]"
                  : "border border-dashed border-[var(--noodle-divider)] text-[var(--slurp-muted)]",
            )}
          >
            {firstPost === "writing" && <span className="slp-image-shimmer" />}
            <span className="relative flex flex-col items-center gap-0.5 px-1">
              {firstPost === "posted" && (
                <Heart size={14} aria-hidden="true" className="fill-current text-[var(--noodle-accent)]" />
              )}
              {t(`ui.slurp.scene.phone.post.${firstPost}`)}
            </span>
          </span>
          <span className="aspect-square rounded-lg bg-[var(--slurp-surface-raised)] opacity-60" />
          <span className="aspect-square rounded-lg bg-[var(--slurp-surface-raised)] opacity-40" />
        </div>
      </div>
    </div>
  );
}

export function SlpScenePreview({
  draft,
  locked,
  fixed,
  recent,
  recentKey,
  allowedTags,
  avatarUrl,
  bannerUrl,
  editOpen = false,
  onEdit,
  onToggleLock,
}: {
  draft: SlpSceneDraft;
  locked: readonly SlpSceneField[];
  /** Fields the page cannot change at all (an open page's public name and handle). */
  fixed: readonly SlpSceneField[];
  /** Fields the newest patch changed, marked for a moment. */
  recent: readonly SlpSceneField[];
  /** Changes with every new patch, so the glow plays again for the next one. */
  recentKey?: string;
  allowedTags: readonly string[];
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  /** The field list starts open (the phone's page sheet, opened on purpose). */
  editOpen?: boolean;
  onEdit: <F extends SlpSceneField>(field: F, value: SlpSceneDraft[F]) => void;
  onToggleLock: (field: SlpSceneField) => void;
}) {
  const { t } = useUiTranslation();
  const [editing, setEditing] = useState<SlpSceneField | null>(null);
  const [open, setOpen] = useState(editOpen);
  const glow = (field: SlpSceneField) => recent.includes(field);
  const firstRecent = ROWS.find(glow);
  return (
    <section aria-label={t("ui.slurp.scene.page.title.page")} className="flex min-h-0 flex-col gap-3">
      <SlpScenePhone draft={draft} recent={recent} recentKey={recentKey} avatarUrl={avatarUrl} bannerUrl={bannerUrl} />
      <div className="rounded-2xl bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center gap-2 rounded-2xl px-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)]"
        >
          <Pencil size={14} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />
          <span className={cn(SLP_TYPE.body, "flex-1 font-semibold")}>{t("ui.slurp.scene.page.editByHand")}</span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn("shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")}
          />
        </button>
        {open && (
          <div className="pb-1">
            <p className={cn(SLP_TYPE.meta, "px-4 pb-2 text-pretty text-[var(--slurp-muted)]")}>
              {t("ui.slurp.scene.page.lockHint")}
            </p>
            <ul className={cn(SLP_GROUP_CLASS, "rounded-t-none shadow-none")}>
              {ROWS.map((field) => (
                <FieldRow
                  // A new patch remounts the row it changed, so its glow plays again.
                  key={glow(field) ? `${field}-${recentKey}` : field}
                  field={field}
                  draft={draft}
                  locked={locked.includes(field)}
                  fixed={fixed.includes(field)}
                  recent={recent.includes(field)}
                  scrollTo={field === firstRecent}
                  editing={editing === field}
                  allowedTags={allowedTags}
                  onEditStart={() => setEditing(field)}
                  onEditEnd={() => setEditing(null)}
                  onEdit={onEdit}
                  onToggleLock={() => onToggleLock(field)}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function FieldRow({
  field,
  draft,
  locked,
  fixed,
  recent,
  scrollTo,
  editing,
  allowedTags,
  onEditStart,
  onEditEnd,
  onEdit,
  onToggleLock,
}: {
  field: SlpSceneField;
  draft: SlpSceneDraft;
  locked: boolean;
  fixed: boolean;
  recent: boolean;
  /** This row is the first one the newest patch changed. */
  scrollTo: boolean;
  editing: boolean;
  allowedTags: readonly string[];
  onEditStart: () => void;
  onEditEnd: () => void;
  onEdit: <F extends SlpSceneField>(field: F, value: SlpSceneDraft[F]) => void;
  onToggleLock: () => void;
}) {
  const { t } = useUiTranslation();
  const label = t(`ui.slurp.scene.field.${field}`);
  const value = draft[field];
  // The first field the chat just filled scrolls into view, so its glow is seen (rows remount per patch).
  const rowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (scrollTo)
      rowRef.current?.scrollIntoView({ block: "nearest", behavior: slpPrefersReducedMotion() ? "auto" : "smooth" });
  }, [scrollTo]);
  const shown =
    field === "gender"
      ? draft.gender && t(`ui.slurp.scene.gender.${draft.gender}`)
      : field === "spice"
        ? draft.spice && t(`ui.slurp.scene.spice.${draft.spice}`)
        : field === "tags"
          ? draft.tags.join(" · ")
          : (value as string);
  return (
    <li
      ref={rowRef}
      className={cn(
        "px-4 py-2.5 transition-colors duration-[var(--slurp-motion-slow)] motion-reduce:transition-none",
        recent && "slp-field-glow bg-[var(--slurp-tint)]",
      )}
    >
      <div className="flex items-center gap-1">
        <span
          className={cn(SLP_TYPE.meta, "flex min-w-0 flex-1 items-center gap-1 truncate text-[var(--slurp-muted)]")}
        >
          {recent && <SlpSparkleGlyph size={12} aria-hidden="true" className="shrink-0 text-[var(--slurp-ink)]" />}
          <span className="truncate">{label}</span>
          {fixed && <span className="shrink-0 ps-0.5">· {t("ui.slurp.scene.page.publicName")}</span>}
        </span>
        {!fixed && !editing && (
          <>
            {/* Only a locked field shows its lock (tap to unlock); an edit locks the field by itself. */}
            {locked && (
              <IconButton label={t("ui.slurp.scene.page.unlock", { field: label })} pressed onClick={onToggleLock}>
                <Lock size={14} aria-hidden="true" />
              </IconButton>
            )}
            <IconButton label={t("ui.slurp.scene.page.edit", { field: label })} onClick={onEditStart}>
              <Pencil size={14} aria-hidden="true" />
            </IconButton>
          </>
        )}
      </div>
      {editing ? (
        <FieldEditor
          field={field}
          draft={draft}
          allowedTags={allowedTags}
          onSave={(next) => {
            onEdit(field, next as never);
            onEditEnd();
          }}
          onCancel={onEditEnd}
        />
      ) : (
        <p
          className={cn(
            SLP_TYPE.body,
            "line-clamp-4 whitespace-pre-wrap break-words text-pretty",
            !shown && "text-[var(--slurp-muted)]",
          )}
        >
          {shown || t("ui.slurp.scene.page.empty")}
        </p>
      )}
    </li>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] [&_svg]:!text-current",
        pressed ? "text-[var(--slurp-ink)]" : "text-[var(--slurp-muted)]",
      )}
    >
      {children}
    </button>
  );
}

function FieldEditor({
  field,
  draft,
  allowedTags,
  onSave,
  onCancel,
}: {
  field: SlpSceneField;
  draft: SlpSceneDraft;
  allowedTags: readonly string[];
  onSave: (value: SlpSceneDraft[SlpSceneField]) => void;
  onCancel: () => void;
}) {
  const { t } = useUiTranslation();
  const [value, setValue] = useState<SlpSceneDraft[SlpSceneField]>(draft[field]);
  const label = t(`ui.slurp.scene.field.${field}`);
  const inputClass =
    "mt-1.5 w-full rounded-xl bg-[var(--slurp-canvas)] px-3 py-2 text-base text-[var(--slurp-text)] outline-none ring-1 ring-inset ring-[var(--noodle-divider)] focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] sm:text-[13px]";
  return (
    <div>
      {field === "gender" ? (
        <SlpSegment
          className="mt-1.5"
          label={label}
          value={(value as SlpSceneDraft["gender"]) ?? "other"}
          onChange={setValue}
          options={(["female", "male", "other"] as const).map((option) => ({
            value: option,
            label: t(`ui.slurp.scene.gender.${option}`),
          }))}
        />
      ) : field === "spice" ? (
        <SlpSegment
          className="mt-1.5"
          label={label}
          value={(value as SlpSceneDraft["spice"]) ?? "flirty"}
          onChange={setValue}
          options={SLP_SCENE_SPICE.map((option) => ({ value: option, label: t(`ui.slurp.scene.spice.${option}`) }))}
        />
      ) : field === "tags" ? (
        <div role="group" aria-label={label} className="mt-1.5 flex flex-wrap gap-1.5">
          {allowedTags.map((tag) => {
            const selected = (value as string[]).includes(tag);
            return (
              <SlpChip
                key={tag}
                selected={selected}
                className="min-h-9 px-3"
                onClick={() =>
                  setValue(
                    selected
                      ? (value as string[]).filter((entry) => entry !== tag)
                      : [...(value as string[]), tag].slice(0, 8),
                  )
                }
              >
                {tag}
              </SlpChip>
            );
          })}
        </div>
      ) : LONG.includes(field) ? (
        <textarea
          aria-label={label}
          value={value as string}
          maxLength={SLP_SCENE_FIELD_LIMITS[field as keyof typeof SLP_SCENE_FIELD_LIMITS]}
          rows={4}
          onChange={(event) => setValue(event.target.value)}
          className={cn(inputClass, "resize-y")}
        />
      ) : (
        <input
          aria-label={label}
          value={value as string}
          maxLength={SLP_SCENE_FIELD_LIMITS[field as keyof typeof SLP_SCENE_FIELD_LIMITS]}
          onChange={(event) => setValue(event.target.value)}
          className={inputClass}
        />
      )}
      <div className="mt-2 flex justify-end gap-1.5">
        <SlpButton variant="tertiary" className="min-h-9" onClick={onCancel}>
          {t("ui.slurp.scene.page.cancel")}
        </SlpButton>
        <SlpButton className="min-h-9" onClick={() => onSave(value)}>
          {t("ui.slurp.scene.page.save")}
        </SlpButton>
      </div>
    </div>
  );
}
