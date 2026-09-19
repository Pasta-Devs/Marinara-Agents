import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";
import type { SlurpArcTimeline, SlurpArcType, SlurpCreatorArcConfig, SlurpProject } from "./slp-projects-contract.js";

/** A Creator's running and past arcs, as any viewer may see them. Empty for a hidden Creator. */
export function useSlurpArcs(personaId: string | null, creatorAccountId: string | null) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "projects", "arcs", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ arcs: SlurpArcTimeline[] }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId!)}/arcs?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && Boolean(creatorAccountId),
  });
}
/** One Director mode action. The server refuses it while Director mode is off. */
export function useDirectSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      ...body
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
      action: "pause" | "resume" | "skip" | "back" | "label" | "twist" | "end" | "choose";
      value?: string;
    }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/director`,
        body,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}
/** Apply or reject an arc's pending profile change. Not a Director action. */
export function useResolveSlurpArcProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      ...body
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
      apply: boolean;
    }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/profile`,
        body,
      ),
    // The profile itself changed too, so every Creator view refetches.
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.noodlerRoot() }),
  });
}
const slurpArcConfigKey = (creatorAccountId: string | null, personaId: string | null) => [
  ...slpKeys.noodlerRoot(),
  "arc-config",
  creatorAccountId ?? "none",
  personaId ?? "none",
];
export function useSlurpArcConfig(personaId: string | null, creatorAccountId: string | null) {
  return useQuery({
    queryKey: slurpArcConfigKey(creatorAccountId, personaId),
    queryFn: () =>
      api.get<{ config: SlurpCreatorArcConfig }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId!)}/arc-config?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && Boolean(creatorAccountId),
  });
}
/** Replaces the whole config: send `{}` to reset every field to global. */
export function useUpdateSlurpArcConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      config,
    }: {
      creatorAccountId: string;
      personaId: string;
      config: SlurpCreatorArcConfig;
    }) =>
      api.put<{ config: SlurpCreatorArcConfig }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/arc-config`,
        { personaId, ...config },
      ),
    onSuccess: (data, { creatorAccountId, personaId }) =>
      qc.setQueryData(slurpArcConfigKey(creatorAccountId, personaId), data),
  });
}
/**
 * A Creator's projects.
 *
 * Owner-only. A project is production notes, unlike the tip goal beside it, which exists to be
 * shown to the audience.
 */
export function useSlurpProjects(personaId: string | null, creatorAccountId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...slpKeys.noodlerRoot(), "projects", creatorAccountId ?? "none", personaId ?? "none"],
    queryFn: () =>
      api.get<{ projects: SlurpProject[] }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId!)}/projects?personaId=${encodeURIComponent(personaId!)}`,
      ),
    enabled: Boolean(personaId) && Boolean(creatorAccountId) && enabled,
  });
}
const invalidateSlurpProjects = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: [...slpKeys.noodlerRoot(), "projects"] });
export function useCreateSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      ...body
    }: {
      creatorAccountId: string;
      personaId: string;
      title: string;
      direction: string;
      chapters: string[];
      typeId: string | null;
      durationDays?: number | null;
      crossoverWith?: string[];
    }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects`,
        body,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}
/** Ask the model for an arc. It comes back as a suggestion to accept, edit, or dismiss. */
export function useGenerateSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ creatorAccountId, personaId }: { creatorAccountId: string; personaId: string }) =>
      api.post<{ project: SlurpProject }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects/generate`,
        { personaId },
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}
/** Generate an unsaved Arc Library draft from a player brief. */
export function useGenerateSlurpArcType() {
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      personaId,
      brief,
    }: {
      creatorAccountId: string;
      personaId: string;
      brief: string;
    }) =>
      api.post<{ type: SlurpArcType }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/arc-library/generate`,
        { personaId, brief },
      ),
  });
}
/** Copy an arc into the arc library as a custom type. */
export function useSaveSlurpProjectToLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      personaId,
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
    }) =>
      api.post<{ type: SlurpArcType }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}/library`,
        { personaId },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: slpKeys.settings() }),
  });
}
export function useUpdateSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      ...body
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
      title?: string;
      direction?: string;
      chapters?: string[];
      chapter?: number;
      status?: SlurpProject["status"];
      intensity?: SlurpProject["intensity"];
      durationDays?: number | null;
    }) =>
      api.patch<{ project: SlurpProject }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}`,
        body,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}
export function useDeleteSlurpProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorAccountId,
      projectId,
      personaId,
    }: {
      creatorAccountId: string;
      projectId: string;
      personaId: string;
    }) =>
      api.delete<{ deleted: boolean }>(
        `/slurp2/slurp/accounts/${encodeURIComponent(creatorAccountId)}/projects/${encodeURIComponent(projectId)}?personaId=${encodeURIComponent(personaId)}`,
      ),
    onSuccess: () => invalidateSlurpProjects(qc),
  });
}
