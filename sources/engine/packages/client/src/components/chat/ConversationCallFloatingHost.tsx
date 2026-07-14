import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";
import { cn } from "../../lib/utils";
import { useConversationCallStatus, useEndConversationCall } from "../../hooks/use-conversation-calls";
import { ConversationCallSurface } from "./ConversationCallSurface";

function callStartedAtMs(value: string | null | undefined) {
  if (!value) return Date.now();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

export function ConversationCallFloatingHost() {
  const snapshot = useChatStore((state) => state.activeConversationCall);
  const expandedPreference = useChatStore((state) => state.conversationCallExpanded);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const setActiveChatId = useChatStore((state) => state.setActiveChatId);
  const setActiveConversationCall = useChatStore((state) => state.setActiveConversationCall);
  const updateActiveConversationCallSession = useChatStore((state) => state.updateActiveConversationCallSession);
  const setConversationCallExpanded = useChatStore((state) => state.setConversationCallExpanded);
  const closeAllDetails = useUIStore((state) => state.closeAllDetails);
  const botBrowserOpen = useUIStore((state) => state.botBrowserOpen);
  const gameAssetsBrowserOpen = useUIStore((state) => state.gameAssetsBrowserOpen);
  const characterDetailId = useUIStore((state) => state.characterDetailId);
  const lorebookDetailId = useUIStore((state) => state.lorebookDetailId);
  const presetDetailId = useUIStore((state) => state.presetDetailId);
  const connectionDetailId = useUIStore((state) => state.connectionDetailId);
  const agentDetailId = useUIStore((state) => state.agentDetailId);
  const toolDetailId = useUIStore((state) => state.toolDetailId);
  const personaDetailId = useUIStore((state) => state.personaDetailId);
  const regexDetailId = useUIStore((state) => state.regexDetailId);
  const characterLibraryOpen = useUIStore((state) => state.characterLibraryOpen);
  const { data: callStatus } = useConversationCallStatus(snapshot?.session.chatId ?? "", Boolean(snapshot));
  const endCall = useEndConversationCall(snapshot?.session.chatId ?? "");
  const [now, setNow] = useState(() => Date.now());

  const hasDetailSurface =
    botBrowserOpen ||
    gameAssetsBrowserOpen ||
    characterLibraryOpen ||
    Boolean(
      characterDetailId ||
      lorebookDetailId ||
      presetDetailId ||
      connectionDetailId ||
      agentDetailId ||
      toolDetailId ||
      personaDetailId ||
      regexDetailId,
    );
  const expanded =
    Boolean(snapshot) && expandedPreference && activeChatId === snapshot?.session.chatId && !hasDetailSurface;

  useEffect(() => {
    if (!snapshot) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || !callStatus) return;
    if (callStatus.activeCall?.id === snapshot.session.id) {
      updateActiveConversationCallSession(callStatus.activeCall);
      return;
    }
    setActiveConversationCall(null);
  }, [callStatus, setActiveConversationCall, snapshot, updateActiveConversationCallSession]);

  const clearCall = useCallback(() => {
    setActiveConversationCall(null);
  }, [setActiveConversationCall]);

  const returnToCall = useCallback(() => {
    if (!snapshot) return;
    closeAllDetails();
    setActiveChatId(snapshot.session.chatId);
    setConversationCallExpanded(true);
  }, [closeAllDetails, setActiveChatId, setConversationCallExpanded, snapshot]);

  const endMinimizedCall = useCallback(async () => {
    if (!snapshot) return;
    try {
      await endCall.mutateAsync(snapshot.session.id);
      clearCall();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end the call.");
    }
  }, [clearCall, endCall, snapshot]);

  const participantNames = useMemo(() => {
    if (!snapshot) return "";
    return snapshot.chatCharIds
      .map((id) => snapshot.characterMap.get(id)?.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 3)
      .join(", ");
  }, [snapshot]);

  if (!snapshot) return null;
  if (expanded) return null;

  const firstCharacter = snapshot.chatCharIds.map((id) => snapshot.characterMap.get(id)).find(Boolean);
  const elapsedLabel = formatDuration(now - callStartedAtMs(snapshot.session.startedAt ?? snapshot.session.createdAt));
  const chatLabel = snapshot.chatName || participantNames || "Conversation call";

  return (
    <>
      <div
        className={cn(
          "mari-chat-area mari-card-css overflow-hidden bg-[var(--background)]",
          expanded
            ? "absolute inset-x-0 bottom-0 top-14 z-40 flex min-h-0 flex-col"
            : "pointer-events-none fixed -left-[200vw] top-0 z-[-1] h-px w-px opacity-0",
        )}
        aria-hidden={!expanded}
      >
        <ConversationCallSurface
          chatId={snapshot.session.chatId}
          session={snapshot.session}
          characterMap={snapshot.characterMap}
          chatCharIds={snapshot.chatCharIds}
          personaInfo={snapshot.personaInfo}
          onEnded={clearCall}
        />
      </div>

      {!expanded && (
        <aside
          className="mari-conversation-call-mini mari-card-css mari-chrome-token-scope pointer-events-auto fixed z-50 flex w-[min(22rem,calc(100vw-1.5rem))] items-center gap-3 rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] p-2.5 text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/30"
          aria-label="Active Conversation call"
        >
          <button
            type="button"
            onClick={returnToCall}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-[var(--marinara-chat-chrome-highlight-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)]"
            title="Return to call"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-highlight-bg)]">
              {firstCharacter?.avatarUrl ? (
                <img src={firstCharacter.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Phone size="1rem" className="text-[var(--marinara-chat-chrome-button-text-hover)]" />
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--marinara-chat-chrome-panel-bg)] bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--marinara-chat-chrome-panel-title)]">
                {chatLabel}
              </div>
              <div className="truncate text-xs tabular-nums text-[var(--marinara-chat-chrome-panel-muted)]">
                In call, {elapsedLabel}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => void endMinimizedCall()}
            disabled={endCall.isPending}
            className="mari-chrome-control mari-chrome-control--danger h-10 w-10 p-0"
            title="End call"
          >
            {endCall.isPending ? <Loader2 size="1rem" className="animate-spin" /> : <PhoneOff size="1rem" />}
          </button>
        </aside>
      )}
    </>
  );
}
