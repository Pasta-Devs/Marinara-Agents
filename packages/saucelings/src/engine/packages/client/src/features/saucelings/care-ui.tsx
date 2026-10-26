import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SAUCELING_CREATURE_ACTIONS,
  SAUCELING_EGG_ACTIONS,
  SAUCELING_EGG_START_WARMTH,
  SAUCELING_HATCH_WAIT_MS,
  type SaucelingPet,
  type SaucelingStateResponse,
  type SaucelingUserAction,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { friendlyError, marinaraRequest, saucelingsRequest } from "./api.js";
import { breathingFigureFrom } from "./image-canvas.js";
import { useSaucelingsTranslation } from "./localization.js";

export const ACTION_ICONS: Record<SaucelingUserAction, string> = {
  feed: "🍝",
  play: "🎲",
  rest: "🌙",
  pet: "💛",
  warm: "🧣",
  talk: "💬",
  listen: "👂",
};

export const ACTION_LABEL_KEYS: Record<SaucelingUserAction, string> = {
  feed: "saucelings.action.feed",
  play: "saucelings.action.play",
  rest: "saucelings.action.rest",
  pet: "saucelings.action.pet",
  warm: "saucelings.action.warm",
  talk: "saucelings.action.talk",
  listen: "saucelings.action.listen",
};

/** An egg's care until it hatches, then the creature's. */
export function actionsFor(pet: Pick<SaucelingPet, "stage">): readonly SaucelingUserAction[] {
  return pet.stage === "egg" ? SAUCELING_EGG_ACTIONS : SAUCELING_CREATURE_ACTIONS;
}

/** Whether a button points at a gap: Feed at hunger, Play at mood, Warm at a cooling egg. */
export function actionCoversGap(action: SaucelingUserAction, gaps: SaucelingStateResponse["gaps"]): boolean {
  return (action === "feed" && gaps.hunger) || (action === "play" && gaps.mood) || (action === "warm" && gaps.warmth);
}

/** The clock, ticking every `everyMs`, so cooldowns and the hatching bar move without a reload; call
 *  `refresh` when a new cooldown arrives, or a tick up to `everyMs` old shows it a minute too long. */
export function useNow(everyMs: number): [number, () => void] {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return [now, useCallback(() => setNow(Date.now()), [])];
}

/** A value that lasts `ms`, then clears; setting it again starts the wait over. */
export function useForAMoment<T>(ms: number) {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = useCallback(
    (next: T) => {
      window.clearTimeout(timer.current);
      setValue(next);
      timer.current = window.setTimeout(() => setValue(null), ms);
    },
    [ms],
  );
  return [value, show] as const;
}

/** How long a painted caretaker holds a care pose, for their care or yours. */
export const CARE_POSE_MS = 2_000;

/** Whole minutes until an action can be used again; 0 when it is ready. */
export function cooldownMinutes(pet: SaucelingPet, action: SaucelingUserAction, nowMs: number): number {
  const until = pet.actionCooldowns[action];
  const left = until ? Date.parse(until) - nowMs : 0;
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}

export function eggWarmth(pet: Pick<SaucelingPet, "meters">): number {
  return pet.meters.warmth ?? SAUCELING_EGG_START_WARMTH;
}

/** How far an egg is through its wait, 0 to 100; it hatches at 100 once it has had any care. */
export function hatchPercent(pet: Pick<SaucelingPet, "createdAt">, nowMs: number): number {
  const waited = nowMs - Date.parse(pet.createdAt);
  return Math.max(0, Math.min(100, Math.floor((waited / SAUCELING_HATCH_WAIT_MS) * 100)));
}

/** When a cared-for egg is due to hatch, so the view can fetch the hatchling; null otherwise. */
export function hatchDueAt(pet: SaucelingPet | null): number | null {
  if (pet?.stage !== "egg" || pet.careActionCount < 1) return null;
  return Date.parse(pet.createdAt) + SAUCELING_HATCH_WAIT_MS;
}

/** The appearance text a card gives image prompts: its image appearance when that is turned on, else its
 *  appearance; the Engine may send the card as JSON text. */
function cardAppearance(data: unknown): string {
  let card = data;
  if (typeof card === "string") {
    try {
      card = JSON.parse(card);
    } catch {
      return "";
    }
  }
  const extensions = (card as { extensions?: Record<string, unknown> } | null)?.extensions;
  const image = extensions?.imageAppearanceEnabled === true ? extensions.imageAppearance : null;
  const text = typeof image === "string" && image.trim() ? image : extensions?.appearance;
  return typeof text === "string" ? text : "";
}

/** The caretaker's avatar and appearance from the Engine's character record. The package's own character list
 *  has neither, so the client asks the Engine; the avatar is null when the character has none. */
export function caretakerCardQuery(characterId: string) {
  return {
    queryKey: ["saucelings", "caretaker-card", characterId],
    queryFn: async () => {
      const record = await marinaraRequest<{ avatarPath?: unknown; data?: unknown }>(
        `/api/characters/${encodeURIComponent(characterId)}`,
      );
      // Only a path on the Engine itself, never another site: "//host" and "/\host" both leave it.
      const avatar =
        typeof record.avatarPath === "string" && /^\/(?![/\\])/u.test(record.avatarPath) ? record.avatarPath : null;
      return { avatar, appearance: cardAppearance(record.data) };
    },
    staleTime: 5 * 60_000,
    retry: false,
  };
}

/** The caretaker's avatar; null when the character has none or is the house caretaker. */
export function useCaretakerAvatar(characterId: string, isCharacter: boolean): string | null {
  return useQuery({ ...caretakerCardQuery(characterId), enabled: isCharacter }).data?.avatar ?? null;
}

/** A painted caretaker's figure strip and its frame count. */
export type CaretakerFigure = { image: string; frames: number };

/** A painted caretaker's figure (see form-art.ts): undefined while it loads, null when they have none or it cannot
 *  be fetched. */
export function useCaretakerFigure(figureId: string | undefined): CaretakerFigure | null | undefined {
  const query = useQuery({
    queryKey: ["saucelings", "figure", figureId],
    queryFn: () => saucelingsRequest<CaretakerFigure>(`/figure/${encodeURIComponent(figureId ?? "")}`),
    enabled: Boolean(figureId),
    // A figure is never changed in place: a new painting is a new id.
    staleTime: Infinity,
    retry: false,
  });
  if (!figureId || query.isError) return null;
  return query.data ? (query.data.image ? query.data : null) : undefined;
}

/** A painted caretaker's figure made to breathe, with the blink drawn over it (see form-art.ts's breathingFigure):
 *  null while it is made, or when it cannot be. Made once per figure, in the browser: a new painting is a new id. */
export function useCaretakerMotion(
  figureId: string | undefined,
  figure: CaretakerFigure | null | undefined,
): { body: string; blink: string | null } | null {
  const image = figure?.image;
  return (
    useQuery({
      queryKey: ["saucelings", "figure-motion", figureId],
      queryFn: () => breathingFigureFrom(image ?? ""),
      enabled: Boolean(figureId && image),
      staleTime: Infinity,
      retry: false,
    }).data ?? null
  );
}

/** Whether the Saucelings panel is at least `rem` wide, as the styles' container queries see it. Read before the
 *  first paint, so a wide panel never flashes the narrow layout. Pass the setter as a ref on any element inside it. */
export function usePanelAtLeast(rem: number) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const panel = element?.closest<HTMLElement>(".sl-shell") ?? element;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const read = () =>
      setWide(panel.clientWidth >= rem * parseFloat(getComputedStyle(document.documentElement).fontSize));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [element, rem]);
  return [setElement, wide] as const;
}

const NO_SPRITES: ReadonlyArray<{ expression: string; url: string }> = [];

/** The character's sprites in the Engine, for the caller to pick from (see caretaker-look.ts); empty for the house
 *  caretaker or a character with none. Only paths on the Engine itself are used. */
export function useCaretakerSprites(
  characterId: string,
  isCharacter: boolean,
): ReadonlyArray<{ expression: string; url: string }> {
  const query = useQuery({
    queryKey: ["saucelings", "caretaker-sprites", characterId],
    queryFn: async () => {
      const list = await marinaraRequest<unknown>(`/api/sprites/${encodeURIComponent(characterId)}`);
      return (Array.isArray(list) ? list : []).flatMap((item) => {
        const entry = item as { expression?: unknown; url?: unknown };
        return typeof entry.expression === "string" &&
          typeof entry.url === "string" &&
          /^\/api\/sprites\//u.test(entry.url)
          ? [{ expression: entry.expression, url: entry.url }]
          : [];
      });
    },
    enabled: isCharacter,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return (isCharacter && query.data) || NO_SPRITES;
}

export function CaretakerAvatar({
  name,
  src,
  small,
  box,
}: {
  name: string;
  src: string | null;
  small?: boolean;
  /** The large rounded square beside the caretaker's lines. */
  box?: boolean;
}) {
  const className = box ? "sl-avatar sl-avatar--box" : small ? "sl-avatar sl-avatar--small" : "sl-avatar";
  return src ? (
    <img className={className} src={src} alt="" />
  ) : (
    <span className={className} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** A request error in plain words (see `friendlyError`), with the original text behind a Details toggle when it was
 *  replaced. It sits inside the caller's own alert line. */
export function FriendlyError({ error }: { error: unknown }) {
  const { t } = useSaucelingsTranslation();
  const [open, setOpen] = useState(false);
  const { message, details } = friendlyError(error, t);
  return (
    <>
      {message}
      {details ? (
        <>
          {" "}
          <button type="button" className="sl-link" aria-expanded={open} onClick={() => setOpen((was) => !was)}>
            {t("saucelings.error.details")}
          </button>
          {open ? <span className="sl-error-details">{details}</span> : null}
        </>
      ) : null}
    </>
  );
}
