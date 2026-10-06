import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";
import type {
  SlpSpiceLanguage,
  SlpSpiceLevel,
  SlpTaste,
  SlpTasteNoticed,
  SlpTasteStrength,
} from "../../../../../shared/src/slp/slp-spice.js";

/** Backstage › Spice, as the server shows it. What Slurp learned stays on the server. */
export type SlpSpiceView = {
  spice: { max: SlpSpiceLevel; tastes: SlpTaste[]; never: string[]; language: SlpSpiceLanguage };
  noticed: SlpTasteNoticed[];
};

const key = () => [...slpKeys.noodlerRoot(), "spice"] as const;
const path = "/slurp2/slurp/spice";

export function useSlurpSpice() {
  return useQuery({ queryKey: key(), queryFn: () => api.get<SlpSpiceView>(path) });
}

/** Every change answers with the whole page, which replaces the cached copy. */
export function useSlurpSpiceMutations() {
  const qc = useQueryClient();
  const store = (answer: SlpSpiceView) => {
    qc.setQueryData(key(), answer);
    // The limit changes every Creator's spice card.
    void qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "steering"] });
  };
  return {
    patch: useMutation({
      mutationFn: (patch: {
        max?: SlpSpiceLevel;
        tastes?: { id?: string; text: string; strength: SlpTasteStrength }[];
        never?: string[];
        language?: SlpSpiceLanguage;
      }) => api.patch<SlpSpiceView>(path, patch),
      onSuccess: store,
    }),
    answerNoticed: useMutation({
      mutationFn: (input: { label: string; answer: "accept" | "stronger" | "remove" }) =>
        api.post<SlpSpiceView>(`${path}/noticed`, input),
      onSuccess: store,
    }),
  };
}
