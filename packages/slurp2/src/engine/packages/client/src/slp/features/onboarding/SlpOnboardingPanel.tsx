import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  NoodleIdentityDisclosure,
  NoodlerOnboardingCompletion,
  NoodlerRefreshNowOutcome,
  NoodlerPostView,
  NoodlerStageProfile,
} from "@marinara-engine/shared";
import {
  NOODLER_BULK_ACCOUNT_MAX,
  NOODLER_POSTS_PER_DAY_MAX,
  resolveNoodlerOnboardingCompletion,
} from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { useSlurpConnections } from "../../base/state/slp-host-connections";
import {
  useBulkCreateNoodlerStageProfiles,
  useNoodlerEligibleAccounts,
  useRefreshTargetedNoodlerCreatorsNow,
} from "../creators/slp-creators-contract";
import { useEnqueueNoodlerFirstPosts, useNoodlerFirstPostStatus } from "./slp-first-post-hooks";
import { useUpdateSlurpConnectionsForCreators } from "../media/slp-media-contract";
import { useSlurpSettings, useUpdateSlurpSettings } from "../settings/slp-settings-contract";
import { cn, generateClientId } from "../../../lib/utils";
import { Modal } from "../../../components/ui/Modal";
import { Avatar, getNoodleAccentStyle, NOODLE_PINK } from "../../base/chrome/SlpChrome";
import {
  SLURP_ACTIVITY_PRESETS,
  SLURP_DEFAULT_ACTIVITY_PRESET,
  slurpActivityPresetForSettings,
  slurpActivityPresetPatch,
  type SlurpActivityPreset,
} from "../../modules/creator/slp-activity-presets";
import { LockedSlurpPostCard } from "../../modules/post/SlpLockedPostCard";
import { useSlurpOnboardingWizardModel } from "./slp-onboarding-wizard-model";
import { SlpOnboardingSteps } from "./SlpOnboardingSteps";

export type Step = 1 | 2 | 3 | 4 | 5;
/** The teaching screens that run ahead of the numbered steps on first run. */
export type Intro = 0 | 1 | 2 | 3 | 4 | null;
export type SetupLane = "easy" | "customize" | null;
export const LAST_INTRO = 4;
/** "creationFailed" is local to the wizard: the shared resolver reports it as "failed", which
 * reads as a first-post problem even when no creator was ever set up. */
export type CompletionKind = NoodlerOnboardingCompletion | "creationFailed";

export const clampPostsPerDay = (raw: string) =>
  Math.max(1, Math.min(NOODLER_POSTS_PER_DAY_MAX, Math.round(Number(raw)) || 1));

export const DISCLOSURES: NoodleIdentityDisclosure[] = ["open", "hinted"];
export const DEFAULT_ACTIVITY_PATCH = slurpActivityPresetPatch(SLURP_DEFAULT_ACTIVITY_PRESET);
export const DEFAULT_POSTS_PER_DAY = DEFAULT_ACTIVITY_PATCH.postsPerDay!;

// The intro uses the real locked post card for a staged walkthrough. Mari is demonstrating
// the interaction, so the example stays independent from the identity choice above.
export const DEMO_PROFILE: NoodlerStageProfile = {
  id: "onboarding-demo",
  sourceAccountId: null,
  handle: "professor_mari",
  displayName: "Professor Mari",
  bio: "",
  avatarUrl: "/sprites/mari/chibi-professor-mari.png",
  avatarCrop: null,
  disclosureMode: "open",
  stagePersonality: "",
  publicIdentity: null,
  createdAt: "",
  updatedAt: "",
};
const DEMO_POST: Pick<NoodlerPostView, "id" | "access" | "createdAt" | "title" | "imageUrl"> &
  Partial<Pick<NoodlerPostView, "likeCount" | "replyCount">> = {
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

export function disclosureLabel(value: NoodleIdentityDisclosure, t: ReturnType<typeof useUiTranslation>["t"]) {
  return t(`ui.noodle.noodlerwizard.disclosure.${value}.title`);
}

export function SlurpOnboardingWizard(props: WizardProps) {
  const model = useSlurpOnboardingWizardModel(props);
  const {
    open,
    selectionOnly,
    onClose,
    onComplete,
    onSeeFeed,
    t,
    eligible,
    bulkCreate,
    refreshTargeted,
    enqueueFirstPosts,
    connectionsQuery,
    accounts,
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
    setSelected,
    disclosure,
    setDisclosure,
    exceptions,
    setExceptions,
    autoPostingEnabled,
    setAutoPostingEnabled,
    postsPerDay,
    setPostsPerDay,
    postsPerDayDraft,
    setPostsPerDayDraft,
    nightQuiet,
    setNightQuiet,
    imagesEnabled,
    setImagesEnabled,
    imageConnectionId,
    setImageConnectionId,
    generateNow,
    setGenerateNow,
    createdIds,
    creationFailures,
    settingsFailed,
    setSettingsFailed,
    creationFailed,
    creationError,
    creationReasons,
    generationConnectionId,
    setGenerationConnectionId,
    outcomes,
    completion,
    setCompletion,
    firstPostsQueued,
    providerConfirmationOpen,
    setProviderConfirmationOpen,
    completionHeadingRef,
    demoProfile,
    hasNextPage,
    selectionFull,
    toggleSelected,
    chooseActivity,
    failedIds,
    failedCount,
    generatedCount,
    resolveCompletion,
    runGeneration,
    saveSettings,
    skip,
    returnToSetup,
    returnToPreviousStep,
    performFinish,
    finish,
    pending,
    summaries,
  } = model;
  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        closeDisabled={pending}
        title={selectionOnly ? t("ui.noodle.noodlerwizard.addCreators") : t("ui.noodle.noodlerwizard.title")}
        width="max-w-3xl"
        mobileFullscreen
        contentClassName="max-sm:flex max-sm:flex-col max-sm:overflow-hidden max-sm:px-4 max-sm:py-2"
        panelStyle={getNoodleAccentStyle(NOODLE_PINK, {
          // The wizard used to hardcode a dark palette, so it stayed dark in light mode.
          // These all resolve through light-dark() now.
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "color-mix(in srgb, var(--noodle-accent) 24%, transparent)",
          "--accent": "color-mix(in srgb, var(--noodle-accent) 12%, transparent)",
        })}
      >
        <div className="flex max-h-[min(78vh,46rem)] min-h-[26rem] flex-col max-sm:min-h-0 max-sm:max-h-none max-sm:flex-1 max-sm:self-stretch">
          {intro !== null && (
            <div
              className="-mx-5 flex items-center gap-2 border-b border-[var(--noodle-accent)]/25 bg-gradient-to-r from-[var(--noodle-accent)]/20 via-[var(--noodle-accent)]/8 to-transparent px-5 pb-3 pt-2 max-sm:-mx-4 max-sm:gap-1.5 max-sm:px-4 max-sm:pb-2"
              aria-hidden="true"
            >
              {[0, 1, 2, 3, 4].map((dot) => (
                <span
                  key={dot}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    dot === intro ? "w-6 bg-[var(--noodle-accent)]" : "w-1.5 bg-[var(--slurp-outline)]",
                  )}
                />
              ))}
            </div>
          )}
          {intro === null && setupLane !== null && step < 5 && (
            <div className="-mx-5 border-b border-[var(--noodle-accent)]/25 bg-gradient-to-r from-[var(--noodle-accent)]/20 via-[var(--noodle-accent)]/8 to-transparent px-5 pb-3 pt-1.5 max-sm:-mx-4 max-sm:px-4 max-sm:pb-1.5">
              {/* Progress rail: done steps stay reachable, later ones stay locked until you get there. */}
              <ol className="flex gap-1.5">
                {summaries.map((item) => {
                  const reachable = item.step <= step;
                  return (
                    <li key={item.step} className="min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!reachable}
                        aria-current={step === item.step ? "step" : undefined}
                        onClick={() => setStep(item.step)}
                        className={cn(
                          "w-full min-w-0 rounded-lg px-2 pb-1.5 pt-2 text-left transition-colors max-sm:px-1 max-sm:pb-1 max-sm:pt-1.5",
                          reachable ? "hover:bg-[var(--slurp-surface-raised)]" : "cursor-default opacity-45",
                        )}
                      >
                        <span
                          className={cn(
                            "block h-1 rounded-full transition-colors",
                            step === item.step
                              ? "bg-[var(--noodle-accent)]"
                              : item.step < step
                                ? "bg-[var(--noodle-accent)]/45"
                                : "bg-[var(--slurp-outline)]",
                          )}
                        />
                        <span className="mt-1.5 block truncate text-[0.7rem] font-bold max-sm:mt-1">{item.label}</span>
                        <span className="block truncate text-[0.7rem] text-[var(--slurp-muted)] max-sm:hidden">
                          {item.value}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto py-4 max-sm:py-2.5">
            {intro === 0 && (
              <div className="space-y-4 max-sm:space-y-3">
                <StepHeading
                  icon={<Sparkles size={18} />}
                  title={t("ui.noodle.noodlerwizard.intro.info.title")}
                  help={t("ui.noodle.noodlerwizard.intro.info.help")}
                />
                <div className="flex items-center gap-4 rounded-xl border border-[var(--noodle-accent)]/25 bg-[var(--noodle-accent)]/10 p-4 max-sm:items-start max-sm:gap-3 max-sm:p-3">
                  <img
                    src="/sprites/mari/Mari_wave.png"
                    alt=""
                    className="h-36 w-auto shrink-0 object-contain max-sm:h-24"
                  />
                  <div className="space-y-3 text-sm leading-6 max-sm:space-y-1.5 max-sm:leading-5">
                    <p className="font-semibold">{t("ui.noodle.noodlerwizard.intro.info.lead")}</p>
                    <p className="text-[var(--slurp-muted)]">{t("ui.noodle.noodlerwizard.intro.info.detail")}</p>
                  </div>
                </div>
              </div>
            )}

            {intro === 1 && (
              <div className="space-y-4 max-sm:space-y-3">
                <StepHeading
                  icon={<AlertTriangle size={18} />}
                  title={t("ui.noodle.noodlerwizard.intro.attention.title")}
                  help={t("ui.noodle.noodlerwizard.intro.attention.help")}
                />
                <div className="space-y-2.5">
                  {[
                    { icon: <Coins size={15} />, key: "cost" },
                    { icon: <ImageIcon size={15} />, key: "images" },
                    { icon: <Cpu size={15} />, key: "context" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-start gap-3 rounded-lg border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/10 px-3 py-2.5 text-sm leading-6"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--noodle-accent)]/15 text-[var(--noodle-accent)]">
                        {item.icon}
                      </span>
                      <span>{t(`ui.noodle.noodlerwizard.intro.attention.${item.key}`)}</span>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg border border-[var(--slurp-outline)] px-3 py-2.5 text-xs leading-5 text-[var(--slurp-muted)]">
                  {t("ui.noodle.noodlerwizard.intro.attention.footer")}
                </p>
              </div>
            )}

            {intro === 2 && (
              <div className="space-y-4 max-sm:space-y-3">
                <StepHeading
                  icon={<Eye size={18} />}
                  title={t("ui.noodle.noodlerwizard.intro.identity.title")}
                  help={t("ui.noodle.noodlerwizard.intro.identity.help")}
                />
                <div className="grid gap-3 max-sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--noodle-accent)]/25 bg-[var(--noodle-accent)]/10 p-4 text-center max-sm:p-2">
                    <Avatar
                      account={{
                        displayName: demoProfile.displayName,
                        avatarUrl: demoProfile.avatarUrl,
                        avatarCrop: demoProfile.avatarCrop,
                      }}
                      size="lg"
                    />
                    <p className="mt-3 font-bold max-sm:mt-2 max-sm:text-xs">{demoProfile.displayName}</p>
                    <p className="text-xs text-[var(--slurp-muted)]">@{demoProfile.handle}</p>
                    <p className="mt-2 text-xs font-semibold text-[var(--noodle-accent)] max-sm:mt-1 max-sm:text-[0.625rem]">
                      {t(`ui.noodle.noodlerwizard.identityPreview.${disclosure}.connection`)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {DISCLOSURES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={disclosure === value}
                        onClick={() => {
                          setDisclosure(value);
                          setPostExplored(false);
                        }}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2.5 text-left transition-colors max-sm:px-2.5 max-sm:py-2",
                          disclosure === value
                            ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/15 text-[var(--slurp-text)] ring-2 ring-[var(--noodle-accent)]/45"
                            : "border-[var(--slurp-outline)] hover:border-[var(--noodle-accent)]/40 hover:bg-[var(--noodle-accent)]/8",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-bold">
                          {t(`ui.noodle.noodlerwizard.disclosure.${value}.title`)}
                          {disclosure === value && <Check size={15} className="shrink-0 text-[var(--noodle-accent)]" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-[var(--slurp-muted)] max-sm:line-clamp-2 max-sm:leading-4">
                          {t(`ui.noodle.noodlerwizard.disclosure.${value}.detail`)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {intro === 3 && (
              <div className="space-y-4 max-sm:space-y-3">
                <StepHeading
                  icon={<Lock size={18} />}
                  title={t("ui.noodle.noodlerwizard.intro.locked.title")}
                  help={t("ui.noodle.noodlerwizard.intro.locked.help")}
                />
                {/* Capped width: the wizard modal is 3xl, and a full-bleed card makes the demo post
                  read as a page rather than as one item in a feed. */}
                <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-[var(--noodle-divider)] max-sm:max-w-[18rem]">
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
              <div className="space-y-4 max-sm:space-y-3">
                <StepHeading
                  icon={<Clock size={18} />}
                  title={t("ui.noodle.noodlerwizard.intro.activity.title")}
                  help={t("ui.noodle.noodlerwizard.intro.activity.help")}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {SLURP_ACTIVITY_PRESETS.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => chooseActivity(choice)}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 text-left transition-colors max-sm:py-2",
                        activityChoice === choice
                          ? "border-[var(--noodle-accent)] bg-[var(--noodle-accent)]/10"
                          : "border-[var(--slurp-outline)] hover:border-[var(--noodle-accent)]/40 hover:bg-[var(--noodle-accent)]/8",
                      )}
                    >
                      <span className="block text-sm font-bold">
                        {t(`ui.noodle.noodlerwizard.activityChoice.${choice}.title`)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-[var(--slurp-muted)]">
                        {t(`ui.noodle.noodlerwizard.activityChoice.${choice}.detail`)}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/[0.06] px-3 py-2.5">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={nightQuiet}
                      onChange={(event) => setNightQuiet(event.target.checked)}
                      className="h-4 w-4 accent-[var(--noodle-accent)]"
                    />
                    {t("ui.noodle.noodlerwizard.nightQuiet")}
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={imagesEnabled}
                      onChange={(event) => setImagesEnabled(event.target.checked)}
                      className="h-4 w-4 accent-[var(--noodle-accent)]"
                    />
                    {t("ui.noodle.noodlerwizard.imagesShort")}
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[var(--noodle-accent)]/30 bg-[var(--noodle-accent)]/8 px-3 py-2.5 max-sm:py-2">
                  <img
                    src="/sprites/mari/Mari_explaining.png"
                    alt=""
                    className="h-16 w-auto object-contain max-sm:h-12"
                  />
                  <p className="text-sm leading-5">
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
              <div className="space-y-5">
                <StepHeading
                  icon={<Sparkles size={18} />}
                  title={t("ui.noodle.noodlerwizard.handoff.title")}
                  help={t("ui.noodle.noodlerwizard.handoff.help")}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSetupLane("easy");
                      setStep(1);
                    }}
                    className="group rounded-xl border border-[var(--noodle-accent)]/60 bg-gradient-to-br from-[var(--noodle-accent)]/22 to-[var(--noodle-accent)]/6 p-5 text-left shadow-sm shadow-[var(--noodle-accent)]/15 transition-[transform,box-shadow,background-color] hover:-translate-y-0.5 hover:shadow-md hover:shadow-[var(--noodle-accent)]/25 motion-reduce:transform-none"
                  >
                    <span className="flex items-center gap-2 text-base font-bold">
                      <Sparkles size={17} className="text-[var(--noodle-accent)]" />
                      {t("ui.noodle.noodlerwizard.handoff.easy.title")}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-[var(--slurp-muted)]">
                      {t("ui.noodle.noodlerwizard.handoff.easy.detail")}
                    </span>
                    <span className="mt-4 flex items-center gap-1 text-sm font-bold text-[var(--noodle-accent)]">
                      {t("ui.noodle.noodlerwizard.handoff.easy.action")}
                      <ChevronRight size={15} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupLane("customize");
                      setStep(1);
                    }}
                    className="group rounded-xl border border-[var(--noodle-accent)]/35 bg-[var(--noodle-accent)]/[0.06] p-5 text-left transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[var(--noodle-accent)]/12 motion-reduce:transform-none"
                  >
                    <span className="flex items-center gap-2 text-base font-bold">
                      <SlidersHorizontal size={17} />
                      {t("ui.noodle.noodlerwizard.handoff.customize.title")}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-[var(--slurp-muted)]">
                      {t("ui.noodle.noodlerwizard.handoff.customize.detail")}
                    </span>
                    <span className="mt-4 flex items-center gap-1 text-sm font-bold text-[var(--slurp-text)]">
                      {t("ui.noodle.noodlerwizard.handoff.customize.action")}
                      <ChevronRight size={15} />
                    </span>
                  </button>
                </div>
              </div>
            )}

            <SlpOnboardingSteps model={model} />
          </div>

          <div className="border-t border-[var(--slurp-outline)] pt-3 max-sm:pt-2">
            <div className="flex items-center justify-between gap-3 max-sm:gap-1.5">
              <div className="flex items-center gap-2 max-sm:gap-0.5">
                {intro !== null && intro > 0 && (
                  <button
                    type="button"
                    onClick={() => setIntro((intro - 1) as Intro)}
                    className="flex min-h-10 items-center gap-1 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-bold max-sm:px-2"
                  >
                    <ChevronLeft size={15} />
                    {t("ui.noodle.noodlerwizard.back")}
                  </button>
                )}
                {intro === null &&
                  setupLane !== null &&
                  ((step > 1 && step < 5) || (step === 5 && completion === "creationFailed")) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 5) returnToSetup();
                        else returnToPreviousStep();
                      }}
                      className="flex min-h-10 items-center gap-1 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-bold max-sm:px-2"
                    >
                      <ChevronLeft size={15} />
                      {t("ui.noodle.noodlerwizard.back")}
                    </button>
                  )}
                {intro === null && setupLane !== null && step === 1 && !selectionOnly && (
                  <button
                    type="button"
                    onClick={() => setSetupLane(null)}
                    className="flex min-h-10 items-center gap-1 rounded-lg border border-[var(--slurp-outline)] px-3 text-sm font-bold max-sm:px-2"
                  >
                    <ChevronLeft size={15} />
                    {t("ui.noodle.noodlerwizard.back")}
                  </button>
                )}
                {!selectionOnly && step < 5 && (intro !== null || setupLane !== null) && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => (intro === null ? void skip() : setIntro(null))}
                    className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--slurp-muted)] hover:text-[var(--slurp-text)] disabled:opacity-50 max-sm:px-1.5 max-sm:text-xs"
                  >
                    {intro === null ? t("ui.noodle.noodlerwizard.skip") : t("ui.noodle.noodlerwizard.skipIntro")}
                  </button>
                )}
              </div>
              {intro !== null ? (
                <button
                  type="button"
                  disabled={intro === 3 && !postExplored}
                  onClick={() => setIntro(intro < LAST_INTRO ? ((intro + 1) as Intro) : null)}
                  className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50 max-sm:px-3"
                >
                  {intro < LAST_INTRO ? t("ui.noodle.noodlerwizard.continue") : t("ui.noodle.noodlerwizard.introDone")}
                  <ChevronRight size={15} />
                </button>
              ) : setupLane === null ? null : step < 5 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={pending || (step === 1 && selected.size === 0)}
                    onClick={() => {
                      if (step === 4) void finish();
                      else if (setupLane === "easy" && step === 1) setStep(4);
                      else setStep((step + 1) as Step);
                    }}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950 disabled:opacity-50 max-sm:px-3 max-sm:text-xs"
                  >
                    {pending && <Loader2 size={15} className="animate-spin" />}
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
                    {!pending && step !== 4 && <ChevronRight size={15} />}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onSeeFeed?.();
                    if (!onSeeFeed) onClose();
                  }}
                  className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-bold text-zinc-950 [&_svg]:!text-zinc-950"
                >
                  {t("ui.noodle.noodlerwizard.openAllCreators")}
                </button>
              )}
            </div>
            {/* Creating profiles then writing first posts can take a while; say which half we are in. */}
            <p aria-live="polite" className="mt-2 min-h-4 text-xs text-[var(--slurp-muted)] max-sm:mt-1">
              {bulkCreate.isPending || enqueueFirstPosts.isPending
                ? t("ui.noodle.noodlerwizard.progressCreating")
                : refreshTargeted.isPending || firstPostsQueued
                  ? t("ui.noodle.noodlerwizard.progressWriting")
                  : ""}
            </p>
          </div>
        </div>
      </Modal>
      <Modal
        open={providerConfirmationOpen}
        onClose={() => setProviderConfirmationOpen(false)}
        title={t("ui.slurp.providerDisclosure.title")}
        width="max-w-md"
        panelClassName="noodle-icon-scope"
        panelStyle={getNoodleAccentStyle(NOODLE_PINK, {
          "--background": "var(--slurp-surface)",
          "--foreground": "var(--slurp-text)",
          "--muted-foreground": "var(--slurp-muted)",
          "--border": "rgba(255, 126, 193, 0.24)",
          "--accent": "rgba(255, 126, 193, 0.12)",
        })}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--muted-foreground)]">
            {t("ui.slurp.providerDisclosure.onboardingDetail")}
          </p>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => setProviderConfirmationOpen(false)}
              className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-xs font-semibold"
            >
              {t("ui.slurp.actions.cancel")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setProviderConfirmationOpen(false);
                void performFinish();
              }}
              className="min-h-10 rounded-lg bg-[var(--noodle-accent)] px-4 text-xs font-bold !text-zinc-950 [&_svg]:!text-zinc-950"
            >
              {t("ui.slurp.actions.continue")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function StepHeading({ icon, title, help }: { icon: ReactNode; title: string; help: string }) {
  return (
    <div className="flex gap-3 max-sm:gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--noodle-accent)] to-[var(--noodle-accent)]/70 text-zinc-950 shadow-sm shadow-[var(--noodle-accent)]/30 max-sm:h-8 max-sm:w-8">
        {icon}
      </span>
      <div className="min-w-0">
        <h3 className="text-xl font-bold leading-snug max-sm:text-lg">{title}</h3>
        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-[var(--slurp-muted)] max-sm:leading-5">{help}</p>
      </div>
    </div>
  );
}
