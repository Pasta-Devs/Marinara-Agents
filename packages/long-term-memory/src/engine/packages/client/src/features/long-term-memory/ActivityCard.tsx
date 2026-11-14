import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { host } from "marinara:host";
import { toast } from "sonner";
import type { LtmExtractionSettingsPatch } from "../../../../shared/src/features/agents/long-term-memory/schema.js";
import { ltmChatMemoriesModeOf } from "../../../../shared/src/features/agents/long-term-memory/runtime-settings.js";
import {
  activitySignalOf,
  claimActivityOwner,
  markRetried,
  retriedAtOf,
  subscribeRetried,
  type ActivitySignal,
} from "./activity-signal";
import { chatMemoriesQueryOptions, errorMessage, lastInjectionQueryOptions, queryKeys, request } from "./api";
import {
  autoImportFailure,
  autoImportNeedsConnection,
  autoImportSavedSince,
  clearLtmOpenRequest,
  hiddenSince,
  lastRecallAt,
  markLtmCardOpen,
  requestLtmOpen,
} from "./auto-import-status";
import { useAutoImportEvents } from "./auto-import-hooks";
import type { LeftOutLimit } from "./card-problem";
import { LastInjectionSummary } from "./LastInjectionSummary";
import { useLtmTranslation } from "./localization";
import type { CapabilityProps } from "./types";
import { showChatPlaceInVault } from "./vault/vault-shared";

const CARD_REFRESH_MS = 5000;

/**
 * What the card and the Agent activity icon both read, once for one chat: whether background import is on, whether a
 * read is in progress and whether the last read failed. `refreshMs` polls the chat's memories while import is on (the
 * card's 5 s; false adds no poll of its own). `watchReads` reads the import events again when a read starts or ends,
 * for a mount whose card does not already do that.
 */
export function useActivityCore(
  props: CapabilityProps,
  { refreshMs, watchReads }: { refreshMs: number | false; watchReads: boolean },
) {
  const extraction = useQuery({
    queryKey: queryKeys.extractionSettings,
    queryFn: () => request<LtmExtractionSettingsPatch>("/extraction-settings"),
  });
  // The Engine passes only the recall keys in chatSettings, so this chat's own choice is read from the package.
  // While background import is on this is polled, so the card shows a read in progress and a fresh hide as they happen.
  const importOnRef = useRef(false);
  const chatMemories = useQuery({
    ...chatMemoriesQueryOptions(props.chatId),
    refetchInterval: () => (importOnRef.current ? refreshMs : false),
  });
  const chatMemoriesOverride = chatMemories.data?.chatMemories ?? null;
  const globalChatMemories = extraction.data ? ltmChatMemoriesModeOf(extraction.data) : null;
  const effectiveChatMemories = chatMemoriesOverride ?? (chatMemories.data ? globalChatMemories : null);
  // An override decides import on its own; without one the global switch does.
  const autoImportOn = chatMemoriesOverride
    ? chatMemoriesOverride !== "manual"
    : extraction.data?.autoImportChatSources === true;
  importOnRef.current = autoImportOn;
  const autoImportEvents = useAutoImportEvents(autoImportOn);
  const reading = autoImportOn && chatMemories.data?.reading === true;
  const queryClient = useQueryClient();
  const readSeen = useRef<string | null>(null);
  const readKnown = chatMemories.data !== undefined;
  const hiddenAt = chatMemories.data?.hidden?.at ?? "";
  useEffect(() => {
    if (!watchReads || !readKnown) return;
    const now = `${props.chatId}|${reading}|${hiddenAt}`;
    const before = readSeen.current;
    readSeen.current = now;
    if (before === null || before === now) return;
    // A mount with the card open reads the change once, not twice: the card's own invalidation must not be cancelled.
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.activity, "auto-import"] }, { cancelRefetch: false });
  }, [watchReads, readKnown, reading, hiddenAt, props.chatId, queryClient]);
  // Try again hides the failed-read line until a newer run fails; kept per chat so the card and the icon agree.
  const retriedAt = useSyncExternalStore(subscribeRetried, () => retriedAtOf(props.chatId));
  const failure = props.chatId ? autoImportFailure(autoImportEvents.data?.events ?? [], props.chatId) : null;
  const saveFailed =
    autoImportOn && props.chatId && failure && failure.at > retriedAt ? { cause: failure.cause, at: failure.at } : null;
  return {
    extraction,
    chatMemories,
    effectiveChatMemories,
    chatMemoriesOverride,
    globalChatMemories,
    autoImportOn,
    autoImportEvents,
    reading,
    saveFailed,
  };
}

/**
 * What the Long-Term Memory card shows, read once for one chat. The chat drawer and the Agent activity panel both draw
 * the card from this, so the two places cannot disagree (the drawer also reads the queries it exposes for its status line).
 */
export function useActivityCardState(props: CapabilityProps) {
  const { t: localizeUi } = useLtmTranslation();
  const [retrying, setRetrying] = useState(false);
  const core = useActivityCore(props, { refreshMs: CARD_REFRESH_MS, watchReads: false });
  const { extraction, chatMemories, autoImportOn, autoImportEvents, reading, saveFailed } = core;
  const waitingDrafts = useQuery({
    enabled: autoImportOn && Boolean(props.chatId),
    queryKey: [...queryKeys.pendingDrafts, props.chatId],
    queryFn: () => request<{ count: number }>(`/drafts/pending-count?chatId=${encodeURIComponent(props.chatId!)}`),
  });
  const lastInjection = useQuery(lastInjectionQueryOptions(props.chatId));
  // "New" on the card means since the last reply's recall: the memories saved, and the messages hidden, after it.
  // While the last recall is unknown (loading, or its read failed) nothing is called new: 0 would count every save.
  const lastRecall = lastRecallAt(lastInjection.data);
  const recallKnown = lastInjection.data !== undefined;
  const savedNew =
    autoImportOn && recallKnown && props.chatId
      ? autoImportSavedSince(autoImportEvents.data?.events ?? [], props.chatId, lastRecall)
      : 0;
  const waiting = autoImportOn ? (waitingDrafts.data?.count ?? 0) : 0;
  const hidden = recallKnown ? hiddenSince(chatMemories.data?.hidden, lastRecall) : null;
  // The import events and the waiting count are not polled; they are read again when a read starts or ends, a hide
  // lands or a reply is recalled. ponytail: a read that starts and ends between two polls is picked up on the next
  // change or when the drawer or the panel reopens; a server-pushed change signal would close that gap. With both open
  // each mount reads the change once (the invalidation and the 5 s poll run twice); a per-chat owner would make it one.
  const queryClient = useQueryClient();
  const changeKey = `${reading}|${chatMemories.data?.hidden?.at ?? ""}|${lastInjection.data?.dispatchedAt ?? ""}`;
  const seenChange = useRef<string | null>(null);
  const changeKnown = chatMemories.data !== undefined && recallKnown;
  useEffect(() => {
    if (!changeKnown) return;
    const before = seenChange.current;
    seenChange.current = changeKey;
    if (before === null || before === changeKey) return;
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.activity, "auto-import"] });
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.pendingDrafts, props.chatId] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.lastInjection(props.chatId) });
  }, [changeKey, changeKnown, queryClient, props.chatId]);
  // The hidden-messages toast (see BranchHiddenTail) stays quiet while a card says the same thing.
  useEffect(
    () => (props.chatId && props.enabledForChat !== false ? markLtmCardOpen(props.chatId) : undefined),
    [props.chatId, props.enabledForChat],
  );
  const needsSetup =
    Boolean(props.chatId) &&
    autoImportOn &&
    !extraction.data?.connectionId &&
    autoImportNeedsConnection(autoImportEvents.data?.events ?? [], props.chatId);
  const retryAutoImport = async () => {
    if (retrying || !props.chatId) return;
    setRetrying(true);
    try {
      await request(`/chat-memories/${encodeURIComponent(props.chatId)}/retry`, "POST");
      // The marker is the failed read's own server time, so the browser's clock never enters the comparison.
      markRetried(props.chatId, saveFailed?.at);
    } catch (error) {
      toast.error(errorMessage(error, localizeUi("ui.longTermMemory.longtermmemorydetail.couldNotUpdateThisChat")));
    } finally {
      setRetrying(false);
    }
  };
  return {
    ...core,
    waitingDrafts,
    lastInjection,
    savedNew,
    waiting,
    hidden,
    needsSetup,
    retrying,
    retryAutoImport,
  };
}

type PackageActivityStore = {
  getState?: () => {
    setPackageActivity?: (packageId: string, chatId: string, signal: Partial<ActivitySignal>) => void;
  };
};

// A soft seam: an Engine older than Capability API 1.820 has no such method, so every step is feature-detected.
function setActivity(chatId: string, signal: ActivitySignal) {
  try {
    const stores = host.stores as { agent?: PackageActivityStore } | undefined;
    stores?.agent?.getState?.().setPackageActivity?.("long-term-memory", chatId, signal);
  } catch {
    // The icon keeps its last state.
  }
}

/**
 * Keeps the Agent activity icon in step with this chat's reads and failed saves. The Engine never clears a package's
 * signal, so the last mount for the chat clears it, and a chat change or memory turned off clears the old chat's.
 */
export function usePublishActivitySignal(
  props: Pick<CapabilityProps, "chatId" | "enabledForChat">,
  card: Parameters<typeof activitySignalOf>[0],
) {
  const chatId = props.chatId ?? null;
  const on = chatId !== null && props.enabledForChat !== false;
  const { busy, alert } = activitySignalOf(card);
  useEffect(() => {
    if (!chatId || !on) return;
    const release = claimActivityOwner(chatId);
    return () => {
      if (release()) setActivity(chatId, { busy: false, alert: false });
    };
  }, [chatId, on]);
  useEffect(() => {
    if (chatId && on) setActivity(chatId, { busy, alert });
  }, [chatId, on, busy, alert]);
}

/**
 * The signal for a mount that is always on screen (the conversation surface), so the icon moves while the panel and the
 * drawer are closed. It adds no poll of its own: the surface's hidden-messages toast already polls the same query.
 * ponytail: a failed save's dot clears when the events are read again, on a read starting or ending or a hide landing;
 * a read that starts and ends inside one 10 s poll, saving nothing hidden, leaves the dot until the next change, a
 * Retry or a reopen. A server-pushed change signal would close that gap.
 */
export function useLtmActivitySignal(props: CapabilityProps) {
  usePublishActivitySignal(props, useActivityCore(props, { refreshMs: false, watchReads: true }));
}

export type ActivityCardState = ReturnType<typeof useActivityCardState>;

/** Opens the agent's page at this chat's own memories, branch chips and all; a row's chip narrows them to one branch. */
export function openChatPlaceInVault(props: CapabilityProps, localizeUi: (key: string) => string) {
  clearLtmOpenRequest(); // a stale Review or Extraction request must not win over the Vault
  if (props.chatId)
    showChatPlaceInVault(props.chatId, props.chatName ?? localizeUi("ui.longTermMemory.memoryvault.currentChat"));
  props.onOpenAgentSettings?.();
}

/** The card, drawn from one chat's state; every button that leaves it opens the agent's own page. */
export function ActivityCardView({
  props,
  card,
  onRaiseLimit,
}: {
  props: CapabilityProps;
  card: ActivityCardState;
  /** Where the chat has the limit fields (the drawer); left out, the card names the cut without the button. */
  onRaiseLimit?: (limit: LeftOutLimit) => void;
}) {
  const { t: localizeUi } = useLtmTranslation();
  const { lastInjection } = card;
  const open = props.onOpenAgentSettings;
  const openChatInVault = () => openChatPlaceInVault(props, localizeUi);
  // The card shows only while memory is on for the chat.
  if (props.enabledForChat === false) return null;
  return (
    <LastInjectionSummary
      data={lastInjection.data}
      loading={lastInjection.isLoading}
      retryPending={lastInjection.isFetching}
      error={lastInjection.isError}
      onRetry={() => void lastInjection.refetch()}
      onOpenMemory={
        open
          ? (noteId) => {
              requestLtmOpen("memory", noteId);
              open();
            }
          : undefined
      }
      onOpenVault={
        open
          ? () => {
              clearLtmOpenRequest();
              open();
            }
          : undefined
      }
      onOpenActivity={
        open
          ? (attemptId) => {
              requestLtmOpen("activity", attemptId);
              open();
            }
          : undefined
      }
      saveFailed={card.saveFailed}
      onRetrySave={() => void card.retryAutoImport()}
      retryingSave={card.retrying}
      needsSetup={card.needsSetup}
      onSetUp={
        open
          ? () => {
              requestLtmOpen("extraction");
              open();
            }
          : undefined
      }
      onRaiseLimit={onRaiseLimit}
      toReview={card.waiting}
      onReview={
        open
          ? () => {
              requestLtmOpen("review");
              open();
            }
          : undefined
      }
      savedNew={card.savedNew}
      onViewSaved={open ? openChatInVault : undefined}
      hidden={card.hidden}
      reading={card.reading}
      compact
    />
  );
}

/**
 * The Agent activity panel's card (view="activity"). It renders nothing until there is something to say (the Engine
 * then shows its own "no activity yet" line), and the panel has no limit fields to focus, so a cut shows its line
 * without Raise limit rather than a dead button.
 * ponytail: opening the chat drawer at the limits needs a host prop the Engine does not give; with one, pass it as onRaiseLimit.
 */
export function ActivityCard({ props }: { props: CapabilityProps }) {
  const card = useActivityCardState(props);
  // ponytail: also published here for a mode with no always-mounted surface element (Game has none): the icon moves
  // only while the panel is open there. An Engine surface mount in that mode would close the gap.
  usePublishActivitySignal(props, card);
  if (!props.chatId) return null;
  const { lastInjection } = card;
  const quiet =
    !lastInjection.isError &&
    (lastInjection.isLoading || (!lastInjection.data?.attempt && !lastInjection.data?.memories.length)) &&
    !card.saveFailed &&
    !card.needsSetup &&
    !card.waiting &&
    !card.savedNew &&
    !card.hidden &&
    !card.reading;
  if (quiet) return null;
  return <ActivityCardView props={props} card={card} />;
}
