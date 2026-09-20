import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import { invalidateSlurpMessages, messageKeys } from "./slp-message-keys.js";
import type {
  SlurpCommission,
  SlurpComposeTarget,
  SlurpCreatorMessaging,
  SlurpMessage,
  SlurpPromptDebug,
  SlurpRapport,
  SlurpThread,
  SlurpThreadRelationship,
} from "./slp-messages-contract.js";

export function useSlurpThreads(personaId: string | null) {
  return useQuery({
    queryKey: messageKeys.threads(personaId),
    queryFn: () =>
      api.get<{
        threads: Array<SlurpThread & { side: "viewer" }>;
        inbound: Array<
          SlurpThread & { side: "creator"; counterpartName: string | null; counterpartHandle: string | null }
        >;
        unread: number;
        inboundUnread: number;
        attentionCommissions: Array<SlurpCommission & { side: "viewer" | "creator" }>;
      }>(`/slurp2/messages/threads?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(personaId),
    // A creator who is offline answers minutes or hours later, through the scheduler. Without a
    // poll that reply only appeared once some other mutation happened to invalidate the cache,
    // so the whole off-hours pacing model was invisible while the app was open.
    refetchInterval: personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useSlurpComposeTargets(personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...messageKeys.root(), "compose-targets", personaId ?? "none"],
    queryFn: () =>
      api.get<{ targets: SlurpComposeTarget[] }>(
        `/slurp2/messages/compose-targets?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && enabled,
    staleTime: 30_000,
  });
}
export function useOpenSlurpCreatorThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; viewerAccountId: string }) =>
      api.post<{ thread: SlurpThread }>("/slurp2/messages/compose", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useSlurpThread(threadId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: messageKeys.thread(threadId ?? "none", personaId),
    queryFn: () =>
      api.get<{
        thread: SlurpThread;
        messages: SlurpMessage[];
        nextCursor: { createdAt: string; id: string } | null;
        creator: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        counterpart: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        creatorLastActiveAt: string | null;
        creatorLastMessageAt: string | null;
        creatorAutoPosting: boolean;
        creatorAvailability?: {
          online: boolean;
          activity: string | null;
          minutesUntilOnline: number | null;
          estimated?: boolean;
        };
        messaging: SlurpCreatorMessaging;
        commissions: SlurpCommission[];
        subscribed?: boolean;
        relationship?: SlurpThreadRelationship;
      }>(`/slurp2/messages/threads/${encodeURIComponent(threadId!)}?personaId=${encodeURIComponent(personaId!)}`),
    enabled: Boolean(threadId && personaId),
    refetchInterval: threadId && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useSlurpOlderMessages() {
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; cursor: { createdAt: string; id: string } }) =>
      api.get<{
        messages: SlurpMessage[];
        nextCursor: { createdAt: string; id: string } | null;
      }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}?personaId=${encodeURIComponent(input.personaId)}&cursorAt=${encodeURIComponent(input.cursor.createdAt)}&cursorId=${encodeURIComponent(input.cursor.id)}`,
      ),
  });
}
export function useSlurpMessagePrompt(threadId: string | null, personaId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...messageKeys.thread(threadId ?? "none", personaId), "prompt"],
    queryFn: () =>
      api.get<SlurpPromptDebug>(
        `/slurp2/messages/threads/${encodeURIComponent(threadId!)}/prompt?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: enabled && Boolean(threadId && personaId),
    staleTime: 0,
  });
}
/**
 * The conversation with one creator, started or not. Used when the player opens a chat from a
 * profile, where there may be no thread yet and creating one on sight would charge a fee.
 */
export function useSlurpCompose(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "messages", "compose", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{
        thread: SlurpThread | null;
        messages: SlurpMessage[];
        nextCursor: { createdAt: string; id: string } | null;
        creator: { id: string; handle: string; displayName: string; avatarUrl: string | null } | null;
        creatorLastActiveAt?: string | null;
        creatorLastMessageAt?: string | null;
        creatorAutoPosting?: boolean;
        creatorAvailability?: {
          online: boolean;
          activity: string | null;
          minutesUntilOnline: number | null;
          estimated?: boolean;
        };
        messaging: SlurpCreatorMessaging;
        commissions: SlurpCommission[];
        subscribed?: boolean;
        relationship?: SlurpThreadRelationship;
      }>(
        `/slurp2/messages/compose?personaId=${encodeURIComponent(personaId!)}&creatorAccountId=${encodeURIComponent(creatorAccountId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
    // Same poll as `useSlurpThread`. Without it a chat opened from a profile never saw the
    // queued off-hours reply, which is most of what the pacing model exists to produce.
    refetchInterval: creatorAccountId && personaId ? 30_000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useRecordSlurpStoryView() {
  return useMutation({
    mutationFn: (input: { storyId: string; personaId: string }) =>
      api.post<{ viewed: boolean; duplicate: boolean }>(
        `/slurp2/slurp/stories/${encodeURIComponent(input.storyId)}/view`,
        { personaId: input.personaId },
      ),
  });
}
export function useSlurpStoryViews(storyId: string | null, personaId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "story-views", storyId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ count: number; viewers: Array<{ id: string; displayName: string; handle: string }> }>(
        `/slurp2/slurp/stories/${encodeURIComponent(storyId!)}/views?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: enabled && Boolean(storyId && personaId),
  });
}
/** The rapport breakdown, read only by the Creator edit panel. */
export function useSlurpRapport(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "messages", "rapport", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ messaging: SlurpCreatorMessaging; rapport: SlurpRapport; facts: Record<string, unknown> }>(
        `/slurp2/messages/creators/${encodeURIComponent(creatorAccountId!)}/rapport?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
  });
}
/** A Creator's own message policy and prices, for the panel that edits them. */
export function useSlurpCreatorMessagingSettings(creatorAccountId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: [
      ...slpKeys.noodlerRoot(),
      "messages",
      "creator-settings",
      creatorAccountId ?? "none",
      personaId ?? "none",
    ],
    queryFn: () =>
      api.get<{
        messaging: SlurpCreatorMessaging;
        subscriptionPrice: number;
        suggested?: { subscriptionPrice: number; unlockPrice: number; commissionBase: number };
      }>(
        `/slurp2/messages/creators/${encodeURIComponent(creatorAccountId!)}/settings?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(creatorAccountId && personaId),
  });
}
export function useSetSlurpCreatorMessaging() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string } & Partial<SlurpCreatorMessaging>) => {
      const { creatorAccountId, ...patch } = input;
      return api.patch<{ messaging: SlurpCreatorMessaging }>(
        `/slurp2/messages/creators/${encodeURIComponent(creatorAccountId)}/settings`,
        patch,
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
