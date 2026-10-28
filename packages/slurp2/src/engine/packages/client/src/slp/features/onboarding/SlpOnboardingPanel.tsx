import { useEffect, useRef } from "react";
import { ChevronRight, Loader2, MessagesSquare } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import type { SlpCreatorOnboardingCompletion } from "../../../../../shared/src/slp/slp-creator-onboarding.js";
import type { SlpCreatorStageProfile, SlpIdentityDisclosure } from "../../../../../shared/src/slp/slp-social.types.js";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import { Modal } from "../../../components/ui/Modal";
import { getSlpAccentStyle, SLP_PINK, SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SLURP_DEFAULT_ACTIVITY_PRESET, slurpActivityPresetPatch } from "../../modules/creator/slp-activity-presets";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpWizardFooter, SlpWizardProgress } from "../../modules/chrome/SlpWizardChrome";
import { useSlurpOnboardingWizardModel } from "./slp-onboarding-wizard-model";
import { SLP_SETUP_STEPS, slpOnboardingProgress } from "./slp-onboarding-progress";
import { SlpOnboardingSteps } from "./SlpOnboardingSteps";
import { SlpSceneOnboarding } from "./SlpSceneOnboarding";
import { SlpBasicSetup } from "./SlpBasicSetup";

export type Step = 1 | 2 | 3 | 4 | 5;
/** "scene" is the role-play sign-up; "easy" is the Creator picker. */
export type SetupLane = "scene" | "easy" | null;
/** "creationFailed" is local to the wizard: the shared resolver reports it as "failed", which
 * reads as a first-post problem even when no creator was ever set up. "writing" is the wait while
 * the first posts are written one by one; it used to show as "partial", which read as a failure. */
export type CompletionKind = SlpCreatorOnboardingCompletion | "creationFailed" | "writing";

export const DISCLOSURES: SlpIdentityDisclosure[] = ["open", "hinted"];
export const DEFAULT_ACTIVITY_PATCH = slurpActivityPresetPatch(SLURP_DEFAULT_ACTIVITY_PRESET);
export const DEFAULT_POSTS_PER_DAY = DEFAULT_ACTIVITY_PATCH.postsPerDay!;

type SlpMariPicks = { mariAppearancePackId?: unknown; mariUnlockedPackIds?: readonly string[] };
// ponytail: copies the Engine's pick rule (lib/mari-work-animations, resolveMariAppearancePack) because the
// vendored Engine snapshot predates it; import it from the Engine once sources/engine is refreshed.
const SLP_MARI_LOCKED_PACKS = new Set(["golden"]);
/** The Professor Mari the player picked in the Engine (home screen, omnibar): her idle portrait. */
export function useSlpMariPortrait(): string {
  const id = useUIStore((state) => (state as SlpMariPicks).mariAppearancePackId);
  const unlocked = useUIStore((state) => (state as SlpMariPicks).mariUnlockedPackIds);
  const usable =
    typeof id === "string" &&
    /^[a-z0-9-]+$/u.test(id) &&
    (!SLP_MARI_LOCKED_PACKS.has(id) || (unlocked ?? []).includes(id));
  return `/sprites/mari/${usable ? id : "basic"}/portrait-idle.webp`;
}

// Mari as the sample Creator of the Basic screen's real locked post card.
export const DEMO_PROFILE: SlpCreatorStageProfile = {
  id: "onboarding-demo",
  sourceAccountId: null,
  handle: "professor_mari",
  displayName: "Professor Mari",
  bio: "",
  avatarUrl: null,
  avatarCrop: null,
  disclosureMode: "open",
  stagePersonality: "",
  appearance: "",
  wardrobe: "",
  locations: "",
  clothingStyle: "auto",
  publicIdentity: null,
  page: null,
  createdAt: "",
  updatedAt: "",
};
export interface WizardProps {
  open: boolean;
  selectionOnly?: boolean;
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
    basic,
    setBasic,
    firstRun,
    applyBasic,
    setupLane,
    setSetupLane,
    selected,
    accounts,
    disclosure,
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
  useEffect(() => {
    if (!open) return;
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
  }, [open]);
  // The lane choice is a short screen: it sits in the middle of a phone instead of under the title.
  const centred = setupLane === null;
  const running =
    signUpProgress && signUpProgress.total > 1
      ? t("ui.noodle.noodlerwizard.progressSigningUp", { done: signUpProgress.done, total: signUpProgress.total })
      : bulkCreate.isPending || enqueueFirstPosts.isPending
        ? t("ui.noodle.noodlerwizard.progressCreating")
        : refreshTargeted.isPending || firstPostsQueued
          ? t("ui.noodle.noodlerwizard.progressWriting")
          : "";
  const back =
    setupLane === null
      ? selectionOnly
        ? undefined
        : () => setBasic(true)
      : step === 4 || (step === 5 && completion === "creationFailed")
        ? () => {
            if (step === 5) returnToSetup();
            else returnToPreviousStep();
          }
        : step === 1
          ? () => setSetupLane(null)
          : undefined;
  const setupBlocked = step === 1 && selected.size === 0;
  const primary =
    setupLane === null ? null : step < 5 ? (
      <SlpPrimaryButton
        disabled={pending || setupBlocked}
        onClick={() => {
          if (step === 4) void finish();
          else setStep(4);
        }}
      >
        {pending && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
        {step === 4
          ? t("ui.noodle.noodlerwizard.createCount", {
              count: selected.size,
            })
          : t("ui.noodle.noodlerwizard.reviewSetup")}
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
    setupLane !== null && step === 1 && setupBlocked && accounts.length > 0
      ? t("ui.slurp.wizard.pickOne", { defaultValue: "Pick at least one creator to continue." })
      : "";
  return (
    <>
      <SlpBasicSetup open={open && basic} firstRun={firstRun} onClose={onClose} onLead={applyBasic} />
      <Modal
        open={open && !basic}
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
              onBack={() => setSetupLane(null)}
              onQuickSetup={() => {
                setSetupLane("easy");
                setStep(1);
              }}
              defaultDisclosure={disclosure}
              onFinished={() => {
                // The pace, nights and pictures picked on the way in are saved like Quick setup saves them.
                void model.saveSettings("completed");
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
                <div className={cn("w-full", centred && "my-auto")}>
                  {setupLane === null && (
                    <div className="mx-auto max-w-2xl space-y-5">
                      <StepHeading
                        centred
                        title={t("ui.noodle.noodlerwizard.handoff.title")}
                        help={t("ui.noodle.noodlerwizard.handoff.help")}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(
                          [
                            { lane: "scene", icon: <MessagesSquare size={18} />, lead: true },
                            { lane: "easy", icon: <SlpSparkleGlyph size={18} />, lead: false },
                          ] as const
                        ).map((card) => (
                          <button
                            key={card.lane}
                            type="button"
                            onClick={() => {
                              setSetupLane(card.lane);
                              setStep(1);
                            }}
                            className={cn(
                              card.lane === "scene" && "sm:col-span-2",
                              "group flex flex-col rounded-2xl p-5 text-start transition-[transform,background-color] duration-[var(--slurp-motion-fast)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--slurp-focus)] motion-reduce:transform-none",
                              card.lead
                                ? "bg-[image:var(--slurp-nav-active)] shadow-[var(--slurp-glow),var(--slurp-highlight)] ring-1 ring-inset ring-[var(--noodle-accent)]/45"
                                : "bg-[var(--slurp-surface-raised)] shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] hover:bg-[var(--accent)]",
                            )}
                          >
                            <span className={cn(SLP_TYPE.title, "flex items-center gap-2")}>
                              <span aria-hidden="true" className="text-[var(--noodle-accent-foreground)]">
                                {card.icon}
                              </span>
                              {t(`ui.noodle.noodlerwizard.handoff.${card.lane}.title`)}
                            </span>
                            <span className={cn(SLP_TYPE.body, "mt-1.5 block text-pretty text-[var(--slurp-muted)]")}>
                              {t(`ui.noodle.noodlerwizard.handoff.${card.lane}.detail`)}
                            </span>
                            <span className="mt-4 flex items-center justify-between gap-2">
                              <span className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>
                                {card.lane === "scene"
                                  ? t("ui.slurp.scene.laneMeta")
                                  : t("ui.slurp.wizard.stepCount", {
                                      count: SLP_SETUP_STEPS[card.lane].length,
                                      defaultValue: "{{count}} steps",
                                    })}
                              </span>
                              <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--noodle-accent-foreground)]">
                                {t(`ui.noodle.noodlerwizard.handoff.${card.lane}.action`)}
                                <ChevronRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <SlpOnboardingSteps model={model} />
                </div>
              </div>

              <SlpWizardFooter
                back={back && { label: t("ui.noodle.noodlerwizard.back"), onClick: back }}
                skip={
                  !selectionOnly && step < 5 && setupLane !== null
                    ? {
                        label: t("ui.noodle.noodlerwizard.skip"),
                        onClick: () => void skip(),
                        disabled: pending,
                      }
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

/** A screen heading: screen-size title, one muted line under it. Centred on the short lane choice. */
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
