import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

/**
 * What public posts and locked posts are each for, globally and per Creator.
 *
 * An empty string means "inherit": a Creator falls back to the global field, and the global field
 * falls back to the built-in text on the server. Nothing here is resolved on the client, so the
 * fields show what was actually written rather than the value in force.
 */
export type SlurpPostGuidanceEntry = { public: string; locked: string; menu: string };
export type SlurpPostGuidance = {
  defaults: SlurpPostGuidanceEntry;
  creators: Record<string, SlurpPostGuidanceEntry>;
  /** The shipped wording, sent by the server so the client never keeps a second copy of it. */
  builtIn: SlurpPostGuidanceEntry;
};
export type SlurpPostAccess = "public" | "locked";
export function useSlurpPostGuidance(enabled = true) {
  return useQuery({
    queryKey: slpKeys.noodlerPostGuidance(),
    queryFn: () => api.get<SlurpPostGuidance>("/slurp2/slurp/post-guidance"),
    enabled,
    staleTime: 10_000,
  });
}
export function useUpdateSlurpPostGuidance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { creatorId?: string | null; public?: string; locked?: string; menu?: string }) =>
      api.patch<SlurpPostGuidance>("/slurp2/slurp/post-guidance", patch),
    onSuccess: (value) => qc.setQueryData(slpKeys.noodlerPostGuidance(), value),
  });
}
export function useGenerateSlurpPostGuidance() {
  return useMutation({
    mutationFn: (input: {
      access: SlurpPostAccess;
      creatorId?: string | null;
      currentDraft?: string;
      guidance?: string;
    }) => api.post<{ guidance: string }>("/slurp2/slurp/post-guidance-draft", input),
  });
}

// The Creators Backstage panel edits per-Creator post guidance inline, so the field is part of this
// contract rather than a Settings internal.
export { SlurpPostGuidanceField } from "./SlpPostGuidanceField.js";
