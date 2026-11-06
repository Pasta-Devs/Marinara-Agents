// ──────────────────────────────────────────────
// Otome Hearth: the Shop, a tab of Wish (#2128). A wooden shelf of gifts to give on dates (flowers, chocolates, wine,
// and under NSFW Heat an aphrodisiac), each unlimited, and a shelf of each love interest's figurine, one each. Every
// item stands on a plank with its price tag and a Buy button; a figurine bought shows "Yours" and Play the scene.
// ──────────────────────────────────────────────
// Routes (S/routes/shop.ts): GET /runs/:run/shop → ShopView (it queues the drawing of each figurine not drawn yet, and
// this panel reads it again while one is `drawing`); POST .../shop/gifts {gift, requestId} and POST
// .../shop/figurines/:li {requestId} → ShopBuyResult. A purchase carries a request id kept until it is answered, so
// Try again sends the same one, and one that landed while its answer was lost is not charged twice. One purchase at a
// time. Buying never calls a model.
import { useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Heart, RotateCcw, ShoppingBag, Sparkle } from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../../api";
import { FigurineArt, GIFT_NAME_KEYS, GiftArt } from "../../components/GiftArt";
import { invalidateCollection, newRequestId, shopQueryKey } from "../../hooks/use-items";
import { runPath } from "../../hooks/use-reader";
import { patchRun } from "../../hooks/use-run";
import { accentOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { RunView } from "../../shared/api-types";
import type { GiftId, ShopBuyResult, ShopView } from "../../shared/shop";
import { PALETTE } from "../../theme/tokens";

/** While a figurine is being drawn, the Shop is read again this often. */
const POLL_MS = 3_000;

export function useShop(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: shopQueryKey(runKey),
    queryFn: () => otome.get<ShopView>(`${runPath(runKey)}/shop`),
    refetchInterval: (query) => (query.state.data?.figurines.some((entry) => entry.drawing) ? POLL_MS : false),
  });
}

/** The answers that refuse a purchase before anything changes (S/routes/shop.ts applyPurchase). */
const REFUSALS: ReadonlySet<string> = new Set(["insufficient", "locked", "conflict", "not-found"]);

/** What a purchase buys, as its route names it. */
type Purchase = { gift: GiftId } | { figurine: string };
const purchaseId = (purchase: Purchase) => ("gift" in purchase ? purchase.gift : `figurine:${purchase.figurine}`);

/** The purchase still waiting for an answer, and its request id. */
export type UnansweredPurchase = MutableRefObject<{ id: string; requestId: string } | null>;

interface ShopPanelProps {
  runKey: string;
  view: RunView;
  /** The id the Wish panel's heading takes, for the tab panel's focus. */
  headingId: string;
  /**
   * The purchase still waiting for an answer: the same one again sends it as it was (see the header). Kept by Wish, not
   * this panel, which mounts again on every tab change.
   */
  unanswered: UnansweredPurchase;
  /** Opens a figurine's scene in the reader. */
  onOpenStory: (key: string) => void;
}

export function ShopPanel({ runKey, view, headingId, unanswered, onOpenStory }: ShopPanelProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { locale } = useOtomeProps().localization;
  const number = new Intl.NumberFormat(locale);
  const shop = useShop(runKey);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<{ purchase: Purchase; text: string; retry: boolean } | null>(null);
  const [bought, setBought] = useState<string | null>(null);
  const lock = useRef(false);

  if (!shop.data) {
    return shop.isError ? (
      <div className="of-panel of-panel--center of-card of-glass" role="alert">
        <p className="of-error">{otome.errorMessage(shop.error)}</p>
        <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void shop.refetch()}>
          <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.common.retry")}
        </button>
      </div>
    ) : (
      <div className="of-center" role="status">
        <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
        <p className="of-body">{t("ui.otomeForge.shop.loading")}</p>
      </div>
    );
  }

  const data = shop.data;
  const nameOf = (purchase: Purchase) =>
    "gift" in purchase
      ? t(GIFT_NAME_KEYS[purchase.gift])
      : t("ui.otomeForge.shop.figurineOf", {
          name: data.figurines.find((entry) => entry.li === purchase.figurine)?.name ?? "",
        });

  const buy = async (purchase: Purchase) => {
    if (lock.current) return;
    lock.current = true;
    const id = purchaseId(purchase);
    setBuying(id);
    setError(null);
    setBought(null);
    const waiting = unanswered.current;
    const request = waiting && waiting.id === id ? waiting : { id, requestId: newRequestId() };
    unanswered.current = request;
    try {
      const result = await otome.post<ShopBuyResult>(
        "gift" in purchase
          ? `${runPath(runKey)}/shop/gifts`
          : `${runPath(runKey)}/shop/figurines/${encodeURIComponent(purchase.figurine)}`,
        "gift" in purchase ? { gift: purchase.gift, requestId: request.requestId } : { requestId: request.requestId },
      );
      unanswered.current = null;
      queryClient.setQueryData<ShopView>(shopQueryKey(runKey), result.shop);
      patchRun(queryClient, runKey, (shown) => ({ ...shown, starlight: result.starlight }));
      void invalidateCollection(queryClient, runKey);
      setBought(nameOf(purchase));
    } catch (cause) {
      // Refused (short of Starlight, the aphrodisiac under SFW, a figurine already bought, gone from the story): nothing
      // was charged and the same request would be refused again, so the next tap is a new purchase.
      const refused = REFUSALS.has(otomeErrorCode(cause) ?? "");
      if (refused) unanswered.current = null;
      setError({ purchase, text: otome.errorMessage(cause), retry: !refused });
      void shop.refetch();
    } finally {
      lock.current = false;
      setBuying(null);
    }
  };

  /** The price tag on the plank's edge (the Buy button says the price to screen readers). */
  const priceTag = (price: number) => (
    <span className="of-shop-tag" aria-hidden="true">
      <Sparkle size={11} strokeWidth={0} fill="currentColor" />
      {number.format(price)}
    </span>
  );

  /** A Buy button; short of Starlight, it stays focusable and says how much is missing. */
  const buyButton = (purchase: Purchase, price: number) => {
    const id = purchaseId(purchase);
    const short = Math.max(0, price - data.starlight);
    const name = nameOf(purchase);
    const shortId = `of-shop-short-${id.replace(/[^a-zA-Z0-9_-]/gu, "")}`;
    return (
      <>
        <button
          type="button"
          className="of-button of-button--primary of-button--small of-shop-buy"
          aria-label={t("ui.otomeForge.shop.buyLabel", { name, price: number.format(price) })}
          aria-disabled={!!buying || short > 0}
          aria-describedby={short > 0 ? shortId : undefined}
          onClick={() => {
            if (!buying && short === 0) void buy(purchase);
          }}
        >
          {buying === id ? t("ui.otomeForge.shop.buying") : t("ui.otomeForge.shop.buy")}
        </button>
        {short > 0 ? (
          <span id={shortId} className="of-banner-short">
            {t("ui.otomeForge.wish.short", { amount: number.format(short) })}
          </span>
        ) : null}
      </>
    );
  };

  const drawing = data.figurines.some((entry) => entry.drawing);
  return (
    <div className="of-shop">
      <section className="of-section of-glass" aria-labelledby={headingId}>
        <h2 id={headingId} className="of-section-title" tabIndex={-1}>
          <ShoppingBag size={18} strokeWidth={1.9} aria-hidden="true" />
          {t("ui.otomeForge.shop.giftsTitle")}
        </h2>
        <p className="of-hint">{t("ui.otomeForge.shop.giftsHint")}</p>
        <ul className="of-shop-shelf" aria-labelledby={headingId}>
          {data.gifts.map((gift) => {
            const name = t(GIFT_NAME_KEYS[gift.id]);
            return (
              <li key={gift.id} className="of-shop-slot">
                <span className="of-shop-stand">
                  <GiftArt gift={gift.id} className="of-shop-item" />
                  {gift.owned > 0 ? (
                    <span className="of-shelf-count" aria-hidden="true">
                      ×{gift.owned}
                    </span>
                  ) : null}
                </span>
                {priceTag(gift.price)}
                <span className="of-shop-name">{name}</span>
                {gift.owned > 0 ? (
                  <span className="of-visually-hidden">
                    {t("ui.otomeForge.shop.ownedCount", { name, count: gift.owned })}
                  </span>
                ) : null}
                {buyButton({ gift: gift.id }, gift.price)}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="of-section of-glass" aria-labelledby={`${headingId}-figurines`}>
        <h2 id={`${headingId}-figurines`} className="of-section-title">
          {t("ui.otomeForge.shop.figurinesTitle")}
        </h2>
        <p className="of-hint">{t("ui.otomeForge.shop.figurinesHint")}</p>
        {data.figurines.length ? (
          <ul className="of-shop-shelf of-shop-shelf--tall" aria-labelledby={`${headingId}-figurines`}>
            {data.figurines.map((entry) => {
              const li = view.lis.find((candidate) => candidate.id === entry.li);
              const name = t("ui.otomeForge.shop.figurineOf", { name: entry.name });
              return (
                <li
                  key={entry.li}
                  className="of-shop-slot"
                  data-owned={entry.owned}
                  style={{ "--of-li-accent": accentOf(li ?? entry) } as CSSProperties}
                >
                  <span className="of-shop-stand">
                    <FigurineArt
                      li={{ id: entry.li, name: entry.name, accent: entry.accent, portrait: li?.portrait }}
                      art={entry.art}
                      className="of-shop-item"
                    />
                  </span>
                  {entry.owned ? (
                    <span className="of-shop-tag of-shop-tag--yours">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                      {t("ui.otomeForge.wardrobe.owned")}
                    </span>
                  ) : (
                    priceTag(data.figurineCost)
                  )}
                  <span className="of-shop-name">{name}</span>
                  {!entry.owned ? (
                    buyButton({ figurine: entry.li }, data.figurineCost)
                  ) : entry.story ? (
                    <button
                      type="button"
                      className="of-button of-button--quiet of-glass of-button--small of-shop-buy"
                      aria-label={t("ui.otomeForge.shop.playSceneLabel", { name: entry.name })}
                      onClick={() => onOpenStory(entry.story!.key)}
                    >
                      <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
                      {t("ui.otomeForge.shop.playScene")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="of-empty">{t("ui.otomeForge.shop.noFigurines")}</p>
        )}
        {drawing ? (
          <p className="of-hint" role="status">
            {t("ui.otomeForge.shop.drawing")}
          </p>
        ) : null}
      </section>

      <div className="of-live" role="status">
        {bought ? <p className="of-notice">{t("ui.otomeForge.shop.bought", { name: bought })}</p> : null}
      </div>
      {error ? (
        <div className="of-notice of-notice--error" role="alert">
          <p>{error.text}</p>
          {error.retry ? (
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              aria-disabled={!!buying}
              onClick={() => {
                if (!buying) void buy(error.purchase);
              }}
            >
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="of-hint">{t("ui.otomeForge.shop.noModel")}</p>
    </div>
  );
}

// ── Styles: registered in theme/styles.ts otomeForgeStyles() (with COLLECTION_RULES' wish styles). ──

const R = ".of-root";

/**
 * The Shop's shelf, also the Wardrobe's gifts (C/screens/wardrobe/Wardrobe.tsx): each slot's stand ends on its own
 * plank, and the slots of a row grow to fill it with no gap between them, so its planks meet as one shelf from wall to
 * wall (a short last row too). Under the plank hang the price tag, the name and the button.
 */
export const SHOP_RULES = `
${R} .of-shop { display: flex; flex-direction: column; gap: 12px; }
${R} .of-shop .of-section-title { display: flex; align-items: center; gap: 8px; }
${R} .of-shop-shelf {
  --of-plank: color-mix(in srgb, ${PALETTE.champagne} 62%, #8a5a3c); --of-stand: 84px;
  display: flex; flex-wrap: wrap; gap: 14px 0; margin: 0; padding: 0; list-style: none;
}
${R} .of-shop-shelf--tall { --of-stand: 112px; }
${R} .of-shop-slot {
  position: relative; flex: 1 1 76px; display: flex; flex-direction: column; align-items: center; gap: 5px;
  min-width: 0; text-align: center;
}
${R} .of-shop-stand {
  position: relative; display: grid; place-items: end center; align-self: stretch; height: var(--of-stand);
  padding-bottom: 10px;
  background: linear-gradient(to bottom, transparent calc(100% - 10px), var(--of-plank) calc(100% - 10px) calc(100% - 4px),
    color-mix(in srgb, var(--of-plank) 70%, #2b2236) calc(100% - 4px));
}
${R} .of-shop-item { display: block; width: 62px; height: 62px; filter: drop-shadow(0 4px 3px rgb(43 34 54 / 0.25)); }
/* A drawn figurine stands taller (its box is 0 0 64 96); until it is drawn, its plush frame is a gift's size. */
${R} img.of-figurine.of-shop-item { width: 64px; height: 96px; object-fit: contain; }
${R} .of-shop-tag {
  display: inline-flex; align-items: center; gap: 3px; margin-top: -3px; padding: 1px 8px 1px 7px; rotate: -3deg;
  border-radius: 3px 8px 8px 3px; font-size: 0.74rem; font-weight: 800; font-variant-numeric: tabular-nums;
  color: ${PALETTE.ink}; background: #f6e7d0; box-shadow: 0 2px 4px rgb(43 34 54 / 0.25);
}
${R} .of-shop-tag--yours { color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne}); }
${R} .of-shop-name { font-size: 0.8rem; font-weight: 700; line-height: 1.15; overflow-wrap: anywhere; }
${R} .of-shop-buy { min-height: 34px; padding: 0 12px; max-width: 100%; }
${R} .of-shop-slot .of-banner-short { max-width: 100%; }
`;
