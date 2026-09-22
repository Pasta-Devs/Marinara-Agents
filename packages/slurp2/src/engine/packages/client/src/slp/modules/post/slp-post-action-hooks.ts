import { useMutation } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

export function useShareSlpPost() {
  return useMutation({
    mutationFn: (input: { personaId: string; creatorAccountId: string; postId: string }) =>
      api.post<{ message: unknown; thread: unknown }>("/slurp2/messages/share-post", input),
  });
}

/** The reasons the report route accepts. Ordered as the modal lists them. */
export const SLP_REPORT_REASONS = [
  "spam",
  "scam",
  "misinformation",
  "harassment",
  "hate",
  "violence",
  "self_harm",
  "adult",
  "underage",
  "privacy",
  "intellectual_property",
  "impersonation",
  "leaked_paid",
  "illegal",
  "other",
] as const;
export type SlpReportReason = (typeof SLP_REPORT_REASONS)[number];

export function useReportSlpContent() {
  return useMutation({
    mutationFn: (input: {
      personaId: string;
      postId: string;
      targetType: "post" | "reply";
      targetId: string;
      reason: SlpReportReason;
      details: string;
    }) =>
      api.post<{ reported: boolean; duplicate: boolean }>(
        `/slurp2/slurp/posts/${encodeURIComponent(input.postId)}/report`,
        input,
      ),
  });
}
