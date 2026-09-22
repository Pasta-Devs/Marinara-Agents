import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SlpWardrobeImportDraft,
  SlpWardrobeLook,
  SlpWardrobeLookInput,
} from "../../../../../shared/src/slp/slp-wardrobe.js";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";

const key = (creatorId: string) => [...slpKeys.noodlerRoot(), "wardrobe", creatorId] as const;

export function useSlurpWardrobe(creatorId: string) {
  return useQuery({
    queryKey: key(creatorId),
    queryFn: () =>
      api.get<{ looks: SlpWardrobeLook[]; limit: number }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/wardrobe`,
      ),
  });
}

export function useSlurpWardrobeMutations(creatorId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: key(creatorId) });
  return {
    create: useMutation({
      mutationFn: (input: SlpWardrobeLookInput) =>
        api.post<SlpWardrobeLook>(`/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/wardrobe`, input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...input }: SlpWardrobeLookInput & { id: string }) =>
        api.patch<SlpWardrobeLook>(
          `/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/wardrobe/${encodeURIComponent(id)}`,
          input,
        ),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        api.delete<{ deleted: true }>(
          `/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/wardrobe/${encodeURIComponent(id)}`,
        ),
      onSuccess: refresh,
    }),
    saveImport: useMutation({
      mutationFn: (input: {
        source: { kind: "character" | "lorebook" | "text" | "legacy"; label?: string };
        looks: SlpWardrobeLookInput[];
      }) =>
        api.post<{ looks: SlpWardrobeLook[] }>(
          `/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/wardrobe/import`,
          input,
        ),
      onSuccess: refresh,
    }),
  };
}

export function usePreviewSlurpWardrobeImport(creatorId: string) {
  return useMutation({
    mutationFn: (input: {
      connectionId?: string;
      source:
        | { kind: "character" }
        | { kind: "lorebook"; lorebookIds: string[] }
        | { kind: "text"; text: string }
        | { kind: "legacy"; text: string };
    }) =>
      api.post<{
        source: { kind: "character" | "lorebook" | "text" | "legacy"; label: string };
        looks: SlpWardrobeImportDraft[];
      }>(`/slurp2/slurp/accounts/${encodeURIComponent(creatorId)}/wardrobe/import-preview`, input),
  });
}

export function useSlurpWardrobeLorebooks() {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "wardrobe-lorebooks"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>("/slurp2/slurp/wardrobe/lorebooks"),
    staleTime: 30_000,
  });
}
