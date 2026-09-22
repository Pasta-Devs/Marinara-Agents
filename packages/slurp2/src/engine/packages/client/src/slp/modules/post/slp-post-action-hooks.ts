import { useMutation } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

export function useShareSlpPost() {
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; postId: string }) =>
      api.post<{ message: unknown; thread: unknown }>("/slurp2/messages/share-post", input),
  });
}

export function useReportSlpContent() {
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      postId: string;
      targetType: "post" | "reply";
      targetId: string;
      reason: "spam" | "illegal" | "privacy" | "harassment" | "adult" | "other";
      details: string;
    }) =>
      api.post<{ reported: boolean; duplicate: boolean }>(
        `/slurp2/slurp/posts/${encodeURIComponent(input.postId)}/report`,
        input,
      ),
  });
}
