// ──────────────────────────────────────────────
// Otome Forge: what Wish, the Wardrobe and the Album share about items (M4): their queries, an item's first open, and
// a tap that paints (an item's art, a banner's, a couple set's pair portrait, a Shop figurine's, #2138, a Tarot card's,
// #2151), and the request id a wish or a Shop purchase (#2128) keeps until it is answered.
// ──────────────────────────────────────────────
// Routes: POST /runs/:run/items/:item/open → ItemOpenResult (S/routes/items.ts) writes a Memory's Character Story, a
// Moment or a first-wear beat and paints its art, once; the server holds the paint for a tap under Ask before painting
// or the Engine's prompt review. A tap paints through the target's own route (`paintPath`, with an edited prompt when
// reviewed) and the prompt to review comes from `promptPath`; it is also the Retry of a failed or stopped paint. One
// open per item, and one paint per target, is in flight from this page however many screens or taps ask.
// 0.21.0: POST /runs/:run/items/:item/seen lets an item won from Wish go from unseen (useMarkSeen): its dot in the
// Wardrobe or the Album, and the count on the dock, go at once; the server's answer and a read again settle them.
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useOtomeApi, type RequestBody } from "../api";
import type { ImagePrompt } from "../components/PromptReviewDialog";
import { useOtomeProps } from "../props";
import { homeQueryKey } from "../screens/home/HomeScreen";
import type { Paint, RunView } from "../shared/api-types";
import { deckKey, type Arcana } from "../shared/tarot";
import type { AlbumView, ItemOpenResult, WardrobeView } from "../shared/wardrobe";
import { collectionOf, isLookKind, type BannerView, type ItemKind, type ItemView } from "../shared/wish";
import { runPath } from "./use-reader";
import { runQueryKey } from "./use-run";

export const wishQueryKey = (runKey: string) => ["otome-forge", "wish", runKey] as const;
export const wardrobeQueryKey = (runKey: string) => ["otome-forge", "wardrobe", runKey] as const;
export const albumQueryKey = (runKey: string) => ["otome-forge", "album", runKey] as const;
/** #2128: the Shop in Wish (C/screens/wish/ShopPanel.tsx). */
export const shopQueryKey = (runKey: string) => ["otome-forge", "shop", runKey] as const;
/** #2151: Tarot night's deck and open reading (C/screens/dates/TarotNight.tsx), one query per love interest under it. */
export const tarotQueryKey = (runKey: string) => ["otome-forge", "tarot", runKey] as const;

/**
 * Everything an item can change: what Wish (and its Shop), the Wardrobe, the Album, Home, Tarot night's deck and the run
 * view show.
 * Resolves once the screens on show have read it again, so a button that waited on the change never shows the old item
 * in between.
 */
export async function invalidateCollection(queryClient: QueryClient, runKey: string): Promise<void> {
  const keys = [
    wishQueryKey(runKey),
    shopQueryKey(runKey),
    wardrobeQueryKey(runKey),
    albumQueryKey(runKey),
    homeQueryKey(runKey),
    tarotQueryKey(runKey),
  ];
  await Promise.all([...keys, runQueryKey(runKey)].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/**
 * 0.21.0: marks an item won from Wish as looked at. Its dot goes from the cached Wardrobe or Album and the dock's count
 * drops at once; then the run view and its screen are read again (a failed request brings the dot back). One request
 * per item at a time.
 */
export function useMarkSeen(runKey: string) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const sent = useRef(new Set<string>());
  return (id: string) => {
    if (sent.current.has(id)) return;
    sent.current.add(id);
    const screen = collectionOf(id);
    const collectionKey = screen === "wardrobe" ? wardrobeQueryKey : albumQueryKey;
    queryClient.setQueryData<RunView>(runQueryKey(runKey), (view) =>
      view?.unseen ? { ...view, unseen: { ...view.unseen, [screen]: Math.max(0, view.unseen[screen] - 1) } } : view,
    );
    if (screen === "wardrobe") {
      const seen = <T extends { id: string; new?: true }>(look: T): T => {
        if (look.id !== id || !look.new) return look;
        const { new: _new, ...rest } = look;
        return rest as T;
      };
      queryClient.setQueryData<WardrobeView>(wardrobeQueryKey(runKey), (data) =>
        data
          ? {
              ...data,
              me: data.me.map(seen),
              him: Object.fromEntries(Object.entries(data.him).map(([li, looks]) => [li, looks.map(seen)])),
            }
          : data,
      );
    } else {
      queryClient.setQueryData<AlbumView>(albumQueryKey(runKey), (data) =>
        data
          ? {
              ...data,
              memories: data.memories.map((item) => {
                if (item.id !== id || !item.new) return item;
                const { new: _new, ...rest } = item;
                return rest;
              }),
            }
          : data,
      );
    }
    void otome
      .post(`${runPath(runKey)}/items/${encodeURIComponent(id)}/seen`, {})
      .catch((error: unknown) => console.warn("Otome Forge could not mark an item seen", error))
      .finally(() => {
        // The run view and the screen are read again, never written from this answer: two seen in quick succession
        // may answer out of order (Dottore on #2204), and a read sent before the write must not leave its dot. A failed
        // request brings the dot back. A later click may send again (the route is idempotent) should one still show.
        sent.current.delete(id);
        void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
        void queryClient.invalidateQueries({ queryKey: collectionKey(runKey) });
      });
  };
}

/** A pull's or a purchase's id: kept until it is answered, so a retry is the same request and is never paid twice. */
export function newRequestId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `w-${Date.now().toString(36)}-${random}`;
}

/** Kinds whose first open writes something: a Character Story, a Moment, a first-wear beat. */
const WRITTEN_KINDS: ReadonlySet<ItemKind> = new Set(["memory5", "moment4", "his-look5", "her-look5"]);

export const writesOnOpen = (item: Pick<ItemView, "kind">) => WRITTEN_KINDS.has(item.kind);

/** An illustrated reward or look whose first open can paint, with images on. */
export const paintsOnOpen = (item: Pick<ItemView, "kind">, images: boolean) =>
  images && (item.kind === "memory5" || item.kind === "moment4" || item.kind === "snapshot3" || isLookKind(item.kind));

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

/**
 * The picture a record shows: its own once ready, and (0.24.0) the one a repaint kept on screen while the new one
 * paints and after it failed. Only a repaint puts a url on a record that is not ready, as a base look's portrait stays.
 */
export const readyArt = (art: Paint | null | undefined): string | null => art?.url || null;

/** Ready art and whether it is a saved cut-out (an ItemView's or BannerView's `cut`: shown as it is, never cleaned). */
export const readyPicture = (source: { art: Paint | null; cut?: true } | null | undefined) => {
  const url = readyArt(source?.art);
  return url ? { url, cut: !!source?.cut } : null;
};
export type ReadyPicture = NonNullable<ReturnType<typeof readyPicture>>;

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

/** S/routes/shop.ts (#2138): POST .../shop/figurines/:li/art and .../art/prompt; `subject` names it in the review. */
export const figurinePaintTarget = (runKey: string, li: string, subject: string): PaintTarget => {
  const path = `${runPath(runKey)}/shop/figurines/${encodeURIComponent(li)}/art`;
  return { id: `figurine:${li}`, subject, paintPath: path, promptPath: `${path}/prompt` };
};

/**
 * S/routes/tarot.ts (#2151): POST .../art/tarot {li, card} and .../art/tarot/prompt, from Tarot night and the Album; a
 * card of the story's one set is the same card whichever love interest's `li` asks. `subject` names it in the review.
 */
export const tarotPaintTarget = (runKey: string, li: string, card: Arcana, subject: string): PaintTarget => ({
  id: `tarot:${deckKey(card, li)}`,
  subject,
  paintPath: `${runPath(runKey)}/art/tarot`,
  promptPath: `${runPath(runKey)}/art/tarot/prompt`,
  body: { li, card },
});

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
