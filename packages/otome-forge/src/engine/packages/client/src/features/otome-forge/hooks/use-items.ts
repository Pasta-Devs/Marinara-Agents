// ──────────────────────────────────────────────
// Otome Forge: what Wish, the Wardrobe and the Album share about items (M4): their queries, an item's first open, and
// a tap that paints (an item's art, a banner's, a couple set's pair portrait).
// ──────────────────────────────────────────────
// Routes: POST /runs/:run/items/:item/open → ItemOpenResult (S/routes/items.ts) writes a Memory's Character Story, a
// Moment or a first-wear beat and paints its art, once; the server holds the paint for a tap under Ask before painting
// or the Engine's prompt review. A tap paints through the target's own route (`paintPath`, with an edited prompt when
// reviewed) and the prompt to review comes from `promptPath`; it is also the Retry of a failed or stopped paint. One
// open per item, and one paint per target, is in flight from this page however many screens or taps ask.
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOtomeApi, type RequestBody } from "../api";
import type { ImagePrompt } from "../components/PromptReviewDialog";
import { useOtomeProps } from "../props";
import { homeQueryKey } from "../screens/home/HomeScreen";
import type { Paint, RunView } from "../shared/api-types";
import type { ItemOpenResult } from "../shared/wardrobe";
import { isLookKind, type BannerView, type ItemKind, type ItemView } from "../shared/wish";
import { runPath } from "./use-reader";
import { runQueryKey } from "./use-run";

export const wishQueryKey = (runKey: string) => ["otome-forge", "wish", runKey] as const;
export const wardrobeQueryKey = (runKey: string) => ["otome-forge", "wardrobe", runKey] as const;
export const albumQueryKey = (runKey: string) => ["otome-forge", "album", runKey] as const;

/**
 * Everything an item can change: what Wish, the Wardrobe, the Album, Home and the run view show. Resolves once the
 * screens on show have read it again, so a button that waited on the change never shows the old item in between.
 */
export async function invalidateCollection(queryClient: QueryClient, runKey: string): Promise<void> {
  const keys = [wishQueryKey(runKey), wardrobeQueryKey(runKey), albumQueryKey(runKey), homeQueryKey(runKey)];
  await Promise.all([...keys, runQueryKey(runKey)].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Kinds whose first open writes something: a Character Story, a Moment, a first-wear beat. */
const WRITTEN_KINDS: ReadonlySet<ItemKind> = new Set(["memory5", "moment4", "his-look5"]);

export const writesOnOpen = (item: Pick<ItemView, "kind">) => WRITTEN_KINDS.has(item.kind);

/** An item that has art to paint on its first open (a Memory's CG, a look), with images on. */
export const paintsOnOpen = (item: Pick<ItemView, "kind">, images: boolean) =>
  images && (item.kind === "memory5" || isLookKind(item.kind));

/**
 * True while an owned item's first open has not finished: its story is unwritten, or its art never started (as the
 * server's `unopened`). A story written without an image connection leaves the art for a later open, which paints it.
 */
export function needsOpen(item: ItemView, images: boolean): boolean {
  if (!item.owned) return false;
  return (writesOnOpen(item) && !item.story) || (paintsOnOpen(item, images) && !item.art);
}

/** A paint the player can start with a tap: held for consent, failed, or stopped by a restart. */
export const paintWaits = (art: Paint | null | undefined) =>
  !!art && (art.state === "waiting-consent" || art.state === "failed" || art.state === "stopped");

export const readyArt = (art: Paint | null | undefined): string | null =>
  art?.state === "ready" && art.url ? art.url : null;

export const imagesOn = (view: Pick<RunView, "world">) => !!view.world.images.connectionId;

/** True when nothing holds focus: the control that had it has left the page. */
export function focusLost(): boolean {
  const active = document.activeElement;
  return !active || active === document.body || !active.isConnected;
}

/**
 * When `key` changes and the change took focus with it (one of this component's own controls was replaced: Open by
 * Read, Wear by "Worn at home", a banner by another), focus moves to `target`, what replaced it or the heading it
 * belongs to. Returns the `onFocus` for the component's root, which is how it knows the control was its own (another
 * card changing in the same render leaves focus alone).
 */
export function useRefocus(key: string, target: () => HTMLElement | null | undefined) {
  const last = useRef(key);
  const focused = useRef<EventTarget | null>(null);
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    const mine = focused.current instanceof Element && !focused.current.isConnected;
    if (mine && focusLost()) target()?.focus({ preventScroll: true });
  });
  return (event: FocusEvent) => {
    focused.current = event.target;
  };
}

/** Something a tap paints, and the routes that paint it and give its prompt for review. */
export interface PaintTarget {
  /** Busy state and errors are kept per id. */
  id: string;
  /** Whose picture it is, for the review dialog's title. */
  subject: string;
  paintPath: string;
  promptPath: string;
  body?: RequestBody;
}

export const itemPaintTarget = (runKey: string, item: ItemView): PaintTarget => {
  const path = `${runPath(runKey)}/items/${encodeURIComponent(item.id)}/art`;
  return { id: item.id, subject: item.look?.name || item.title, paintPath: path, promptPath: `${path}/prompt` };
};

/** S/routes/wish.ts: POST .../wish/art {banner} and .../wish/art/prompt {banner}. */
export const bannerPaintTarget = (runKey: string, banner: BannerView): PaintTarget => ({
  id: `banner:${banner.key}`,
  subject: banner.title || banner.five.title,
  paintPath: `${runPath(runKey)}/wish/art`,
  promptPath: `${runPath(runKey)}/wish/art/prompt`,
  body: { banner: banner.key },
});

const openRequests = new Map<string, Promise<ItemOpenResult>>();
const paintRequests = new Map<string, Promise<{ art?: Paint | null }>>();

export interface PaintReview {
  target: PaintTarget;
  initial: ImagePrompt;
  busy: boolean;
  error: string | null;
}

/** First opens and paint taps for one run, with the prompt review the Engine's setting asks for. */
export function useItemActions(runKey: string) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [review, setReview] = useState<PaintReview | null>(null);

  const mark = (id: string, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const fail = (id: string, text: string | null) =>
    setErrors((current) => {
      const next = { ...current };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });

  /** The first open; a second call while one runs (from any screen) shares it. Null when it failed. */
  const open = async (item: ItemView): Promise<ItemOpenResult | null> => {
    const key = `${runKey}/${item.id}`;
    let request = openRequests.get(key);
    if (!request) {
      request = otome
        .post<ItemOpenResult>(`${runPath(runKey)}/items/${encodeURIComponent(item.id)}/open`)
        .finally(() => openRequests.delete(key));
      openRequests.set(key, request);
    }
    mark(item.id, true);
    fail(item.id, null);
    try {
      const result = await request;
      await invalidateCollection(queryClient, runKey);
      return result;
    } catch (error) {
      fail(item.id, otome.errorMessage(error));
      // The art was queued before the story call that failed: the screens read it again, the error text stays.
      await invalidateCollection(queryClient, runKey).catch(() => undefined);
      return null;
    } finally {
      mark(item.id, false);
    }
  };

  const sendPaint = async (target: PaintTarget, edited?: ImagePrompt): Promise<Paint | null> => {
    const key = `${runKey}/${target.id}`;
    let request = paintRequests.get(key);
    if (!request) {
      request = otome
        .post<{ art?: Paint | null }>(target.paintPath, { ...target.body, ...edited })
        .finally(() => paintRequests.delete(key));
      paintRequests.set(key, request);
    }
    mark(target.id, true);
    fail(target.id, null);
    try {
      const { art } = await request;
      // The review closes first, so focus goes back to the Paint it came from before the screens read the change.
      setReview(null);
      await invalidateCollection(queryClient, runKey);
      return art ?? null;
    } catch (error) {
      const text = otome.errorMessage(error);
      if (edited) setReview((shown) => (shown ? { ...shown, busy: false, error: text } : shown));
      else fail(target.id, text);
      return null;
    } finally {
      mark(target.id, false);
    }
  };

  /** A tap on Paint or Try again: with prompt review on, the prompt shows for editing first. */
  const paint = async (target: PaintTarget) => {
    if (busy.has(target.id) || review) return;
    if (!reviewImagePromptsBeforeSend) {
      await sendPaint(target);
      return;
    }
    mark(target.id, true);
    fail(target.id, null);
    try {
      const initial = await otome.post<ImagePrompt>(target.promptPath, { ...target.body });
      setReview({ target, initial, busy: false, error: null });
    } catch (error) {
      fail(target.id, otome.errorMessage(error));
    } finally {
      mark(target.id, false);
    }
  };

  return {
    open,
    paint,
    paintItem: (item: ItemView) => paint(itemPaintTarget(runKey, item)),
    paintBanner: (banner: BannerView) => paint(bannerPaintTarget(runKey, banner)),
    busy,
    errors,
    review,
    sendReview: (edited: ImagePrompt) => {
      if (!review || review.busy) return;
      setReview({ ...review, busy: true, error: null });
      void sendPaint(review.target, edited);
    },
    skipReview: () => setReview(null),
  };
}

export type ItemActions = ReturnType<typeof useItemActions>;
