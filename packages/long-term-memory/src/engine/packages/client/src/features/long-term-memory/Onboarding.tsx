import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LtmExtractionSettingsPatch,
  LtmImportSourceNotesResponse,
  LtmInteropPreviewResponse,
} from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import {
  ltmChatMemoriesModeOf,
  type LtmChatMemoriesMode,
} from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import { chatOnlyLtmScope } from "../../../../shared/src/features/agents/long-term-memory/scope.js";
import { errorMessage, invalidateLtmQueries, queryKeys, request } from "./api";
import {
  ChatMemoriesSample,
  chatMemoriesDescriptionKey,
  chatMemoriesFlags,
  chatMemoriesLabelKey,
  chatMemoriesModes,
} from "./chat-memories";
import { Button, ModalDialog, StatusSurface, lockedActionProps } from "./shared-controls";
import { selectLtmPluralForm, useLtmTranslation } from "./localization";
import { readSetupProgress, writeSetupProgress, type LtmSetupBeat } from "./onboarding/progress";
import { SetupSprite } from "./onboarding/Sprite";
import { getLtmSourceTaskSnapshot, startLtmSourceTask, type LtmSourceTaskContract } from "./source-task";
import type { CapabilityProps } from "./types";

type OnboardingProps = {
  props: CapabilityProps;
  /** True once the status query has loaded, so an empty Vault is known to be empty. */
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
  onOpenVault: () => Promise<boolean>;
  /** Closes setup and starts the tour; absent once the tour was finished or ended. */
  onStartTour?: () => void;
  /** Closes the stage; every answer is already saved. */
  onClose: () => void;
};

const beatNameKeys = {
  1: "ui.longTermMemory.onboarding.beatHello",
  2: "ui.longTermMemory.onboarding.beatHow",
  3: "ui.longTermMemory.onboarding.beatHeadStart",
  4: "ui.longTermMemory.onboarding.beatDone",
} as const;
// archivist-modes: frame 0 is Mari at rest, then one frame per answer.
const modeFrames = { save: 1, review: 2, manual: 3 } as const;
// With no chat open, setup reads only the newest few chats' summaries.
const RECENT_CHAT_LIMIT = 10;
const compactButtonProps = { className: "mari-editor-action--compact text-[0.625rem]", style: { minHeight: "2rem" } };
const afterImportKeys = [
  queryKeys.notes,
  queryKeys.scopeTargetsRoot,
  queryKeys.localCharactersRoot,
  queryKeys.status,
  queryKeys.integrity,
  queryKeys.identityRepair,
  queryKeys.review,
  queryKeys.pendingDrafts,
  queryKeys.rejectedSuggestions,
  queryKeys.preview,
  queryKeys.lorebookPreview,
];

type ReadResult = { filed: number; waiting: number; from: string };

const prefersReducedMotion = () => {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  } catch {
    return false;
  }
};

/** Mari's lines arrive one at a time (350 ms, then 650 ms each); Show all and reduced motion show them at once. */
function usePacedLines(count: number, key: string) {
  const id = `${count}:${key}`;
  const [paced, setPaced] = useState(() => ({ id, shown: prefersReducedMotion() ? count : 0 }));
  // A new beat starts from no lines in its first render, so the last beat's count never flashes its answers.
  const shown = paced.id === id ? paced.shown : prefersReducedMotion() ? count : 0;
  useEffect(() => {
    if (prefersReducedMotion()) {
      setPaced({ id, shown: count });
      return;
    }
    setPaced({ id, shown: 0 });
    let next = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      next += 1;
      // Show all may already have shown every line; a late tick never takes lines back.
      const reached = next;
      setPaced((current) => (current.id === id ? { id, shown: Math.max(current.shown, reached) } : current));
      if (next < count) timer = setTimeout(step, 650);
    };
    timer = setTimeout(step, 350);
    return () => clearTimeout(timer);
  }, [count, id]);
  return [Math.min(shown, count), () => setPaced({ id, shown: count })] as const;
}

/** A tappable answer: a title and one line under it. */
function Choice({
  title,
  hint,
  pressed,
  locked = false,
  onChoose,
  ...rest
}: {
  title: string;
  hint: string;
  pressed?: boolean;
  locked?: boolean;
  onChoose: () => void;
} & Record<`data-${string}`, string | boolean | undefined> &
  Pick<HTMLAttributes<HTMLButtonElement>, "onMouseEnter" | "onMouseLeave" | "onFocus" | "onBlur">) {
  return (
    <Button
      primary={pressed}
      aria-pressed={pressed}
      className="w-full justify-start py-2 text-left"
      onClick={() => {
        // A locked answer only sets aria-disabled, so its click still arrives here.
        if (!locked) onChoose();
      }}
      {...lockedActionProps(locked)}
      {...rest}
    >
      <span className="grid min-w-0 gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs font-normal">{hint}</span>
      </span>
    </Button>
  );
}

/**
 * Professor Mari's setup: four short beats (Hello, How, Head start, Done) in a dialog. Every answer saves when it
 * is tapped and the beat is stored, so closing keeps the place and the next open resumes there. Reaching Done
 * finishes setup, and a finished setup opened again never stores an earlier beat over it.
 */
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
  onOpenVault,
  onStartTour,
  onClose,
}: OnboardingProps) {
  const { t: localizeUi, locale } = useLtmTranslation();
  const queryClient = useQueryClient();
  const titleId = useId();
  const talkId = useId();
  // Once setup reaches Done (now or before), going Back or closing never stores an earlier beat over it.
  const doneRef = useRef(readSetupProgress() === "done");
  const [beat, setBeat] = useState<LtmSetupBeat>(() => {
    const saved = readSetupProgress();
    return typeof saved === "number" ? saved : 1;
  });
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [readResult, setReadResult] = useState<ReadResult | null>(null);
  const [hoveredMode, setHoveredMode] = useState<LtmChatMemoriesMode | null>(null);
  const [chatMemoriesChoice, setChatMemoriesChoice] = useState<LtmChatMemoriesMode | null>(null);
  const talkRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const savedChatMemoriesRef = useRef<LtmChatMemoriesMode | null>(null);
  const extraction = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
  const storedChatMemories = extraction.data ? ltmChatMemoriesModeOf(extraction.data) : null;
  // A new setup (empty vault, still on the stored default) starts on "Save them for me"; an existing one shows its
  // choice. Until the status loads, the count reads 0, so the stored choice shows and Next writes nothing.
  const shownChatMemories =
    chatMemoriesChoice ??
    (ready && storedChatMemories === "manual" && savedMemoryCount === 0 ? "save" : storedChatMemories);

  const goTo = (next: LtmSetupBeat) => {
    setError("");
    setHoveredMode(null);
    movedRef.current = true;
    setBeat(next);
  };
  useEffect(() => {
    if (beat === 4) doneRef.current = true;
    writeSetupProgress(doneRef.current ? "done" : beat);
  }, [beat]);
  // A read that finishes after the stage closed still finishes setup.
  const markDone = () => {
    doneRef.current = true;
    writeSetupProgress("done");
  };
  // The tapped answer leaves with its beat, so focus moves to Mari's lines for the next one.
  useEffect(() => {
    if (!movedRef.current) return;
    movedRef.current = false;
    talkRef.current?.focus({ preventScroll: true });
  }, [beat]);

  const saveChatMemories = async (choice: LtmChatMemoriesMode | null) => {
    // The last answer written counts as stored while the settings query refetches.
    if (!choice || choice === (savedChatMemoriesRef.current ?? storedChatMemories)) return true;
    setError("");
    try {
      await request("/extraction-settings", "PUT", chatMemoriesFlags(choice));
      savedChatMemoriesRef.current = choice;
      await invalidateLtmQueries(queryClient, [queryKeys.extractionSettings]);
      return true;
    } catch (caught) {
      setError(errorMessage(caught, localizeUi("ui.longTermMemory.longtermmemorydetail.chatMemoriesCouldNotSave")));
      return false;
    }
  };
  const chooseChatMemories = (choice: LtmChatMemoriesMode) => {
    setChatMemoriesChoice(choice);
    void saveChatMemories(choice);
  };
  // Remember this chat: on beat 1 it moves on, on the Done recap it stays.
  const remember = async () => {
    if (activationPending) return;
    setError("");
    if (activeChat || (await onActivate())) {
      if (beat === 1) goTo(2);
    } else setError(localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat"));
  };

  // "Read my recent chats": the open chat's summaries are filed to that chat (the Sources default); with no chat
  // open, the newest few chats are read and each memory stays with the chat it came from.
  const readRecentChats = async () => {
    if (reading) return;
    if (getLtmSourceTaskSnapshot().active?.status === "running") {
      setError(localizeUi("ui.longTermMemory.onboarding.alreadyReading"));
      return;
    }
    setError("");
    setReading(true);
    const chatId = connectedChat ? (props.chatId ?? undefined) : undefined;
    const scope = chatId ? chatOnlyLtmScope(chatId) : undefined;
    const from = chatId ? chatLabel : localizeUi("ui.longTermMemory.onboarding.yourRecentChats");
    try {
      const preview = await request<LtmInteropPreviewResponse>("/import/preview", "POST", {
        source: "chats",
        limit: chatId ? 100 : RECENT_CHAT_LIMIT,
        ...(scope ? { sourceScope: scope } : {}),
      });
      const pending = preview.samples.filter((sample) => sample.status === "pending");
      if (!pending.length) {
        markDone();
        setReadResult({ filed: 0, waiting: 0, from });
        goTo(4);
        return;
      }
      const contract: LtmSourceTaskContract = {
        source: "chats",
        sourceIds: pending.map((sample) => sample.sourceId),
        action: "import",
        ...(scope ? { sourceScope: scope, destinationScope: scope, chatId } : {}),
        sourceTargetLabel: from,
      };
      const task = await startLtmSourceTask<LtmImportSourceNotesResponse>({
        kind: "import",
        contract,
        sourceTitles: pending.map((sample) => sample.title),
        run: (signal) =>
          request(
            "/import/source-notes",
            "POST",
            {
              source: "chats",
              sourceIds: contract.sourceIds,
              limit: 100,
              extract: true,
              ...(scope ? { sourceScope: scope, destinationScope: scope, chatId } : {}),
            },
            signal,
          ),
      });
      void invalidateLtmQueries(queryClient, afterImportKeys).catch(() => undefined);
      if (task.status !== "completed") {
        setError(
          task.status === "cancelled"
            ? localizeUi("ui.longTermMemory.onboarding.readingStopped")
            : task.error?.message || localizeUi("ui.longTermMemory.onboarding.readingFailed"),
        );
        return;
      }
      const result = task.result as LtmImportSourceNotesResponse;
      let filed = 0;
      let waiting = 0;
      for (const item of result.imported) {
        const found = item.draft?.mutations.length ?? 0;
        if (item.draft?.status === "pending") waiting += found;
        else if (item.draft?.status === "accepted" || item.draft?.status === "auto_applied") filed += found;
      }
      markDone();
      setReadResult({ filed, waiting, from });
      goTo(4);
    } catch (caught) {
      setError(errorMessage(caught, localizeUi("ui.longTermMemory.onboarding.readingFailed")));
    } finally {
      setReading(false);
    }
  };
  const startFresh = () => {
    setReadResult(null);
    goTo(4);
  };
  // A refused navigation (unsaved work kept) leaves the stage open.
  const leaveFor = async (navigate: () => Promise<boolean>) => {
    if (await navigate()) onClose();
  };

  const plural = (n: number, one: string, other: string, from: string) =>
    localizeUi(selectLtmPluralForm(locale, n) === "one" ? one : other, { count: n, value1: from });
  const filed = readResult?.filed ?? 0;
  const waiting = readResult?.waiting ?? 0;
  const from = readResult?.from ?? "";
  const filedAny = filed + waiting > 0;
  // Beat 1 offers to turn memory on only when the host lets this chat change it.
  const canTurnOn = connectedChat && Boolean(props.onEnabledForChatChange);
  const readingFrom = connectedChat ? chatLabel : localizeUi("ui.longTermMemory.onboarding.yourRecentChats");

  const lines: string[] =
    beat === 1
      ? [
          localizeUi("ui.longTermMemory.onboarding.helloLine1"),
          localizeUi("ui.longTermMemory.onboarding.helloLine2"),
          canTurnOn
            ? localizeUi("ui.longTermMemory.onboarding.helloAskChat", { value1: chatLabel })
            : localizeUi("ui.longTermMemory.onboarding.helloAskNoChat"),
        ]
      : beat === 2
        ? [localizeUi("ui.longTermMemory.onboarding.howLine1"), localizeUi("ui.longTermMemory.onboarding.howLine2")]
        : beat === 3
          ? reading
            ? [localizeUi("ui.longTermMemory.onboarding.reading", { value1: readingFrom })]
            : [
                localizeUi("ui.longTermMemory.onboarding.headStartLine1"),
                localizeUi("ui.longTermMemory.onboarding.headStartLine2"),
              ]
          : filedAny
            ? [
                localizeUi("ui.longTermMemory.onboarding.filed"),
                ...(filed
                  ? [
                      plural(
                        filed,
                        "ui.longTermMemory.onboarding.filedInVaultOne",
                        "ui.longTermMemory.onboarding.filedInVaultOther",
                        from,
                      ),
                    ]
                  : []),
                ...(waiting
                  ? [
                      plural(
                        waiting,
                        "ui.longTermMemory.onboarding.waitingInReviewOne",
                        "ui.longTermMemory.onboarding.waitingInReviewOther",
                        from,
                      ),
                    ]
                  : []),
              ]
            : [
                localizeUi("ui.longTermMemory.onboarding.allSet"),
                localizeUi("ui.longTermMemory.onboarding.nothingYet"),
              ];
  const [shownLines, showAll] = usePacedLines(lines.length, `${beat}:${reading}:${filedAny}`);
  const talking = shownLines < lines.length;

  const sprite =
    beat === 1 ? (
      <SetupSprite key="hello" sprite="hello-drawer" packageVersion={props.packageVersion} />
    ) : beat === 2 ? (
      <SetupSprite
        key="modes"
        sprite="archivist-modes"
        frame={modeFrames[hoveredMode ?? shownChatMemories ?? "manual"]}
        packageVersion={props.packageVersion}
      />
    ) : beat === 3 ? (
      <SetupSprite
        key="reading"
        sprite={reading ? "archive-working" : "headstart-ladder"}
        packageVersion={props.packageVersion}
      />
    ) : (
      <SetupSprite
        key={filedAny ? "filed" : "fresh"}
        sprite={filedAny ? "done-filed" : "done-fresh"}
        packageVersion={props.packageVersion}
      />
    );

  let answers: ReactNode = null;
  if (beat === 1) {
    answers = canTurnOn ? (
      <>
        <Choice
          data-ltm-setup-choice="remember"
          title={localizeUi("ui.longTermMemory.onboarding.rememberChat", { value1: chatLabel })}
          hint={localizeUi("ui.longTermMemory.onboarding.rememberChatHint")}
          pressed={activeChat}
          locked={activationPending}
          onChoose={() => void remember()}
        />
        <Choice
          data-ltm-setup-choice="not-this-chat"
          title={localizeUi("ui.longTermMemory.onboarding.notThisChat")}
          hint={localizeUi("ui.longTermMemory.onboarding.notThisChatHint")}
          locked={activationPending}
          onChoose={() => goTo(2)}
        />
      </>
    ) : (
      <Choice
        data-ltm-setup-choice="pick-later"
        title={localizeUi("ui.longTermMemory.onboarding.pickLater")}
        hint={localizeUi("ui.longTermMemory.onboarding.pickLaterHint")}
        onChoose={() => goTo(2)}
      />
    );
  } else if (beat === 2) {
    const sampleMode = hoveredMode ?? shownChatMemories;
    answers = (
      <>
        {chatMemoriesModes.map((mode) => (
          <Choice
            key={mode}
            data-ltm-setup-choice={mode}
            title={localizeUi(chatMemoriesLabelKey(mode))}
            hint={localizeUi(chatMemoriesDescriptionKey(mode))}
            pressed={shownChatMemories === mode}
            locked={!extraction.data}
            onChoose={() => chooseChatMemories(mode)}
            onMouseEnter={() => setHoveredMode(mode)}
            onMouseLeave={() => setHoveredMode(null)}
            onFocus={() => setHoveredMode(mode)}
            onBlur={() => setHoveredMode(null)}
          />
        ))}
        {sampleMode ? <ChatMemoriesSample mode={sampleMode} compact /> : null}
        {extraction.isError ? (
          <StatusSurface tone="danger" data-ltm-setup-settings-error>
            <span className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                {errorMessage(
                  extraction.error,
                  localizeUi("ui.longTermMemory.memorysettings.couldNotLoadMemorySettings"),
                )}
              </span>
              <Button {...compactButtonProps} data-ltm-setup-retry onClick={() => void extraction.refetch()}>
                {localizeUi("ui.longTermMemory.activityview.retry")}
              </Button>
            </span>
          </StatusSurface>
        ) : null}
        <Button
          primary
          data-ltm-setup-next
          {...lockedActionProps(!extraction.data)}
          onClick={() => {
            if (!extraction.data) return;
            // Next keeps the answer it shows, including the preselected one.
            void saveChatMemories(shownChatMemories).then((saved) => saved && goTo(3));
          }}
        >
          {localizeUi("ui.longTermMemory.onboarding.next")}
        </Button>
      </>
    );
  } else if (beat === 3) {
    answers = reading ? (
      <StatusSurface busy data-ltm-setup-reading>
        {localizeUi("ui.longTermMemory.onboarding.readingHint")}
      </StatusSurface>
    ) : (
      <>
        <Choice
          data-ltm-setup-choice="read-recent"
          title={localizeUi("ui.longTermMemory.onboarding.readRecentChats")}
          hint={
            connectedChat
              ? localizeUi("ui.longTermMemory.onboarding.readRecentChatsHintChat", { value1: chatLabel })
              : localizeUi("ui.longTermMemory.onboarding.readRecentChatsHint")
          }
          onChoose={() => void readRecentChats()}
        />
        <Choice
          data-ltm-setup-choice="start-fresh"
          title={localizeUi("ui.longTermMemory.onboarding.startFresh")}
          hint={localizeUi("ui.longTermMemory.onboarding.startFreshHint")}
          onChoose={startFresh}
        />
      </>
    );
  } else {
    const reviewCount = Math.max(waiting, pendingDraftCount ?? 0);
    const recapRow = (label: string, change: LtmSetupBeat, extra?: ReactNode) => (
      <li className="flex flex-wrap items-center gap-2 text-xs" data-ltm-setup-recap={change}>
        <span className="min-w-0 flex-1">{label}</span>
        {extra}
        <Button {...compactButtonProps} onClick={() => goTo(change)}>
          {localizeUi("ui.longTermMemory.onboarding.change")}
        </Button>
      </li>
    );
    answers = (
      <>
        <ul className="grid gap-1">
          {recapRow(
            connectedChat
              ? localizeUi(
                  activeChat ? "ui.longTermMemory.onboarding.recapOn" : "ui.longTermMemory.onboarding.recapOff",
                  { value1: chatLabel },
                )
              : localizeUi("ui.longTermMemory.onboarding.recapNoChat"),
            1,
            canTurnOn && !activeChat ? (
              <Button
                {...compactButtonProps}
                data-ltm-setup-turn-on
                {...lockedActionProps(activationPending)}
                onClick={() => void remember()}
              >
                {localizeUi("ui.longTermMemory.onboarding.turnOn")}
              </Button>
            ) : null,
          )}
          {recapRow(storedChatMemories ? localizeUi(chatMemoriesLabelKey(storedChatMemories)) : "", 2)}
          {recapRow(
            filedAny
              ? plural(
                  filed + waiting,
                  "ui.longTermMemory.onboarding.recapReadOne",
                  "ui.longTermMemory.onboarding.recapReadOther",
                  from,
                )
              : localizeUi("ui.longTermMemory.onboarding.recapNothingRead"),
            3,
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button primary data-ltm-setup-open-vault onClick={() => void leaveFor(onOpenVault)}>
            {localizeUi("ui.longTermMemory.onboarding.openVault")}
          </Button>
          {reviewCount > 0 ? (
            <Button data-ltm-setup-review onClick={() => void leaveFor(onOpenReview)}>
              {localizeUi("ui.longTermMemory.onboarding.reviewNow")}
            </Button>
          ) : null}
          {onStartTour ? (
            <Button data-ltm-setup-tour onClick={onStartTour}>
              {localizeUi("ui.longTermMemory.onboarding.showMeAround")}
            </Button>
          ) : null}
        </div>
      </>
    );
  }

  const savesHint = (
    <span className="text-xs text-[var(--muted-foreground)]">
      {localizeUi("ui.longTermMemory.onboarding.savesRightAway")}
    </span>
  );
  return (
    <ModalDialog
      titleId={titleId}
      descriptionId={talkId}
      initialFocus="[data-ltm-setup-talk]"
      onCancel={onClose}
      data-ltm-surface="onboarding"
      data-ltm-setup-beat={String(beat)}
    >
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-sm font-semibold">
            {localizeUi("ui.longTermMemory.onboarding.title")}
          </h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.longTermMemory.onboarding.withMari", { value1: localizeUi(beatNameKeys[beat]) })}
          </p>
        </div>
        <Button data-ltm-setup-close onClick={onClose}>
          {localizeUi(beat === 4 ? "ui.longTermMemory.onboarding.close" : "ui.longTermMemory.onboarding.later")}
        </Button>
      </header>
      <div className="flex gap-1" data-ltm-setup-progress>
        {([1, 2, 3, 4] as const).map((segment) => (
          <span
            key={segment}
            aria-hidden="true"
            className="h-1 flex-1 rounded-full"
            style={{ background: segment <= beat ? "var(--primary)" : "var(--border)" }}
          />
        ))}
        <span className="sr-only">
          {localizeUi("ui.longTermMemory.onboarding.questionOf", { current: beat, total: 4 })}
        </span>
      </div>
      {/* On a narrow screen or with large text, Mari's lines go under the sprite instead of a sliver beside it. */}
      <div className="flex flex-wrap items-end gap-3">
        {sprite}
        <div
          id={talkId}
          ref={talkRef}
          tabIndex={-1}
          aria-live="polite"
          data-ltm-setup-talk
          className="min-w-0 flex-1 space-y-1 text-sm outline-none"
          style={{ flexBasis: "10rem" }}
        >
          {lines.slice(0, shownLines).map((line, index) => (
            <p key={`${beat}-${index}`} className={index === 0 ? "font-semibold" : ""}>
              {line}
            </p>
          ))}
          {talking ? (
            <Button
              {...compactButtonProps}
              data-ltm-setup-show-all
              onClick={() => {
                // The button leaves with the last line, so focus stays on Mari's lines.
                showAll();
                talkRef.current?.focus({ preventScroll: true });
              }}
            >
              {localizeUi("ui.longTermMemory.onboarding.showAll")}
            </Button>
          ) : null}
        </div>
      </div>
      {!talking ? (
        <div className="grid gap-2" data-ltm-setup-answers>
          {answers}
        </div>
      ) : null}
      {error ? (
        <StatusSurface tone="danger" data-ltm-setup-error>
          {error}
        </StatusSurface>
      ) : null}
      {beat > 1 && !reading ? (
        <footer className="flex flex-wrap items-center gap-2">
          <Button data-ltm-setup-back onClick={() => goTo((beat - 1) as LtmSetupBeat)}>
            {localizeUi("ui.longTermMemory.longtermmemorydetail.back")}
          </Button>
          {beat < 4 ? savesHint : null}
        </footer>
      ) : beat === 1 ? (
        <footer>{savesHint}</footer>
      ) : null}
    </ModalDialog>
  );
}
