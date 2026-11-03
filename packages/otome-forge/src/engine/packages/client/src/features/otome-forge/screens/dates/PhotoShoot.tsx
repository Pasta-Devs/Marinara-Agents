// ──────────────────────────────────────────────
// Otome Hearth: the Photo Shoot (#2087). One page: a place the story painted, what the two of you wear, and an
// expression and a pose for each of you, then Take picture: one photo of you posing for the camera together, kept in
// the Album and taped into his note on Home. No model call anywhere, so the player picks his expression and pose too.
// ──────────────────────────────────────────────
// Routes (S/routes/dates.ts): POST /runs/:run/photos/prompt (prompt review) and POST /runs/:run/photos {id, ...setup}.
// Take picture follows the story's image settings as the keepsake does: a confirm under Ask before painting, then the
// prompt review when the Engine asks for it, then one POST. A tap's photo id is kept through a failure or a lost answer,
// so Try again names the same photo and the server answers or repaints it once; it is new after a ready photo and
// whenever the setup changes. A shared pose is one pick for you both (SH/photos.ts withPose), and a change it makes to
// the other person's pose is announced. Only ids and the typed words are sent, never the translated labels.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, RotateCcw } from "lucide-react";
import { useOtomeApi } from "../../api";
import { Avatar } from "../../components/Avatar";
import { CostHint } from "../../components/CostHint";
import { Dialog } from "../../components/Dialog";
import { PromptReviewDialog, type ImagePrompt } from "../../components/PromptReviewDialog";
import { focusLost, imagesOn, invalidateCollection } from "../../hooks/use-items";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import { useOtomeProps } from "../../props";
import { BASE_LOOK, STORY_PLACE } from "../../shared/dates";
import {
  PHOTO_CUSTOM,
  PHOTO_DEFAULT_EXPRESSION,
  PHOTO_DEFAULT_POSE,
  PHOTO_EXPRESSIONS,
  PHOTO_SHARED_POSES,
  PHOTO_SOLO_POSES,
  PHOTO_TEXT_MAX,
  isSharedPose,
  newPhotoId,
  withPose,
  type PhotoExpression,
  type PhotoPick,
  type PhotoPose,
  type PhotoView,
} from "../../shared/photos";
import { Pills, TextField } from "../setup/parts";
import { useWardrobe } from "../wardrobe/Wardrobe";
import type { ActivityScreenProps } from "./DatesHub";
import { LookPicker, wornDateLook } from "./LookPicker";
import { PlacePicker, paintedPlaces } from "./PlacePicker";

// Literal keys, so the locale validator sees each one.
const EXPRESSION_KEYS: Record<PhotoExpression, string> = {
  smile: "ui.otomeForge.photoShoot.expressionSmile",
  laugh: "ui.otomeForge.photoShoot.expressionLaugh",
  wink: "ui.otomeForge.photoShoot.expressionWink",
  blush: "ui.otomeForge.photoShoot.expressionBlush",
  pout: "ui.otomeForge.photoShoot.expressionPout",
  smirk: "ui.otomeForge.photoShoot.expressionSmirk",
  fond: "ui.otomeForge.photoShoot.expressionFond",
  surprised: "ui.otomeForge.photoShoot.expressionSurprised",
};

/** Shared poses are labelled without names, so each reads the same in both lists ("Carries piggyback"). */
const POSE_KEYS: Record<PhotoPose, string> = {
  pose: "ui.otomeForge.photoShoot.posePose",
  peace: "ui.otomeForge.photoShoot.posePeace",
  wave: "ui.otomeForge.photoShoot.poseWave",
  "finger-heart": "ui.otomeForge.photoShoot.poseFingerHeart",
  "hand-on-hip": "ui.otomeForge.photoShoot.poseHandOnHip",
  "arms-crossed": "ui.otomeForge.photoShoot.poseArmsCrossed",
  "thumbs-up": "ui.otomeForge.photoShoot.poseThumbsUp",
  "hands-in-pockets": "ui.otomeForge.photoShoot.poseHandsInPockets",
  kiss: "ui.otomeForge.photoShoot.poseKiss",
  hug: "ui.otomeForge.photoShoot.poseHug",
  "play-fight": "ui.otomeForge.photoShoot.posePlayFight",
  "hold-hands": "ui.otomeForge.photoShoot.poseHoldHands",
  forehead: "ui.otomeForge.photoShoot.poseForehead",
  "back-to-back": "ui.otomeForge.photoShoot.poseBackToBack",
  "hand-heart": "ui.otomeForge.photoShoot.poseHandHeart",
  "cheek-kiss": "ui.otomeForge.photoShoot.poseCheekKiss",
  "cheek-kissed": "ui.otomeForge.photoShoot.poseCheekKissed",
  "piggyback-carry": "ui.otomeForge.photoShoot.posePiggybackCarry",
  "piggyback-ride": "ui.otomeForge.photoShoot.posePiggybackRide",
  "back-hug": "ui.otomeForge.photoShoot.poseBackHug",
  "back-hugged": "ui.otomeForge.photoShoot.poseBackHugged",
};

type Side = "his" | "her";
type Picks = Record<Side, PhotoPick>;

const START: PhotoPick = { expression: PHOTO_DEFAULT_EXPRESSION, pose: PHOTO_DEFAULT_POSE };

/** "custom" with no words of their own yet. */
const missingWords = (pick: PhotoPick) =>
  (pick.expression === PHOTO_CUSTOM && !pick.expressionText?.trim()) ||
  (pick.pose === PHOTO_CUSTOM && !pick.poseText?.trim());

/** A pick as the server takes it: ids, and only the words a "custom" pick has. */
function wire(pick: PhotoPick): PhotoPick {
  return {
    expression: pick.expression,
    ...(pick.expression === PHOTO_CUSTOM ? { expressionText: pick.expressionText?.trim() ?? "" } : {}),
    pose: pick.pose,
    ...(pick.pose === PHOTO_CUSTOM ? { poseText: pick.poseText?.trim() ?? "" } : {}),
  };
}

interface PersonPicksProps {
  /** Whose picks: his name, or "You". */
  who: string;
  /** The other one's name, as the shared-pose hint names them. */
  other: string;
  accent: string;
  pick: PhotoPick;
  onExpression: (expression: PhotoPick["expression"]) => void;
  onPose: (pose: PhotoPick["pose"]) => void;
  onText: (field: "expressionText" | "poseText", text: string) => void;
}

/** One person's expression (a preset or their own words) and pose (together, solo, or their own words). */
function PersonPicks({ who, other, accent, pick, onExpression, onPose, onText }: PersonPicksProps) {
  const { t } = useTranslation();
  const id = useId();
  const custom = { value: PHOTO_CUSTOM, label: t("ui.otomeForge.photoShoot.custom") } as const;
  const shared = isSharedPose(pick.pose);
  return (
    <section
      className="of-section of-glass of-photo-person"
      aria-labelledby={`${id}-who`}
      style={{ "--of-li-accent": accent } as CSSProperties}
    >
      <h2 id={`${id}-who`} className="of-section-title">
        {who}
      </h2>
      <Pills<PhotoPick["expression"]>
        legend={t("ui.otomeForge.photoShoot.expression")}
        value={pick.expression}
        options={[...PHOTO_EXPRESSIONS.map((value) => ({ value, label: t(EXPRESSION_KEYS[value]) })), custom]}
        onChange={onExpression}
        small
      />
      {pick.expression === PHOTO_CUSTOM ? (
        <TextField
          label={t("ui.otomeForge.photoShoot.customExpression")}
          value={pick.expressionText ?? ""}
          max={PHOTO_TEXT_MAX}
          counter
          hint={t("ui.otomeForge.photoShoot.customHint")}
          onChange={(text) => onText("expressionText", text)}
        />
      ) : null}
      <Pills<PhotoPick["pose"]>
        legend={t("ui.otomeForge.photoShoot.poseTogether")}
        value={shared ? pick.pose : null}
        options={PHOTO_SHARED_POSES.map((value) => ({ value, label: t(POSE_KEYS[value]) }))}
        onChange={onPose}
        small
      />
      <Pills<PhotoPick["pose"]>
        legend={t("ui.otomeForge.photoShoot.poseSolo")}
        value={shared ? null : pick.pose}
        options={[...PHOTO_SOLO_POSES.map((value) => ({ value, label: t(POSE_KEYS[value]) })), custom]}
        onChange={onPose}
        small
      />
      {pick.pose === PHOTO_CUSTOM ? (
        <TextField
          label={t("ui.otomeForge.photoShoot.customPose")}
          value={pick.poseText ?? ""}
          max={PHOTO_TEXT_MAX}
          counter
          hint={t("ui.otomeForge.photoShoot.customHint")}
          onChange={(text) => onText("poseText", text)}
        />
      ) : null}
      <p className="of-hint">{t("ui.otomeForge.photoShoot.sharedHint", { name: other })}</p>
    </section>
  );
}

export function PhotoShoot({ runKey, view, li: picked }: ActivityScreenProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { reviewImagePromptsBeforeSend } = useOtomeProps();
  const id = useId();
  // The run view's copy carries the newest level and portrait.
  const partner = view.lis.find((item) => item.id === picked.id) ?? picked;
  const accent = accentOf(partner);
  const herName = view.player.name || t("ui.otomeForge.photoShoot.you");
  const images = imagesOn(view);

  const places = paintedPlaces(view.world);
  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const place = places.find((entry) => entry.key === placeKey) ?? places[0] ?? null;

  // The looks each of them owns (the Wardrobe's list): the picker starts on what each wears now.
  const wardrobe = useWardrobe(runKey);
  const [looks, setLooks] = useState({ hisLook: BASE_LOOK, herLook: BASE_LOOK });
  const chosenLooks = useRef(false);
  const hisWorn = wornDateLook(wardrobe.data?.him[partner.id]);
  const herWorn = wornDateLook(wardrobe.data?.me);
  useEffect(() => {
    if (!chosenLooks.current) setLooks({ hisLook: hisWorn, herLook: herWorn });
  }, [hisWorn, herWorn]);

  const [picks, setPicks] = useState<Picks>({ his: START, her: START });
  const [announced, setAnnounced] = useState("");

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoView | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [review, setReview] = useState<ImagePrompt | null>(null);
  /** The photo a failed or lost tap was for: Try again sends it again. */
  const lastId = useRef<string | null>(null);
  const takeRef = useRef<HTMLButtonElement>(null);
  const againRef = useRef<HTMLButtonElement>(null);
  const restartRef = useRef(false);

  // A changed setup is a new photo (and a failure shown for the old one no longer applies).
  const setupKey = JSON.stringify([place?.key ?? null, looks, picks]);
  const shownSetup = useRef(setupKey);
  useEffect(() => {
    if (shownSetup.current === setupKey) return;
    shownSetup.current = setupKey;
    lastId.current = null;
    setPhoto((current) => (current?.art.state === "ready" ? current : null));
    setError(null);
  }, [setupKey]);

  const ready = photo?.art.state === "ready" && photo.art.url ? photo : null;
  // The print takes the place of Take picture (and Take another takes it back): focus goes with the button it replaced.
  useEffect(() => {
    if (ready && focusLost()) againRef.current?.focus({ preventScroll: true });
    if (!ready && restartRef.current) {
      restartRef.current = false;
      takeRef.current?.focus({ preventScroll: true });
    }
  }, [ready]);

  const pickFor = (side: Side) => (next: Partial<PhotoPick>) =>
    setPicks((current) => ({ ...current, [side]: { ...current[side], ...next } }));
  const poseFor = (side: Side) => (pose: PhotoPick["pose"]) => {
    const other: Side = side === "his" ? "her" : "his";
    const next = withPose(picks, side, pose);
    const changed = next[other].pose;
    if (changed !== picks[other].pose && changed !== PHOTO_CUSTOM) {
      setAnnounced(
        t("ui.otomeForge.photoShoot.poseChanged", {
          name: other === "his" ? partner.name : herName,
          pose: t(POSE_KEYS[changed]),
        }),
      );
    }
    setPicks(next);
  };

  // Why Take picture cannot be pressed, said beside it (its aria-describedby).
  const reason = !images
    ? t("ui.otomeForge.photoShoot.noImages")
    : !place
      ? t(places.length ? "ui.otomeForge.photoShoot.needsPlace" : "ui.otomeForge.photoShoot.noPlaces")
      : wardrobe.isPending
        ? t("ui.otomeForge.photoShoot.needsLooks")
        : missingWords(picks.his) || missingWords(picks.her)
          ? t("ui.otomeForge.photoShoot.needsText")
          : null;

  const setup = () => ({
    li: partner.id,
    place: place!.key,
    ...looks,
    his: wire(picks.his),
    her: wire(picks.her),
  });

  /** One POST for the photo, with the reviewed prompt when there was one. */
  const take = async (prompt?: ImagePrompt) => {
    if (!place) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    const photoId = (lastId.current ??= newPhotoId());
    try {
      const { photo: taken } = await otome.post<{ photo: PhotoView }>(`${runPath(runKey)}/photos`, {
        id: photoId,
        ...setup(),
        ...(prompt ?? {}),
      });
      setPhoto(taken);
      setReview(null);
      if (taken.art.state === "ready") lastId.current = null;
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      busyRef.current = false;
      setBusy(false);
      // The Album, Home and the Wardrobe read again, even once this screen has gone.
      void invalidateCollection(queryClient, runKey);
    }
  };

  /** After the confirm (or none): review the prompt first when the Engine asks for that, else take it. */
  const start = async () => {
    setConfirming(false);
    if (!reviewImagePromptsBeforeSend) {
      await take();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      setReview(await otome.post<ImagePrompt>(`${runPath(runKey)}/photos/prompt`, setup()));
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const tap = () => {
    if (busyRef.current || reason) return;
    if (view.world.images.ask) setConfirming(true);
    else void start();
  };

  const failed = photo?.art.state === "failed" || photo?.art.state === "stopped";
  const reasonId = `${id}-reason`;
  return (
    <div className="of-page of-dates of-photo-shoot" style={{ "--of-li-accent": accent } as CSSProperties}>
      <header className="of-date-head">
        <Avatar name={partner.name} url={partner.portrait} accent={accent} size={54} />
        <div className="of-date-head-text">
          <p className="of-eyebrow">{t("ui.otomeForge.common.screenPhotoShoot")}</p>
          <h1 className="of-title of-title--page" tabIndex={-1}>
            {t("ui.otomeForge.dates.photoTitle", { name: partner.name })}
          </h1>
          <p className="of-hand">{t("ui.otomeForge.photoShoot.note")}</p>
        </div>
      </header>

      {!images ? <p className="of-notice">{t("ui.otomeForge.photoShoot.noImages")}</p> : null}

      <section className="of-section of-glass" aria-labelledby={`${id}-place`}>
        <h2 id={`${id}-place`} className="of-section-title">
          {t("ui.otomeForge.photoShoot.placeTitle")}
        </h2>
        {places.length ? (
          <PlacePicker
            storyOnly
            legend={t("ui.otomeForge.photoShoot.placeLegend", { name: partner.name })}
            partnerName={partner.name}
            storyPlaces={places}
            value={place ? { place: STORY_PLACE, storyPlace: { key: place.key, name: place.name } } : null}
            onChange={(next) => {
              if (next.storyPlace) setPlaceKey(next.storyPlace.key);
            }}
          />
        ) : (
          <p className="of-empty">{t("ui.otomeForge.photoShoot.noPlaces")}</p>
        )}
      </section>

      <section className="of-section of-glass" aria-labelledby={`${id}-looks`}>
        <h2 id={`${id}-looks`} className="of-section-title">
          {t("ui.otomeForge.photoShoot.looksTitle")}
        </h2>
        <LookPicker
          partner={partner}
          player={view.player}
          hisLooks={wardrobe.data?.him[partner.id]}
          herLooks={wardrobe.data?.me}
          {...looks}
          note={t("ui.otomeForge.photoShoot.lookNote")}
          onChange={(next) => {
            chosenLooks.current = true;
            setLooks(next);
          }}
        />
      </section>

      <PersonPicks
        who={partner.name}
        other={herName}
        accent={accent}
        pick={picks.his}
        onExpression={(expression) => pickFor("his")({ expression })}
        onPose={poseFor("his")}
        onText={(field, text) => pickFor("his")(field === "poseText" ? { poseText: text } : { expressionText: text })}
      />
      <PersonPicks
        who={t("ui.otomeForge.photoShoot.you")}
        other={partner.name}
        accent="var(--of-champagne)"
        pick={picks.her}
        onExpression={(expression) => pickFor("her")({ expression })}
        onPose={poseFor("her")}
        onText={(field, text) => pickFor("her")(field === "poseText" ? { poseText: text } : { expressionText: text })}
      />
      {/* The other person's pose a shared pick changed, said once. */}
      <p className="of-visually-hidden" role="status">
        {announced}
      </p>

      <section className="of-section of-glass of-photo-take" aria-labelledby={`${id}-take`} aria-busy={busy}>
        <h2 id={`${id}-take`} className="of-visually-hidden">
          {t("ui.otomeForge.photoShoot.take")}
        </h2>
        {ready ? (
          <>
            <figure className="of-keepsake-photo of-photo-result">
              <img
                src={ready.art.url}
                alt={t("ui.otomeForge.photoShoot.alt", { name: partner.name, place: ready.place.name })}
              />
              <figcaption className="of-keepsake-caption">{ready.place.name}</figcaption>
            </figure>
            <p className="of-hint" role="status">
              {t("ui.otomeForge.photoShoot.saved", { name: partner.name })}
            </p>
            <button
              ref={againRef}
              type="button"
              className="of-button of-button--primary of-button--small"
              onClick={() => {
                restartRef.current = true;
                setPhoto(null);
              }}
            >
              <Camera size={15} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.photoShoot.again")}
            </button>
          </>
        ) : (
          <>
            {busy && !review ? (
              <p className="of-hint of-keepsake-busy" role="status">
                <Camera className="of-pulse" size={15} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.photoShoot.taking")}
              </p>
            ) : null}
            {failed && !busy ? (
              <p className="of-notice of-notice--error" role="alert">
                {photo?.art.state === "stopped"
                  ? t("ui.otomeForge.photoShoot.stopped")
                  : t("ui.otomeForge.photoShoot.failed")}
              </p>
            ) : null}
            {error && !review ? (
              <p className="of-notice of-notice--error" role="alert">
                {error}
              </p>
            ) : null}
            <CostHint images={1} note={t("ui.otomeForge.photoShoot.noCalls")} />
            <button
              ref={takeRef}
              type="button"
              className="of-button of-button--primary"
              aria-disabled={busy || !!reason}
              aria-describedby={reason ? reasonId : undefined}
              onClick={tap}
            >
              {failed || error ? (
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Camera size={16} strokeWidth={2} aria-hidden="true" />
              )}
              {failed || error ? t("ui.otomeForge.common.retry") : t("ui.otomeForge.photoShoot.take")}
            </button>
            {reason ? (
              <p id={reasonId} className="of-hint">
                {reason}
              </p>
            ) : null}
          </>
        )}
      </section>

      {confirming ? (
        <Dialog
          title={t("ui.otomeForge.photoShoot.askTitle")}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                onClick={() => setConfirming(false)}
              >
                {t("ui.otomeForge.photoShoot.askNo")}
              </button>
              <button type="button" className="of-button of-button--primary" onClick={() => void start()}>
                <Camera size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.photoShoot.askYes")}
              </button>
            </>
          }
        >
          <p className="of-body">{t("ui.otomeForge.photoShoot.askText", { name: partner.name })}</p>
          <CostHint images={1} note={t("ui.otomeForge.photoShoot.noCalls")} />
        </Dialog>
      ) : null}
      {review ? (
        <PromptReviewDialog
          subject={t("ui.otomeForge.photoShoot.subject", { name: partner.name })}
          initial={review}
          busy={busy}
          error={error}
          sendLabel={t("ui.otomeForge.photoShoot.take")}
          onSend={(prompt) => {
            if (!busyRef.current) void take(prompt);
          }}
          onSkip={() => setReview(null)}
        />
      ) : null}
    </div>
  );
}
