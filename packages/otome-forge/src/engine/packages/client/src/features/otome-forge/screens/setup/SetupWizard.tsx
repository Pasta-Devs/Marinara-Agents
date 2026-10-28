// ──────────────────────────────────────────────
// Otome Forge: the world setup wizard. Six steps (story, you, cast, content, connections, review), a stepper that
// can go back to any finished step, and a draft kept on this device (`otome-forge:setup-draft:v1`) until the world is
// made. "Forge our story" sends POST /runs; the server checks every limit and the 18+ gate again.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import { otomeErrorCode, useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import {
  MAX_CHARACTERS,
  defaultTextConnectionId,
  useCharacterOptions,
  useConnections,
  usePersonaOptions,
} from "../../hooks/use-engine-resources";
import type { RunView } from "../../shared/api-types";
import { CastStep } from "./CastStep";
import { ConnectionsStep } from "./ConnectionsStep";
import { ContentStep } from "./ContentStep";
import {
  clearDraft,
  dropMissingPicks,
  emptyDraft,
  isBlankDraft,
  loadDraft,
  saveDraft,
  SETUP_STEPS,
  stepProblem,
  toSetupInput,
  type SetupDraft,
  type SetupStep,
} from "./draft";
import { PremiseStep } from "./PremiseStep";
import { ProtagonistStep } from "./ProtagonistStep";
import { ReviewStep } from "./ReviewStep";

const STEP_NAME_KEYS: Record<SetupStep, string> = {
  premise: "ui.otomeForge.setup.stepPremise",
  protagonist: "ui.otomeForge.setup.stepProtagonist",
  cast: "ui.otomeForge.setup.stepCast",
  content: "ui.otomeForge.setup.stepContent",
  connections: "ui.otomeForge.setup.stepConnections",
  review: "ui.otomeForge.setup.stepReview",
};

const STEP_TITLE_KEYS: Record<SetupStep, string> = {
  premise: "ui.otomeForge.setup.premiseTitle",
  protagonist: "ui.otomeForge.setup.protagonistTitle",
  cast: "ui.otomeForge.setup.castTitle",
  content: "ui.otomeForge.setup.contentTitle",
  connections: "ui.otomeForge.setup.connectionsTitle",
  review: "ui.otomeForge.setup.reviewTitle",
};

const SAVE_DELAY_MS = 250;

interface SetupWizardProps {
  /** The new run, once POST /runs has made it. */
  onCreated: (view: RunView) => void;
}

export function SetupWizard({ onCreated }: SetupWizardProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const connections = useConnections();
  const [draft, setDraft] = useState<SetupDraft>(() => loadDraft() ?? emptyDraft());
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Bumped by Start over, so the premise step starts again: its Undo and any pending "Surprise me" belong to the old
  // draft.
  const [resets, setResets] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const finished = useRef(false);

  const update = (change: (current: SetupDraft) => SetupDraft) => setDraft(change);

  // Kept on this device as the player types, once they have entered something; never after the world is made.
  useEffect(() => {
    if (finished.current) return;
    const timer = window.setTimeout(() => (isBlankDraft(draft) ? clearDraft() : saveDraft(draft)), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft]);

  // The Engine's default text connection until the player picks one; a deleted job connection means "Same as story",
  // and a deleted image connection means no images. A failed list changes nothing.
  const { text: textConnections, image: imageConnections, isLoading: connectionsLoading } = connections;
  const connectionsFailed = connections.isError;
  useEffect(() => {
    if (connectionsLoading || connectionsFailed) return;
    setDraft((current) => {
      const known = (id: string) => textConnections.some((connection) => connection.id === id);
      const job = (id: string) => (id && !known(id) ? "" : id);
      const repaired = {
        narration: known(current.connections.narration)
          ? current.connections.narration
          : defaultTextConnectionId(textConnections),
        structured: job(current.connections.structured),
        chat: job(current.connections.chat),
        compress: job(current.connections.compress),
      };
      const imageId = current.images.connectionId;
      const keepImage = !imageId || imageConnections.some((connection) => connection.id === imageId);
      if (JSON.stringify(repaired) === JSON.stringify(current.connections) && keepImage) return current;
      return {
        ...current,
        connections: repaired,
        images: keepImage ? current.images : { ...current.images, connectionId: null },
      };
    });
  }, [connectionsFailed, connectionsLoading, imageConnections, textConnections]);

  // A persona or card deleted from the Engine since the draft was kept is dropped, so its step asks again instead of
  // the server refusing the world at the end. Only a list that loaded counts: one still loading, paused offline,
  // failed, or cut off at its cap changes nothing.
  const personas = usePersonaOptions();
  const characters = useCharacterOptions();
  const personasKnown = personas.isSuccess;
  const cardsKnown = characters.isSuccess && characters.items.length < MAX_CHARACTERS;
  useEffect(() => {
    setDraft((current) =>
      dropMissingPicks(current, personasKnown ? personas.items : null, cardsKnown ? characters.items : null),
    );
  }, [cardsKnown, characters.items, personas.items, personasKnown]);

  // A step the player moved to starts at its heading, announced and at the top.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    bodyRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [draft.step]);

  // While the connections load, the connections step is not reported as missing one.
  const textCount = connectionsLoading ? 1 : textConnections.length;
  const stepIndex = SETUP_STEPS.indexOf(draft.step);
  const problemKey = stepProblem(draft, draft.step, textCount);
  // A step is done once the player has been past it and nothing before it is missing; any of those can be revisited.
  const firstOpen = SETUP_STEPS.findIndex((step) => stepProblem(draft, step, textCount) !== null);
  const reachedIndex = SETUP_STEPS.indexOf(draft.reached);
  const reachable = (index: number) => index <= reachedIndex && (firstOpen === -1 || index <= firstOpen);

  const goTo = (step: SetupStep) => {
    if (step === draft.step) return;
    moved.current = true;
    setAttempted(false);
    setError(null);
    setDraft((current) => ({
      ...current,
      step,
      reached: SETUP_STEPS.indexOf(step) > SETUP_STEPS.indexOf(current.reached) ? step : current.reached,
    }));
  };

  const next = () => {
    if (problemKey) {
      setAttempted(true);
      return;
    }
    const following = SETUP_STEPS[stepIndex + 1];
    if (following) goTo(following);
  };

  const create = async () => {
    if (busy) return;
    if (stepProblem(draft, "review", textCount)) {
      setAttempted(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { view } = await otome.post<{ view: RunView }>("/runs", { setup: toSetupInput(draft) });
      finished.current = true;
      clearDraft();
      onCreated(view);
    } catch (failure) {
      setError(
        otomeErrorCode(failure) === "age-gate"
          ? t("ui.otomeForge.setup.createNeedsGate")
          : otome.errorMessage(failure, "ui.otomeForge.setup.createFailed"),
      );
      setBusy(false);
    }
  };

  const reset = () => {
    clearDraft();
    moved.current = true;
    setConfirmReset(false);
    setAttempted(false);
    setError(null);
    setResets((count) => count + 1);
    setDraft({
      ...emptyDraft(),
      connections: { ...emptyDraft().connections, narration: defaultTextConnectionId(textConnections) },
    });
  };

  const surpriseConnection = draft.connections.structured || draft.connections.narration;
  const body =
    draft.step === "premise" ? (
      <PremiseStep key={resets} draft={draft} update={update} connectionId={surpriseConnection} />
    ) : draft.step === "protagonist" ? (
      <ProtagonistStep draft={draft} update={update} />
    ) : draft.step === "cast" ? (
      <CastStep draft={draft} update={update} />
    ) : draft.step === "content" ? (
      <ContentStep draft={draft} update={update} />
    ) : draft.step === "connections" ? (
      <ConnectionsStep draft={draft} update={update} />
    ) : (
      <ReviewStep draft={draft} onEdit={goTo} />
    );

  const isReview = draft.step === "review";
  const status = error ?? (attempted && problemKey ? t(problemKey) : null);

  return (
    <div className="of-wizard">
      <header className="of-wizard-head">
        <h1 className="of-title of-title--page" tabIndex={-1}>
          {t("ui.otomeForge.common.screenSetup")}
        </h1>
        <nav aria-label={t("ui.otomeForge.setup.stepsLabel")}>
          <ol className="of-stepper">
            {SETUP_STEPS.map((step, index) => {
              const done = index !== stepIndex && index <= reachedIndex && (firstOpen === -1 || index < firstOpen);
              const name = t(STEP_NAME_KEYS[step]);
              const label = done
                ? t("ui.otomeForge.setup.stepDone", { number: index + 1, name })
                : t("ui.otomeForge.setup.stepNumbered", { number: index + 1, name });
              return (
                <li key={step} className="of-stepper-item">
                  <button
                    type="button"
                    className="of-stepper-dot"
                    data-state={index === stepIndex ? "current" : done ? "done" : "todo"}
                    aria-current={index === stepIndex ? "step" : undefined}
                    aria-label={label}
                    title={label}
                    aria-disabled={!reachable(index)}
                    onClick={() => {
                      if (reachable(index)) goTo(step);
                    }}
                  >
                    {done ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : index + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <div ref={bodyRef} className="of-wizard-body">
        <p className="of-step-count">
          {t("ui.otomeForge.setup.stepOf", { number: stepIndex + 1, total: SETUP_STEPS.length })} ·{" "}
          {t(STEP_NAME_KEYS[draft.step])}
        </p>
        <h2 ref={headingRef} className="of-step-title" tabIndex={-1}>
          {t(STEP_TITLE_KEYS[draft.step])}
        </h2>
        {body}
        <div className="of-wizard-reset">
          <button
            type="button"
            className="of-button of-button--text of-button--small"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            {t("ui.otomeForge.setup.startOver")}
          </button>
          <p className="of-hint">{t("ui.otomeForge.setup.draftKept")}</p>
        </div>
      </div>
      <footer className="of-wizard-foot of-glass of-glass--strong">
        <div className="of-live" role="status" aria-live="polite">
          {status ? (
            <p className={error ? "of-foot-status of-foot-status--error" : "of-foot-status"}>{status}</p>
          ) : null}
        </div>
        <div className="of-wizard-actions">
          {stepIndex > 0 ? (
            <button
              type="button"
              className="of-button of-button--quiet of-glass"
              onClick={() => goTo(SETUP_STEPS[stepIndex - 1]!)}
            >
              <ChevronLeft className="of-back-icon" size={17} strokeWidth={2.2} aria-hidden="true" />
              {t("ui.otomeForge.setup.back")}
            </button>
          ) : (
            <span />
          )}
          {isReview ? (
            <button
              type="button"
              className="of-button of-button--primary of-button--forge"
              aria-disabled={busy}
              onClick={() => void create()}
            >
              <Sparkles className={busy ? "of-pulse" : undefined} size={17} strokeWidth={2} aria-hidden="true" />
              {busy ? t("ui.otomeForge.setup.creating") : t("ui.otomeForge.setup.create")}
            </button>
          ) : (
            <button type="button" className="of-button of-button--primary" aria-disabled={!!problemKey} onClick={next}>
              {t("ui.otomeForge.setup.next")}
              <ChevronRight className="of-back-icon" size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
      </footer>
      {confirmReset ? (
        <Dialog
          title={t("ui.otomeForge.setup.startOverTitle")}
          onClose={() => setConfirmReset(false)}
          actions={
            <>
              <button
                type="button"
                className="of-button of-button--quiet of-glass"
                onClick={() => setConfirmReset(false)}
              >
                {t("ui.otomeForge.setup.keepDraft")}
              </button>
              <button type="button" className="of-button of-button--primary" onClick={reset}>
                {t("ui.otomeForge.setup.startOverConfirm")}
              </button>
            </>
          }
        >
          <p className="of-body">{t("ui.otomeForge.setup.startOverText")}</p>
        </Dialog>
      ) : null}
    </div>
  );
}
