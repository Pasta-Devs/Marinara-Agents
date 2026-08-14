import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api-client";
import type { SlurpSourceReference } from "../components/slurp/slurp-navigation.types";

export type SlurpCreator = SlurpSourceReference & {
  id: string;
  sourceStatus: "active" | "paused_source_missing";
};

export type SlurpBootstrap = {
  creators: SlurpCreator[];
  viewers: Array<{ id: string; personaId: string }>;
  settings: Record<string, never>;
};

export const slurpKeys = {
  all: ["slurp"] as const,
  bootstrap: () => [...slurpKeys.all, "bootstrap"] as const,
  viewer: (personaId: string) => [...slurpKeys.all, "viewer", personaId] as const,
};

export function useSlurp(enabled = true) {
  return useQuery({
    queryKey: slurpKeys.bootstrap(),
    queryFn: () => api.get<SlurpBootstrap>("/slurp"),
    enabled,
  });
}

export function useCreateSlurpCreator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: SlurpSourceReference) =>
      api.post<SlurpCreator>("/slurp/creators", source),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: slurpKeys.bootstrap() }),
  });
}
