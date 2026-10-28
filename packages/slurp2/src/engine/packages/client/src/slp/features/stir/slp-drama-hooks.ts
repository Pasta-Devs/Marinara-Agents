import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { slpKeys } from "../../base/state/slp-query-keys";
import type { SlpDramaSettings } from "../../../../../shared/src/slp/slp-drama.js";

/** Mirrors `/slurp/drama` (docs/DRAMA.md): what can run, and what runs now. */
export type SlpDramaCatalogEntry = {
  id: string;
  kind: "situation" | "drama";
  name: string;
  description: string;
  builtin: boolean;
  dials: { key: string; options: string[]; default: string }[];
  /** A drama that runs only while this situation stands. */
  requires: string | null;
  /** A built-in pack's storyline: the pack switch turns it on. */
  pack?: { name: string; on: boolean } | null;
};
type SlpDramaCast = Record<string, { id: string; name: string | null }>;
export type SlpDramaRunView = {
  id: string;
  dramaId: string;
  cast: SlpDramaCast;
  stage: string;
  startedAt: string;
  endedAt: string | null;
  ending: string | null;
  choice: { answer: number | null; dueAt: string } | null;
  log: { at: string; code: string; detail?: string }[];
};
export type SlpSituationRunView = {
  id: string;
  situationId: string;
  cast: SlpDramaCast;
  startedAt: string;
  endedAt: string | null;
};
export type SlpDramaView = {
  settings: SlpDramaSettings;
  catalog: SlpDramaCatalogEntry[];
  runs: SlpDramaRunView[];
  situations: SlpSituationRunView[];
};

const key = () => [...slpKeys.noodlerRoot(), "drama"] as const;

export function useSlurpDrama() {
  return useQuery({ queryKey: key(), queryFn: () => api.get<SlpDramaView>("/slurp2/slurp/drama") });
}

export function useSlurpDramaMutations(personaId: string | null) {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: key() });
  return {
    start: useMutation({
      mutationFn: (dramaId: string) => api.post("/slurp2/slurp/drama/start", { personaId, dramaId }),
      onSettled: refresh,
    }),
    end: useMutation({
      mutationFn: (runId: string) =>
        api.post(`/slurp2/slurp/drama/runs/${encodeURIComponent(runId)}/end`, { personaId }),
      onSettled: refresh,
    }),
  };
}

/** A pack key ("audience-knows") as words ("Audience knows"). */
export const slpDramaWords = (value: string) =>
  value ? value[0]!.toUpperCase() + value.slice(1).replaceAll("-", " ") : value;
