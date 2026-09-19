import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpWallet } from "../economy/slp-economy-contract.js";
import { invalidateSlurpMessages } from "./slp-message-keys.js";
import type { SlurpMessage, SlurpSendResponse, SlurpThread } from "./slp-messages-contract.js";

export function useSendSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      creatorAccountId: string;
      content: string;
      requestId?: string;
      tip?: { amount: number; note?: string } | null;
    }) => api.post<SlurpSendResponse>("/slurp2/messages/send", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useSlurpCheatDirective() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; directive: string }) =>
      api.post<{
        status: "accepted";
        kind:
          | "guidance"
          | "coins"
          | "force_creator_photo"
          | "force_ppv"
          | "mood"
          | "rapport"
          | "availability"
          | "help"
          | "follow_up";
        coins?: number;
        amount?: number;
        minutes?: number;
        help?: string[];
        reply?: SlurpMessage | null;
        replyStatus?: string;
      }>("/slurp2/messages/cheat", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
/** Answer a queued conversation now. The server still applies every guard a normal send does. */
export function useForceSlurpReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; threadId: string }) =>
      api.post<Omit<SlurpSendResponse, "message" | "tipError">>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/force-reply`,
        { personaId: input.personaId },
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useRequestSlurpReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; guidance?: string }) =>
      api.post<{ reply: SlurpMessage | null; replyStatus: string; typingMs?: number }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/request-reply`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useTipInSlurpThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      creatorAccountId: string;
      amount: number;
      note?: string;
      requestId?: string;
    }) => api.post<SlurpSendResponse & { wallet: SlurpWallet }>("/slurp2/messages/tip", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useUnlockSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string }) =>
      api.post<{ message: SlurpMessage; wallet: SlurpWallet }>("/slurp2/messages/ppv/unlock", input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useReactToSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string; reaction: "heart" | null }) =>
      api.post<{ message: SlurpMessage }>(`/slurp2/messages/${encodeURIComponent(input.messageId)}/reaction`, input),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
/** Write as the Creator, in your own words. */
export function useSendSlurpCreatorReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; viewerAccountId: string; content: string }) =>
      api.post<{ message: SlurpMessage; thread: SlurpThread | null }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/reply`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
/** Have the Creator draft a reply. The model is the fallback, not the default. */
export function useDraftSlurpCreatorReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; threadId: string }) =>
      api.post<{ message: SlurpMessage; thread: SlurpThread | null }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/draft-reply`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useSendSlurpCreatorPpv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      creatorAccountId: string;
      personaId: string;
      viewerAccountId: string;
      content: string;
      price: number;
    }) =>
      api.post<{ message: SlurpMessage }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/ppv`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useSendSlurpCreatorImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      prompt: string;
      content: string;
      intent?: "friendly" | "hostile" | "premium";
    }) =>
      api.post<{ message: SlurpMessage }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/image`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useSendSlurpViewerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      file: File;
      content: string;
    }) => {
      const form = new FormData();
      form.append("personaId", input.personaId);
      form.append("creatorAccountId", input.creatorAccountId);
      form.append("content", input.content);
      form.append("file", input.file);
      return api.upload<{ message: SlurpMessage; replyStatus: string }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/image-upload`,
        form,
      );
    },
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useGenerateSlurpViewerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      prompt: string;
      content?: string;
    }) =>
      api.post<{ message: SlurpMessage; replyStatus: string }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/viewer-image`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useBroadcastSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; content: string }) =>
      api.post<{ sent: number }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/broadcast`,
        input,
      ),
    onSuccess: () => invalidateSlurpMessages(queryClient),
  });
}
export function useResolveSlurpMessageRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string; decision: "accept" | "decline" }) =>
      api.post<{ thread: SlurpThread }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/request`,
        input,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
/** Empty one conversation. Every message goes; what the fan paid for does not. */
export function useResetSlurpThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string }) =>
      api.post<{ thread: SlurpThread }>(`/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/reset`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
/**
 * Rewrite what the creator remembers about this fan.
 *
 * The whole list goes up, because the panel edits it as a list. The server normalizes and caps it
 * the same way it does the creator's own memory writes.
 */
export function useSetSlurpThreadNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      personaId: string;
      notes: { id?: string; text: string; tier: "working" | "longterm" }[];
    }) =>
      api.put<{ notes: { id: string; text: string; tier: "working" | "longterm" }[] }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/notes`,
        { personaId: input.personaId, notes: input.notes },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
export function useCancelSlurpFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; followUpId: string; personaId: string }) =>
      api.post<{ success: boolean }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/cancel-follow-up`,
        {
          followUpId: input.followUpId,
          personaId: input.personaId,
        },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
