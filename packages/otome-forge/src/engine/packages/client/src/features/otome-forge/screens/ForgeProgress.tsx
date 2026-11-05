// ──────────────────────────────────────────────
// Otome Forge: forging a world. The steps (world plan, one bible per love interest, then the cast's looks), Retry for
// a step that failed (never retried by itself) with the reason it failed, and "Paint the cast (N images)": looks are
// paid, so they wait for the player's tap. With "Review image prompts before sending" on, every paint (Retry too) shows
// its prompt first, so painting is offered once the world is ready and each look exists. Once the world is ready, the
// cast is shown with their bibles behind a spoiler gate.
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
import { bibleQueryKey, patchRun, runQueryKey, useRun, useSampledAccents } from "../hooks/use-run";
import { accentOf } from "../lib/accent";
import { useOtomeProps } from "../props";
import type { ForgeStatus, ForgeStep, ForgeStepState, Paint, RunLiView, RunView } from "../shared/api-types";
import { intimacyOpen } from "../shared/content";
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
  useSampledAccents(run.data);
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
  // The look a paint step paints: its record carries the image connection's reason for a failure.
  const paintOf = (step: ForgeStep): Paint | undefined =>
    step.id === "paint:player" ? view.player.art : view.lis.find((li) => `paint:${li.id}` === step.id)?.art;
  const nameOfStep = (step: ForgeStep): string => {
    if (step.id === "world-plan") return t("ui.otomeForge.setup.forgeStepWorld");
    if (step.id === "paint:player") return t("ui.otomeForge.setup.forgeStepPaintPlayer");
    const [kind, li] = step.id.split(":");
    const name = view.lis.find((item) => item.id === li)?.name ?? li ?? "";
    if (kind === "bible") return t("ui.otomeForge.setup.forgeStepBible", { name });
    if (kind === "paint") return t("ui.otomeForge.setup.forgeStepPaint", { name });
    return step.id;
  };
  const waiting = steps.filter((step) => isPaint(step) && step.state === "waiting-consent");
  const hasImages = !!view.world.images.connectionId;
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
    setBusy("review");
    setReviewPrompt(null);
    setReviewError(null);
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
    else void send(step.id, "/forge/retry", { step: step.id });
  };

  // Repaint: a look already painted, painted anew. The old look stays until the new one is saved.
  const repaint = async (step: ForgeStep) => {
    if (busy || reviewOpen) return;
    setErrorAt("steps");
    if (reviewImagePromptsBeforeSend) {
      reviewStep([step.id]);
      return;
    }
    setBusy(step.id);
    setError(null);
    try {
      const { paint } = await otome.post<{ paint: Paint }>(`${base}/art/paint`, {
        target: { kind: "look", owner: paintOwner(step.id) },
      });
      if (paint.state === "failed") {
        const message = t("ui.otomeForge.setup.repaintFailed");
        setError(debugMode && paint.error ? `${message} (${paint.error})` : message);
      }
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
      const { paint } = await otome.post<{ paint: Paint }>(`${base}/art/expressions`, {
        li,
        ...(reviewed ? { base: reviewed.base, prompts: reviewed.prompts } : {}),
      });
      if (paint.state !== "ready") {
        const message = t("ui.otomeForge.setup.repaintExpressionsFailed");
        const detail = debugMode && paint.error ? `${message} (${paint.error})` : message;
        if (reviewed) setReviewError(detail);
        else setError(detail);
      } else setExpressionReview(null);
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
      setExpressionReview({ ...preview, li, index: 0 });
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

  // A paint that failed at the provider answers like a success with a `failed` record: the dialog stays on the same
  // person with the player's edits, to paint again or skip.
  const sendReviewed = async (prompt: ImagePrompt) => {
    const stepId = reviewQueue[0];
    if (!stepId || busy) return;
    setBusy("review");
    setReviewError(null);
    let painted = false;
    try {
      const { paint } = await otome.post<{ paint: Paint }>(`${base}/art/paint`, {
        target: { kind: "look", owner: paintOwner(stepId) },
        prompt: prompt.prompt,
        negativePrompt: prompt.negativePrompt,
      });
      void queryClient.invalidateQueries({ queryKey: runQueryKey(runKey) });
      if (paint.state === "failed") {
        const message = t("ui.otomeForge.setup.reviewPaintFailed");
        setReviewError(debugMode && paint.error ? `${message} (${paint.error})` : message);
      } else painted = true;
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
            ? view.lis.find((li) => `paint:${li.id}` === step.id && (li.worn || li.portrait))
            : undefined;
          return (
            <li key={step.id} className="of-forge-step" data-state={step.state}>
              <span className="of-forge-icon" aria-hidden="true">
                <Icon size={15} strokeWidth={2.2} fill={step.state === "running" ? "currentColor" : "none"} />
              </span>
              <span className="of-forge-text">
                <span className="of-forge-name">{name}</span>
                <span className="of-forge-state">{t(STATE_LABEL_KEYS[step.state])}</span>
                {step.state === "failed" ? (
                  <span className="of-forge-why">{t(forgeStepErrorKey(step.error))}</span>
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
              ) : step.state === "done" && isPaint(step) && hasImages ? (
                <span className={`of-forge-retry${expressionLi ? " of-forge-retry--paints" : ""}`}>
                  <span className="of-forge-retry">
                    <button
                      type="button"
                      className="of-button of-button--quiet of-glass of-button--small"
                      aria-disabled={!!busy || reviewOpen}
                      aria-label={t("ui.otomeForge.setup.forgeRepaintStep", { step: name })}
                      onClick={() => void repaint(step)}
                    >
                      <Paintbrush size={14} strokeWidth={2.2} aria-hidden="true" />
                      {busy === step.id ? t("ui.otomeForge.setup.repainting") : t("ui.otomeForge.setup.repaint")}
                    </button>
                    <CostHint images={1} />
                  </span>
                  {expressionLi ? (
                    <span className="of-forge-retry">
                      <button
                        type="button"
                        className="of-button of-button--quiet of-glass of-button--small"
                        aria-disabled={!!busy || reviewOpen}
                        aria-label={t("ui.otomeForge.setup.repaintExpressionsLabel", {
                          name: expressionLi.name,
                        })}
                        onClick={() => void repaintExpressions(expressionLi.id)}
                      >
                        <Paintbrush size={14} strokeWidth={2.2} aria-hidden="true" />
                        {busy === `expressions:${expressionLi.id}`
                          ? t("ui.otomeForge.setup.repainting")
                          : t("ui.otomeForge.setup.repaintExpressions")}
                      </button>
                      <CostHint images={FACES.length} />
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
      {ready ? <CastList view={view} onOpenBible={onOpenBible} /> : null}

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
            name: view.lis.find((li) => li.id === expressionReview.li)?.name,
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

function CastList({ view, onOpenBible }: { view: RunView; onOpenBible: (li: string) => void }) {
  const { t } = useTranslation();
  return (
    <section className="of-section of-glass" aria-labelledby={`${view.runKey}-cast`}>
      <h2 id={`${view.runKey}-cast`} className="of-section-title">
        {t("ui.otomeForge.setup.forgeCastTitle")}
      </h2>
      <ul className="of-cast">
        {view.lis.map((li) => {
          const accent = accentOf(li);
          return (
            <li key={li.id} className="of-cast-card" style={{ ["--of-li-accent" as string]: accent }}>
              <Avatar name={li.name} url={li.portrait} accent={accent} size={64} />
              <span className="of-cast-name">{li.name}</span>
              <span className="of-hint">{`${li.pronouns.subject}/${li.pronouns.object}`}</span>
              <ImageAppearanceEditor key={`${view.runKey}:${li.id}`} runKey={view.runKey} li={li} />
              {intimacyOpen(view.world.content) ? (
                <IntimacyFill key={`${view.runKey}:${li.id}:intimacy`} runKey={view.runKey} li={li} />
              ) : null}
              <button
                type="button"
                className="of-button of-button--text of-button--small"
                aria-label={t("ui.otomeForge.setup.openBibleOf", { name: li.name })}
                onClick={() => onOpenBible(li.id)}
              >
                <BookLock size={14} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.setup.openBible")}
              </button>
            </li>
          );
        })}
      </ul>
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
function ImageAppearanceEditor({ runKey, li }: { runKey: string; li: RunLiView }) {
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
      patchRun(queryClient, runKey, (view) => ({
        ...view,
        lis: view.lis.map((current) =>
          current.id === li.id
            ? {
                ...current,
                look: {
                  ...current.look,
                  outfitLine: current.look?.outfitLine ?? "",
                  identityLine: result.identityLine,
                },
              }
            : current,
        ),
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
