// ──────────────────────────────────────────────
// Otome Forge: forging a world. The steps (world plan, one bible per love interest, then the cast's looks), Retry for
// a step that failed (never retried by itself) with the reason it failed, and "Paint the cast (N images)": looks are
// paid, so they wait for the player's tap. With "Review image prompts before sending" on, every paint (Retry too) shows
// its prompt first, so painting is offered once the world is ready and each look exists. Once the world is ready, the
// cast is shown with their bibles behind a spoiler gate.
// ──────────────────────────────────────────────
import { useState } from "react";
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
import { patchRun, runQueryKey, useRun, useSampledAccents } from "../hooks/use-run";
import { accentOf } from "../lib/accent";
import { useOtomeProps } from "../props";
import type { ForgeStatus, ForgeStep, ForgeStepState, Paint, RunView } from "../shared/api-types";

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
  onBegin: () => void;
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
  const [errorAt, setErrorAt] = useState<"offer" | "steps">("steps");
  // Prompt review: the paint steps still to show, and the prompt for the first one.
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [reviewPrompt, setReviewPrompt] = useState<ImagePrompt | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

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

  const reviewOpen = reviewQueue.length > 0;
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

  // Always in the page (a live region that appears with its message is often not read); filled only at `at`.
  const errorAlert = (at: "offer" | "steps") => (
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
                {step.state === "failed" && debugMode && step.error ? (
                  <span className="of-forge-error">{step.error}</span>
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
          <button type="button" className="of-button of-button--primary" onClick={onBegin}>
            <Heart size={16} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.forgeBegin")}
          </button>
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
