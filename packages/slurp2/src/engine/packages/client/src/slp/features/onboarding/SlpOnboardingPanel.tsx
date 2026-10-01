import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import type { SlpCreatorOnboardingCompletion } from "../../../../../shared/src/slp/slp-creator-onboarding.js";
import type { SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle, SLP_PINK, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SLURP_DEFAULT_ACTIVITY_PRESET, slurpActivityPresetPatch } from "../../modules/creator/slp-activity-presets";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpWizardFooter, SlpWizardProgress } from "../../modules/chrome/SlpWizardChrome";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import { useSlurpOnboardingWizardModel } from "./slp-onboarding-wizard-model";
import { slpOnboardingProgress } from "./slp-onboarding-progress";
import { SlpOnboardingSteps } from "./SlpOnboardingSteps";
import { SlpSceneOnboarding } from "./SlpSceneOnboarding";
import { SlpSiteWelcome } from "./SlpSiteWelcome";

export type Step = 1 | 2 | 3 | 4 | 5;
/** "scene" is the role-play sign-up; "easy" is Quick setup. */
export type SetupLane = "scene" | "easy" | "customize" | null;
/** "creationFailed" is local to the wizard: the shared resolver reports it as "failed", which
 * reads as a first-post problem even when no creator was ever set up. "writing" is the wait while
 * the first posts are written one by one; it used to show as "partial", which read as a failure. */
export type CompletionKind = SlpCreatorOnboardingCompletion | "creationFailed" | "writing";

export const DISCLOSURES: SlpIdentityDisclosure[] = ["open", "hinted"];
export const DEFAULT_ACTIVITY_PATCH = slurpActivityPresetPatch(SLURP_DEFAULT_ACTIVITY_PRESET);
export const DEFAULT_POSTS_PER_DAY = DEFAULT_ACTIVITY_PATCH.postsPerDay!;

export interface WizardProps {
  open: boolean;
  selectionOnly?: boolean;
  /** The Support ticket in front of the sign-up: "first" on a first run, "again" from "Run setup again". */
  opening?: "first" | "again";
  /** Leaves Slurp (the age check's way out). */
  onLeave?: () => void;
  /** The persona's name on the Pastapay card. */
  personaName?: string;
  onClose: () => void;
  onComplete?: () => void;
  onSeeFeed?: () => void;
  onSkipped?: () => void;
}

export function disclosureLabel(value: SlpIdentityDisclosure, t: ReturnType<typeof useUiTranslation>["t"]) {
  return t(`ui.noodle.noodlerwizard.disclosure.${value}.title`);
}

export function SlurpOnboardingWizard(props: WizardProps) {
  const model = useSlurpOnboardingWizardModel(props);
  const {
    open,
    selectionOnly,
    onClose,
    onSeeFeed,
    t,
    bulkCreate,
    refreshTargeted,
    enqueueFirstPosts,
    step,
    setStep,
    rail,
    setRail,
    setupLane,
    setSetupLane,
    selected,
    accounts,
    disclosure,
    setDisclosure,
    setImageConnectionId,
    setSettingsSeeded,
    completion,
    firstPostsQueued,
    signUpProgress,
    providerConfirmationOpen,
    setProviderConfirmationOpen,
    skip,
    returnToSetup,
    returnToPreviousStep,
    performFinish,
    finish,
    pending,
  } = model;
  const progress = slpOnboardingProgress({ setupLane, step });
  const scene = setupLane === "scene";
  // The Engine Modal focuses its X on open, which rings it after a tap. Move the first focus to the
  // screen heading once the Modal has run its own focus step (two frames).
  const frameRef = useRef<HTMLDivElement | null>(null);
  const shown = open && !rail;
  useEffect(() => {
    if (!shown) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() =>
        frameRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true }),
      );
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [shown]);
  const running =
    signUpProgress && signUpProgress.total > 1
      ? t("ui.noodle.noodlerwizard.progressSigningUp", { done: signUpProgress.done, total: signUpProgress.total })
      : bulkCreate.isPending || enqueueFirstPosts.isPending
        ? t("ui.noodle.noodlerwizard.progressCreating")
        : refreshTargeted.isPending || firstPostsQueued
          ? t("ui.noodle.noodlerwizard.progressWriting")
          : "";
  const back =
    (step > 1 && step < 5) || (step === 5 && completion === "creationFailed")
      ? () => {
          if (step === 5) returnToSetup();
          else returnToPreviousStep();
        }
      : step === 1
        ? () => setSetupLane("scene")
        : undefined;
  const setupBlocked = step === 1 && selected.size === 0;
  const primary =
    step < 5 ? (
      <SlpPrimaryButton
        disabled={pending || setupBlocked}
        onClick={() => {
          if (step === 4) void finish();
          else if (setupLane === "easy" && step === 1) setStep(4);
          else setStep((step + 1) as Step);
        }}
      >
        {pending && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
        {step === 4
          ? t("ui.noodle.noodlerwizard.createCount", {
              count: selected.size,
            })
          : setupLane === "easy"
            ? t("ui.noodle.noodlerwizard.reviewSetup")
            : step === 1
              ? t("ui.noodle.noodlerwizard.setIdentities")
              : step === 2
                ? t("ui.noodle.noodlerwizard.setActivity")
                : t("ui.noodle.noodlerwizard.setImages")}
        {!pending && step !== 4 && <ChevronRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />}
      </SlpPrimaryButton>
    ) : (
      <SlpPrimaryButton
        onClick={() => {
          onSeeFeed?.();
          if (!onSeeFeed) onClose();
        }}
      >
        {t("ui.noodle.noodlerwizard.openAllCreators")}
      </SlpPrimaryButton>
    );
  // Every disabled primary says why, in one line under it.
  const reason =
    step === 1 && setupBlocked && accounts.length > 0
      ? t("ui.slurp.wizard.pickOne", { defaultValue: "Pick at least one creator to continue." })
      : "";
  // After the stamp the sign-up starts from Slurp's own settings, so a later save repeats them.
  const [railOpenings, setRailOpenings] = useState(0);
  useEffect(() => {
    if (open) setRailOpenings((count) => count + 1);
  }, [open]);
  const leaveRail = (lane: Exclude<SetupLane, null>) => {
    setRail(false);
    setSetupLane(lane);
    setStep(1);
  };
  return (
    <>
      {rail && (
        <SlpSiteWelcome
          // A fresh ticket per opening: a second "Run setup again" must not show the stamped one.
          key={railOpenings}
          open={open}
          opening={props.opening ?? "first"}
          personaName={props.personaName ?? ""}
          onLeave={props.onLeave}
          onClose={onClose}
          onStamped={(stamp) => {
            setSettingsSeeded(false);
            setDisclosure(stamp.signUp.disclosure);
            setImageConnectionId(stamp.signUp.imageConnectionId ?? "");
          }}
          onFeed={() => {
            props.onComplete?.();
            onClose();
          }}
          onSignUp={() => leaveRail("scene")}
          onQuickLane={() => leaveRail("easy")}
        />
      )}
      <Modal
        open={shown}
        onClose={onClose}
        title={selectionOnly ? t("ui.noodle.noodlerwizard.addCreators") : t("ui.noodle.noodlerwizard.title")}
        // The sign-up scene gets a wider stage on desktop: the chat plus the phone that builds up.
        width={scene ? "max-w-4xl" : "max-w-3xl"}
        mobileFullscreen
        contentClassName="max-sm:flex max-sm:flex-col max-sm:overflow-hidden max-sm:px-4 max-sm:py-2"
        panelStyle={getSlpAccentStyle(SLP_PINK, {
          // The wizard used to hardcode a dark palette, so it stayed dark in light mode.
          // These all resolve through light-dark() now.
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
          "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
        })}
      >
        <div
          ref={frameRef}
          className={cn(
            "flex max-h-[min(78vh,46rem)] min-h-[26rem] flex-col text-[var(--slurp-text)] max-sm:min-h-0 max-sm:max-h-none max-sm:flex-1 max-sm:self-stretch",
            // The scene's chat scrolls inside a fixed frame instead of growing the dialog.
            scene && "h-[min(78vh,46rem)] max-sm:h-auto",
          )}
        >
          {scene ? (
            <SlpSceneOnboarding
              accounts={accounts}
              connectionId={model.generationConnectionId || undefined}
              // From the ticket the sign-up starts on Support's own part.
              defaultPreset={selectionOnly ? undefined : "support"}
              onBack={onClose}
              onQuickSetup={() => {
                setSetupLane("easy");
                setStep(1);
              }}
              defaultDisclosure={disclosure}
              onFinished={() => {
                // The pace, nights and pictures stamped on the way in are saved like Quick setup saves them.
                void model.saveSettings();
                props.onComplete?.();
              }}
              onSeeFeed={() => {
                onSeeFeed?.();
                if (!onSeeFeed) onClose();
              }}
            />
          ) : (
            <>
              {progress && (
                <SlpWizardProgress
                  current={progress.current}
                  total={progress.total}
                  stepOf={t("ui.slurp.wizard.stepOf", {
                    current: progress.current,
                    total: progress.total,
                    defaultValue: "Step {{current}} of {{total}}",
                  })}
                  label={t(`ui.slurp.wizard.label.${progress.label}`)}
                />
              )}

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-4 max-sm:py-2.5">
                <div className="w-full">
                  <SlpOnboardingSteps model={model} />
                </div>
              </div>

              <SlpWizardFooter
                back={back && { label: t("ui.noodle.noodlerwizard.back"), onClick: back }}
                skip={
                  !selectionOnly && step < 5
                    ? { label: t("ui.noodle.noodlerwizard.skip"), onClick: () => void skip(), disabled: pending }
                    : undefined
                }
                primary={primary}
                // Creating profiles then writing first posts can take a while; say which half we are in.
                note={running ? `${running} ${t("ui.slurp.pulse.task.canClose")}` : reason}
              />
            </>
          )}
        </div>
      </Modal>
      <Modal
        open={providerConfirmationOpen}
        onClose={() => setProviderConfirmationOpen(false)}
        title={t("ui.slurp.providerDisclosure.title")}
        width="max-w-md"
        panelClassName="noodle-icon-scope"
        panelStyle={getSlpAccentStyle(SLP_PINK, {
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "rgba(255, 126, 193, 0.24)",
          "--accent": "rgba(255, 126, 193, 0.12)",
        })}
      >
        <div className="space-y-4 text-[var(--slurp-text)]">
          <p className={cn(SLP_TYPE.body, "text-pretty text-[var(--muted-foreground)]")}>
            {t("ui.slurp.providerDisclosure.onboardingDetail")}
          </p>
          <div className="flex justify-end gap-2">
            <SlpButton variant="tertiary" onClick={() => setProviderConfirmationOpen(false)}>
              {t("ui.slurp.actions.cancel")}
            </SlpButton>
            <SlpPrimaryButton
              disabled={pending}
              onClick={() => {
                setProviderConfirmationOpen(false);
                void performFinish();
              }}
            >
              {t("ui.slurp.actions.continue")}
            </SlpPrimaryButton>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** A screen heading: screen-size title, one muted line under it. Centred on the short tour screens. */
export function StepHeading({ title, help, centred = false }: { title: string; help: string; centred?: boolean }) {
  return (
    <div className={cn("min-w-0", centred && "text-center")}>
      {/* The first thing focused when the wizard opens, so a pointer open shows no ring on the X. */}
      <h3 tabIndex={-1} data-autofocus className={cn(SLP_TYPE.screen, "text-balance outline-none")}>
        {title}
      </h3>
      <p className={cn(SLP_TYPE.body, "mt-1 text-pretty text-[var(--slurp-muted)]", centred && "mx-auto max-w-md")}>
        {help}
      </p>
    </div>
  );
}

/** Open / Hinted as the settings kit's cards (one radio group), used by the tour and step 2. */
export function DisclosureChoice({
  value,
  onChange,
  t,
}: {
  value: SlpIdentityDisclosure;
  onChange: (value: SlpIdentityDisclosure) => void;
  t: ReturnType<typeof useUiTranslation>["t"];
}) {
  return (
    <ChoiceSetting
      label={t("ui.noodle.noodlerwizard.disclosure.question")}
      labelHidden
      variant="cards"
      value={value}
      onChange={onChange}
      options={DISCLOSURES.map((option) => ({
        value: option,
        label: t(`ui.noodle.noodlerwizard.disclosure.${option}.title`),
        detail: t(`ui.noodle.noodlerwizard.disclosure.${option}.detail`),
      }))}
    />
  );
}
