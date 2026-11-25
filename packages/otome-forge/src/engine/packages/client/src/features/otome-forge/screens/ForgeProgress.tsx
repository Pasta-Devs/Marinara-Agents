// ──────────────────────────────────────────────
// Otome Forge: forging a world. The steps (world plan, one bible per love interest, then the cast's looks), Retry for
// a step that failed (never retried by itself) with the reason it failed, and "Paint the cast (N images)": looks are
// paid, so they wait for the player's tap. With "Review image prompts before sending" on, every paint (Retry too) shows
// its prompt first, so painting is offered once the world is ready and each look exists. Once the world is ready, the
// cast is shown with their bibles behind a spoiler gate; #2475: her friends follow the love interests, marked as
// friends, with their appearance, card and bible (never a love interest's intimacy fill).
// 0.46.3: Repaint, Repaint expressions and a reviewed paint answer once their paint has started, and it goes on in the
// background whether the player stays or leaves. The run view says what paints (a running paint step, a pending look,
// `facesPaint`), and is polled while anything does (useRun); a paint that failed shows on its step with Retry, and
// faces that did not land beside Repaint expressions, which paints them again. A look's Repaint stays in place, saying
// Painting…, while its step runs. With prompt review on, a reviewed paint that did not land opens its review again
// with the player's edits (reviewedLooks, reviewedFaces).
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookLock,
  Check,
  CircleAlert,
  Gem,
  Heart,
  Hourglass,
  ImageOff,
  Paintbrush,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { forgeStepErrorKey, useOtomeApi } from "../api";
import { Avatar } from "../components/Avatar";
import { CostHint } from "../components/CostHint";
import { PromptReviewDialog, type ImagePrompt } from "../components/PromptReviewDialog";
import { bibleQueryKey, patchCastMember, patchRun, runQueryKey, useRun } from "../hooks/use-run";
import { accentOf } from "../lib/accent";
import { useOtomeProps } from "../props";
import type {
  ForgeStatus,
  ForgeStep,
  ForgeStepState,
  Paint,
  RunCastMember,
  RunLiView,
  RunView,
} from "../shared/api-types";
import { intimacyOpen } from "../shared/content";
import { isEngineArt } from "../shared/engine-art";
import { forgePrerequisite } from "../shared/forge";
import { FACES, type Face } from "../shared/faces";
import { TextField } from "./setup/parts";
import { SaveBar } from "./settings/ContentSettings";

const FACE_LABELS: Record<Face, string> = {
  tender: "ui.otomeForge.reader.faceTender",
  flustered: "ui.otomeForge.reader.faceFlustered",
  cold: "ui.otomeForge.reader.faceCold",
  hurt: "ui.otomeForge.reader.faceHurt",
  angry: "ui.otomeForge.reader.faceAngry",
};
interface ExpressionReview {
  li: string;
  base: string;
  prompts: Record<Face, ImagePrompt>;
  index: number;
}

/**
 * 0.46.3: the prompts the player last reviewed and sent, by `${runKey} ${step id}` for a look and `${runKey} ${li}` for
 * a set of faces (with the look it was for), kept while they leave the page. A paint that then fails in the background
 * opens its review with them, not the defaults; a review of one that did not fail, or a paint sent without review,
 * lets them go.
 */
const reviewedLooks = new Map<string, ImagePrompt>();
const reviewedFaces = new Map<string, Pick<ExpressionReview, "base" | "prompts">>();

const STATE_ICONS: Record<ForgeStepState, LucideIcon> = {
  pending: Hourglass,
  running: Heart,
  done: Check,
  failed: CircleAlert,
  "waiting-consent": Paintbrush,
};

const STATE_LABEL_KEYS: Record<ForgeStepState, string> = {
  pending: "ui.otomeForge.setup.forgeStatePending",
  running: "ui.otomeForge.setup.forgeStateRunning",
  done: "ui.otomeForge.setup.forgeStateDone",
  failed: "ui.otomeForge.setup.forgeStateFailed",
  "waiting-consent": "ui.otomeForge.setup.forgeStateWaiting",
};

const isPaint = (step: ForgeStep) => step.id.startsWith("paint:");

/** The art target a paint step stands for: `paint:player` → "player", `paint:<li>` → "li:<li>". */
function paintOwner(stepId: string): string {
  const owner = stepId.slice("paint:".length);
  return owner === "player" ? "player" : `li:${owner}`;
}

interface ForgeProgressProps {
  runKey: string;
  onOpenBible: (li: string) => void;
  /** Opens the story (the prologue first); a rejection is shown beside Begin. */
  onBegin: () => Promise<void> | void;
}

export function ForgeProgress({ runKey, onOpenBible, onBegin }: ForgeProgressProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { reviewImagePromptsBeforeSend, debugMode } = useOtomeProps();
  const run = useRun(runKey);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Where the last action was started, so its failure shows beside that control: the paint offer or the steps.
  const [errorAt, setErrorAt] = useState<"offer" | "steps" | "begin">("steps");
  // Prompt review: the paint steps still to show, and the prompt for the first one.
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [reviewPrompt, setReviewPrompt] = useState<ImagePrompt | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [expressionReview, setExpressionReview] = useState<ExpressionReview | null>(null);

  const view = run.data;
  if (!view) {
    return run.isError ? (
      <div className="of-center">
        <div className="of-panel of-panel--center of-card of-glass" role="alert">
          <p className="of-error">{otome.errorMessage(run.error)}</p>
          <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void run.refetch()}>
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.common.retry")}
          </button>
        </div>
      </div>
    ) : (
      <div className="of-center" role="status">
        <Heart className="of-pulse" size={30} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
        <p className="of-body">{t("ui.otomeForge.common.loading")}</p>
      </div>
    );
  }

  const base = `/runs/${encodeURIComponent(runKey)}`;
  const steps = view.forge.steps;
  const ready = view.forge.phase === "ready";
  // #2458: her friends' portraits are painted here too, after the love interests'.
  const people = [...view.lis, ...(view.friends ?? [])];
  // The look a paint step paints: its record carries the image connection's reason for a failure.
  const paintOf = (step: ForgeStep): Paint | undefined =>
    step.id === "paint:player" ? view.player.art : people.find((li) => `paint:${li.id}` === step.id)?.art;
  const portraitOf = (step: ForgeStep): string | undefined =>
    step.id === "paint:player" ? view.player.portrait : people.find((li) => `paint:${li.id}` === step.id)?.portrait;
  const nameOfStep = (step: ForgeStep): string => {
    if (step.id === "world-plan") return t("ui.otomeForge.setup.forgeStepWorld");
    if (step.id === "paint:player") return t("ui.otomeForge.setup.forgeStepPaintPlayer");
    const [kind, li] = step.id.split(":");
    const name = people.find((item) => item.id === li)?.name ?? li ?? "";
    if (kind === "bible") return t("ui.otomeForge.setup.forgeStepBible", { name });
    if (kind === "paint") return t("ui.otomeForge.setup.forgeStepPaint", { name });
    return step.id;
  };
  const waiting = steps.filter((step) => isPaint(step) && step.state === "waiting-consent");
  const hasImages = !!view.world.images.connectionId;
  // #2147: a look adopted from Engine art is done before its bible is written; Repaint waits for that, as the server does.
  const lookWritten = (step: ForgeStep) =>
    !steps.some((before) => before.id === forgePrerequisite(step.id) && before.state !== "done");
  const doneCount = steps.filter((step) => step.state === "done").length;

  const applyForge = (forge: ForgeStatus) => patchRun(queryClient, runKey, (current) => ({ ...current, forge }));

  const send = async (key: string, path: string, body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      applyForge((await otome.post<{ forge: ForgeStatus }>(`${base}${path}`, body)).forge);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
    }
  };

  // Busy while the prompt loads, so another tap cannot start a second review.
  const loadReview = async (stepId: string) => {
    setReviewError(null);
    const kept = reviewedLooks.get(`${runKey} ${stepId}`);
    if (kept && steps.some((step) => step.id === stepId && step.state === "failed")) {
      setReviewPrompt(kept);
      return;
    }
    reviewedLooks.delete(`${runKey} ${stepId}`);
    setBusy("review");
    setReviewPrompt(null);
    try {
      const prompt = await otome.post<ImagePrompt>(`${base}/art/prompt`, {
        target: { kind: "look", owner: paintOwner(stepId) },
      });
      setReviewPrompt({ prompt: prompt.prompt, negativePrompt: prompt.negativePrompt });
    } catch (failure) {
      setReviewQueue([]);
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
    }
  };

  const reviewStep = (stepIds: string[]) => {
    setError(null);
    setReviewQueue(stepIds);
    void loadReview(stepIds[0]!);
  };

  const reviewOpen = reviewQueue.length > 0 || expressionReview !== null;
  const startPainting = () => {
    if (!waiting.length || busy || reviewOpen) return;
    setErrorAt("offer");
    if (reviewImagePromptsBeforeSend) reviewStep(waiting.map((step) => step.id));
    else void send("paint", "/forge/consent", { steps: waiting.map((step) => step.id) });
  };

  // A paint's Retry is a paint like any other: with prompt review on, its prompt is shown first.
  const retry = (step: ForgeStep) => {
    if (busy || reviewOpen) return;
    setErrorAt("steps");
    if (isPaint(step) && reviewImagePromptsBeforeSend) reviewStep([step.id]);
    else {
      reviewedLooks.delete(`${runKey} ${step.id}`);
      void send(step.id, "/forge/retry", { step: step.id });
    }
  };

  // The server marks a paint's step running before it answers: so does the view, so its Repaint says Painting… at once.
  const markRunning = (stepId: string) =>
    patchRun(queryClient, runKey, (current) => ({
      ...current,
      forge: {
        ...current.forge,
        steps: current.forge.steps.map((step) => (step.id === stepId ? { ...step, state: "running" as const } : step)),
      },
    }));

  // Repaint: a look already painted, painted anew in the background. The old look stays until the new one is saved.
  const repaint = async (step: ForgeStep) => {
    if (busy || reviewOpen) return;
    setErrorAt("steps");
    if (reviewImagePromptsBeforeSend) {
      reviewStep([step.id]);
      return;
    }
    setBusy(step.id);
    setError(null);
    reviewedLooks.delete(`${runKey} ${step.id}`);
    try {
      await otome.post<{ paint: Paint }>(`${base}/art/paint`, { target: { kind: "look", owner: paintOwner(step.id) } });
      markRunning(step.id);
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
    }
  };

  const sendExpressions = async (li: string, reviewed?: ExpressionReview) => {
    setBusy(`expressions:${li}`);
    setError(null);
    setReviewError(null);
    try {
      await otome.post<{ paint: Paint }>(`${base}/art/expressions`, {
        li,
        ...(reviewed ? { base: reviewed.base, prompts: reviewed.prompts } : {}),
      });
      if (reviewed) reviewedFaces.set(`${runKey} ${li}`, { base: reviewed.base, prompts: reviewed.prompts });
      else reviewedFaces.delete(`${runKey} ${li}`);
      setExpressionReview(null);
    } catch (failure) {
      if (reviewed) setReviewError(otome.errorMessage(failure));
      else setError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
    }
  };

  const repaintExpressions = async (li: string) => {
    if (busy || reviewOpen) return;
    setErrorAt("steps");
    setError(null);
    if (!reviewImagePromptsBeforeSend) return sendExpressions(li);
    setBusy("review");
    setReviewError(null);
    try {
      const preview = await otome.post<Omit<ExpressionReview, "li" | "index">>(`${base}/art/expressions/prompt`, {
        li,
      });
      // Faces that did not land (Your cast says so) open with the edits sent for that look.
      const kept = reviewedFaces.get(`${runKey} ${li}`);
      const again = kept?.base === preview.base && people.some((person) => person.id === li && person.facesPaint);
      if (!again) reviewedFaces.delete(`${runKey} ${li}`);
      setExpressionReview({ ...preview, ...(again && kept ? { prompts: kept.prompts } : {}), li, index: 0 });
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
    }
  };

  const reviewExpression = (prompt: ImagePrompt) => {
    if (!expressionReview || busy) return;
    const updated = {
      ...expressionReview,
      prompts: { ...expressionReview.prompts, [FACES[expressionReview.index]!]: prompt },
    };
    setExpressionReview(updated);
    if (updated.index < FACES.length - 1) setExpressionReview({ ...updated, index: updated.index + 1 });
    else void sendExpressions(updated.li, updated);
  };

  const nextReview = () => {
    const rest = reviewQueue.slice(1);
    setReviewQueue(rest);
    if (rest.length) void loadReview(rest[0]!);
    else setReviewPrompt(null);
  };

  // The reviewed paint starts, and the next person's prompt follows at once: it paints in the background, and one that
  // fails at the provider shows on its step with Retry. What is refused before it starts stays in the dialog.
  const sendReviewed = async (prompt: ImagePrompt) => {
    const stepId = reviewQueue[0];
    if (!stepId || busy) return;
    setBusy("review");
    setReviewError(null);
    let painted = false;
    try {
      await otome.post<{ paint: Paint }>(`${base}/art/paint`, {
        target: { kind: "look", owner: paintOwner(stepId) },
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
      });
      reviewedLooks.set(`${runKey} ${stepId}`, prompt);
      markRunning(stepId);
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      painted = true;
    } catch (failure) {
      setReviewError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
    }
    if (painted) nextReview();
  };

  const reviewing = reviewQueue[0];
  const reviewSubject = reviewing
    ? nameOfStep(steps.find((step) => step.id === reviewing) ?? { id: reviewing, state: "waiting-consent" })
    : "";

  const begin = async () => {
    if (busy) return;
    setErrorAt("begin");
    setError(null);
    setBusy("begin");
    try {
      await onBegin();
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(null);
    }
  };

  // Always in the page (a live region that appears with its message is often not read); filled only at `at`.
  const errorAlert = (at: "offer" | "steps" | "begin") => (
    <div role="alert" className="of-live">
      {error && errorAt === at ? <p className="of-notice of-notice--error">{error}</p> : null}
    </div>
  );

  // While forging, the steps lead; once the world is ready, painting and the cast lead and the steps follow.
  const stepsSection = (
    <section className="of-section of-glass" aria-labelledby={`${runKey}-steps`}>
      <h2 id={`${runKey}-steps`} className="of-section-title">
        {t("ui.otomeForge.setup.forgeStepsTitle")}
      </h2>
      <p className="of-visually-hidden" role="status" aria-live="polite">
        {t("ui.otomeForge.setup.forgeProgress", { done: doneCount, total: steps.length })}
      </p>
      <ol className="of-forge-steps">
        {steps.map((step) => {
          const Icon = STATE_ICONS[step.state];
          const name = nameOfStep(step);
          const expressionLi = view.world.images.expressions
            ? people.find((li) => `paint:${li.id}` === step.id && (li.worn || li.portrait))
            : undefined;
          // 0.46.3: its new faces paint in the background, or did not land.
          const faces = expressionLi?.facesPaint;
          const facesPainting = faces?.state === "pending";
          // A look already there, painted anew in the background: its Repaint stays, saying so, and keeps focus.
          const lookPainting = step.state === "running" && isPaint(step) && !!portraitOf(step);
          return (
            <li key={step.id} className="of-forge-step" data-state={step.state}>
              <span className="of-forge-icon" aria-hidden="true">
                <Icon size={15} strokeWidth={2.2} fill={step.state === "running" ? "currentColor" : "none"} />
              </span>
              <span className="of-forge-text">
                <span className="of-forge-name">{name}</span>
                <span className="of-forge-state">
                  {t(
                    step.state === "done" && isEngineArt(paintOf(step)?.url)
                      ? "ui.otomeForge.setup.forgeStateEngineArt"
                      : step.state === "running" && isPaint(step)
                        ? "ui.otomeForge.setup.repainting"
                        : STATE_LABEL_KEYS[step.state],
                  )}
                </span>
                {step.state === "failed" ? (
                  <span className="of-forge-why">
                    {/* A repaint that failed keeps the look it had. */}
                    {t(
                      isPaint(step) && step.error === "failed" && portraitOf(step)
                        ? "ui.otomeForge.setup.repaintFailed"
                        : forgeStepErrorKey(step.error),
                    )}
                  </span>
                ) : null}
                {step.state === "failed" && debugMode && (paintOf(step)?.error || step.error) ? (
                  <span className="of-forge-error">{paintOf(step)?.error || step.error}</span>
                ) : null}
              </span>
              {step.state === "failed" ? (
                <span className="of-forge-retry">
                  <button
                    type="button"
                    className="of-button of-button--quiet of-glass of-button--small"
                    aria-disabled={!!busy || reviewOpen}
                    aria-label={t("ui.otomeForge.setup.forgeRetryStep", { step: name })}
                    onClick={() => retry(step)}
                  >
                    <RotateCcw size={14} strokeWidth={2.2} aria-hidden="true" />
                    {t("ui.otomeForge.common.retry")}
                  </button>
                  {isPaint(step) ? <CostHint images={1} /> : null}
                </span>
              ) : (step.state === "done" || lookPainting) && isPaint(step) && hasImages && lookWritten(step) ? (
                <span className={`of-forge-retry${expressionLi ? " of-forge-retry--paints" : ""}`}>
                  <span className="of-forge-retry">
                    <button
                      type="button"
                      className="of-button of-button--quiet of-glass of-button--small"
                      aria-disabled={!!busy || reviewOpen || lookPainting}
                      aria-label={t("ui.otomeForge.setup.forgeRepaintStep", { step: name })}
                      onClick={() => !lookPainting && void repaint(step)}
                    >
                      <Paintbrush size={14} strokeWidth={2.2} aria-hidden="true" />
                      {busy === step.id || lookPainting
                        ? t("ui.otomeForge.setup.repainting")
                        : t("ui.otomeForge.setup.repaint")}
                    </button>
                    <CostHint images={1} />
                  </span>
                  {expressionLi ? (
                    <span className="of-forge-retry">
                      <button
                        type="button"
                        className="of-button of-button--quiet of-glass of-button--small"
                        aria-disabled={!!busy || reviewOpen || facesPainting || lookPainting}
                        aria-label={t("ui.otomeForge.setup.repaintExpressionsLabel", {
                          name: expressionLi.name,
                        })}
                        onClick={() => !facesPainting && !lookPainting && void repaintExpressions(expressionLi.id)}
                      >
                        <Paintbrush size={14} strokeWidth={2.2} aria-hidden="true" />
                        {busy === `expressions:${expressionLi.id}` || facesPainting
                          ? t("ui.otomeForge.setup.repainting")
                          : t("ui.otomeForge.setup.repaintExpressions")}
                      </button>
                      <CostHint images={FACES.length} />
                    </span>
                  ) : null}
                  {faces && !facesPainting ? (
                    <span className="of-forge-why">
                      {t("ui.otomeForge.setup.repaintExpressionsFailed")}
                      {debugMode && faces.error ? ` (${faces.error})` : ""}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {errorAlert("steps")}
    </section>
  );
  // Looks wait for the player's tap; without an image connection the cast stays as initials, and the ready world says so.
  // Prompt review asks for each look's prompt first, which needs that look (every bible written), so it waits for ready;
  // without review, consent waits on the server for each look.
  const paintOffer =
    hasImages && waiting.length && (ready || !reviewImagePromptsBeforeSend) ? (
      <section className="of-section of-glass of-paint-offer">
        <p className="of-body">{t("ui.otomeForge.setup.paintOffer")}</p>
        <button
          type="button"
          className="of-button of-button--primary"
          aria-disabled={!!busy || reviewOpen}
          onClick={startPainting}
        >
          <Paintbrush size={16} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.setup.paintCast", { count: waiting.length })}
        </button>
        <CostHint images={waiting.length} note={t("ui.otomeForge.setup.paintCastNote")} />
      </section>
    ) : !hasImages && ready ? (
      <div className="of-empty of-glass">
        <ImageOff size={20} strokeWidth={1.7} aria-hidden="true" />
        <p>{t("ui.otomeForge.setup.paintNoConnection")}</p>
      </div>
    ) : null;

  return (
    <div className="of-page">
      <div className="of-page-head">
        <div className="of-emblem of-glass" aria-hidden="true">
          {ready ? <Sparkles size={30} strokeWidth={1.6} /> : <Gem className="of-pulse" size={30} strokeWidth={1.6} />}
        </div>
        <h1 className="of-title" tabIndex={-1}>
          {ready ? t("ui.otomeForge.setup.forgeReadyTitle") : t("ui.otomeForge.common.screenForge")}
        </h1>
        {view.world.title ? <p className="of-subtitle">{view.world.title}</p> : null}
        <p className="of-hand">
          {ready ? t("ui.otomeForge.setup.forgeReadyNote") : t("ui.otomeForge.setup.forgeNote")}
        </p>
      </div>

      {ready ? null : stepsSection}
      {paintOffer}
      {errorAlert("offer")}
      {ready ? <CastList view={view} steps={steps} onOpenBible={onOpenBible} /> : null}

      {ready ? (
        <div className="of-actions">
          <button
            type="button"
            className="of-button of-button--primary"
            aria-disabled={busy === "begin" || undefined}
            onClick={() => void begin()}
          >
            <Heart size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.forgeBegin")}
          </button>
          {view.prologue ? null : <p className="of-hint">{t("ui.otomeForge.setup.beginPrologueCost")}</p>}
          {errorAlert("begin")}
        </div>
      ) : null}

      {ready ? stepsSection : null}

      {reviewing && reviewPrompt ? (
        <PromptReviewDialog
          key={reviewing}
          subject={reviewSubject}
          initial={reviewPrompt}
          busy={busy === "review"}
          error={reviewError}
          onSend={(prompt) => void sendReviewed(prompt)}
          onSkip={nextReview}
        />
      ) : null}
      {expressionReview ? (
        <PromptReviewDialog
          key={`${expressionReview.li}:${expressionReview.index}`}
          subject={t("ui.otomeForge.setup.reviewExpressionSubject", {
            name: people.find((li) => li.id === expressionReview.li)?.name,
            face: t(FACE_LABELS[FACES[expressionReview.index]!]),
            index: expressionReview.index + 1,
            total: FACES.length,
          })}
          initial={expressionReview.prompts[FACES[expressionReview.index]!]}
          busy={busy !== null}
          error={reviewError}
          onSend={reviewExpression}
          onSkip={() => setExpressionReview(null)}
          sendLabel={t(
            expressionReview.index < FACES.length - 1
              ? "ui.otomeForge.setup.reviewExpressionsNext"
              : "ui.otomeForge.setup.reviewExpressionsSend",
          )}
          skipLabel={t("ui.otomeForge.setup.reviewExpressionsCancel")}
          hint={t("ui.otomeForge.setup.reviewExpressionsHint")}
          images={FACES.length}
        />
      ) : null}
    </div>
  );
}

function CastList({
  view,
  steps,
  onOpenBible,
}: {
  view: RunView;
  steps: ForgeStep[];
  onOpenBible: (li: string) => void;
}) {
  const { t } = useTranslation();
  const friends = view.friends ?? [];
  /** A love interest's card (`li` is him) or a friend's (none of his love-interest-only parts). */
  const card = (person: RunCastMember, li?: RunLiView) => {
    const accent = accentOf(person);
    const pronouns = `${person.pronouns.subject}/${person.pronouns.object}`;
    // 0.46.3: their look or faces paint in the background; the new picture shows here once it lands.
    const painting =
      steps.some((step) => step.id === `paint:${person.id}` && step.state === "running") ||
      person.art?.state === "pending" ||
      person.facesPaint?.state === "pending";
    return (
      <li key={person.id} className="of-cast-card" style={{ ["--of-li-accent" as string]: accent }}>
        <Avatar name={person.name} url={person.portrait} accent={accent} size={64} />
        <span className="of-cast-name">{person.name}</span>
        <span className="of-hint">{li ? pronouns : t("ui.otomeForge.setup.castFriend", { pronouns })}</span>
        {painting ? (
          <span className="of-hint" role="status">
            {t("ui.otomeForge.setup.castPainting")}
          </span>
        ) : null}
        <ImageAppearanceEditor key={`${view.runKey}:${person.id}`} runKey={view.runKey} li={person} />
        {li && intimacyOpen(view.world.content) ? (
          <IntimacyFill key={`${view.runKey}:${li.id}:intimacy`} runKey={view.runKey} li={li} />
        ) : null}
        <button
          type="button"
          className="of-button of-button--text of-button--small"
          aria-label={t("ui.otomeForge.setup.openBibleOf", { name: person.name })}
          onClick={() => onOpenBible(person.id)}
        >
          <BookLock size={14} strokeWidth={2} aria-hidden="true" />
          {t("ui.otomeForge.setup.openBible")}
        </button>
      </li>
    );
  };
  return (
    <section className="of-section of-glass" aria-labelledby={`${view.runKey}-cast`}>
      <h2 id={`${view.runKey}-cast`} className="of-section-title">
        {t("ui.otomeForge.setup.forgeCastTitle")}
      </h2>
      <ul className="of-cast">{view.lis.map((li) => card(li, li))}</ul>
      {friends.length ? (
        <>
          <h3 id={`${view.runKey}-friends`} className="of-section-title">
            {t("ui.otomeForge.setup.castFriends")}
          </h3>
          <ul className="of-cast" aria-labelledby={`${view.runKey}-friends`}>
            {friends.map((friend) => card(friend))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

/**
 * An adult NSFW story's way to give an older bible its intimacy preferences (#1936): one call writes that block alone,
 * keeping the rest of the bible, the story and its progress. Its text stays in the spoiler-gated bible. Shown while the
 * bible lacks the block; once added here, a focused status takes the button's place until the cast is left.
 */
function IntimacyFill({ runKey, li }: { runKey: string; li: RunLiView }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addedRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (added) addedRef.current?.focus({ preventScroll: true });
  }, [added]);
  if (added) {
    return (
      <p ref={addedRef} tabIndex={-1} role="status" className="of-hint of-intimacy-fill">
        {t("ui.otomeForge.setup.intimacyFillDone")}
      </p>
    );
  }
  if (li.intimacy) return null;
  const fill = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await otome.post(`/runs/${encodeURIComponent(runKey)}/lis/${encodeURIComponent(li.id)}/intimacy`);
      setAdded(true);
      patchRun(queryClient, runKey, (view) => ({
        ...view,
        lis: view.lis.map((entry) => (entry.id === li.id ? { ...entry, intimacy: true as const } : entry)),
      }));
      // A bible read before the fill would otherwise show without the block until it went stale.
      void queryClient.invalidateQueries({ queryKey: bibleQueryKey(runKey, li.id) });
    } catch (failure) {
      setError(otome.errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="of-intimacy-fill">
      <button
        type="button"
        className="of-button of-button--quiet of-glass of-button--small"
        aria-disabled={busy || undefined}
        aria-label={t("ui.otomeForge.setup.intimacyFillOf", { name: li.name })}
        onClick={() => void fill()}
      >
        <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
        {busy ? t("ui.otomeForge.setup.intimacyFilling") : t("ui.otomeForge.setup.intimacyFill")}
      </button>
      <p className="of-hint">{t("ui.otomeForge.setup.intimacyFillHint")}</p>
      <div role="alert" className="of-live">
        {error ? <p className="of-notice of-notice--error">{error}</p> : null}
      </div>
    </div>
  );
}

/** The public visual description, edited without opening the spoiler-heavy Bible or painting anything. */
function ImageAppearanceEditor({ runKey, li }: { runKey: string; li: RunCastMember }) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const stored = li.look?.identityLine ?? "";
  const [draft, setDraft] = useState(stored);
  const latest = useRef(stored);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);
  const previousStored = useRef(stored);
  useEffect(() => {
    const previous = previousStored.current;
    previousStored.current = stored;
    if (latest.current === previous) {
      latest.current = stored;
      setDraft(stored);
      setStatus(null);
    }
  }, [stored]);
  const save = async () => {
    if (busy || draft === stored) return;
    const submitted = draft;
    setBusy(true);
    setStatus(null);
    try {
      const result = await otome.saveImageAppearance(runKey, li.id, submitted);
      patchCastMember(queryClient, runKey, li.id, (current) => ({
        look: { ...current.look, outfitLine: current.look?.outfitLine ?? "", identityLine: result.identityLine },
      }));
      // A save must not replace text typed while its request was pending.
      if (latest.current === submitted) {
        latest.current = result.identityLine;
        setDraft(result.identityLine);
        setStatus({ error: false, text: t("ui.otomeForge.setup.imageAppearanceSaved") });
      }
    } catch (failure) {
      setStatus({ error: true, text: otome.errorMessage(failure) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="of-cast-appearance"
      aria-label={t("ui.otomeForge.setup.imageAppearanceOf", { name: li.name })}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        label={t("ui.otomeForge.setup.imageAppearance")}
        hint={t("ui.otomeForge.setup.imageAppearanceHint")}
        rows={3}
        value={draft}
        onChange={(value) => {
          latest.current = value;
          setDraft(value);
          setStatus(null);
        }}
      />
      <SaveBar changed={draft !== stored} busy={busy} status={status} onSave={() => void save()} />
    </form>
  );
}
