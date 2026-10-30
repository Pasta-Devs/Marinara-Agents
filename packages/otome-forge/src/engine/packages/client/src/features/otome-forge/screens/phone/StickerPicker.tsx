// ──────────────────────────────────────────────
// Otome Forge: his faces as stickers. Only the faces already painted (M2b's ready set on the run view, read the way
// the reader's FacePlate reads them) are offered; with none painted the picker is not shown. A sticker in a bubble
// whose face is not painted shows as a labelled chip instead. The panel closes on Escape, on a press outside the
// picker, and when focus moves to something outside it. A blur with nowhere to go is ignored: Safari and iOS never
// focus a pressed button, so pressing a sticker blurs the focused one with no target before its click lands.
// ──────────────────────────────────────────────
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Heart, HeartCrack, Smile, Snowflake, Sparkles, type LucideIcon } from "lucide-react";
import { forgeStoryExpressionArt } from "@forge-kit/story-expressions.mjs";
import type { RunLiView } from "../../shared/api-types";
import { FACES, type Face } from "../../shared/faces";
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

export function readyFaces(li: RunLiView): Array<{ face: Face; url: string }> {
  return FACES.flatMap((face) => {
    const url = faceArt(li, face);
    return url ? [{ face, url }] : [];
  });
}

// The reader's face icons (screens/reader/FacePlate.tsx keeps its own map private).
export const STICKER_ICONS: Record<Face, LucideIcon> = {
  tender: Heart,
  flustered: Sparkles,
  cold: Snowflake,
  hurt: HeartCrack,
  angry: Flame,
};

interface StickerPickerProps {
  li: RunLiView;
  disabled: boolean;
  onPick: (face: Face) => void;
}

export function StickerPicker({ li, disabled, onPick }: StickerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const faces = readyFaces(li);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (wrap.current && !event.composedPath().includes(wrap.current)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  if (faces.length === 0) return null;
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
  return (
    <div ref={wrap} className="of-stickers" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        className="of-icon-button of-glass"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={panelId}
        aria-disabled={disabled}
        onClick={() => !disabled && setOpen((value) => !value)}
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
          {faces.map(({ face, url }) => (
            <button
              key={face}
              type="button"
              className="of-sticker-choice"
              aria-label={t("ui.otomeForge.phone.stickerSend", { face: t(FACE_LABEL_KEYS[face]) })}
              onClick={() => {
                close(false);
                onPick(face);
              }}
            >
              <img src={url} alt="" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A sticker in a bubble: his painted face, else the face's icon and name. */
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
