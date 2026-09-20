import type { SlurpPromotion } from "./slp-ads-contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpContentRating } from "../../base/state/slp-state-types.js";

export function useSlurpInlineAds(personaId: string | null, creatorId?: string | null, contextTags: string[] = []) {
  return useQuery({
    queryKey: slpKeys.ads(personaId ?? "none", creatorId, contextTags),
    queryFn: () =>
      api.get<{ items: SlurpPromotion[] }>(
        `/slurp2/slurp/viewer/ads?personaId=${encodeURIComponent(personaId!)}${creatorId ? `&creatorId=${encodeURIComponent(creatorId)}` : ""}${contextTags.length ? `&contextTags=${encodeURIComponent(contextTags.join(","))}` : ""}`,
      ),
    enabled: Boolean(personaId),
    staleTime: 60_000,
  });
}
export function useHideSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp2/slurp/viewer/ads/${encodeURIComponent(promotionId)}/hide`, { personaId }),
    onSuccess: (_state, input) =>
      qc.invalidateQueries({
        queryKey: slpKeys.slpCreatorViewers(),
        predicate: (query) => query.queryKey.includes(input.personaId),
      }),
  });
}
export function useRecordSlurpAdAction() {
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp2/slurp/viewer/ads/${encodeURIComponent(promotionId)}/action`, { personaId }),
  });
}
export function useHideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp2/slurp/viewer/ads/brand/hide`, { personaId, brand }),
    onSuccess: (_state, input) => {
      void qc.invalidateQueries({ queryKey: slpKeys.adState(input.personaId) });
      void qc.invalidateQueries({
        queryKey: slpKeys.slpCreatorViewers(),
        predicate: (query) => query.queryKey.includes(input.personaId),
      });
    },
  });
}
export function useUnhideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp2/slurp/viewer/ads/brand/unhide`, { personaId, brand }),
    onSuccess: (_state, input) => qc.invalidateQueries({ queryKey: slpKeys.adState(input.personaId) }),
  });
}
export function useSlurpAdState(personaId: string | null) {
  return useQuery({
    queryKey: slpKeys.adState(personaId ?? "none"),
    queryFn: () =>
      api.get<{ hiddenBrands: string[]; hidden: SlurpPromotion[]; seen: SlurpPromotion[] }>(
        `/slurp2/slurp/viewer/ads/state?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId),
  });
}
export function useSlurpAdPool() {
  return useQuery({
    queryKey: slpKeys.adPool(),
    queryFn: () => api.get<{ items: SlurpPromotion[] }>(`/slurp2/slurp/ads/pool`),
  });
}
export function useGenerateSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) =>
      api.post<{ items: SlurpPromotion[]; retired: string[]; images: number }>(`/slurp2/slurp/ads/generate`, {
        count,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export type SlurpAdInput = {
  brand: string;
  product: string;
  copy: string;
  contentRating: SlurpContentRating;
};
export function useCreateSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SlurpAdInput) => api.post<SlurpPromotion>(`/slurp2/slurp/ads/pool`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useUpdateSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<SlurpAdInput> & { id: string; retiredAt?: null }) =>
      api.patch<SlurpPromotion>(`/slurp2/slurp/ads/pool/${encodeURIComponent(id)}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useDeleteSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) => api.delete(`/slurp2/slurp/ads/pool/${encodeURIComponent(promotionId)}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useGenerateSlurpAdImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) =>
      api.post<{ ad: SlurpPromotion }>(`/slurp2/slurp/ads/${encodeURIComponent(promotionId)}/image`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useSlurpAdLorebooks(enabled: boolean) {
  return useQuery({
    queryKey: [...slpKeys.adPool(), "lorebooks"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>(`/slurp2/slurp/ads/lorebooks`),
    enabled,
  });
}
export function useSyncSlurpAdLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (force?: boolean) =>
      api.post<{ outcome: "disabled" | "unchanged" | "missing" | "synced" }>(`/slurp2/slurp/ads/lorebook/sync`, {
        force,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useImportSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post<{ imported: number; events: number }>(`/slurp2/slurp/ads/import`, { mode: "merge", payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slpKeys.adPool() });
      void qc.invalidateQueries({ queryKey: slpKeys.slpCreatorViewers() });
    },
  });
}
export function useResetSlurpAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post(`/slurp2/slurp/viewer/ads/reset`, { personaId }),
    // Ad queries are keyed by creator and context tags too, so the bare `ads(personaId)` key only
    // ever matched the contextless variant and left every visible feed showing reset ads.
    onSuccess: (_state, personaId) =>
      queryClient.invalidateQueries({
        queryKey: slpKeys.slpCreatorViewers(),
        predicate: (query) => query.queryKey.includes("ads") && query.queryKey.includes(personaId),
      }),
  });
}
