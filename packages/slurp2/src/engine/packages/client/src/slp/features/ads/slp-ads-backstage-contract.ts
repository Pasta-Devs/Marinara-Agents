import { useRef, useState } from "react";
import type { SlurpContentRating } from "../../base/state/slp-state-types";
import type { SlpBackstageTarget } from "../../base/navigation/slp-backstage-target";
import {
  useCreateSlurpAd,
  useDeleteSlurpAd,
  useGenerateSlurpAdImage,
  useGenerateSlurpAds,
  useImportSlurpAds,
  useResetSlurpAds,
  useSlurpAdLorebooks,
  useSlurpAdPool,
  useSlurpAdState,
  useSyncSlurpAdLorebook,
  useUnhideSlurpAdBrand,
  useUpdateSlurpAd,
} from "./slp-ads-hooks";

type AdDraft = { brand: string; product: string; copy: string; contentRating: SlurpContentRating };

/**
 * Every ad query, mutation and editor draft the Backstage ads panel needs. The Backstage host
 * composes this; it does not fetch ads itself. Enabled flags repeat the pre-split conditions so the
 * same requests fire at the same moments.
 */
export function useSlpAdsBackstageState(target: SlpBackstageTarget, viewerPersonaId: string | null) {
  const resetAds = useResetSlurpAds();
  const adPool = useSlurpAdPool();
  const generateAds = useGenerateSlurpAds();
  const importAds = useImportSlurpAds();
  const createAd = useCreateSlurpAd();
  const [customAdOpen, setCustomAdOpen] = useState(false);
  const [customAd, setCustomAd] = useState<AdDraft>({ brand: "", product: "", copy: "", contentRating: "tame" });
  const adsImportRef = useRef<HTMLInputElement>(null);
  const adState = useSlurpAdState(target === "ads" ? viewerPersonaId : null);
  const unhideBrand = useUnhideSlurpAdBrand();
  const deleteAd = useDeleteSlurpAd();
  const updateAd = useUpdateSlurpAd();
  const [editingAd, setEditingAd] = useState<({ id: string } & AdDraft) | null>(null);
  const generateAdImage = useGenerateSlurpAdImage();
  const adLorebooks = useSlurpAdLorebooks(target === "ads");
  const syncAdLorebook = useSyncSlurpAdLorebook();
  const [adsWorldDraft, setAdsWorldDraft] = useState<string | null>(null);
  return {
    resetAds,
    adPool,
    generateAds,
    importAds,
    createAd,
    customAdOpen,
    setCustomAdOpen,
    customAd,
    setCustomAd,
    adsImportRef,
    adState,
    unhideBrand,
    deleteAd,
    updateAd,
    editingAd,
    setEditingAd,
    generateAdImage,
    adLorebooks,
    syncAdLorebook,
    adsWorldDraft,
    setAdsWorldDraft,
  };
}

export type SlpAdsBackstageState = ReturnType<typeof useSlpAdsBackstageState>;
