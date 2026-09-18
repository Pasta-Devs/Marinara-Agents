import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpPromptDefinition, SlurpSettings, SlurpSettingsUpdate } from "./slp-settings-contract.js";

export function useSlurpSettings() {
  return useQuery({
    queryKey: noodleKeys.settings(),
    queryFn: () => api.get<SlurpSettings>("/slurp2/settings"),
    staleTime: 10_000,
  });
}
export function useSlurpSettingsDefaults() {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "defaults"] as const,
    queryFn: () => api.get<SlurpSettings>("/slurp2/settings/defaults"),
    staleTime: Infinity,
  });
}
export function useSlurpPromptBlocks() {
  return useQuery({
    queryKey: [...noodleKeys.settings(), "prompt-blocks"] as const,
    queryFn: () => api.get<{ prompts: SlurpPromptDefinition[] }>("/slurp2/settings/prompt-blocks"),
    staleTime: Infinity,
  });
}
export function useUpdateSlurpSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: SlurpSettingsUpdate) => api.patch<SlurpSettings>("/slurp2/settings", patch),
    onSuccess: (settings) => {
      queryClient.setQueryData(noodleKeys.settings(), settings);
      return queryClient.invalidateQueries({ queryKey: noodleKeys.noodlerFanStatus() });
    },
  });
}
/** Put a built-in arc type back to its shipped state. */
export function useResetSlurpArcType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<SlurpSettings>(`/slurp2/arc-library/${encodeURIComponent(id)}/reset`, {}),
    onSuccess: (settings) => queryClient.setQueryData(noodleKeys.settings(), settings),
  });
}
