import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { noodleKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpContentRating } from "../../base/state/slp-state-types.js";

export type SlurpPromotion = {
  id: string;
  platform?: "slurp" | "noodle";
  kind: "creator" | "inline";
  contentRating?: SlurpContentRating;
  origin?: "builtin" | "user" | "generated";
  retiredAt?: string | null;
  brand: string;
  product: string;
  copy: string;
  categories: string[];
  contextTags: string[];
  creatorAccountId?: string;
  creatorHandle?: string;
  imageUrl?: string | null;
  actionLabel?: string;
};
export function useSlurpInlineAds(personaId: string | null, creatorId?: string | null, contextTags: string[] = []) {
  return useQuery({
    queryKey: noodleKeys.ads(personaId ?? "none", creatorId, contextTags),
    queryFn: () =>
      api.get<{ items: SlurpPromotion[] }>(
        `/slurp2/noodler/viewer/ads?personaId=${encodeURIComponent(personaId!)}${creatorId ? `&creatorId=${encodeURIComponent(creatorId)}` : ""}${contextTags.length ? `&contextTags=${encodeURIComponent(contextTags.join(","))}` : ""}`,
      ),
    enabled: Boolean(personaId),
    staleTime: 60_000,
  });
}
export function useHideSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/${encodeURIComponent(promotionId)}/hide`, { personaId }),
    onSuccess: (_state, input) =>
      qc.invalidateQueries({
        queryKey: noodleKeys.noodlerViewers(),
        predicate: (query) => query.queryKey.includes(input.personaId),
      }),
  });
}
export function useRecordSlurpAdAction() {
  return useMutation({
    mutationFn: ({ personaId, promotionId }: { personaId: string; promotionId: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/${encodeURIComponent(promotionId)}/action`, { personaId }),
  });
}
export function useHideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/brand/hide`, { personaId, brand }),
    onSuccess: (_state, input) => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adState(input.personaId) });
      void qc.invalidateQueries({
        queryKey: noodleKeys.noodlerViewers(),
        predicate: (query) => query.queryKey.includes(input.personaId),
      });
    },
  });
}
export function useUnhideSlurpAdBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personaId, brand }: { personaId: string; brand: string }) =>
      api.post(`/slurp2/noodler/viewer/ads/brand/unhide`, { personaId, brand }),
    onSuccess: (_state, input) => qc.invalidateQueries({ queryKey: noodleKeys.adState(input.personaId) }),
  });
}
export function useSlurpAdState(personaId: string | null) {
  return useQuery({
    queryKey: noodleKeys.adState(personaId ?? "none"),
    queryFn: () =>
      api.get<{ hiddenBrands: string[]; hidden: SlurpPromotion[]; seen: SlurpPromotion[] }>(
        `/slurp2/noodler/viewer/ads/state?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId),
  });
}
export function useSlurpAdPool() {
  return useQuery({
    queryKey: noodleKeys.adPool(),
    queryFn: () => api.get<{ items: SlurpPromotion[] }>(`/slurp2/noodler/ads/pool`),
  });
}
export function useGenerateSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count?: number) =>
      api.post<{ items: SlurpPromotion[]; retired: string[]; images: number }>(`/slurp2/noodler/ads/generate`, {
        count,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
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
    mutationFn: (input: SlurpAdInput) => api.post<SlurpPromotion>(`/slurp2/noodler/ads/pool`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}
export function useUpdateSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<SlurpAdInput> & { id: string; retiredAt?: null }) =>
      api.patch<SlurpPromotion>(`/slurp2/noodler/ads/pool/${encodeURIComponent(id)}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}
export function useDeleteSlurpAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) => api.delete(`/slurp2/noodler/ads/pool/${encodeURIComponent(promotionId)}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}
export function useGenerateSlurpAdImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (promotionId: string) =>
      api.post<{ ad: SlurpPromotion }>(`/slurp2/noodler/ads/${encodeURIComponent(promotionId)}/image`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}
export function useSlurpAdLorebooks(enabled: boolean) {
  return useQuery({
    queryKey: [...noodleKeys.adPool(), "lorebooks"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>(`/slurp2/noodler/ads/lorebooks`),
    enabled,
  });
}
export function useSyncSlurpAdLorebook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (force?: boolean) =>
      api.post<{ outcome: "disabled" | "unchanged" | "missing" | "synced" }>(`/slurp2/noodler/ads/lorebook/sync`, {
        force,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}
export function useImportSlurpAds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post<{ imported: number; events: number }>(`/slurp2/noodler/ads/import`, { mode: "merge", payload }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: noodleKeys.adPool() });
      void qc.invalidateQueries({ queryKey: noodleKeys.noodlerViewers() });
    },
  });
}
export function useResetSlurpAds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personaId: string) => api.post(`/slurp2/noodler/viewer/ads/reset`, { personaId }),
    // Ad queries are keyed by creator and context tags too, so the bare `ads(personaId)` key only
    // ever matched the contextless variant and left every visible feed showing reset ads.
    onSuccess: (_state, personaId) =>
      queryClient.invalidateQueries({
        queryKey: noodleKeys.noodlerViewers(),
        predicate: (query) => query.queryKey.includes("ads") && query.queryKey.includes(personaId),
      }),
  });
}
