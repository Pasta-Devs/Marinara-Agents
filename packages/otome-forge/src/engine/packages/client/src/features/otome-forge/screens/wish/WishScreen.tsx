// ──────────────────────────────────────────────
// Otome Forge: Wish. This fortnight's banners (Memories, a love interest's Wardrobe, My Wardrobe) and every past one in
// Echoes, each with the exact pity count; Starlight is the only currency, earned in play. A wish never calls a model:
// the server charges and rolls in one write and answers with what arrived, which comes in a sealed letter, a 5★ reveal
// for each 5★, and the results. Skip always goes straight to the results.
// ──────────────────────────────────────────────
// Routes (S/routes/wish.ts): GET /runs/:run/wish → WishView; POST .../wish/open → WishOpenResult (writes the banners
// this fortnight is missing: one model call, and their art unless Ask before painting holds it); POST .../wish/pull
// {banner, count, requestId} → WishPullResponse; POST .../selector/:li {item} → SelectorResult. A pull carries a
// request id, kept until it is answered: Try again after a failure sends the same one, so a wish that did land is
// shown, not charged twice. One pull at a time from this screen.
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Feather, Gift, Heart, History, Paintbrush, RotateCcw, Sparkle, Sparkles, X } from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../../api";
import { CostHint } from "../../components/CostHint";
import { DeclinedPanel } from "../../components/DeclinedPanel";
import { Dialog } from "../../components/Dialog";
import { useStageLayer } from "../../components/Stage";
import {
  focusLost,
  imagesOn,
  invalidateCollection,
  paintWaits,
  readyArt,
  useItemActions,
  useRefocus,
  wishQueryKey,
  type ItemActions,
} from "../../hooks/use-items";
import { useOtomeAudio } from "../../hooks/use-otome-audio";
import { cancelStoryWork, runPath, useReducedMotion } from "../../hooks/use-reader";
import { patchRun } from "../../hooks/use-run";
import { accentOf, initialsOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import type { RunView } from "../../shared/api-types";
import {
  DUPLICATE_REFUNDS,
  FIVE_STAR_RATE,
  FOUR_STAR_EVERY,
  FOUR_STAR_RATE,
  HARD_PITY,
  SOFT_PITY_FROM,
  wishCost,
  type BannerView,
  type ItemView,
  type PullCount,
  type PullResult,
  type Rarity,
  type SelectorView,
  type WishOpenResult,
  type WishPullResponse,
  type WishView,
} from "../../shared/wish";
import { BannerTabs, tabLabel, type WishTab } from "./BannerTabs";
import { PityCounter } from "./PityCounter";
import { Reveal5 } from "./Reveal5";
import { RARITY_NAMES, SealedLetter } from "./SealedLetter";
import { ItemArt, PaintReviewDialog, RarityStars, TenPullGrid } from "./TenPullGrid";

/** While banners are being written or art is painting, the view is read again this often. */
const POLL_MS = 3_000;
const LETTER_SOUND = "sfx:ui:latch";

const allItems = (banner: BannerView) => [banner.five, ...banner.four, ...banner.three];
const painting = (wish: WishView | undefined) =>
  !!wish &&
  (wish.creating ||
    [...wish.banners, ...wish.echoes].some(
      (banner) => banner.art?.state === "pending" || allItems(banner).some((item) => item.art?.state === "pending"),
    ));

export function useWish(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: wishQueryKey(runKey),
    queryFn: () => otome.get<WishView>(`${runPath(runKey)}/wish`),
    refetchInterval: (query) => (painting(query.state.data) ? POLL_MS : false),
  });
}

/** A day key ("YYYY-MM-DD", already the player's local day) as a date in their language. */
export function formatDay(dayKey: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) return dayKey;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat(locale, { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

/** A pull's id: kept until the pull is answered, so a retry is the same pull. */
function newRequestId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `w-${Date.now().toString(36)}-${random}`;
}

interface PullError {
  banner: string;
  count: PullCount;
  text: string;
  /** False when nothing was charged (not enough Starlight): no Try again. */
  retry: boolean;
}

const bestRarity = (results: PullResult[]): Rarity =>
  results.reduce<Rarity>((best, result) => (result.rarity > best ? result.rarity : best), 3);

interface WishScreenProps {
  runKey: string;
  view: RunView;
  /** Opens a Character Story, a Moment or a first-wear beat in the reader. */
  onOpenStory: (key: string) => void;
  onOpenWardrobe: () => void;
}

interface Sequence {
  banner: BannerView;
  results: PullResult[];
  spent: number;
  phase: { at: "letter" } | { at: "reveal"; index: number } | { at: "results" };
}

export function WishScreen({ runKey, view, onOpenStory, onOpenWardrobe }: WishScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const id = useId();
  const wish = useWish(runKey);
  const actions = useItemActions(runKey);
  const opening = useOpenBanners(runKey);
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<WishTab>("memories");
  const [echo, setEcho] = useState<string | null>(null);
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [pulling, setPulling] = useState<{ banner: string; count: PullCount } | null>(null);
  const [pullError, setPullError] = useState<PullError | null>(null);
  const pullLock = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // What the panel shows changed under the control that had focus (banners written, an Echo opened or left, a wish
  // closed whose Try again had gone): focus goes to the panel's heading.
  const onFocus = useRefocus(
    [tab, echo ?? "", wish.data?.missing.length ?? -1, !!wish.data?.creating, !!sequence].join("|"),
    () => panelRef.current?.querySelector<HTMLElement>("h2[tabindex]") ?? panelRef.current,
  );
  // The pull still waiting for an answer: the same wish again (Try again, or the button) sends it as it was, so one
  // that landed while its answer was lost is shown, not charged twice.
  const unanswered = useRef<{ banner: string; count: PullCount; requestId: string } | null>(null);

  const head = (
    <div className="of-page-head of-page-head--tight">
      <h1 className="of-title" tabIndex={-1}>
        {t("ui.otomeForge.common.screenWish")}
      </h1>
      <p className="of-hand">{t("ui.otomeForge.wish.note")}</p>
    </div>
  );

  if (!wish.data) {
    return (
      <div className="of-page of-wishes">
        {head}
        {wish.isError ? (
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(wish.error)}</p>
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void wish.refetch()}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-center" role="status">
            <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">{t("ui.otomeForge.wish.loading")}</p>
          </div>
        )}
      </div>
    );
  }

  const data = wish.data;
  const byKind = new Map(data.banners.map((banner) => [banner.kind, banner]));
  const items = new Map(
    [...data.banners, ...data.echoes].flatMap((banner) => allItems(banner)).map((item) => [item.id, item]),
  );
  const resolve = (item: ItemView) => items.get(item.id) ?? item;
  const wardrobe = byKind.get("his-wardrobe");
  const wardrobeName = wardrobe ? (view.lis.find((li) => li.id === wardrobe.featuredLi)?.name ?? null) : null;
  const fresh = new Set<WishTab>(data.missing);

  const pull = async (banner: BannerView, count: PullCount) => {
    if (pullLock.current) return;
    pullLock.current = true;
    setPulling({ banner: banner.key, count });
    setPullError(null);
    const waiting = unanswered.current;
    const request =
      waiting && waiting.banner === banner.key && waiting.count === count
        ? waiting
        : { banner: banner.key, count, requestId: newRequestId() };
    unanswered.current = request;
    try {
      const response = await otome.post<WishPullResponse>(`${runPath(runKey)}/wish/pull`, { ...request });
      unanswered.current = null;
      queryClient.setQueryData<WishView>(wishQueryKey(runKey), (current) =>
        current ? { ...current, starlight: response.starlight, pity: response.pity } : current,
      );
      patchRun(queryClient, runKey, (shown) => ({ ...shown, starlight: response.starlight }));
      void invalidateCollection(queryClient, runKey);
      setSequence({ banner, results: response.results, spent: wishCost(count), phase: { at: "letter" } });
    } catch (error) {
      // Refused for want of Starlight: nothing was charged or rolled, so the next tap is a new wish.
      const refused = otomeErrorCode(error) === "insufficient";
      if (refused) unanswered.current = null;
      setPullError({ banner: banner.key, count, text: otome.errorMessage(error), retry: !refused });
      void wish.refetch();
    } finally {
      pullLock.current = false;
      setPulling(null);
    }
  };

  const shownEcho = tab === "echoes" && echo ? (data.echoes.find((banner) => banner.key === echo) ?? null) : null;
  const panelBanner = tab === "echoes" ? shownEcho : (byKind.get(tab) ?? null);

  return (
    <div className="of-page of-wishes" onFocus={onFocus}>
      {head}
      <BannerTabs
        id={id}
        tab={tab}
        wardrobeName={wardrobeName}
        fresh={fresh}
        onChange={(next) => {
          setTab(next);
          setEcho(null);
        }}
      />
      <div
        ref={panelRef}
        key={tab}
        id={`${id}-${tab}-panel`}
        className="of-tab-panel"
        role="tabpanel"
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
      >
        {tab !== "echoes" && (data.missing.length > 0 || data.creating) ? (
          <NewBanners view={view} wish={data} opening={opening} />
        ) : null}
        {panelBanner ? (
          <BannerPanel
            view={view}
            banner={panelBanner}
            wish={data}
            actions={actions}
            pulling={pulling}
            error={pullError?.banner === panelBanner.key ? pullError : null}
            onPull={(count) => void pull(panelBanner, count)}
            onBack={shownEcho ? () => setEcho(null) : undefined}
          />
        ) : tab === "echoes" ? (
          <EchoList view={view} wish={data} onOpen={setEcho} />
        ) : !data.missing.includes(tab) && !data.creating ? (
          <p className="of-empty of-glass">{t("ui.otomeForge.wish.noBanner")}</p>
        ) : null}
      </div>
      <Selectors runKey={runKey} view={view} selectors={Array.isArray(data.selectors) ? data.selectors : []} />
      <p className="of-hint of-wishes-foot">{t("ui.otomeForge.wish.neverExpires")}</p>
      <PaintReviewDialog actions={actions} />
      {sequence ? (
        <PullSequence
          view={view}
          sequence={sequence}
          resolve={resolve}
          actions={actions}
          reducedMotion={reducedMotion}
          onPhase={(phase) => setSequence((current) => (current ? { ...current, phase } : current))}
          onClose={() => setSequence(null)}
          onOpenStory={onOpenStory}
          onOpenWardrobe={onOpenWardrobe}
        />
      ) : null}
    </div>
  );
}

// ── This fortnight's banners, written on the player's tap ──

/**
 * Opening the fortnight's banners. It lives in WishScreen, not in the tab panel (which is keyed by tab and mounts
 * again on a change), so a tab change neither offers Open again nor loses Cancel or what the open returned.
 */
function useOpenBanners(runKey: string) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [failed, setFailed] = useState<WishOpenResult["failed"]>([]);
  const abort = useRef<AbortController | null>(null);

  const open = async () => {
    if (busy) return;
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    setFailed([]);
    try {
      const result = await otome.post<WishOpenResult>(
        `${runPath(runKey)}/wish/open`,
        {},
        { signal: controller.signal },
      );
      queryClient.setQueryData(wishQueryKey(runKey), result.wish);
      setFailed(result.failed ?? []);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
      void queryClient.invalidateQueries({ queryKey: wishQueryKey(runKey) });
    } finally {
      if (abort.current === controller) abort.current = null;
      setBusy(false);
    }
  };

  const cancel = async () => {
    abort.current?.abort();
    await cancelStoryWork(otome.post, runKey);
    void queryClient.invalidateQueries({ queryKey: wishQueryKey(runKey) });
  };

  return { busy, error, failed, open, cancel };
}

type OpenBanners = ReturnType<typeof useOpenBanners>;

function NewBanners({
  view,
  wish,
  opening: { busy, error, failed, open, cancel },
}: {
  view: RunView;
  wish: WishView;
  opening: OpenBanners;
}) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const actionRef = useRef<HTMLButtonElement>(null);
  const writing = busy || wish.creating;
  const wasWriting = useRef(writing);

  // The pressed button leaves (Open becomes Cancel, then Open again): focus follows to the one that took its place.
  useEffect(() => {
    if (wasWriting.current === writing) return;
    wasWriting.current = writing;
    if (document.activeElement === document.body || !document.activeElement?.isConnected) {
      actionRef.current?.focus({ preventScroll: true });
    }
  }, [writing]);

  if (error && !writing) {
    return <DeclinedPanel error={error} run={view} job="structured" onRetry={() => void open()} />;
  }
  const images = imagesOn(view);
  return (
    <section className="of-section of-glass of-banner-new" aria-labelledby="of-banner-new">
      <p className="of-eyebrow">
        {t("ui.otomeForge.wish.fortnight", {
          from: formatDay(wish.rotation.startsDay, locale),
          to: formatDay(wish.rotation.endsDay, locale),
        })}
      </p>
      <h2 id="of-banner-new" className="of-section-title">
        {writing ? t("ui.otomeForge.wish.writingTitle") : t("ui.otomeForge.wish.newTitle")}
      </h2>
      {writing ? (
        <div className="of-planning" role="status">
          <Feather className="of-pulse" size={24} strokeWidth={1.6} aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.wish.writing")}</p>
        </div>
      ) : (
        <p className="of-body">{t("ui.otomeForge.wish.newText", { count: wish.missing.length })}</p>
      )}
      {failed.length ? (
        <p className="of-notice of-notice--error" role="alert">
          {t("ui.otomeForge.wish.someFailed", {
            names: failed.map((entry) => tabLabel(t, entry.kind, null)).join(", "),
          })}
        </p>
      ) : null}
      {writing ? (
        <button
          ref={actionRef}
          type="button"
          className="of-button of-button--quiet of-glass"
          onClick={() => void cancel()}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.reader.cancel")}
        </button>
      ) : (
        <>
          <button ref={actionRef} type="button" className="of-button of-button--primary" onClick={() => void open()}>
            <Gift size={16} strokeWidth={2} aria-hidden="true" />
            {failed.length ? t("ui.otomeForge.common.retry") : t("ui.otomeForge.wish.openNew")}
          </button>
          <div className="of-item-cost">
            <p className="of-cost">
              <Feather size={14} strokeWidth={2} aria-hidden="true" />
              <span>
                {t("ui.otomeForge.wish.costBanners")}
                <span className="of-cost-note"> · {t("ui.otomeForge.story.planCostNote")}</span>
              </span>
            </p>
            {images ? (
              <CostHint
                images={wish.missing.length}
                note={
                  view.world.images.ask
                    ? t("ui.otomeForge.wish.costAskNote")
                    : t("ui.otomeForge.wish.costBannerArtNote")
                }
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

// ── One banner ──

interface BannerPanelProps {
  view: RunView;
  banner: BannerView;
  wish: WishView;
  actions: ItemActions;
  pulling: { banner: string; count: PullCount } | null;
  error: PullError | null;
  onPull: (count: PullCount) => void;
  /** Back to Echoes, for a past banner. */
  onBack?: () => void;
}

function BannerPanel({ view, banner, wish, actions, pulling, error, onPull, onBack }: BannerPanelProps) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const number = new Intl.NumberFormat(locale);
  const li = view.lis.find((item) => item.id === banner.featuredLi) ?? null;
  const art = readyArt(banner.art) ?? readyArt(banner.five.art);
  const held = paintWaits(banner.art) ? banner.art : null;
  const heldId = `banner:${banner.key}`;
  const pity = wish.pity[banner.kind];
  const busy = pulling?.banner === banner.key;
  const accent = li ? accentOf(li) : undefined;
  const titleId = `of-banner-${banner.key}`;

  const pullButton = (count: PullCount) => {
    const cost = wishCost(count);
    const short = Math.max(0, cost - wish.starlight);
    const label =
      busy && pulling?.count === count
        ? t("ui.otomeForge.wish.wishing")
        : count === 10
          ? t("ui.otomeForge.wish.wishTen")
          : t("ui.otomeForge.wish.wishOne");
    return (
      <div className="of-banner-pull">
        <button
          type="button"
          className={
            count === 10
              ? "of-button of-button--primary of-banner-wish"
              : "of-button of-button--quiet of-glass of-banner-wish"
          }
          aria-label={t("ui.otomeForge.wish.wishLabel", { label, cost: number.format(cost) })}
          aria-disabled={!!pulling || short > 0}
          aria-describedby={short > 0 ? `${titleId}-short-${count}` : undefined}
          onClick={() => {
            if (!pulling && short === 0) onPull(count);
          }}
        >
          <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
          <span className="of-banner-price" aria-hidden="true">
            <Sparkle size={12} strokeWidth={0} fill="currentColor" />
            {number.format(cost)}
          </span>
        </button>
        {short > 0 ? (
          <span id={`${titleId}-short-${count}`} className="of-banner-short">
            {t("ui.otomeForge.wish.short", { amount: number.format(short) })}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <section
      className="of-banner of-glass"
      data-kind={banner.kind}
      aria-labelledby={titleId}
      style={accent ? ({ "--of-li-accent": accent } as CSSProperties) : undefined}
    >
      {onBack ? (
        <button type="button" className="of-button of-button--text of-banner-back" onClick={onBack}>
          <History size={15} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.wish.allEchoes")}
        </button>
      ) : null}
      <div className="of-banner-hero" data-painting={banner.art?.state === "pending"}>
        {art ? (
          <img className="of-banner-img" src={art} alt="" decoding="async" />
        ) : (
          <span className="of-banner-quiet" aria-hidden="true">
            <span className="of-item-initials">{initialsOf(li?.name ?? view.player.name)}</span>
          </span>
        )}
        <span className="of-banner-shade" aria-hidden="true" />
        <div className="of-banner-caption">
          <p className="of-banner-eyebrow">
            {banner.echo
              ? t("ui.otomeForge.wish.echoDates", {
                  from: formatDay(banner.startsDay, locale),
                  to: formatDay(banner.endsDay, locale),
                })
              : t("ui.otomeForge.wish.until", { date: formatDay(banner.endsDay, locale) })}
          </p>
          <h2 id={titleId} className="of-banner-title" tabIndex={-1}>
            {banner.title || banner.five.title}
          </h2>
          <p className="of-banner-featured">
            <RarityStars rarity={5} />
            <span>{banner.five.look?.name || banner.five.title}</span>
            {banner.five.owned ? (
              <span className="of-badge of-badge--soft">
                <Check size={11} strokeWidth={3} aria-hidden="true" />
                {t("ui.otomeForge.wish.owned")}
              </span>
            ) : null}
          </p>
          {li ? <p className="of-banner-who">{t("ui.otomeForge.wish.with", { name: li.name })}</p> : null}
        </div>
      </div>
      {banner.art?.state === "pending" ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.wish.paintingBanner")}
        </p>
      ) : null}
      {held ? (
        <div className="of-inline-actions">
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            aria-disabled={actions.busy.has(heldId)}
            onClick={() => {
              if (!actions.busy.has(heldId)) void actions.paintBanner(banner);
            }}
          >
            {held.state === "waiting-consent" ? (
              <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
            ) : (
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            )}
            {held.state === "waiting-consent"
              ? t("ui.otomeForge.wish.paintBanner")
              : t("ui.otomeForge.wish.paintRetry")}
          </button>
          <CostHint images={1} />
          {held.state === "failed" ? <span className="of-hint">{t("ui.otomeForge.wish.paintFailed")}</span> : null}
        </div>
      ) : null}
      {actions.errors[heldId] ? (
        <p className="of-notice of-notice--error" role="alert">
          {actions.errors[heldId]}
        </p>
      ) : null}
      <PityCounter pity={pity} />
      <div className="of-banner-pulls">
        {pullButton(1)}
        {pullButton(10)}
      </div>
      {error ? (
        <div className="of-notice of-notice--error" role="alert">
          <span>{error.text}</span>
          {error.retry ? (
            <button
              type="button"
              className="of-button of-button--text of-button--small"
              aria-disabled={!!pulling}
              onClick={() => {
                if (!pulling) onPull(error.count);
              }}
            >
              {t("ui.otomeForge.common.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
      {banner.echo ? <p className="of-hint">{t("ui.otomeForge.wish.echoPity")}</p> : null}
      {banner.five.premise ? <p className="of-body of-banner-premise">{banner.five.premise}</p> : null}
      <p className="of-hint">{t("ui.otomeForge.wish.noModel")}</p>
      <BannerContents view={view} banner={banner} />
    </section>
  );
}

/** What a banner holds, with the rates, and which are owned. */
function BannerContents({ view, banner }: { view: RunView; banner: BannerView }) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  const number = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const rows: Array<{ rarity: Rarity; items: ItemView[] }> = [
    { rarity: 5, items: [banner.five] },
    { rarity: 4, items: banner.four },
    { rarity: 3, items: banner.three },
  ];
  return (
    <details className="of-details of-banner-contents">
      <summary className="of-summary">{t("ui.otomeForge.wish.contents")}</summary>
      <div className="of-details-body">
        <p className="of-hint">
          {t("ui.otomeForge.wish.rates", {
            five: percent.format(FIVE_STAR_RATE),
            soft: SOFT_PITY_FROM,
            hard: HARD_PITY,
            four: percent.format(FOUR_STAR_RATE),
            every: FOUR_STAR_EVERY,
          })}
        </p>
        {rows.map(({ rarity, items }) => (
          <div key={rarity} className="of-banner-row" data-rarity={RARITY_NAMES[rarity]}>
            <RarityStars rarity={rarity} />
            <ul className="of-banner-items">
              {items.map((item) => (
                <li key={item.id} className="of-banner-item">
                  <ItemArt item={item} view={view} />
                  <span className="of-banner-item-name">
                    {rarity === 3
                      ? (view.lis.find((li) => li.id === item.li)?.name ?? item.title)
                      : item.look?.name || item.title}
                  </span>
                  {item.owned ? (
                    <span className="of-banner-item-owned">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                      <span className="of-visually-hidden">{t("ui.otomeForge.wish.owned")}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="of-hint">
          {t("ui.otomeForge.wish.refunds", {
            five: number.format(DUPLICATE_REFUNDS[5]),
            four: number.format(DUPLICATE_REFUNDS[4]),
            three: number.format(DUPLICATE_REFUNDS[3]),
          })}
        </p>
      </div>
    </details>
  );
}

function EchoList({ view, wish, onOpen }: { view: RunView; wish: WishView; onOpen: (key: string) => void }) {
  const { t } = useTranslation();
  const { locale } = useOtomeProps().localization;
  if (!wish.echoes.length) {
    return (
      <p className="of-empty of-glass">
        <History size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.wish.noEchoes")}
      </p>
    );
  }
  return (
    <section className="of-section of-glass" aria-labelledby="of-echoes">
      <h2 id="of-echoes" className="of-section-title" tabIndex={-1}>
        {t("ui.otomeForge.wish.echoesTitle")}
      </h2>
      <p className="of-hint">{t("ui.otomeForge.wish.echoesText")}</p>
      <ul className="of-echoes">
        {wish.echoes.map((banner) => {
          const li = view.lis.find((item) => item.id === banner.featuredLi) ?? null;
          const name = banner.title || banner.five.title;
          return (
            <li key={banner.key}>
              <button
                type="button"
                className="of-echo of-glass"
                style={li ? ({ "--of-li-accent": accentOf(li) } as CSSProperties) : undefined}
                onClick={() => onOpen(banner.key)}
              >
                <ItemArt item={banner.five} view={view} fallbackUrl={readyArt(banner.art)} />
                <span className="of-echo-text">
                  <span className="of-echo-kind">{tabLabel(t, banner.kind, li?.name ?? null)}</span>
                  <span className="of-echo-title">{name}</span>
                  <span className="of-echo-dates">
                    {t("ui.otomeForge.wish.echoDates", {
                      from: formatDay(banner.startsDay, locale),
                      to: formatDay(banner.endsDay, locale),
                    })}
                  </span>
                </span>
                {banner.five.owned ? (
                  <span className="of-badge of-badge--soft">{t("ui.otomeForge.wish.owned")}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── The Memory Selector: at affection 10, each love interest offers one of their Memories, once ──

function Selectors({ runKey, view, selectors }: { runKey: string; view: RunView; selectors: SelectorView[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const offered = selectors.filter((selector) => selector.available && selector.choices.length > 0);
  if (!offered.length) return null;
  const shown = offered.find((selector) => selector.li === open) ?? null;
  return (
    <section className="of-section of-glass of-selectors" aria-labelledby="of-selectors">
      <h2 id="of-selectors" className="of-section-title">
        {t("ui.otomeForge.wish.selectorTitle")}
      </h2>
      <p className="of-hint">{t("ui.otomeForge.wish.selectorText")}</p>
      <ul className="of-selector-list">
        {offered.map((selector) => {
          const li = view.lis.find((item) => item.id === selector.li);
          if (!li) return null;
          return (
            <li key={selector.li}>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                style={{ "--of-li-accent": accentOf(li) } as CSSProperties}
                onClick={() => setOpen(selector.li)}
              >
                <Gift size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.wish.selectorFrom", { name: li.name })}
              </button>
            </li>
          );
        })}
      </ul>
      {shown ? <SelectorDialog runKey={runKey} view={view} selector={shown} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

function SelectorDialog({
  runKey,
  view,
  selector,
  onClose,
}: {
  runKey: string;
  view: RunView;
  selector: SelectorView;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const group = useId();
  const [picked, setPicked] = useState<string | null>(selector.choices[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const li = view.lis.find((item) => item.id === selector.li);
  const claim = async () => {
    if (busy || !picked) return;
    setBusy(true);
    setError(null);
    try {
      await otome.post(`${runPath(runKey)}/selector/${encodeURIComponent(selector.li)}`, { item: picked });
      await invalidateCollection(queryClient, runKey);
      onClose();
    } catch (failure) {
      setError(otome.errorMessage(failure));
      setBusy(false);
    }
  };
  return (
    <Dialog
      wide
      title={t("ui.otomeForge.wish.selectorFrom", { name: li?.name ?? "" })}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button
            type="button"
            className="of-button of-button--quiet of-glass"
            onClick={() => {
              if (!busy) onClose();
            }}
            aria-disabled={busy}
          >
            {t("ui.otomeForge.reader.notNow")}
          </button>
          <button
            type="button"
            className="of-button of-button--primary"
            aria-disabled={busy || !picked}
            onClick={() => void claim()}
          >
            <Gift size={16} strokeWidth={2} aria-hidden="true" />
            {busy ? t("ui.otomeForge.wish.claiming") : t("ui.otomeForge.wish.claim")}
          </button>
        </>
      }
    >
      <p className="of-body">{t("ui.otomeForge.wish.selectorDialogText", { name: li?.name ?? "" })}</p>
      <fieldset className="of-fieldset">
        <legend className="of-visually-hidden">{t("ui.otomeForge.wish.selectorTitle")}</legend>
        <div className="of-choices">
          {selector.choices.map((item) => (
            <label key={item.id} className="of-choice of-glass" data-checked={picked === item.id}>
              <input
                type="radio"
                className="of-visually-hidden"
                name={group}
                value={item.id}
                checked={picked === item.id}
                onChange={() => setPicked(item.id)}
              />
              <span className="of-choice-head">
                <RarityStars rarity={5} />
                <span className="of-choice-title">{item.title}</span>
              </span>
              {item.premise ? <span className="of-choice-text">{item.premise}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

// ── A wish arriving: the letter, a reveal for each 5★, then the results ──

interface PullSequenceProps {
  view: RunView;
  sequence: Sequence;
  resolve: (item: ItemView) => ItemView;
  actions: ItemActions;
  reducedMotion: boolean;
  onPhase: (phase: Sequence["phase"]) => void;
  onClose: () => void;
  onOpenStory: (key: string) => void;
  onOpenWardrobe: () => void;
}

function PullSequence({
  view,
  sequence,
  resolve,
  actions,
  reducedMotion,
  onPhase,
  onClose,
  onOpenStory,
  onOpenWardrobe,
}: PullSequenceProps) {
  const { t } = useTranslation();
  const audio = useOtomeAudio();
  const { results, phase, banner } = sequence;
  const fives = results.flatMap((result, index) => (result.rarity === 5 ? [index] : []));
  const bannerArt = readyArt(banner.art) ?? readyArt(resolve(banner.five).art);
  const toResults = () => onPhase({ at: "results" });
  const afterReveal = (index: number) => {
    const next = fives.indexOf(index) + 1;
    if (next < fives.length) onPhase({ at: "reveal", index: fives[next]! });
    else toResults();
  };

  let body: ReactNode;
  if (phase.at === "letter") {
    body = (
      <SealedLetter
        rarity={bestRarity(results)}
        to={view.player.name}
        count={results.length}
        reducedMotion={reducedMotion}
        onBreak={() => audio?.playSfx(LETTER_SOUND)}
        onOpened={() => (fives.length ? onPhase({ at: "reveal", index: fives[0]! }) : toResults())}
      />
    );
  } else if (phase.at === "reveal" && results[phase.index]) {
    const result = results[phase.index]!;
    body = (
      <Reveal5
        key={phase.index}
        view={view}
        item={resolve(result.item)}
        isNew={result.isNew}
        fallbackUrl={bannerArt}
        position={fives.length > 1 ? { index: fives.indexOf(phase.index) + 1, total: fives.length } : null}
        actions={actions}
        reducedMotion={reducedMotion}
        onContinue={() => afterReveal(phase.index)}
      />
    );
  } else {
    body = (
      <TenPullGrid
        view={view}
        results={results}
        resolve={resolve}
        spent={sequence.spent}
        actions={actions}
        bannerArt={bannerArt}
        reducedMotion={reducedMotion}
        onDone={onClose}
        onOpenStory={onOpenStory}
        onOpenWardrobe={onOpenWardrobe}
      />
    );
  }

  const onResults = phase.at === "results";
  return (
    <StageTakeover
      label={t("ui.otomeForge.wish.overlayLabel")}
      rarity={RARITY_NAMES[bestRarity(results)]}
      onEscape={onResults ? onClose : toResults}
      top={
        onResults ? null : (
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small of-skip"
            onClick={toResults}
          >
            {t("ui.otomeForge.wish.skip")}
          </button>
        )
      }
    >
      {body}
    </StageTakeover>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const focusables = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((item) => item.getClientRects().length > 0);

interface StageTakeoverProps {
  label: string;
  rarity: string;
  /** Escape: Skip while the wish arrives, Done on its results. */
  onEscape: () => void;
  top: ReactNode;
  children: ReactNode;
}

/**
 * The whole stage while a wish arrives: the top bar and dock behind it are inert, Tab stays inside, Escape skips, and
 * focus goes back to the wish button when it closes. A dialog opened from inside (the prompt review) may let the body
 * go when it closes, so the takeover holds it again after every render.
 */
function StageTakeover({ label, rarity, onEscape, top, children }: StageTakeoverProps) {
  const stage = useStageLayer();
  const ref = useRef<HTMLDivElement>(null);
  // Read while rendering, before the letter inside takes focus in its own (earlier) effect.
  const [previous] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));

  useEffect(() => {
    if (stage) stage.body.inert = true;
  });
  useEffect(() => {
    if (!stage) return;
    return () => {
      stage.body.inert = false;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [previous, stage]);

  // Keys while focus has fallen out of the page (the pressed control left): Escape still skips, Tab comes back in.
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    const onDocumentKey = (event: globalThis.KeyboardEvent) => {
      const panel = ref.current;
      if (!panel || !focusLost()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        escape.current();
      } else if (event.key === "Tab") {
        event.preventDefault();
        const items = focusables(panel);
        (event.shiftKey ? items.at(-1) : items[0])?.focus();
      }
    };
    document.addEventListener("keydown", onDocumentKey);
    return () => document.removeEventListener("keydown", onDocumentKey);
  }, []);

  if (!stage) return null;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const panel = ref.current;
    // Keys from a dialog opened over the takeover are that dialog's own.
    if (!panel || !(event.target instanceof Node) || !panel.contains(event.target)) return;
    if (event.key === "Escape") {
      event.stopPropagation();
      onEscape();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusables(panel);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return createPortal(
    <div
      ref={ref}
      className="of-takeover"
      data-rarity={rarity}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      <div className="of-takeover-sky" aria-hidden="true" />
      <div className="of-takeover-top">{top}</div>
      <div className="of-takeover-body">{children}</div>
    </div>,
    stage.layer,
  );
}
