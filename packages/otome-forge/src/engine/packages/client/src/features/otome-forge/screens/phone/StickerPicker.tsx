// ──────────────────────────────────────────────
// Otome Forge: chat stickers (#2044). The picker offers the protagonist's five (painted for the run with images on,
// else the built-in set) and, with images on, his painted ones (S/art/stickers.ts sendableStickers offers P17 the
// same). A bubble shows a sticker by its id from the run view's book, a labelled chip when it has no image (or the
// image fails), and a message saved before #2044 still shows his painted face (faceArt). A new sticker of his shows
// "You unlocked a new sticker" (useStickerNotice). The panel closes on Escape, on a press outside the picker, and when
// focus moves to something outside it. A press inside the picker moves no focus: Safari and iOS never focus a pressed
// button, and instead give focus to the nearest focusable ancestor (the Engine's main), which closed the panel
// before the tap's click landed, so a tapped sticker never sent. A blur with nowhere to go is ignored too.
// ponytail: the built-in set is the labelled icon chip: its emoji artwork (Codex image generation) is not shipped yet.
// Upgrade path: ship stickers/<emotion>.webp as package assets (contributions.assets) and give `yours` their URLs.
// ──────────────────────────────────────────────
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Angry,
  Flame,
  Frown,
  Heart,
  HeartCrack,
  Laugh,
  Smile,
  Snowflake,
  Sparkles,
  Sticker as StickerIcon,
  type LucideIcon,
} from "lucide-react";
import { forgeStoryExpressionArt } from "@forge-kit/story-expressions.mjs";
import { imagesOn } from "../../hooks/use-items";
import type { RunLiView, RunView, StickerView } from "../../shared/api-types";
import { FACES, isFace, type Face } from "../../shared/faces";
import {
  PLAYER_STICKERS,
  PLAYER_STICKER_OWNER,
  isPlayerSticker,
  parseStickerId,
  stickerId,
  type PlayerSticker,
} from "../../shared/stickers";
import { FACE_LABEL_KEYS } from "../reader/FacePlate";

/** His painted face, or null while it isn't painted. */
export function faceArt(li: RunLiView, face: Face): string | null {
  const shown = forgeStoryExpressionArt(
    { art: li.portrait ?? "", expressions: li.expressions ?? {} },
    { expression: face },
    FACES,
  );
  return shown.neutral !== undefined && shown.art ? shown.art : null;
}

// The reader's face icons (screens/reader/FacePlate.tsx keeps its own map private).
export const STICKER_ICONS: Record<Face, LucideIcon> = {
  tender: Heart,
  flustered: Sparkles,
  cold: Snowflake,
  hurt: HeartCrack,
  angry: Flame,
};

/** The protagonist's stickers' names (literal keys, so the locale validator sees them) and built-in icons. */
export const PLAYER_STICKER_LABEL_KEYS: Record<PlayerSticker, string> = {
  laugh: "ui.otomeForge.phone.stickerLaugh",
  love: "ui.otomeForge.phone.stickerLove",
  shy: "ui.otomeForge.phone.stickerShy",
  sad: "ui.otomeForge.phone.stickerSad",
  pout: "ui.otomeForge.phone.stickerPout",
};
const PLAYER_STICKER_ICONS: Record<PlayerSticker, LucideIcon> = {
  laugh: Laugh,
  love: Heart,
  shy: Smile,
  sad: Frown,
  pout: Angry,
};

/** A sticker as the phone shows it: its name, and its image unless it is the built-in set. */
export interface StickerChoice {
  id: string;
  label: string;
  url?: string;
  Icon: LucideIcon;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

function choiceOf(t: Translate, sticker: Pick<StickerView, "id" | "emotion" | "label" | "url">, images: boolean) {
  const player = parseStickerId(sticker.id)?.owner === PLAYER_STICKER_OWNER && isPlayerSticker(sticker.emotion);
  return {
    id: sticker.id,
    label: sticker.label || (player ? t(PLAYER_STICKER_LABEL_KEYS[sticker.emotion as PlayerSticker]) : sticker.emotion),
    // With images off the protagonist's are the built-in set.
    ...(sticker.url && (images || !player) ? { url: sticker.url } : {}),
    Icon: player ? PLAYER_STICKER_ICONS[sticker.emotion as PlayerSticker] : StickerIcon,
  };
}

/** The run's stickers: what the picker offers in his thread (`yours`, `his`) and every one a bubble may show. */
export function useStickers(view: Pick<RunView, "world" | "stickers">, li?: Pick<RunLiView, "id">) {
  const { t } = useTranslation();
  const images = imagesOn(view);
  const book = view.stickers ?? [];
  const yours = PLAYER_STICKERS.map((emotion) =>
    choiceOf(
      t,
      book.find((sticker) => sticker.owner === PLAYER_STICKER_OWNER && sticker.emotion === emotion) ?? {
        id: stickerId(PLAYER_STICKER_OWNER, emotion),
        emotion,
      },
      images,
    ),
  );
  const all = [
    ...yours,
    ...book.filter((sticker) => sticker.owner !== PLAYER_STICKER_OWNER).map((s) => choiceOf(t, s, images)),
  ];
  const his = images && li ? all.filter((sticker) => parseStickerId(sticker.id)?.owner === li.id) : [];
  return { yours, his, byId: new Map(all.map((sticker) => [sticker.id, sticker])) };
}

export type Stickers = ReturnType<typeof useStickers>;

/** A message's sticker in words: an old face's name, a sticker's own, or its emotion. */
export function stickerLabel(t: Translate, stickers: Stickers, sticker: string): string {
  if (isFace(sticker)) return t(FACE_LABEL_KEYS[sticker]);
  const known = stickers.byId.get(sticker);
  if (known) return known.label;
  const parsed = parseStickerId(sticker);
  if (parsed?.owner === PLAYER_STICKER_OWNER && isPlayerSticker(parsed.emotion))
    return t(PLAYER_STICKER_LABEL_KEYS[parsed.emotion]);
  return parsed?.emotion ?? "";
}

interface StickerPickerProps {
  stickers: Stickers;
  /** His name, for his section's title. */
  name: string;
  disabled: boolean;
  onPick: (id: string) => void;
}

export function StickerPicker({ stickers, name, disabled, onPick }: StickerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (wrap.current && !event.composedPath().includes(wrap.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close(true);
  };
  const label = t("ui.otomeForge.phone.stickers");
  const group = (title: string, choices: StickerChoice[]) => (
    <div className="of-sticker-group" role="group" aria-label={title}>
      <p className="of-sticker-group-title" aria-hidden="true">
        {title}
      </p>
      <div className="of-sticker-grid">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            className="of-sticker-choice"
            data-kind={choice.url ? "chibi" : "builtin"}
            aria-label={t("ui.otomeForge.phone.stickerSend", { face: choice.label })}
            title={choice.label}
            onClick={() => {
              close(false);
              onPick(choice.id);
            }}
          >
            {choice.url ? (
              <img src={choice.url} alt="" draggable={false} />
            ) : (
              <choice.Icon size={26} strokeWidth={1.8} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div
      ref={wrap}
      className="of-stickers"
      onKeyDown={onKeyDown}
      // Keeps focus where it is on a press, so the sticker's click lands (see the header); keys and clicks still work.
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        ref={trigger}
        type="button"
        className="of-icon-button of-glass"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) return;
          // Closing from here gives focus back to this button, as Escape does: a press moves no focus (see the
          // header), so the sticker that had it would otherwise leave with the panel and drop focus to the page.
          if (open) close(true);
          else setOpen(true);
        }}
      >
        <Smile size={18} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={panel}
          id={panelId}
          className="of-sticker-panel of-glass of-glass--strong"
          role="group"
          aria-label={label}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && !wrap.current?.contains(next)) setOpen(false);
          }}
        >
          {group(t("ui.otomeForge.phone.stickersYours"), stickers.yours)}
          {stickers.his.length ? group(t("ui.otomeForge.phone.stickersHis", { name }), stickers.his) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A face sticker from before #2044 in a bubble: his painted face, else the face's icon and name. */
export function Sticker({ li, face }: { li: RunLiView; face: Face }) {
  const { t } = useTranslation();
  const url = faceArt(li, face);
  const label = t("ui.otomeForge.phone.sticker", { face: t(FACE_LABEL_KEYS[face]) });
  if (url) return <img className="of-sticker" src={url} alt={label} draggable={false} />;
  const Icon = STICKER_ICONS[face];
  return (
    <span className="of-sticker of-sticker--quiet" role="img" aria-label={label} data-face={face}>
      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      <span aria-hidden="true">{t(FACE_LABEL_KEYS[face])}</span>
    </span>
  );
}

/** A #2044 sticker in a bubble: its cut-out, whole; a labelled chip without an image or when it fails to load. */
export function StickerArt({ stickers, id }: { stickers: Stickers; id: string }) {
  const { t } = useTranslation();
  const sticker = stickers.byId.get(id);
  const [broken, setBroken] = useState(false);
  const name = stickerLabel(t, stickers, id);
  const label = t("ui.otomeForge.phone.sticker", { face: name });
  if (sticker?.url && !broken) {
    return (
      <img
        className="of-sticker"
        data-kind="chibi"
        src={sticker.url}
        alt={label}
        draggable={false}
        onError={() => setBroken(true)}
      />
    );
  }
  const Icon = sticker?.Icon ?? StickerIcon;
  return (
    <span className="of-sticker of-sticker--quiet" role="img" aria-label={label}>
      <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      <span aria-hidden="true">{name}</span>
    </span>
  );
}

/** How long "You unlocked a new sticker" shows. */
export const STICKER_NOTICE_MS = 4_000;

/**
 * "You unlocked a new sticker" while the app is open: each sticker of his that appears in the run view after its
 * first read shows a notice for STICKER_NOTICE_MS. ponytail: one that lands while the app is closed is not announced;
 * upgrade path: a seen mark on the state.
 */
export function StickerNotice({ view }: { view: Pick<RunView, "runKey" | "stickers" | "lis"> }) {
  const { t } = useTranslation();
  const known = useRef<{ run: string; ids: Set<string> } | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [shown, setShown] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);
  const his = (view.stickers ?? []).filter((sticker) => sticker.owner !== PLAYER_STICKER_OWNER);
  const key = his.map((sticker) => sticker.id).join(" ");
  useEffect(() => {
    if (known.current?.run !== view.runKey) {
      known.current = { run: view.runKey, ids: new Set(his.map((sticker) => sticker.id)) };
      setShown([]);
      return;
    }
    const fresh = his.filter((sticker) => !known.current!.ids.has(sticker.id));
    if (!fresh.length) return;
    for (const sticker of fresh) known.current.ids.add(sticker.id);
    const added = fresh.map((sticker) => ({
      id: sticker.id,
      name: view.lis.find((li) => li.id === sticker.owner)?.name ?? "",
    }));
    setShown((current) => [...current, ...added]);
    // Each notice goes on its own time, whatever lands after it.
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setShown((current) => current.filter((entry) => !added.includes(entry)));
    }, STICKER_NOTICE_MS);
    timers.current.add(timer);
    // Only when his stickers or the run change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, view.runKey]);
  // Just below the lowest header on screen (the top bar, a memory banner, his thread's, the reader's), so it never
  // covers his name, Close, the reader's tools or a failed summary's Retry; the stylesheet's place until then.
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = box.current;
    const stage = element?.offsetParent;
    if (!element || !stage || !shown.length) return;
    const heads = [...stage.querySelectorAll(".of-topbar, .of-memory-banner, .of-thread-head, .of-reader-head")];
    const bottom = Math.max(...heads.map((head) => head.getBoundingClientRect().bottom));
    element.style.top = heads.length ? `${Math.round(bottom - stage.getBoundingClientRect().top + 8)}px` : "";
  }, [shown.length]);
  return (
    <div ref={box} className="of-toasts of-toasts--app" role="status">
      {shown.map((entry) => (
        <p key={entry.id} className="of-toast of-toast--cg">
          <StickerIcon size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>
            {t("ui.otomeForge.phone.stickerUnlocked")}
            {entry.name ? <span className="of-toast-note"> · {entry.name}</span> : null}
          </span>
        </p>
      ))}
    </div>
  );
}
