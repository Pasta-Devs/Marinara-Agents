import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpContentRating } from "../../base/state/slp-state-types.js";
import type { SlurpPromotion } from "./slp-ads-contract";

/** A brand and its products (each product is an ad in the pool), as Backstage shows them (R). */
export type SlurpBrand = {
  id: string;
  name: string;
  category: string;
  tone: string;
  logoPrompt: string;
  logoUrl?: string | null;
  origin: "builtin" | "user" | "generated";
  disabledAt?: string | null;
  products: SlurpPromotion[];
};

export type SlurpBrandInput = { name: string; category: string; tone: string; logoPrompt: string };
export type SlurpProductInput = {
  product: string;
  copy: string;
  priceFeel: "budget" | "everyday" | "premium";
  contentRating: SlurpContentRating;
  look: string;
};

// Under the ad pool key: everything that refreshes the pool refreshes the brands, and back.
const brandsKey = () => [...slpKeys.adPool(), "brands"] as const;

export function useSlurpBrands() {
  return useQuery({
    queryKey: brandsKey(),
    queryFn: () => api.get<{ items: SlurpBrand[] }>("/slurp2/slurp/ads/brands"),
  });
}

function useBrandMutation<T>(run: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.adPool() }),
  });
}

export const useCreateSlurpBrand = () =>
  useBrandMutation((input: SlurpBrandInput) => api.post<SlurpBrand>("/slurp2/slurp/ads/brands", input));

export const useUpdateSlurpBrand = () =>
  useBrandMutation(
    ({ id, ...patch }: Partial<SlurpBrandInput> & { id: string; enabled?: boolean; logo?: string | null }) =>
      api.patch(`/slurp2/slurp/ads/brands/${encodeURIComponent(id)}`, patch),
  );

export const useDeleteSlurpBrand = () =>
  useBrandMutation((id: string) =>
    api.delete<{ ok: true; disabled?: boolean }>(`/slurp2/slurp/ads/brands/${encodeURIComponent(id)}`),
  );

export const useCreateSlurpProduct = () =>
  useBrandMutation(({ brandId, ...input }: SlurpProductInput & { brandId: string }) =>
    api.post(`/slurp2/slurp/ads/brands/${encodeURIComponent(brandId)}/products`, input),
  );

export const useUpdateSlurpProduct = () =>
  useBrandMutation(({ id, ...patch }: Partial<SlurpProductInput> & { id: string; retiredAt?: null }) =>
    api.patch(`/slurp2/slurp/ads/pool/${encodeURIComponent(id)}`, patch),
  );

export const useSetSlurpProductPicture = () =>
  useBrandMutation(({ id, image }: { id: string; image: string | null }) =>
    api.post(`/slurp2/slurp/ads/pool/${encodeURIComponent(id)}/picture`, { image }),
  );

/** A stored picture as a data URL, so Undo can put it back after a new one replaced it. */
export async function slurpPictureAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const blob = await (await fetch(url, { credentials: "same-origin" })).blob();
    return await readSlurpPictureFile(blob);
  } catch {
    return null;
  }
}

/** A picked file as a data URL (the routes take pictures that way, like the assist's pictures). */
export function readSlurpPictureFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
