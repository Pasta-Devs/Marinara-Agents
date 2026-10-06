import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
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
      /** Written as Slurp Support (Slurp's staff), not as the persona. */
      asSupport?: boolean;
      /** Support only: the Creator answers with a photo taken right now (0.3.6). */
      photoDemand?: boolean;
      /** Support only: an Offer or a move riding this line (docs/SUPPORT-DESK.md). */
      desk?: { mode: "offer" | "now"; step: { action: string; input: Record<string, unknown> } };
    }) => api.post<SlurpSendResponse>("/slurp2/messages/send", input),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** R9: change your own words in a DM. */
export function useEditSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; threadId: string; messageId: string; content: string }) =>
      api.post(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/messages/${encodeURIComponent(input.messageId)}/edit`,
        { personaId: input.personaId, content: input.content },
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** R9: take a message out of a DM thread (never a tip, paid picture or commission step). */
export function useDeleteSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; threadId: string; messageId: string }) =>
      api.post(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/messages/${encodeURIComponent(input.messageId)}/delete`,
        { personaId: input.personaId },
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** R9: the Creator writes their last answer again (answered like Get reply now). */
export function useRegenerateSlurpReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; threadId: string }) =>
      api.post<Omit<SlurpSendResponse, "message" | "tipError">>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/regenerate`,
        { personaId: input.personaId },
      ),
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/**
 * The Creator's side of "Request a reply": ask the fan to write back.
 *
 * Same tool, other direction. Only the Creator's owner may call it, which the route checks.
 */
export function useRequestSlurpFanReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { creatorAccountId: string; personaId: string; threadId: string; guidance?: string }) =>
      api.post<{ reply: SlurpMessage | null; replyStatus: string }>(
        `/slurp2/messages/creators/${encodeURIComponent(input.creatorAccountId)}/request-fan-reply`,
        input,
      ),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
export function useUnlockSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string }) =>
      api.post<{ message: SlurpMessage; wallet: SlurpWallet }>("/slurp2/messages/ppv/unlock", input),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
export function useReactToSlurpMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string; reaction: "heart" | null }) =>
      api.post<{ message: SlurpMessage }>(`/slurp2/messages/${encodeURIComponent(input.messageId)}/reaction`, input),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
      asSupport?: boolean;
    }) => {
      const form = new FormData();
      form.append("personaId", input.personaId);
      if (input.asSupport) form.append("asSupport", "true");
      form.append("creatorAccountId", input.creatorAccountId);
      form.append("content", input.content);
      form.append("file", input.file);
      return api.upload<SlurpPhotoSendResult>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/image-upload`,
        form,
      );
    },
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** A sent photo and the Creator's answer to it, shaped like a text send's (R1-019). */
export type SlurpPhotoSendResult = {
  message: SlurpMessage;
  reply: SlurpMessage | null;
  replyStatus: string;
  typingMs?: number;
};
export function useGenerateSlurpViewerImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      threadId: string;
      creatorAccountId: string;
      personaId: string;
      prompt: string;
      content?: string;
      asSupport?: boolean;
    }) =>
      api.post<SlurpPhotoSendResult>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/viewer-image`,
        input,
      ),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
/** Empty one conversation. Every message goes; what the fan paid for does not. */
export function useResetSlurpThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { threadId: string; personaId: string }) =>
      api.post<{ thread: SlurpThread }>(`/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/reset`, input),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
      baseNoteIds: string[];
    }) =>
      api.put<{ notes: { id: string; text: string; tier: "working" | "longterm" }[] }>(
        `/slurp2/messages/threads/${encodeURIComponent(input.threadId)}/notes`,
        { personaId: input.personaId, notes: input.notes, baseNoteIds: input.baseNoteIds },
      ),
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
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
    // Settled, not success: a request that timed out may still have been stored.
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}

/** An internal note in a Support thread: the player's own, never shown to the Creator or a model. */
export function useAddSlurpDeskNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; text: string }) =>
      api.post<{ message: SlurpMessage }>("/slurp2/slurp/desk/note", input),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}

/** Support marks the open ticket resolved; the Creator answers and rates it. */
export function useResolveSlurpDeskTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string }) =>
      api.post<{ message: SlurpMessage; replyStatus: string }>("/slurp2/slurp/desk/ticket/resolve", input),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}

/** The player, as a Creator they run, answers an Offer AI Support sent them. */
export function useAnswerSlurpDeskOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { personaId: string; messageId: string; answer: "accept" | "decline" }) =>
      api.post<{ status: string; error: string | null }>("/slurp2/slurp/desk/offer/answer", input),
    onSettled: () => invalidateSlurpMessages(queryClient),
  });
}
