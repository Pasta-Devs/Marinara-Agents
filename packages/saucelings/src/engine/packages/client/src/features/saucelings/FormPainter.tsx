import { useMutation, useMutationState, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  SAUCELING_STAGES,
  type SaucelingDesign,
  type SaucelingPet,
  type SaucelingSpeciesId,
  type SaucelingStage,
  type SaucelingStateResponse,
} from "../../../../shared/src/features/agents/saucelings/types.js";
import { spriteStrip } from "../../../../shared/src/features/agents/saucelings/vocabulary.js";
import { friendlyError, marinaraRequest, saucelingsRequest } from "./api.js";
import { caretakerCardQuery, FriendlyError, useCaretakerFigure } from "./care-ui.js";
import { pickStandingSprite } from "./caretaker-look.js";
import { figureImageFrom, formImageFrom, pictureReference, sheetFormsFrom, spriteReference } from "./image-canvas.js";
import {
  FIGURE_NEGATIVE,
  SHEET_NEGATIVE,
  figureAttempts,
  formNegative,
  formRequest,
  sheetRequest,
  sheetStages,
  type FormReference,
} from "./image-prompts.js";
import { HelpTip } from "./HelpTip.js";
import { useSaucelingsTranslation } from "./localization.js";
import { formQuery } from "./PetSprite.js";

/** Asked of the image connection: square, and 1024 because SDXL and Flux models degrade below it. The painting is
 *  shrunk (see image-canvas.ts's FORM_INPUT_PX) before a 52-pixel form is cut out of it. */
const FORM_REQUEST_PX = 1024;
/** A life sheet holds up to 18 drawings, so it is asked for larger. */
const SHEET_REQUEST_PX = 1024;

/** One painting to make: which sauceling, the stage it shows, and what it is painted from. A "sheet" paints every
 *  stage of the design in one picture; a "stage" paints `stage` alone. */
interface FormJob {
  petId: string;
  species: SaucelingSpeciesId;
  design: SaucelingDesign;
  forms: SaucelingPet["forms"];
  stage: SaucelingStage;
  kind: "sheet" | "stage";
}

/** The nook sauceling's form for the stage it shows, when its caretaker invented that stage: its whole sheet while
 *  it has no forms yet (or to repaint), else that stage alone. */
function nookJob(pet: SaucelingPet | null, repaint = false): FormJob | null {
  const stage = pet ? (pet.lockedStage ?? pet.stage) : null;
  if (!pet?.design || !stage || !pet.design.stages[stage]) return null;
  const kind = repaint || Object.keys(pet.forms).length === 0 ? "sheet" : "stage";
  return { petId: pet.id, species: pet.species, design: pet.design, forms: pet.forms, stage, kind };
}

const missing = (job: FormJob | null) => (job && !job.forms[job.stage] ? job : null);

/** One sauceling paints one thing at a time, so its paintings share a key. */
const paintKey = (petId: string) => ["saucelings", "paint", petId];

/** What a painting is of: the sheet, or one stage. */
const paintOf = (job: FormJob) => (job.kind === "sheet" ? "sheet" : job.stage);

/** This page, to the server, so two open pages never paint the same picture. Not a secret: it only tells pages
 *  apart (crypto.randomUUID needs a secure context, which a LAN Engine is not). */
const PAGE_TOKEN = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** Asks the image connection for a square picture, with pictures (up to four) whose look it keeps, and what it must
 *  leave out. */
async function generateImage(
  connectionId: string,
  prompt: string,
  negativePrompt: string,
  size: number,
  references: string[],
) {
  const generated = await marinaraRequest<{ image: string }>("/api/characters/avatar-generation", "POST", {
    connectionId,
    // The name gives the override's id, so the request is exactly this prompt and none of the Engine's own.
    name: "sauceling-form",
    appearance: prompt,
    promptOverrides: [{ id: "avatar:sauceling-form", prompt, negativePrompt }],
    styleProfileId: "off",
    width: size,
    height: size,
    ...(references.length > 0 ? { referenceImages: references } : {}),
  });
  return generated.image;
}

/** Paints one form with the image connection and saves it, in place of any it had. Each form is painted from the
 *  one before it, or an evolved sauceling's first from its old sprite. */
async function paintForm(
  job: FormJob,
  connectionId: string,
  queryClient: QueryClient,
  assetUrl: (path: string) => string,
  failed: string,
): Promise<SaucelingStateResponse> {
  const { design, stage } = job;
  const earlierId = SAUCELING_STAGES.slice(0, SAUCELING_STAGES.indexOf(stage))
    .reverse()
    .map((earlier) => job.forms[earlier])
    .find(Boolean);
  // A reference that will not load is left out, and the form is painted from its description alone.
  let reference: string | null = null;
  let referenceKind: FormReference = null;
  if (earlierId) {
    reference = await queryClient
      .fetchQuery(formQuery(earlierId, true))
      .then((earlier) => spriteReference(earlier.image))
      .catch(() => null);
    referenceKind = reference ? "earlier" : null;
  } else if (design.origin === "evolved") {
    const sprite = spriteStrip(job.species, stage, "content");
    reference = await spriteReference(assetUrl(sprite.path), sprite.row).catch(() => null);
    referenceKind = reference ? "before" : null;
  }
  const generated = await generateImage(
    connectionId,
    formRequest(design, stage, referenceKind),
    formNegative(stage),
    FORM_REQUEST_PX,
    reference ? [reference] : [],
  );
  const form = await formImageFrom(generated, stage);
  if (!form) throw new Error(failed);
  return saucelingsRequest<SaucelingStateResponse>("/form", "POST", { stage, image: form, petId: job.petId });
}

/** Paints a sauceling's whole life sheet in one picture and saves every stage's forms from it, an evolved one's
 *  from its old sprite. A sheet that cannot be read is not asked for again: the stage on show is painted alone. */
async function paintSheet(
  job: FormJob,
  connectionId: string,
  queryClient: QueryClient,
  assetUrl: (path: string) => string,
  failed: string,
): Promise<SaucelingStateResponse> {
  const sprite = spriteStrip(job.species, "adult", "content");
  const reference =
    job.design.origin === "evolved" ? await spriteReference(assetUrl(sprite.path), sprite.row).catch(() => null) : null;
  const stages = sheetStages(job.design);
  const sheet = await generateImage(
    connectionId,
    sheetRequest(job.design, reference ? "before" : null),
    SHEET_NEGATIVE,
    SHEET_REQUEST_PX,
    reference ? [reference] : [],
  );
  const forms = await sheetFormsFrom(sheet, stages);
  if (!forms) return paintForm({ ...job, kind: "stage" }, connectionId, queryClient, assetUrl, failed);
  return saucelingsRequest<SaucelingStateResponse>("/form/sheet", "POST", { petId: job.petId, forms });
}

/** Starts painting a job. */
function usePaint(job: FormJob | null, state: SaucelingStateResponse, assetUrl: (path: string) => string) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const connectionId = state.world.settings.portraitConnectionId;
  return useMutation({
    mutationKey: job ? paintKey(job.petId) : ["saucelings", "paint"],
    mutationFn: async ({ target }: { target: FormJob }) => {
      if (!connectionId) throw new Error(t("saucelings.album.needsConnection"));
      // The server refuses a picture another page is painting.
      await saucelingsRequest("/form/start", "POST", { petId: target.petId, key: paintOf(target), token: PAGE_TOKEN });
      const paint = target.kind === "sheet" ? paintSheet : paintForm;
      const next = await paint(target, connectionId, queryClient, assetUrl, t("saucelings.form.failed"));
      // A repaint gives each stage a new form id; the pictures are loaded before the swap shows (as in FormRepaint's
      // undo), so the sauceling does not drop to its silhouette while they come. One that fails loads later.
      await Promise.all(
        Object.values(next.world.activePet?.forms ?? {}).map((id) => queryClient.prefetchQuery(formQuery(id))),
      );
      return next;
    },
    // These run even when the component that started the painting has gone, such as a tab that was closed.
    onSuccess: (next) => {
      queryClient.setQueryData(["saucelings", "state"], next);
      void queryClient.invalidateQueries({ queryKey: ["saucelings", "menagerie"] });
    },
  }).mutate;
}

/** How the latest painting under a key went, whichever component started it. */
function useRunStatus(key: readonly unknown[]) {
  const runs = useMutationState({
    filters: { mutationKey: key, exact: true },
    select: (run) => run.state,
  });
  const latest = runs.at(-1);
  return { pending: latest?.status === "pending", error: latest?.error ?? null };
}
const usePaintStatus = (petId: string) => useRunStatus(paintKey(petId));

/** The stages the player was asked about painting (`petId/stage`), so each is asked once. This page remembers them
 *  too, for when storage is blocked. */
const PAINT_ASKED_KEY = "saucelings-paint-asked";
const askedHere = new Set<string>();

function askedList(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PAINT_ASKED_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const wasAsked = (id: string) => askedHere.has(id) || askedList().includes(id);

function markAsked(id: string): void {
  askedHere.add(id);
  try {
    localStorage.setItem(
      PAINT_ASKED_KEY,
      JSON.stringify([...askedList().filter((item) => item !== id), id].slice(-100)),
    );
  } catch {
    // Remembered for this page only.
  }
}

/** Asks whether to paint a stage that has no picture yet; nothing is painted without a yes. */
function PaintOffer({ isEgg, name, onAnswer }: { isEgg: boolean; name: string; onAnswer: (paint: boolean) => void }) {
  const { t } = useSaucelingsTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    // autoFocus ran while the dialog was still closed.
    dialog?.querySelector<HTMLButtonElement>(".sl-btn--primary")?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="sl-dialog"
      aria-labelledby="sl-paint-offer-title"
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
    >
      <h2 id="sl-paint-offer-title">
        {isEgg ? t("saucelings.form.offerEggTitle") : t("saucelings.form.offerTitle", { name })}
      </h2>
      <p>{isEgg ? t("saucelings.form.offerEggBody") : t("saucelings.form.offerBody", { name })}</p>
      <div className="sl-dialog-actions">
        <button type="button" className="sl-btn" onClick={() => onAnswer(false)}>
          {t("saucelings.form.offerNotNow")}
        </button>
        <button type="button" className="sl-btn sl-btn--primary" onClick={() => onAnswer(true)}>
          {t("saucelings.form.offerPaint")}
        </button>
      </div>
    </dialog>
  );
}

/** Says a Menagerie egg is being painted, or why it could not be. */
export function EggPaintNote({ petId }: { petId: string }) {
  const { t } = useSaucelingsTranslation();
  const { pending, error } = usePaintStatus(petId);
  if (pending) {
    return (
      <span role="status" style={{ fontSize: "0.8rem", opacity: 0.8 }}>
        {t("saucelings.form.paintingEgg")}
      </span>
    );
  }
  return error ? (
    <span role="alert" className="sl-error">
      {t("saucelings.form.eggFailed", { error: friendlyError(error, t).message })}
    </span>
  ) : null;
}

/** The nook sauceling's missing form for the stage it shows: it asks once whether to paint it, and keeps a Paint
 *  button for later; nothing otherwise. */
export function FormPainter({
  state,
  assetUrl,
}: {
  state: SaucelingStateResponse;
  assetUrl: (path: string) => string;
}) {
  const { t } = useSaucelingsTranslation();
  const pet = state.world.activePet;
  const job = missing(nookJob(pet));
  const paint = usePaint(job, state, assetUrl);
  const { pending, error } = usePaintStatus(job?.petId ?? "");
  const [, setAnswered] = useState(0);
  const settings = state.world.settings;
  if (!pet || !job || !settings.portraitEnabled || !settings.portraitConnectionId) return null;
  const isEgg = pet.stage === "egg";
  const askId = `${job.petId}/${job.stage}`;
  const answer = (yes: boolean) => {
    markAsked(askId);
    setAnswered((n) => n + 1);
    if (yes) paint({ target: job });
  };
  return (
    <div className="sl-care-row">
      {!pending && !wasAsked(askId) ? <PaintOffer isEgg={isEgg} name={pet.name} onAnswer={answer} /> : null}
      <button type="button" className="sl-btn" disabled={pending} onClick={() => paint({ target: job })}>
        {pending
          ? t("saucelings.form.painting")
          : `🎨 ${isEgg ? t("saucelings.form.paintEgg") : t("saucelings.form.paint", { name: pet.name, stage: t(`saucelings.stage.${job.stage}`) })}`}
      </button>
      <span className="sl-care-note" role="status">
        {pending ? t("saucelings.form.paintingNote") : t("saucelings.form.needed")}
      </span>
      {error && !pending ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={error} />
        </span>
      ) : null}
    </div>
  );
}

/** Paints the nook sauceling's whole sheet again (every stage, in one picture), after asking, for when the picture
 *  came out wrong. It lives in the Looks panel, out of the way, since it is rarely needed; the old forms stay until the new
 *  ones are saved. */
export function FormRepaint({
  state,
  assetUrl,
}: {
  state: SaucelingStateResponse;
  assetUrl: (path: string) => string;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const pet = state.world.activePet;
  const job = nookJob(pet, true);
  const paint = usePaint(job, state, assetUrl);
  const { pending, error } = usePaintStatus(job?.petId ?? "");
  // The pictures are loaded before the swap shows, so the sauceling does not blink out while they come.
  const undo = useMutation({
    mutationFn: async (petId: string) => {
      const next = await saucelingsRequest<SaucelingStateResponse>("/form/undo", "POST", { petId });
      await Promise.all(
        Object.values(next.world.activePet?.forms ?? {}).map((id) => queryClient.prefetchQuery(formQuery(id))),
      );
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(["saucelings", "state"], next);
      void queryClient.invalidateQueries({ queryKey: ["saucelings", "menagerie"] });
    },
  });
  const settings = state.world.settings;
  if (!pet || !job || !job.forms[job.stage] || !settings.portraitEnabled) return null;
  const canPaint = Boolean(settings.portraitConnectionId);
  const canUndo = Object.keys(pet.savedForms).length > 0;
  if (!canPaint && !canUndo) return null;
  const label =
    pet.stage === "egg" ? t("saucelings.form.repaintEgg") : t("saucelings.form.repaint", { name: pet.name });
  return (
    <div className="sl-about-row">
      {confirming ? (
        <>
          <span className="sl-care-note">{t("saucelings.form.repaintNote")}</span>
          <button
            type="button"
            className="sl-btn"
            onClick={() => {
              setConfirming(false);
              paint({ target: job });
            }}
          >
            {t("saucelings.form.repaintConfirm")}
          </button>
          <button type="button" className="sl-btn" onClick={() => setConfirming(false)}>
            {t("saucelings.common.cancel")}
          </button>
        </>
      ) : (
        <>
          {pending ? (
            <button type="button" className="sl-btn" disabled>
              {t("saucelings.form.painting")}
            </button>
          ) : canPaint ? (
            <HelpTip text={t("saucelings.form.repaintHint")} label={t("saucelings.help.label", { action: label })}>
              <button type="button" className="sl-btn" onClick={() => setConfirming(true)}>
                🎨 {label}
              </button>
            </HelpTip>
          ) : null}
          {canUndo ? (
            <HelpTip
              text={t("saucelings.form.undoRepaintHint")}
              label={t("saucelings.help.label", { action: t("saucelings.form.undoRepaint") })}
            >
              <button
                type="button"
                className="sl-btn"
                disabled={pending || undo.isPending}
                onClick={() => undo.mutate(pet.id)}
              >
                ↶ {t("saucelings.form.undoRepaint")}
              </button>
            </HelpTip>
          ) : null}
          <span className="sl-care-note" role="status">
            {pending ? t("saucelings.form.paintingNote") : null}
          </span>
        </>
      )}
      {error && !pending ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={error} />
        </span>
      ) : null}
      {undo.error && !undo.isPending ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={undo.error} />
        </span>
      ) : null}
    </div>
  );
}

/** Turns who faces which way on the stage, whatever their art: a saved switch, so there is no image request. */
function FlipButton({
  name,
  flipped,
  request,
}: {
  name: string;
  flipped: boolean;
  request: (flipped: boolean) => Promise<SaucelingStateResponse>;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const flip = useMutation({
    mutationFn: () => request(!flipped),
    onSuccess: (next) => queryClient.setQueryData(["saucelings", "state"], next),
  });
  return (
    <div className="sl-about-row">
      <HelpTip
        text={t("saucelings.flip.note", { name })}
        label={t("saucelings.help.label", { action: t("saucelings.flip.label", { name }) })}
      >
        <button
          type="button"
          className="sl-btn"
          aria-pressed={flipped}
          disabled={flip.isPending}
          onClick={() => flip.mutate()}
        >
          ↔ {t("saucelings.flip.label", { name })}
        </button>
      </HelpTip>
      {flip.error && !flip.isPending ? (
        <span role="alert" className="sl-error">
          <FriendlyError error={flip.error} />
        </span>
      ) : null}
    </div>
  );
}

/** Flips the sauceling in the nook; the switch is saved on it, so it keeps its way through every stage. */
export function PetFlip({ state }: { state: SaucelingStateResponse }) {
  const { t } = useSaucelingsTranslation();
  const pet = state.world.activePet;
  if (!pet) return null;
  return (
    <FlipButton
      // An egg still has its kind's name, which would give away what hatches.
      name={pet.stage === "egg" ? t("saucelings.egg.name") : pet.name}
      flipped={pet.flipped}
      request={(flipped) => saucelingsRequest<SaucelingStateResponse>("/pet", "PATCH", { flipped })}
    />
  );
}

/** Flips a caretaker, painted or not. */
export function CaretakerFlip({
  state,
  characterId,
  name,
}: {
  state: SaucelingStateResponse;
  characterId: string;
  name: string;
}) {
  return (
    <FlipButton
      name={name}
      flipped={state.world.flippedCaretakers.includes(characterId)}
      request={(flipped) =>
        saucelingsRequest<SaucelingStateResponse>("/caretaker/flip", "PATCH", { characterId, flipped })
      }
    />
  );
}

/** One caretaker is painted at a time. */
const figureKey = (characterId: string) => ["saucelings", "figure-paint", characterId];

/** Paints the caretaker as a pixel figure that stands in the Nook in the pets' style, in place of their Engine
 *  sprites: an image request from their avatar, one of their sprites and their card's appearance. It asks first,
 *  and whatever stands there now stays until the new figure is saved. */
export function FigurePainter({
  state,
  characterId,
  name,
  sprites,
}: {
  state: SaucelingStateResponse;
  characterId: string;
  name: string;
  sprites: ReadonlyArray<{ expression: string; url: string }>;
}) {
  const { t } = useSaucelingsTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const settings = state.world.settings;
  const connectionId = settings.portraitConnectionId;
  const figure = useCaretakerFigure(state.world.caretakerFigures[characterId]);
  // The new figure is cached first, so the stage swaps straight to it instead of standing empty while it loads.
  const saved = ({ next, image, frames }: { next: SaucelingStateResponse; image: string; frames: number }) => {
    const figureId = next.world.caretakerFigures[characterId];
    if (figureId) queryClient.setQueryData(["saucelings", "figure", figureId], { image, frames });
    queryClient.setQueryData(["saucelings", "state"], next);
  };
  const paint = useMutation({
    mutationKey: figureKey(characterId),
    mutationFn: async () => {
      if (!connectionId) throw new Error(t("saucelings.album.needsConnection"));
      const card = await queryClient.fetchQuery(caretakerCardQuery(characterId));
      // A picture that will not load is left out, and the figure is painted from what is left.
      const pictures = [card.avatar, pickStandingSprite(sprites, "neutral")].filter((src): src is string => !!src);
      const references = (await Promise.all(pictures.map((src) => pictureReference(src).catch(() => null)))).filter(
        (reference): reference is string => reference !== null,
      );
      // A reference becomes the starting picture on A1111 and Forge, and a weak model cannot always lay out eight
      // drawings, so a figure that does not read is asked for again in simpler ways (see `figureAttempts`).
      let figure: { image: string; frames: number } | null = null;
      for (const attempt of figureAttempts(name, card.appearance, references, settings.threeDrawingFallback)) {
        const sheet = await generateImage(
          connectionId,
          attempt.prompt,
          FIGURE_NEGATIVE,
          SHEET_REQUEST_PX,
          attempt.references,
        );
        figure = await figureImageFrom(sheet);
        if (figure) break;
      }
      if (!figure) throw new Error(t("saucelings.figure.failed", { name }));
      const next = await saucelingsRequest<SaucelingStateResponse>("/figure", "POST", {
        characterId,
        image: figure.image,
      });
      return { next, ...figure };
    },
    // This runs even when the Caretaker panel was closed while it painted.
    onSuccess: saved,
  }).mutate;
  // The figure is loaded before the swap shows, so the stage does not stand empty while it comes.
  const undo = useMutation({
    mutationFn: async () => {
      const next = await saucelingsRequest<SaucelingStateResponse>("/figure/undo", "POST", { characterId });
      const figureId = next.world.caretakerFigures[characterId];
      if (figureId) {
        await queryClient.prefetchQuery({
          queryKey: ["saucelings", "figure", figureId],
          queryFn: () => saucelingsRequest(`/figure/${encodeURIComponent(figureId)}`),
          staleTime: Infinity,
        });
      }
      return next;
    },
    onSuccess: (next) => queryClient.setQueryData(["saucelings", "state"], next),
  });
  const { pending, error } = useRunStatus(figureKey(characterId));
  if (!settings.portraitEnabled) return null;
  const painted = Boolean(state.world.caretakerFigures[characterId]);
  const canUndo = Boolean(painted && state.world.savedFigures[characterId]);
  if (!connectionId && !canUndo) return null;
  const busy = pending || undo.isPending;
  return (
    <>
      <div className="sl-about-row">
        {confirming ? (
          <>
            <span className="sl-care-note">{t("saucelings.figure.confirmNote", { name })}</span>
            <button
              type="button"
              className="sl-btn"
              onClick={() => {
                setConfirming(false);
                paint();
              }}
            >
              {t("saucelings.figure.confirm")}
            </button>
            <button type="button" className="sl-btn" onClick={() => setConfirming(false)}>
              {t("saucelings.common.cancel")}
            </button>
          </>
        ) : (
          <>
            {pending ? (
              <button type="button" className="sl-btn" disabled>
                {t("saucelings.form.painting")}
              </button>
            ) : connectionId ? (
              <HelpTip
                text={t("saucelings.figure.hint")}
                label={t("saucelings.help.label", {
                  action: painted ? t("saucelings.figure.repaint", { name }) : t("saucelings.figure.paint", { name }),
                })}
              >
                <button type="button" className="sl-btn" disabled={busy} onClick={() => setConfirming(true)}>
                  🎨 {painted ? t("saucelings.figure.repaint", { name }) : t("saucelings.figure.paint", { name })}
                </button>
              </HelpTip>
            ) : null}
            {canUndo ? (
              <HelpTip
                text={t("saucelings.figure.undoHint")}
                label={t("saucelings.help.label", { action: t("saucelings.figure.undoRepaint", { name }) })}
              >
                <button type="button" className="sl-btn" disabled={busy} onClick={() => undo.mutate()}>
                  ↶ {t("saucelings.figure.undoRepaint", { name })}
                </button>
              </HelpTip>
            ) : null}
            <span className="sl-care-note" role="status">
              {pending
                ? t("saucelings.form.paintingNote")
                : figure?.frames === 3
                  ? t("saucelings.figure.threePoses", { name })
                  : null}
            </span>
          </>
        )}
        {error && !pending ? (
          <span role="alert" className="sl-error">
            <FriendlyError error={error} />
          </span>
        ) : null}
        {undo.error && !undo.isPending ? (
          <span role="alert" className="sl-error">
            <FriendlyError error={undo.error} />
          </span>
        ) : null}
      </div>
    </>
  );
}
