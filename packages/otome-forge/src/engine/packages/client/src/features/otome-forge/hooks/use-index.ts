// ──────────────────────────────────────────────
// Otome Forge: the index document (`otome-forge:index`): the player's runs, the active one, the 18+ confirmation
// ──────────────────────────────────────────────
// GET /index reads it (creating nothing); POST /index/opened records this visit once per mount.
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOtomeApi } from "../api";
import type { OtomeIndex } from "../shared/api-types";

export const INDEX_QUERY_KEY = ["otome-forge", "index"] as const;

export function useOtomeIndex() {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const index = useQuery({
    queryKey: INDEX_QUERY_KEY,
    queryFn: async () => (await otome.get<{ index: OtomeIndex }>("/index")).index,
  });
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    otome
      .post<{ index: OtomeIndex }>("/index/opened")
      .then(({ index: next }) => queryClient.setQueryData(INDEX_QUERY_KEY, next))
      .catch((error: unknown) => console.warn("Otome Forge could not record this visit", error));
  }, [otome, queryClient]);
  return index;
}
