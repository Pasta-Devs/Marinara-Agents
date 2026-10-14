import { useEffect, useRef, useState } from "react";
import { ChevronRight, Coins, Cpu, Image as ImageIcon, Loader2, MessagesSquare, SlidersHorizontal } from "lucide-react";
import { SlpSparkleGlyph } from "../../base/chrome/SlpGlyphs";
import type { SlpCreatorOnboardingCompletion } from "../../../../../shared/src/slp/slp-creator-onboarding.js";
import type {
  SlpCreatorPostView,
  SlpCreatorStageProfile,
  SlpIdentityDisclosure,
} from "../../../../../shared/src/slp/slp-social.types.js";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Modal } from "../../../components/ui/Modal";
import { Avatar, getSlpAccentStyle, SLP_GROUP_CLASS, SLP_PINK, SLP_TYPE } from "../../base/chrome/SlpChrome";
import {
  SLURP_ACTIVITY_PRESETS,
  SLURP_DEFAULT_ACTIVITY_PRESET,
  slurpActivityPresetPatch,
} from "../../modules/creator/slp-activity-presets";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { SlpButton, SlpPrimaryButton } from "../../modules/chrome/SlpButton";
import { SlpWizardFooter, SlpWizardProgress } from "../../modules/chrome/SlpWizardChrome";
import { ChoiceSetting } from "../../modules/settings/SlpSettingsInputs";
import { Toggle } from "../../modules/settings/SlpSettingsControls";
import { useSlurpOnboardingWizardModel } from "./slp-onboarding-wizard-model";
import { SLP_SETUP_STEPS, slpOnboardingProgress } from "./slp-onboarding-progress";
import { SlpOnboardingSteps } from "./SlpOnboardingSteps";
import { SlpSceneOnboarding } from "./SlpSceneOnboarding";
import { SlpSiteWelcome } from "./SlpSiteWelcome";

export type Step = 1 | 2 | 3 | 4 | 5;
/** The teaching screens that run ahead of the numbered steps on first run. */
export type Intro = 0 | 1 | 2 | 3 | 4 | null;
/** "scene" is the role-play sign-up; "easy" is Quick setup. */
export type SetupLane = "scene" | "easy" | "customize" | null;
export const LAST_INTRO = 4;
/** "creationFailed" is local to the wizard: the shared resolver reports it as "failed", which
 * reads as a first-post problem even when no creator was ever set up. "writing" is the wait while
 * the first posts are written one by one; it used to show as "partial", which read as a failure. */
export type CompletionKind = SlpCreatorOnboardingCompletion | "creationFailed" | "writing";

export const DISCLOSURES: SlpIdentityDisclosure[] = ["open", "hinted"];
export const DEFAULT_ACTIVITY_PATCH = slurpActivityPresetPatch(SLURP_DEFAULT_ACTIVITY_PRESET);
export const DEFAULT_POSTS_PER_DAY = DEFAULT_ACTIVITY_PATCH.postsPerDay!;

// The intro uses the real locked post card for a staged walkthrough. Mari is demonstrating
// the interaction, so the example stays independent from the identity choice above.
export const DEMO_PROFILE: SlpCreatorStageProfile = {
  id: "onboarding-demo",
  sourceAccountId: null,
  handle: "professor_mari",
  displayName: "Professor Mari",
  bio: "",
  avatarUrl: "/sprites/mari/chibi-professor-mari.png",
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
const DEMO_POST: Pick<SlpCreatorPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
  Partial<Pick<SlpCreatorPostView, "likeCount" | "replyCount">> = {
  id: "onboarding-demo-post",
  access: "locked",
  createdAt: new Date().toISOString(),
  title: null,
  // Pre-blurred teaser: the locked card is what the user is being taught to recognise, so the demo
  // image must read as "paywalled" even outside the card's own blur treatment. Unlocking swaps in
  // the payoff image (see `unlockedImageUrl` below) rather than sharpening this one.
  imageUrl: "/sprites/mari/Mari_noodler_teaser_locked.webp",
  likeCount: 12,
  replyCount: 3,
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
    intro,
    setIntro,
    setupLane,
    setSetupLane,
    postExplored,
    setPostExplored,
    activityChoice,
    selected,
    accounts,
    disclosure,
    setDisclosure,
    postsPerDay,
    nightQuiet,
    setNightQuiet,
    imagesEnabled,
    setImagesEnabled,
    completion,
    firstPostsQueued,
    signUpProgress,
    providerConfirmationOpen,
    setProviderConfirmationOpen,
    demoProfile,
    chooseActivity,
    skip,
    returnToSetup,
    returnToPreviousStep,
    performFinish,
    finish,
    pending,
  } = model;
  const progress = slpOnboardingProgress({ intro, setupLane, step });
  const scene = intro === null && setupLane === "scene";
  // The first-run welcome is the sign-up scene with the roles swapped; the old tour is one tap away.
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (open) setTour(false);
  }, [open]);
  const welcome = intro !== null && !tour && !selectionOnly;
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
  // Short screens (the tour, the lane choice) sit in the middle of a phone instead of under the title.
  const centred = intro !== null || setupLane === null;
  const running =
    signUpProgress && signUpProgress.total > 1
      ? t("ui.noodle.noodlerwizard.progressSigningUp", { done: signUpProgress.done, total: signUpProgress.total })
      : bulkCreate.isPending || enqueueFirstPosts.isPending
        ? t("ui.noodle.noodlerwizard.progressCreating")
        : refreshTargeted.isPending || firstPostsQueued
          ? t("ui.noodle.noodlerwizard.progressWriting")
          : "";
  const back =
    intro !== null
      ? intro > 0
        ? () => setIntro((intro - 1) as Intro)
        : undefined
      : setupLane === null
        ? selectionOnly
          ? undefined
          : () => setIntro(LAST_INTRO)
        : (step > 1 && step < 5) || (step === 5 && completion === "creationFailed")
          ? () => {
              if (step === 5) returnToSetup();
              else returnToPreviousStep();
            }
          : step === 1
            ? () => setSetupLane(null)
            : undefined;
  const introBlocked = intro === 3 && !postExplored;
  const setupBlocked = step === 1 && selected.size === 0;
  const primary =
    intro !== null ? (
      <SlpPrimaryButton
        disabled={introBlocked}
        onClick={() => setIntro(intro < LAST_INTRO ? ((intro + 1) as Intro) : null)}
      >
        {intro < LAST_INTRO ? t("ui.noodle.noodlerwizard.continue") : t("ui.noodle.noodlerwizard.introDone")}
        <ChevronRight size={16} aria-hidden="true" className="shrink-0 rtl:rotate-180" />
      </SlpPrimaryButton>
    ) : setupLane === null ? null : step < 5 ? (
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
    intro !== null && introBlocked
      ? t("ui.slurp.wizard.revealToContinue", { defaultValue: "Unlock Mari's post to continue." })
      : intro === null && setupLane !== null && step === 1 && setupBlocked && accounts.length > 0
        ? t("ui.slurp.wizard.pickOne", { defaultValue: "Pick at least one creator to continue." })
        : "";
  return (
    <>
      <Modal
        open={open}
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
            (scene || welcome) && "h-[min(78vh,46rem)] max-sm:h-auto",
          )}
        >
          {welcome ? (
            <SlpSiteWelcome
              settings={model}
              onSignUp={() => {
                setIntro(null);
                setSetupLane("scene");
              }}
              onFeed={() => void skip()}
              onTour={() => setTour(true)}
            />
          ) : scene ? (
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
                  {intro === 0 && (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
                      <img
                        src="/sprites/mari/Mari_wave.png"
                        alt=""
                        className="h-40 w-auto object-contain drop-shadow-[0_12px_28px_color-mix(in_srgb,var(--noodle-accent)_35%,transparent)] max-sm:h-36"
                      />
                      <StepHeading
                        centred
                        title={t("ui.noodle.noodlerwizard.intro.info.title")}
                        help={t("ui.noodle.noodlerwizard.intro.info.help")}
                      />
                      <p className={cn(SLP_TYPE.body, "text-pretty text-[var(--slurp-muted)]")}>
                        <span className="font-semibold text-[var(--slurp-text)]">
                          {t("ui.noodle.noodlerwizard.intro.info.lead")}
                        </span>{" "}
                        {t("ui.noodle.noodlerwizard.intro.info.detail")}
                      </p>
                    </div>
                  )}

                  {intro === 1 && (
                    <div className="mx-auto max-w-md space-y-4">
                      <StepHeading
                        centred
                        title={t("ui.noodle.noodlerwizard.intro.attention.title")}
                        help={t("ui.noodle.noodlerwizard.intro.attention.help")}
                      />
                      <ul className={SLP_GROUP_CLASS}>
                        {[
                          { icon: <Coins size={18} />, key: "cost" },
                          { icon: <ImageIcon size={18} />, key: "images" },
                          { icon: <Cpu size={18} />, key: "context" },
                        ].map((item) => (
                          <li key={item.key} className={cn(SLP_TYPE.body, "flex items-start gap-3 px-4 py-3")}>
                            <span aria-hidden="true" className="mt-px shrink-0 text-[var(--noodle-accent-foreground)]">
                              {item.icon}
                            </span>
                            <span className="text-pretty">
                              {t(`ui.noodle.noodlerwizard.intro.attention.${item.key}`)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className={cn(SLP_TYPE.meta, "text-center text-pretty text-[var(--slurp-muted)]")}>
                        {t("ui.noodle.noodlerwizard.intro.attention.footer")}
                      </p>
                    </div>
                  )}

                  {intro === 2 && (
                    <div className="mx-auto max-w-2xl space-y-4">
                      <StepHeading
                        centred
                        title={t("ui.noodle.noodlerwizard.intro.identity.title")}
                        help={t("ui.noodle.noodlerwizard.intro.identity.help")}
                      />
                      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                        <div className="flex flex-col items-center text-center">
                          <Avatar
                            account={{
                              displayName: demoProfile.displayName,
                              avatarUrl: demoProfile.avatarUrl,
                              avatarCrop: demoProfile.avatarCrop,
                            }}
                            size="lg"
                          />
                          <p className={cn(SLP_TYPE.title, "mt-2")}>{demoProfile.displayName}</p>
                          <p className={cn(SLP_TYPE.meta, "text-[var(--slurp-muted)]")}>@{demoProfile.handle}</p>
                          <p className={cn(SLP_TYPE.meta, "mt-1 font-semibold text-[var(--noodle-accent-foreground)]")}>
                            {t(`ui.noodle.noodlerwizard.identityPreview.${disclosure}.connection`)}
                          </p>
                        </div>
                        <DisclosureChoice
                          value={disclosure}
                          onChange={(value) => {
                            setDisclosure(value);
                            setPostExplored(false);
                          }}
                          t={t}
                        />
                      </div>
                    </div>
                  )}

                  {intro === 3 && (
                    <div className="space-y-4">
                      <StepHeading
                        centred
                        title={t("ui.noodle.noodlerwizard.intro.locked.title")}
                        help={t("ui.noodle.noodlerwizard.intro.locked.help")}
                      />
                      {/* Capped width: the wizard modal is 3xl, and a full-bleed card makes the demo post
                    read as a page rather than as one item in a feed. */}
                      <div className="mx-auto max-w-sm overflow-hidden rounded-2xl shadow-[var(--slurp-shadow-raised),var(--slurp-highlight)] max-sm:max-w-[20rem]">
                        <LockedSlurpPostCard
                          key={disclosure}
                          post={{
                            ...DEMO_POST,
                            title: t("ui.noodle.noodlerwizard.demoPost.walkthrough.title"),
                            imageUrl: DEMO_POST.imageUrl,
                          }}
                          profile={DEMO_PROFILE}
                          subscribed={false}
                          unlockPending={false}
                          subscriptionPending={false}
                          onUnlock={() => {}}
                          onToggleSubscription={() => {}}
                          demo={{
                            body: t("ui.noodle.noodlerwizard.demoPost.walkthrough.body"),
                            lockedTitle: t("ui.noodle.noodlerwizard.demoPost.walkthrough.lockedTitle"),
                            unlockedLabel: t("ui.noodle.postaccess.unlocked"),
                            unlockedImageUrl: "/sprites/mari/Mari_noodler_teaser_unlocked.webp",
                            onReveal: () => setPostExplored(true),
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {intro === 4 && (
                    <div className="mx-auto max-w-2xl space-y-4">
                      <StepHeading
                        centred
                        title={t("ui.noodle.noodlerwizard.intro.activity.title")}
                        help={t("ui.noodle.noodlerwizard.intro.activity.help")}
                      />
                      <ChoiceSetting
                        label={t("ui.noodle.noodlerwizard.intro.activity.title")}
                        labelHidden
                        variant="cards"
                        value={activityChoice}
                        onChange={chooseActivity}
                        options={SLURP_ACTIVITY_PRESETS.map((choice) => ({
                          value: choice,
                          label: t(`ui.noodle.noodlerwizard.activityChoice.${choice}.title`),
                          detail: t(`ui.noodle.noodlerwizard.activityChoice.${choice}.detail`),
                        }))}
                      />
                      <div className={SLP_GROUP_CLASS}>
                        <div className="px-4">
                          <Toggle
                            compact
                            label={t("ui.noodle.noodlerwizard.nightQuiet")}
                            value={nightQuiet}
                            onChange={setNightQuiet}
                          />
                        </div>
                        <div className="px-4">
                          <Toggle
                            compact
                            label={t("ui.noodle.noodlerwizard.imagesShort")}
                            value={imagesEnabled}
                            onChange={setImagesEnabled}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl bg-[var(--slurp-tint)] px-3 py-2.5">
                        <img
                          src="/sprites/mari/Mari_explaining.png"
                          alt=""
                          className="h-14 w-auto shrink-0 object-contain max-sm:h-12"
                        />
                        <p className={cn(SLP_TYPE.body, "text-pretty")}>
                          {activityChoice === "manual"
                            ? t("ui.noodle.noodlerwizard.intro.activity.manualPreview")
                            : t("ui.noodle.noodlerwizard.intro.activity.preview", {
                                count: postsPerDay,
                              })}
                        </p>
                      </div>
                    </div>
                  )}

                  {intro === null && setupLane === null && (
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
                            { lane: "customize", icon: <SlidersHorizontal size={18} />, lead: false },
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
                  !selectionOnly && step < 5 && (intro !== null || setupLane !== null)
                    ? {
                        label:
                          intro === null ? t("ui.noodle.noodlerwizard.skip") : t("ui.noodle.noodlerwizard.skipIntro"),
                        onClick: () => (intro === null ? void skip() : setIntro(null)),
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
