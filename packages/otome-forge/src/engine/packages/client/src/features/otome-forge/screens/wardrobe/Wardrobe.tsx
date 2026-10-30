// ──────────────────────────────────────────────
// Otome Forge: the Wardrobe. Complete looks only, for each love interest and for the player (Me): wear one at home,
// show one of hers to a love interest (their one line about it, voiced; the first show of a look pays affection), and
// the couple sets a look of hers makes with one of theirs, with a pair portrait once both are painted. A love
// interest is named or referred to by their own pronouns, never "him" by default.
// ──────────────────────────────────────────────
// Routes (S/routes/wardrobe.ts): GET /runs/:run/wardrobe → WardrobeView; POST .../wardrobe/wear {owner, look} →
// {wardrobe} (her new look is noticed by a love interest: P19, written in the background while `noticing`); POST
// .../wardrobe/show {li, look} → ShowResult (P24). An unopened look is opened here as anywhere else (hooks/use-items).
// Home (M3) shows the worn looks and HeNoticed (components/HeNoticed.tsx) too; useWearLook is exported for it.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Heart, House, Paintbrush, RotateCcw, Sparkle, Sparkles, X } from "lucide-react";
import { useOtomeApi } from "../../api";
import { CostHint } from "../../components/CostHint";
import { Dialog } from "../../components/Dialog";
import { HeNoticed } from "../../components/HeNoticed";
import { LookImage } from "../../components/LookImage";
import { ImageDescription } from "../../components/ImageDescription";
import {
  imagesOn,
  invalidateCollection,
  paintWaits,
  readyArt,
  useItemActions,
  useRefocus,
  wardrobeQueryKey,
  type ItemActions,
  type PaintTarget,
} from "../../hooks/use-items";
import { useAudioSnapshot, useOtomeAudio } from "../../hooks/use-otome-audio";
import { runPath } from "../../hooks/use-reader";
import { accentOf, initialsOf } from "../../lib/accent";
import type { LiId, RunLiView, RunView } from "../../shared/api-types";
import { FACES } from "../../shared/faces";
import type { CoupleSet, LookView, ShowResult, WardrobeOwner, WardrobeView, WearResult } from "../../shared/wardrobe";
import type { ItemView } from "../../shared/wish";
import { FACE_LABEL_KEYS } from "../reader/FacePlate";
import { OpenCost, PaintReviewDialog, RarityStars } from "../wish/TenPullGrid";

/** While a look paints or a love interest is noticing hers, the wardrobe is read again this often. */
const POLL_MS = 3_000;

const working = (wardrobe: WardrobeView | undefined) =>
  !!wardrobe &&
  (wardrobe.noticing ||
    [...Object.values(wardrobe.him).flat(), ...wardrobe.me].some((look) => look.art?.state === "pending") ||
    wardrobe.couples.some((couple) => couple.pair?.state === "pending"));

export function useWardrobe(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: wardrobeQueryKey(runKey),
    queryFn: () => otome.get<WardrobeView>(`${runPath(runKey)}/wardrobe`),
    refetchInterval: (query) => (working(query.state.data) ? POLL_MS : false),
  });
}

/**
 * Wears a look at home (his on Home and in the story's faces, hers on Home's Me). Exported for Home (M3), which may
 * offer the same switch. One wear at a time; the wardrobe and everything that shows a worn look are read again.
 */
export function useWearLook(runKey: string) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [wearing, setWearing] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ owner: WardrobeOwner; message: string } | null>(null);
  const lock = useRef(false);
  const wear = async (owner: WardrobeOwner, look: string): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setWearing(`${owner}/${look}`);
    setFailure(null);
    try {
      const { wardrobe } = await otome.post<WearResult>(`${runPath(runKey)}/wardrobe/wear`, { owner, look });
      queryClient.setQueryData(wardrobeQueryKey(runKey), wardrobe);
      await invalidateCollection(queryClient, runKey);
      return true;
    } catch (cause) {
      setFailure({ owner, message: otome.errorMessage(cause) });
      return false;
    } finally {
      lock.current = false;
      setWearing(null);
    }
  };
  return { wear, wearing, error: failure?.message ?? null, errorOwner: failure?.owner ?? null };
}

const ownerName = (t: ReturnType<typeof useTranslation>["t"], owner: WardrobeOwner, lis: RunLiView[]) =>
  owner === "me" ? t("ui.otomeForge.wardrobe.me") : (lis.find((li) => li.id === owner)?.name ?? "");

/** The pair portrait's routes (S/routes/wardrobe.ts: POST .../wardrobe/pair {hers} and .../pair/prompt {hers}). */
const pairTarget = (runKey: string, couple: CoupleSet): PaintTarget => ({
  id: `pair:${couple.his.id}:${couple.hers.id}`,
  subject: `${couple.his.name} · ${couple.hers.name}`,
  paintPath: `${runPath(runKey)}/wardrobe/pair`,
  promptPath: `${runPath(runKey)}/wardrobe/pair/prompt`,
  body: { hers: couple.hers.id },
});

interface WardrobeProps {
  runKey: string;
  view: RunView;
  /** Opens a look's first-wear scene in the reader. */
  onOpenStory: (key: string) => void;
  /** Whose looks show first: a love interest, or "me". */
  initialOwner?: WardrobeOwner;
}

export function Wardrobe({ runKey, view, onOpenStory, initialOwner }: WardrobeProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const group = useId();
  const wardrobe = useWardrobe(runKey);
  const actions = useItemActions(runKey);
  const wearing = useWearLook(runKey);
  const [owner, setOwner] = useState<WardrobeOwner>(initialOwner ?? view.lis[0]?.id ?? "me");
  const [showing, setShowing] = useState<LookView | null>(null);
  const owners: WardrobeOwner[] = [...view.lis.map((li) => li.id), "me"];

  const head = (
    <div className="of-page-head of-page-head--tight">
      <h1 className="of-title" tabIndex={-1}>
        {t("ui.otomeForge.common.screenWardrobe")}
      </h1>
      <p className="of-hand">{t("ui.otomeForge.wardrobe.note")}</p>
    </div>
  );

  if (!wardrobe.data) {
    return (
      <div className="of-page of-ward">
        {head}
        {wardrobe.isError ? (
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(wardrobe.error)}</p>
            <button
              type="button"
              className="of-button of-button--quiet of-glass"
              onClick={() => void wardrobe.refetch()}
            >
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-center" role="status">
            <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">{t("ui.otomeForge.wardrobe.loading")}</p>
          </div>
        )}
      </div>
    );
  }

  const data = wardrobe.data;
  const looks = owner === "me" ? data.me : (data.him[owner] ?? []);
  const li = owner === "me" ? null : (view.lis.find((item) => item.id === owner) ?? null);
  const couples = data.couples.filter((couple) => owner === "me" || couple.his.li === owner);

  return (
    <div className="of-page of-ward">
      {head}
      <fieldset className="of-ward-owners of-glass">
        <legend className="of-visually-hidden">{t("ui.otomeForge.wardrobe.whose")}</legend>
        {owners.map((value) => {
          const person = view.lis.find((item) => item.id === value) ?? null;
          const checked = owner === value;
          return (
            <label
              key={value}
              className="of-ward-owner"
              data-checked={checked}
              style={person ? ({ "--of-li-accent": accentOf(person) } as CSSProperties) : undefined}
            >
              <input
                type="radio"
                className="of-visually-hidden"
                name={group}
                value={value}
                checked={checked}
                onChange={() => setOwner(value)}
              />
              <span className="of-ward-owner-dot" aria-hidden="true">
                {person ? initialsOf(person.name) : <Sparkles size={12} strokeWidth={2} />}
              </span>
              <span className="of-ward-owner-name">{ownerName(t, value, view.lis)}</span>
            </label>
          );
        })}
      </fieldset>

      <section className="of-section of-glass" aria-labelledby={`${group}-looks`}>
        <h2 id={`${group}-looks`} className="of-section-title">
          {owner === "me"
            ? t("ui.otomeForge.wardrobe.myLooks")
            : t("ui.otomeForge.wardrobe.theirLooks", { name: li?.name ?? "" })}
        </h2>
        {/* One live region for the hint and the line that replaces it, so the line itself is announced. */}
        {owner === "me" ? (
          <div className="of-live" role="status">
            {data.noticing ? (
              <p className="of-hint">{t("ui.otomeForge.wardrobe.noticing")}</p>
            ) : (
              <HeNoticed view={view} noticed={data.noticed} />
            )}
          </div>
        ) : null}
        {looks.length ? (
          <ul className="of-ward-grid">
            {looks.map((look) => (
              <li key={look.id}>
                <LookCard
                  runKey={runKey}
                  view={view}
                  look={look}
                  person={li}
                  actions={actions}
                  wearing={wearing.wearing === `${owner}/${look.id}`}
                  wearBusy={!!wearing.wearing}
                  onWear={() => void wearing.wear(owner, look.id)}
                  onShow={() => setShowing(look)}
                  onOpenStory={onOpenStory}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-empty">{t("ui.otomeForge.wardrobe.none")}</p>
        )}
        {wearing.error && wearing.errorOwner === owner ? (
          <p className="of-notice of-notice--error" role="alert">
            {wearing.error}
          </p>
        ) : null}
        <p className="of-hint">{t("ui.otomeForge.wardrobe.hint")}</p>
      </section>

      {couples.length ? (
        <section className="of-section of-glass" aria-labelledby={`${group}-couples`}>
          <h2 id={`${group}-couples`} className="of-section-title">
            {t("ui.otomeForge.wardrobe.couplesTitle")}
          </h2>
          <p className="of-hint">{t("ui.otomeForge.wardrobe.couplesText")}</p>
          <ul className="of-couples">
            {couples.map((couple) => (
              <li key={`${couple.his.id}:${couple.hers.id}`}>
                <CoupleCard runKey={runKey} view={view} couple={couple} actions={actions} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {showing ? <ShowDialog runKey={runKey} view={view} look={showing} onClose={() => setShowing(null)} /> : null}
      <PaintReviewDialog actions={actions} />
    </div>
  );
}

/** A look as an item, for its first open and its paint (the Wardrobe lists looks, not items). */
const lookItem = (look: LookView): ItemView | null =>
  look.item
    ? {
        id: look.id,
        kind: look.item.kind,
        rarity: look.item.rarity,
        banner: "",
        li: look.owner === "me" ? null : look.owner,
        title: look.item.title,
        look: { name: look.name },
        owned: true,
        art: look.art,
        story: look.story ?? null,
      }
    : null;

interface LookCardProps {
  runKey: string;
  view: RunView;
  look: LookView;
  /** Whose look (null for hers). */
  person: RunLiView | null;
  actions: ItemActions;
  wearing: boolean;
  wearBusy: boolean;
  onWear: () => void;
  onShow: () => void;
  onOpenStory: (key: string) => void;
}

function LookCard({ view, look, person, actions, wearing, wearBusy, onWear, onShow, onOpenStory }: LookCardProps) {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLHeadingElement>(null);
  const wornRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const item = lookItem(look);
  const name = look.name || t("ui.otomeForge.wardrobe.baseLook");
  const url = look.url ?? readyArt(look.art);
  const who = person?.name ?? view.player.name;
  const busy = item ? actions.busy.has(item.id) : false;
  const error = item ? actions.errors[item.id] : undefined;
  const faces = look.faces ? FACES.filter((face) => look.faces?.[face]) : [];
  const images = imagesOn(view);
  // Wearing one of theirs paints its faces in the background when they are not painted yet (S/routes/wardrobe.ts).
  const wearPaintsFaces = look.owner !== "me" && images && view.world.images.expressions && faces.length < FACES.length;
  const held = paintWaits(look.art);
  const shownAll = look.owner === "me" && view.lis.length > 0 && view.lis.every((li) => look.shownTo?.includes(li.id));
  const single = view.lis.length === 1 ? view.lis[0]! : null;
  const showLabel = single
    ? t("ui.otomeForge.wardrobe.show", { name: single.name })
    : t("ui.otomeForge.wardrobe.showSomeone");
  // Open, Paint or Wear leaves once it is done: focus goes to "Worn at home", the card's next action, or its name.
  const onFocus = useRefocus(
    `${look.unopened}|${held}|${look.worn}`,
    () =>
      (look.worn ? wornRef.current : null) ??
      actionsRef.current?.querySelector<HTMLElement>("button") ??
      nameRef.current,
  );
  return (
    <article
      className="of-ward-look"
      onFocus={onFocus}
      data-worn={look.worn}
      style={person ? ({ "--of-li-accent": accentOf(person) } as CSSProperties) : undefined}
    >
      <span className="of-ward-frame" data-painting={look.art?.state === "pending"} aria-hidden="true">
        <LookImage
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          fallback={<span className="of-item-initials">{initialsOf(who)}</span>}
        />
        {look.worn ? (
          <span className="of-ward-worn">
            <House size={11} strokeWidth={2.4} />
          </span>
        ) : null}
      </span>
      <div className="of-ward-look-body">
        <h3 ref={nameRef} className="of-ward-look-name" tabIndex={-1}>
          {name}
        </h3>
        {look.item ? <RarityStars rarity={look.item.rarity} /> : null}
        <ImageDescription text={look.description} />
        {look.worn ? (
          <p ref={wornRef} className="of-ward-look-state" tabIndex={-1}>
            {t("ui.otomeForge.wardrobe.worn")}
          </p>
        ) : null}
        {look.art?.state === "pending" ? (
          <p className="of-hint" role="status">
            {t("ui.otomeForge.wish.painting")}
          </p>
        ) : null}
        {faces.length ? (
          <p className="of-ward-faces">
            <span className="of-visually-hidden">
              {t("ui.otomeForge.wardrobe.faces", {
                faces: faces.map((face) => t(FACE_LABEL_KEYS[face])).join(", "),
              })}
            </span>
            {faces.map((face) => (
              <LookImage key={face} src={look.faces?.[face]} alt="" title={t(FACE_LABEL_KEYS[face])} loading="lazy" />
            ))}
          </p>
        ) : null}
        <div ref={actionsRef} className="of-ward-actions">
          {item && look.unopened ? (
            <>
              <button
                type="button"
                className="of-button of-button--primary of-button--small"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void actions.open(item);
                }}
              >
                <Sparkle size={14} strokeWidth={2} aria-hidden="true" />
                {busy ? t("ui.otomeForge.wish.opening") : t("ui.otomeForge.wardrobe.open")}
              </button>
              <OpenCost item={item} images={images} ask={view.world.images.ask} />
            </>
          ) : null}
          {item && !look.unopened && held ? (
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void actions.paintItem(item);
                }}
              >
                {look.art?.state === "waiting-consent" ? (
                  <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
                ) : (
                  <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                )}
                {look.art?.state === "waiting-consent"
                  ? t("ui.otomeForge.wish.paint")
                  : t("ui.otomeForge.wish.paintRetry")}
              </button>
              <CostHint images={1} />
            </>
          ) : null}
          {look.wearable && !look.worn ? (
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass of-button--small"
                aria-disabled={wearBusy}
                aria-label={t("ui.otomeForge.wardrobe.wearNamed", { look: name })}
                onClick={() => {
                  if (!wearBusy) onWear();
                }}
              >
                <House size={14} strokeWidth={2} aria-hidden="true" />
                {wearing ? t("ui.otomeForge.wardrobe.wearing") : t("ui.otomeForge.wardrobe.wear")}
              </button>
              {wearPaintsFaces ? (
                <CostHint images={FACES.length} note={t("ui.otomeForge.setup.costExpressionsNote")} />
              ) : null}
            </>
          ) : null}
          {look.owner === "me" && look.item && view.lis.length ? (
            // Showing is one line of theirs (no picture): it works without images too.
            <button
              type="button"
              className="of-button of-button--quiet of-glass of-button--small"
              aria-label={
                single
                  ? t("ui.otomeForge.wardrobe.showNamed", { name: single.name, look: name })
                  : t("ui.otomeForge.wardrobe.showSomeoneNamed", { look: name })
              }
              onClick={onShow}
            >
              <Heart size={14} strokeWidth={2} aria-hidden="true" />
              {showLabel}
              {shownAll ? <Check size={13} strokeWidth={2.6} aria-hidden="true" /> : null}
            </button>
          ) : null}
          {look.story?.key ? (
            <button
              type="button"
              className="of-button of-button--text of-button--small"
              onClick={() => onOpenStory(look.story!.key)}
            >
              <BookOpen size={14} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.wish.readFirstWear")}
            </button>
          ) : null}
        </div>
        {!look.wearable && !look.unopened && !held && look.art?.state !== "pending" ? (
          <p className="of-hint">
            {images ? t("ui.otomeForge.wardrobe.notWearable") : t("ui.otomeForge.wardrobe.notWearableNoImages")}
          </p>
        ) : null}
        {error ? (
          <p className="of-notice of-notice--error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function CoupleCard({
  runKey,
  view,
  couple,
  actions,
}: {
  runKey: string;
  view: RunView;
  couple: CoupleSet;
  actions: ItemActions;
}) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const li = view.lis.find((item) => item.id === couple.his.li) ?? null;
  const target = pairTarget(runKey, couple);
  const busy = actions.busy.has(target.id);
  const pair = readyArt(couple.pair);
  const painting = couple.pair?.state === "pending" || busy;
  // "Paint a pair portrait" leaves while it paints: focus goes to the set's title, then the status under it is read.
  const onFocus = useRefocus(`${painting}|${!!pair}`, () => titleRef.current);
  const half = (side: "his" | "hers") => {
    const look = couple[side];
    const name = side === "his" ? (li?.name ?? "") : view.player.name;
    return (
      <span className="of-couple-half" data-owned={look.owned}>
        <span className="of-ward-frame of-ward-frame--small" aria-hidden="true">
          <LookImage
            src={look.url}
            alt=""
            loading="lazy"
            fallback={<span className="of-item-initials">{initialsOf(name)}</span>}
          />
        </span>
        <span className="of-couple-name">{look.name}</span>
        <span className="of-couple-state">
          {look.owned ? (
            <>
              <Check size={12} strokeWidth={3} aria-hidden="true" />
              {t("ui.otomeForge.wardrobe.owned")}
            </>
          ) : (
            t("ui.otomeForge.wardrobe.missing")
          )}
        </span>
      </span>
    );
  };
  return (
    <article
      className="of-couple"
      onFocus={onFocus}
      data-complete={couple.complete}
      style={li ? ({ "--of-li-accent": accentOf(li) } as CSSProperties) : undefined}
    >
      <h3 ref={titleRef} className="of-couple-title" tabIndex={-1}>
        {li ? t("ui.otomeForge.wardrobe.coupleWith", { name: li.name }) : t("ui.otomeForge.wardrobe.couplesTitle")}
        {couple.complete ? <span className="of-badge">{t("ui.otomeForge.wardrobe.complete")}</span> : null}
      </h3>
      <div className="of-couple-pair">
        {half("his")}
        <Heart className="of-couple-heart" size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" />
        {half("hers")}
      </div>
      {pair ? (
        <img
          className="of-couple-portrait"
          src={pair}
          alt={t("ui.otomeForge.wardrobe.pairAlt", { name: li?.name ?? "" })}
        />
      ) : painting ? (
        <p className="of-hint" role="status">
          {t("ui.otomeForge.wardrobe.pairPainting")}
        </p>
      ) : couple.canPaintPair && imagesOn(view) ? (
        <div className="of-inline-actions">
          <button
            type="button"
            className="of-button of-button--quiet of-glass of-button--small"
            aria-disabled={busy}
            onClick={() => {
              if (!busy) void actions.paint(target);
            }}
          >
            <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
            {couple.pair?.state === "failed" || couple.pair?.state === "stopped"
              ? t("ui.otomeForge.wish.paintRetry")
              : t("ui.otomeForge.wardrobe.paintPair")}
          </button>
          <CostHint images={1} />
        </div>
      ) : !couple.complete ? (
        <p className="of-hint">{t("ui.otomeForge.wardrobe.coupleHint")}</p>
      ) : null}
      {actions.errors[target.id] ? (
        <p className="of-notice of-notice--error" role="alert">
          {actions.errors[target.id]}
        </p>
      ) : null}
    </article>
  );
}

/** Show {name} one of her looks: pick who (when there are several), then their line, voiced, in their face. */
function ShowDialog({
  runKey,
  view,
  look,
  onClose,
}: {
  runKey: string;
  view: RunView;
  look: LookView;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const audio = useOtomeAudio();
  const { speaking } = useAudioSnapshot();
  const [li, setLi] = useState<LiId | null>(view.lis.length === 1 ? view.lis[0]!.id : null);
  const [result, setResult] = useState<ShowResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef<string | null>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const person = view.lis.find((item) => item.id === li) ?? null;
  const name = look.name || t("ui.otomeForge.wardrobe.baseLook");
  const voiceRef = `show:${look.id}:${li ?? ""}`;

  const show = async (to: LiId) => {
    if (busy) return;
    setLi(to);
    setBusy(true);
    setError(null);
    try {
      const shown = await otome.post<ShowResult>(`${runPath(runKey)}/wardrobe/show`, { li: to, look: look.id });
      setResult(shown);
      void invalidateCollection(queryClient, runKey);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  // With one love interest there is no one to pick: they are shown at once.
  useEffect(() => {
    if (view.lis.length === 1 && started.current === null) {
      started.current = view.lis[0]!.id;
      void show(view.lis[0]!.id);
    }
    // Once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Their line is read out, and voiced when voices are on; focus moves to it so a screen reader hears it too.
  useEffect(() => {
    if (!result || !person) return;
    lineRef.current?.focus({ preventScroll: true });
    // Each Show writes a new line, and the clip kept under a ref is the first one voiced there: so none is kept.
    const line = { speaker: person.name, text: result.line, expression: result.face ?? "" } as const;
    void audio?.speak(line, voiceRef, { cache: false });
    // Once per line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  useEffect(() => () => audio?.stopVoice(), [audio]);

  const face =
    result?.face && person?.expressions?.[result.face]
      ? person.expressions[result.face]
      : (person?.worn?.url ?? person?.portrait);
  const affection = result?.grants.reduce((sum, grant) => sum + grant.affection, 0) ?? 0;
  return (
    <Dialog
      wide
      title={person ? t("ui.otomeForge.wardrobe.showTitle", { name: person.name, look: name }) : showTitle(t, name)}
      onClose={busy ? undefined : onClose}
      actions={
        <button
          type="button"
          className="of-button of-button--quiet of-glass"
          onClick={() => {
            if (!busy) onClose();
          }}
          aria-disabled={busy}
        >
          <X size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.wardrobe.close")}
        </button>
      }
    >
      {!result && !busy && (!li || error) ? (
        <ul className="of-show-list">
          {view.lis.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="of-candidate of-glass"
                style={{ "--of-li-accent": accentOf(item) } as CSSProperties}
                onClick={() => void show(item.id)}
              >
                <span className="of-avatar" aria-hidden="true">
                  {item.portrait ? <img src={item.portrait} alt="" /> : initialsOf(item.name)}
                </span>
                <span className="of-candidate-name">{t("ui.otomeForge.wardrobe.show", { name: item.name })}</span>
                {look.shownTo?.includes(item.id) ? (
                  <span className="of-candidate-reason">{t("ui.otomeForge.wardrobe.shownBefore")}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {busy ? (
        <div className="of-planning" role="status">
          <Heart className="of-pulse" size={24} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.wardrobe.showing", { name: person?.name ?? "" })}</p>
        </div>
      ) : null}
      {result && person ? (
        <figure className="of-show-line" style={{ "--of-li-accent": accentOf(person) } as CSSProperties}>
          <span className="of-avatar of-avatar--hero" aria-hidden="true">
            {face ? <img src={face} alt="" /> : initialsOf(person.name)}
          </span>
          <figcaption className="of-show-who">{person.name}</figcaption>
          <p ref={lineRef} className="of-show-text" tabIndex={-1}>
            “{result.line}”
          </p>
          {audio?.wouldSpeak({ speaker: person.name, text: result.line }) ? (
            <button
              type="button"
              className="of-button of-button--text of-button--small"
              onClick={() =>
                speaking === voiceRef
                  ? audio.stopVoice()
                  : void audio.speak({ speaker: person.name, text: result.line }, voiceRef, { cache: false })
              }
            >
              {speaking === voiceRef
                ? t("ui.otomeForge.audio.stopVoice")
                : t("ui.otomeForge.audio.playVoice", { name: person.name })}
            </button>
          ) : null}
          {affection ? (
            <p className="of-grant">
              <Heart size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />
              {t("ui.otomeForge.wardrobe.affection", { name: person.name, amount: affection })}
            </p>
          ) : null}
        </figure>
      ) : null}
      {error ? (
        <p className="of-notice of-notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}

const showTitle = (t: ReturnType<typeof useTranslation>["t"], look: string) =>
  t("ui.otomeForge.wardrobe.showWho", { look });
