import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpReusablePromptInstruction } from "../../base/state/slp-state-types.js";
import type {
  SlurpPromptBlocksResponse,
  SlurpPromptPreviewResponse,
  SlurpPromptResultPreviewResponse,
  SlurpPromptResultPreviewInput,
  SlurpSettings,
  SlurpSettingsUpdate,
} from "./slp-settings-contract.js";

export function useSlurpSettings() {
  return useQuery({
    queryKey: slpKeys.settings(),
    queryFn: () => api.get<SlurpSettings>("/slurp2/settings"),
    staleTime: 10_000,
  });
}
export function useSlurpSettingsDefaults() {
  return useQuery({
    queryKey: [...slpKeys.settings(), "defaults"] as const,
    queryFn: () => api.get<SlurpSettings>("/slurp2/settings/defaults"),
    staleTime: Infinity,
  });
}
export function useSlurpPromptBlocks() {
  return useQuery({
    queryKey: [...slpKeys.settings(), "prompt-blocks"] as const,
    queryFn: () => api.get<SlurpPromptBlocksResponse>("/slurp2/settings/prompt-blocks"),
    staleTime: Infinity,
  });
}
/**
 * What a prompt's blocks actually contain, for one Creator.
 *
 * A mutation rather than a query: it is asked for when a player opens a preview, not kept warm for
 * every prompt in the panel.
 */
export function useSlurpPromptBlockPreview() {
  return useMutation({
    mutationFn: (input: {
      promptId: string;
      creatorAccountId: string;
      promptBlocks?: unknown;
      promptInstructions?: SlurpReusablePromptInstruction[];
    }) => api.post<SlurpPromptPreviewResponse>("/slurp2/settings/prompt-blocks/preview", input),
  });
}
/**
 * Every block of one prompt, resolved for one Creator, kept current while the draft changes.
 * Read-only and model-free, so the studio can show it without a button.
 */
export function useSlurpLivePromptBlocks(
  input: {
    promptId: string;
    creatorAccountId: string;
    promptBlocks: unknown;
    promptInstructions: SlurpReusablePromptInstruction[];
  } | null,
) {
  return useQuery({
    queryKey: [...slpKeys.settings(), "live-prompt", input],
    queryFn: () => api.post<SlurpPromptPreviewResponse>("/slurp2/settings/prompt-blocks/preview", input),
    enabled: Boolean(input?.creatorAccountId),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}
export function useSlurpPromptResultPreview() {
  return useMutation({
    mutationFn: (input: SlurpPromptResultPreviewInput) =>
      api.post<SlurpPromptResultPreviewResponse>("/slurp2/settings/prompt-blocks/generate-preview", input),
  });
}
export function useUpdateSlurpSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SlurpSettingsUpdate) => api.patch<SlurpSettings>("/slurp2/settings", patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(slpKeys.settings(), settings);
      return queryClient.invalidateQueries({ queryKey: slpKeys.noodlerFanStatus() });
    },
  });
}
/** Put a built-in arc type back to its shipped state. */
export function useResetSlurpArcType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SlurpSettings>(`/slurp2/arc-library/${encodeURIComponent(id)}/reset`, {}),
    onSuccess: (settings) => queryClient.setQueryData(slpKeys.settings(), settings),
  });
}
