import { useEffect, useState } from "react";
import { Button } from "./shared-controls";
import { useLtmTranslation } from "./localization";
import type { CapabilityProps, SourceTab } from "./types";

const onboardingStorageKey = "marinara-long-term-memory-onboarding-v1";
const onboardingStepPattern = /^step:(\d+)$/u;
const persistOnboardingStep = (step: number) => {
  try {
    localStorage.setItem(onboardingStorageKey, `step:${step}`);
  } catch {}
};

// The Engine's Professor Mari poses (public/sprites/mari/<pack>/pose-<pose>.webp, Basic pack). The painted
// Mari_*.png files these replaced are gone from the Engine, which left the guide with broken images.
const onboardingSteps = [
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.save",
    titleKey: "ui.longTermMemory.longtermmemorydetail.fromSourceToSavedMemory",
    mobileSprite: "basic/pose-wave.webp",
    desktopSprite: "basic/pose-wave.webp",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.recall",
    titleKey: "ui.longTermMemory.longtermmemorydetail.howRecallWorks",
    mobileSprite: "basic/pose-explaining.webp",
    desktopSprite: "basic/pose-explaining.webp",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.activate",
    titleKey: "ui.longTermMemory.longtermmemorydetail.turnItOnForThisChat",
    mobileSprite: "basic/pose-point-up.webp",
    desktopSprite: "basic/pose-point-up.webp",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.import",
    titleKey: "ui.longTermMemory.longtermmemorydetail.chooseWhatToRemember",
    mobileSprite: "basic/pose-point-down.webp",
    desktopSprite: "basic/pose-point-middle.webp",
    alt: "",
    mobileFlip: false,
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.review",
    titleKey: "ui.longTermMemory.longtermmemorydetail.reviewBeforeSaving",
    mobileSprite: "basic/pose-point-down.webp",
    desktopSprite: "basic/pose-point-up.webp",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.check",
    titleKey: "ui.longTermMemory.longtermmemorydetail.checkWhatTheChatUsed",
    mobileSprite: "basic/pose-thinking.webp",
    desktopSprite: "basic/pose-thinking.webp",
    mobileFlip: false,
    alt: "",
  },
  {
    labelKey: "ui.longTermMemory.longtermmemorydetail.underTheHood",
    titleKey: "ui.longTermMemory.longtermmemorydetail.underTheHoodTitle",
    mobileSprite: "basic/pose-thinking.webp",
    desktopSprite: "basic/pose-thinking.webp",
    mobileFlip: false,
    alt: "",
  },
] as const;

type OnboardingProps = {
  props: CapabilityProps;
  /** True once the status query has loaded; the guide opens on first run after that. */
  ready: boolean;
  savedMemoryCount: number;
  pendingDraftCount: number | undefined;
  chatLabel: string;
  connectedChat: boolean;
  activeChat: boolean;
  activationPending: boolean;
  /** Turns Long-Term Memory on for the chat; resolves true when it was enabled. */
  onActivate: () => Promise<boolean>;
  onOpenReview: () => Promise<boolean>;
  onOpenSources: (source?: SourceTab) => Promise<boolean>;
  onOpenVault: () => Promise<boolean>;
  /** Hands the parent the function that reopens the guide at its first step. */
  onOpen: (open: () => void) => void;
};

export function Onboarding({
  props,
  ready,
  savedMemoryCount,
  pendingDraftCount,
  chatLabel,
  connectedChat,
  activeChat,
  activationPending,
  onActivate,
  onOpenReview,
  onOpenSources,
  onOpenVault,
  onOpen,
}: OnboardingProps) {
  const { t: localizeUi } = useLtmTranslation();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingSource, setOnboardingSource] = useState<SourceTab>("chats");

  useEffect(() => {
    onOpen(() => {
      setOnboardingStep(0);
      setOnboardingOpen(true);
    });
  }, [onOpen]);

  useEffect(() => {
    if (!ready) return;
    let stored = "";
    try {
      stored = localStorage.getItem(onboardingStorageKey) ?? "";
    } catch {}
    if (stored === "complete") return;
    const match = onboardingStepPattern.exec(stored);
    const savedStep = match ? Number(match[1]) : null;
    if (savedStep !== null && Number.isInteger(savedStep) && savedStep >= 0 && savedStep < onboardingSteps.length) {
      setOnboardingStep(savedStep);
      setOnboardingOpen(true);
      return;
    }
    if (savedMemoryCount !== 0) return;
    setOnboardingOpen(true);
  }, [ready, savedMemoryCount]);

  const completeOnboarding = () => {
    setOnboardingOpen(false);
    try {
      localStorage.setItem(onboardingStorageKey, "complete");
    } catch {}
  };
  const suspendOnboarding = () => {
    persistOnboardingStep(onboardingStep);
    setOnboardingOpen(false);
  };

  useEffect(() => {
    if (!onboardingOpen) return;
    persistOnboardingStep(onboardingStep);
  }, [onboardingOpen, onboardingStep]);

  const openPromptPresetSections = () => {
    suspendOnboarding();
    props.onOpenActivePromptPresetEditor?.();
  };
  const openChatSummarySettings = () => {
    suspendOnboarding();
    props.onOpenChatSummarySettings?.();
  };
  const advanceOnboarding = () =>
    setOnboardingStep((step) => {
      const next = Math.min(step + 1, onboardingSteps.length - 1);
      persistOnboardingStep(next);
      return next;
    });
  const activateForOnboarding = async () => {
    if (await onActivate()) advanceOnboarding();
  };

  if (!onboardingOpen) return null;
  return (
    <section
      aria-labelledby="ltm-onboarding-title"
      aria-describedby="ltm-onboarding-description"
      data-ltm-surface="onboarding"
      className="mari-editor-panel mari-editor-panel--soft overflow-hidden"
    >
      <style>{`
                [data-ltm-onboarding-body] {
                  display: grid;
                  grid-template-columns: minmax(0, 1fr);
                  align-items: center;
                  gap: 1.25rem;
                }
                [data-ltm-onboarding-sprite-wrap] {
                  display: flex;
                  min-height: 7rem;
                  align-items: center;
                  justify-content: flex-end;
                }
                [data-ltm-onboarding-sprite] {
                  display: block;
                  width: auto;
                  height: 7rem;
                  max-width: 100%;
                  object-fit: contain;
                }
                [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-flip] {
                  transform: scaleX(-1);
                }
                [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-shift="left"] {
                  transform: translateX(-40px);
                }
                [data-ltm-onboarding-actions] {
                  display: flex;
                  flex-direction: column;
                  gap: 0.5rem;
                }
                [data-ltm-onboarding-actions] > button {
                  width: 100%;
                }
                [data-ltm-source-choice] {
                  display: grid;
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                  gap: 0.5rem;
                }
                [data-ltm-source-choice] > button {
                  min-width: 0;
                  width: 100%;
                  justify-content: center;
                  text-align: center;
                  white-space: normal;
                }
                [data-ltm-onboarding-footer] {
                  display: flex;
                  justify-content: flex-start;
                  border-top: 1px solid var(--border);
                  padding: 0.75rem 1rem;
                }
                [data-ltm-onboarding-footer] > p {
                  min-width: 0;
                  flex: 1;
                }
                [data-ltm-onboarding-close] {
                  min-height: 2.75rem;
                  padding: 0.375rem 0.625rem;
                  font-size: 0.75rem;
                }
                @media (min-width: 768px) {
                  [data-ltm-onboarding-body] {
                    grid-template-columns: minmax(0, 1fr) 12rem;
                  }
                  [data-ltm-onboarding-sprite-wrap] {
                    min-height: 11rem;
                    justify-content: center;
                  }
                  [data-ltm-onboarding-sprite] {
                    height: 11rem;
                    max-width: 12rem;
                  }
                  [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-flip] {
                    transform: none;
                  }
                  [data-ltm-onboarding-sprite][data-ltm-onboarding-mobile-shift] {
                    transform: none;
                  }
                  [data-ltm-onboarding-actions] {
                    flex-direction: row;
                    flex-wrap: wrap;
                  }
                  [data-ltm-onboarding-actions] > button {
                    width: auto;
                  }
                }
              `}</style>
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <img
          src="/sprites/mari/chibi-professor-mari.webp"
          alt=""
          draggable={false}
          className="h-10 w-10 shrink-0 object-contain"
        />
        <p className="min-w-0 flex-1 text-xs font-semibold">
          {localizeUi("ui.longTermMemory.longtermmemorydetail.professorMariSSetupGuide")}
        </p>
        <p className="shrink-0 text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.longtermmemorydetail.stepProgress", {
            current: onboardingStep + 1,
            total: onboardingSteps.length,
            label: localizeUi(onboardingSteps[onboardingStep].labelKey),
          })}
        </p>
      </div>
      <div data-ltm-onboarding-body className="p-4 sm:p-6">
        <div className="space-y-4">
          <div className="space-y-2" aria-live="polite" aria-atomic="true">
            <h2 id="ltm-onboarding-title" className="text-lg font-semibold">
              {localizeUi(onboardingSteps[onboardingStep].titleKey)}
            </h2>
            <div
              id="ltm-onboarding-description"
              className="max-w-[65ch] space-y-4 text-sm leading-6 text-[var(--muted-foreground)]"
            >
              {onboardingStep === 0 ? (
                <>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.memoryStatesIntro")}</p>
                  <dl className="space-y-4">
                    <div>
                      <dt className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceNote")}
                      </dt>
                      <dd>{localizeUi("ui.longTermMemory.longtermmemorydetail.sourceNoteDefinition")}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.proposedMemory")}
                      </dt>
                      <dd>{localizeUi("ui.longTermMemory.longtermmemorydetail.proposedMemoryDefinition")}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.savedMemory")}
                      </dt>
                      <dd>{localizeUi("ui.longTermMemory.longtermmemorydetail.savedMemoryDefinition")}</dd>
                    </div>
                  </dl>
                </>
              ) : onboardingStep === 1 ? (
                <>
                  <p>
                    <strong className="font-semibold text-[var(--foreground)]">
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.recalledMemory")}
                    </strong>{" "}
                    {localizeUi("ui.longTermMemory.longtermmemorydetail.recalledMemoryDefinition")}
                  </p>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.recallNotEveryReply")}</p>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.recallMatchmaker")}</p>
                </>
              ) : onboardingStep === 2 ? (
                <>
                  {activeChat ? (
                    <>
                      <p>
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.activeChatStatus", {
                          value1: chatLabel,
                        })}
                      </p>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.activeChatBehavior")}</p>
                    </>
                  ) : connectedChat ? (
                    <>
                      <p>
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatStatus", {
                          value1: chatLabel,
                        })}
                      </p>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatAction")}</p>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatAvailability")}</p>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.inactiveChatVerification")}</p>
                    </>
                  ) : (
                    <>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.noChatAvailability")}</p>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.noChatActivationPath")}</p>
                    </>
                  )}
                  {props.chatMode === "conversation" ? (
                    <>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.conversationPlacementLead")}</p>
                      <p>
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.conversationPlacementAdvancedBefore")}{" "}
                        <code>{"{{memories}}"}</code>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.conversationPlacementAdvancedBetween")}{" "}
                        <code>{"{{memoryRecall}}"}</code>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.conversationPlacementAdvancedAfter")}
                      </p>
                    </>
                  ) : props.chatMode === "roleplay" || props.chatMode === "game" ? (
                    <>
                      <ol className="list-decimal space-y-1 ps-6">
                        <li>{localizeUi("ui.longTermMemory.longtermmemorydetail.promptBlockPlacementOpenEditor")}</li>
                        <li>{localizeUi("ui.longTermMemory.longtermmemorydetail.promptBlockPlacementOpenSections")}</li>
                        <li>
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.promptBlockPlacementAddAgentSection")}
                        </li>
                        <li>
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.promptBlockPlacementKeepBlockEnabled")}
                        </li>
                      </ol>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.promptBlockPlacementFallback")}</p>
                    </>
                  ) : null}
                </>
              ) : onboardingStep === 3 ? (
                <>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChoiceIntro")}</p>
                  <ul className="list-disc space-y-1 ps-6">
                    <li>
                      <strong className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChats")}
                      </strong>{" "}
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChatDescription")}
                    </li>
                    <li>
                      <strong className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceLorebooks")}
                      </strong>{" "}
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceLorebookDescription")}
                    </li>
                    <li>
                      <strong className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceCharacters")}
                      </strong>{" "}
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.sourceCharacterDescription")}
                    </li>
                  </ul>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChoiceAfterList")}</p>
                </>
              ) : onboardingStep === 4 ? (
                <>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.reviewIntro")}</p>
                  <ul className="list-disc space-y-1 ps-6">
                    <li>
                      <strong className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewAccept")}
                      </strong>{" "}
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewAcceptConsequence")}
                    </li>
                    <li>
                      <strong className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewEdit")}
                      </strong>{" "}
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewEditConsequence")}
                    </li>
                    <li>
                      <strong className="font-semibold text-[var(--foreground)]">
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewSkip")}
                      </strong>{" "}
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.reviewSkipConsequence")}
                    </li>
                  </ul>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.reviewStableAppearance")}</p>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.reviewRecallEligibility")}</p>
                </>
              ) : onboardingStep === 5 ? (
                activeChat ? (
                  <>
                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyIntro")}</p>
                    <ol className="list-decimal space-y-1 ps-6">
                      <li>
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.verifySendMessage", {
                          value1: chatLabel,
                        })}
                      </li>
                      <li>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyPeekPrompt")}</li>
                    </ol>
                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyZeroResults")}</p>
                  </>
                ) : (
                  <>
                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyPrerequisite")}</p>
                    <ol className="list-decimal space-y-1 ps-6">
                      <li>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyWithoutChatSendMessage")}</li>
                      <li>{localizeUi("ui.longTermMemory.longtermmemorydetail.verifyWithoutChatInspectSummary")}</li>
                    </ol>
                  </>
                )
              ) : onboardingStep === 6 ? (
                <>
                  <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodIntro")}</p>
                  <details className="rounded-md border border-[var(--border)] px-3 py-2">
                    <summary className="cursor-pointer font-semibold text-[var(--foreground)]">
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodExtraction")}
                    </summary>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
                      <p>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodSourceNotesLabel")}
                        </strong>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodSourceNotes")}
                      </p>
                      <p>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodFingerprintsLabel")}
                        </strong>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodFingerprints")}
                      </p>
                      <p>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodCandidatesLabel")}
                        </strong>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodCandidates")}
                      </p>
                      <p>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodEvidenceLabel")}
                        </strong>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodEvidence")}
                      </p>
                      <p>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodDuplicatesLabel")}
                        </strong>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodDuplicates")}
                      </p>
                      <p>
                        <strong className="font-semibold text-[var(--foreground)]">
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodReviewLabel")}
                        </strong>{" "}
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodReview")}
                      </p>
                    </div>
                  </details>
                  <details className="rounded-md border border-[var(--border)] px-3 py-2">
                    <summary className="cursor-pointer font-semibold text-[var(--foreground)]">
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodRecall")}
                    </summary>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]">
                      <ul className="list-disc space-y-2 ps-6">
                        <li>
                          <strong className="font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodDirectMatchesLabel")}
                          </strong>{" "}
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodDirectMatches")}
                        </li>
                        <li>
                          <strong className="font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodWordMatchingLabel")}
                          </strong>{" "}
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodWordMatching")}
                        </li>
                        <li>
                          <strong className="font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodKeywordsLabel")}
                          </strong>{" "}
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodKeywords")}
                        </li>
                        <li>
                          <strong className="font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodRelatedMemoriesLabel")}
                          </strong>{" "}
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodRelatedMemories")}
                        </li>
                        <li>
                          <strong className="font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodMeaningLabel")}
                          </strong>{" "}
                          {localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodMeaning")}
                        </li>
                      </ul>
                      <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.underTheHoodFusion")}</p>
                    </div>
                  </details>
                </>
              ) : null}
            </div>
            {onboardingStep === 3 ? (
              <>
                <div
                  data-ltm-source-choice
                  role="group"
                  aria-label={localizeUi("ui.longTermMemory.longtermmemorydetail.sourceChoice")}
                >
                  {(["chats", "lorebooks", "characters"] as const).map((source) => (
                    <Button
                      key={source}
                      primary={onboardingSource === source}
                      aria-pressed={onboardingSource === source}
                      onClick={() => setOnboardingSource(source)}
                    >
                      {localizeUi(
                        `ui.longTermMemory.longtermmemorydetail.source${source[0].toUpperCase()}${source.slice(1)}`,
                      )}
                    </Button>
                  ))}
                </div>
                {onboardingSource === "chats" ? (
                  <div className="max-w-[65ch] space-y-4 text-sm leading-6 text-[var(--muted-foreground)]">
                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.chatSummarySetupIntro")}</p>
                    <p>{localizeUi("ui.longTermMemory.longtermmemorydetail.chatSummarySetupOpen")}</p>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          <div data-ltm-onboarding-actions>
            {onboardingStep > 0 ? (
              <Button
                onClick={() =>
                  setOnboardingStep((step) => {
                    const previous = step - 1;
                    persistOnboardingStep(previous);
                    return previous;
                  })
                }
              >
                {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
              </Button>
            ) : null}
            {onboardingStep === 0 ? (
              <Button primary onClick={advanceOnboarding}>
                {localizeUi("ui.longTermMemory.longtermmemorydetail.nextHowRecallWorks")}
              </Button>
            ) : onboardingStep === 1 ? (
              <Button primary onClick={advanceOnboarding}>
                {localizeUi("ui.longTermMemory.longtermmemorydetail.nextTurnItOn")}
              </Button>
            ) : onboardingStep === 2 ? (
              activeChat ? (
                <>
                  <Button primary onClick={advanceOnboarding}>
                    {localizeUi("ui.longTermMemory.longtermmemorydetail.nextChooseASource")}
                  </Button>
                  {(props.chatMode === "roleplay" || props.chatMode === "game") &&
                  props.onOpenActivePromptPresetEditor ? (
                    <Button onClick={openPromptPresetSections}>
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.openPromptPresetSections")}
                    </Button>
                  ) : null}
                </>
              ) : connectedChat ? (
                <>
                  <Button
                    primary
                    disabled={activationPending || !props.onEnabledForChatChange}
                    onClick={() => void activateForOnboarding()}
                  >
                    {localizeUi("ui.longTermMemory.longtermmemorydetail.turnOnForThisChat")}
                  </Button>
                  <Button onClick={advanceOnboarding}>
                    {localizeUi("ui.longTermMemory.longtermmemorydetail.continueWithoutActivating")}
                  </Button>
                  {(props.chatMode === "roleplay" || props.chatMode === "game") &&
                  props.onOpenActivePromptPresetEditor ? (
                    <Button onClick={openPromptPresetSections}>
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.openPromptPresetSections")}
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button primary onClick={advanceOnboarding}>
                  {localizeUi("ui.longTermMemory.longtermmemorydetail.continueWithoutAChat")}
                </Button>
              )
            ) : onboardingStep === 3 ? (
              <>
                <Button onClick={advanceOnboarding}>
                  {localizeUi("ui.longTermMemory.longtermmemorydetail.continueToReview")}
                </Button>
                {onboardingSource === "chats" ? (
                  <>
                    {props.chatMode === "roleplay" && props.onOpenChatSummarySettings ? (
                      <Button onClick={openChatSummarySettings}>
                        {localizeUi("ui.longTermMemory.longtermmemorydetail.openChatSummarySettings")}
                      </Button>
                    ) : null}
                    <Button
                      primary
                      onClick={async () => {
                        await onOpenSources("chats");
                      }}
                    >
                      {localizeUi("ui.longTermMemory.longtermmemorydetail.openChatSources")}
                    </Button>
                  </>
                ) : (
                  <Button
                    primary
                    onClick={async () => {
                      await onOpenSources(onboardingSource);
                    }}
                  >
                    {localizeUi(
                      onboardingSource === "characters"
                        ? "ui.longTermMemory.longtermmemorydetail.importACharacter"
                        : "ui.longTermMemory.longtermmemorydetail.importALorebook",
                    )}
                  </Button>
                )}
              </>
            ) : onboardingStep === 4 ? (
              <>
                <Button onClick={advanceOnboarding}>
                  {localizeUi("ui.longTermMemory.longtermmemorydetail.continueToCheck")}
                </Button>
                <Button
                  primary
                  onClick={async () => {
                    if (pendingDraftCount) await onOpenReview();
                    else await onOpenSources("characters");
                  }}
                >
                  {localizeUi(
                    pendingDraftCount
                      ? "ui.longTermMemory.longtermmemorydetail.openReviewQueue"
                      : "ui.longTermMemory.longtermmemorydetail.chooseASource",
                  )}
                </Button>
              </>
            ) : onboardingStep === 5 ? (
              <>
                <Button primary onClick={advanceOnboarding}>
                  {localizeUi("ui.longTermMemory.longtermmemorydetail.nextUnderTheHood")}
                </Button>
                <Button
                  onClick={async () => {
                    if (savedMemoryCount) await onOpenVault();
                    else await onOpenSources("characters");
                  }}
                >
                  {localizeUi(
                    savedMemoryCount
                      ? "ui.longTermMemory.longtermmemorydetail.goToSavedMemories"
                      : "ui.longTermMemory.longtermmemorydetail.chooseASource",
                  )}
                </Button>
              </>
            ) : (
              <Button
                primary
                onClick={async () => {
                  if (savedMemoryCount) await onOpenVault();
                  else await onOpenSources("characters");
                }}
              >
                {localizeUi(
                  savedMemoryCount
                    ? "ui.longTermMemory.longtermmemorydetail.goToSavedMemories"
                    : "ui.longTermMemory.longtermmemorydetail.chooseASource",
                )}
              </Button>
            )}
          </div>
        </div>
        <div data-ltm-onboarding-sprite-wrap>
          <picture>
            <source
              media="(min-width: 768px)"
              srcSet={`/sprites/mari/${onboardingSteps[onboardingStep].desktopSprite}`}
            />
            <img
              src={`/sprites/mari/${onboardingSteps[onboardingStep].mobileSprite}`}
              alt={onboardingSteps[onboardingStep].alt}
              draggable={false}
              data-ltm-onboarding-sprite={onboardingSteps[onboardingStep].mobileSprite}
              data-ltm-onboarding-mobile-flip={onboardingSteps[onboardingStep].mobileFlip || undefined}
              data-ltm-onboarding-mobile-shift={onboardingStep === 4 ? "left" : undefined}
            />
          </picture>
        </div>
      </div>
      <div data-ltm-onboarding-footer className="items-center gap-3">
        <Button data-ltm-onboarding-close onClick={completeOnboarding}>
          {localizeUi("ui.longTermMemory.longtermmemorydetail.close")}
        </Button>
        <p className="text-xs text-[var(--muted-foreground)]">
          {localizeUi("ui.longTermMemory.longtermmemorydetail.youCanReplayThisGuideWithTheHelpButton")}
        </p>
      </div>
    </section>
  );
}
