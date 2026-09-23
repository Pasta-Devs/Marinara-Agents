import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  SlpArcBlueprint,
  SlpArcOpportunityRecord,
  SlpEventBlueprint,
  SlpEventOccurrence,
  SlpStoryFact,
  SlpStoryCalendarItem,
  SlpStoryPack,
} from "../../../../../shared/src/slp/slp-story-engine.js";
import { api } from "../../../lib/api-client.js";
import { slpKeys } from "../../base/state/slp-query-keys.js";

export type SlpBundledPackSummary = Pick<
  SlpStoryPack,
  "format" | "schemaVersion" | "id" | "version" | "name" | "description" | "author"
> & {
  arcCount: number;
  eventCount: number;
};
export type SlpPackPreviewEntry = {
  kind: "arc" | "event";
  contentId: string;
  name: string;
  status: "new" | "update" | "local-edit" | "conflict" | "invalid";
  selected: boolean;
  warnings: string[];
  error?: string;
  value?: SlpArcBlueprint | SlpEventBlueprint;
};
export type SlpPackPreview = {
  previewId: string;
  expiresAt: string;
  pack: Pick<SlpStoryPack, "id" | "version" | "name" | "description" | "author">;
  entries: SlpPackPreviewEntry[];
  warnings: string[];
};

const storyKey = ["slurp2", "story"] as const;

export function useSlpStoryCalendar(from: Date, to: Date) {
  return useQuery({
    queryKey: [...storyKey, "calendar", from.toISOString(), to.toISOString()],
    queryFn: () =>
      api.get<{ from: string; to: string; items: SlpStoryCalendarItem[] }>(
        `/slurp2/story/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      ),
  });
}

export function useSlpBundledStoryPacks() {
  return useQuery({
    queryKey: [...storyKey, "packs"],
    queryFn: () => api.get<{ packs: SlpBundledPackSummary[] }>("/slurp2/story-packs/bundled"),
    staleTime: Infinity,
  });
}
export function useSlpStoryTimeline() {
  return useQuery({
    queryKey: [...storyKey, "timeline"],
    queryFn: () =>
      api.get<{ occurrences: SlpEventOccurrence[]; facts: SlpStoryFact[]; opportunities: SlpArcOpportunityRecord[] }>(
        "/slurp2/story/timeline",
      ),
  });
}
export function usePreviewBundledStoryPack() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<SlpPackPreview>(`/slurp2/story-packs/bundled/${encodeURIComponent(id)}/preview`, {}),
  });
}
export function usePreviewStoryPack() {
  return useMutation({ mutationFn: (pack: unknown) => api.post<SlpPackPreview>("/slurp2/story-packs/preview", pack) });
}
export function useApplyStoryPack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      previewId: string;
      choices: Array<{
        kind: "arc" | "event";
        contentId: string;
        action: "copy" | "replace" | "skip";
        enabled?: boolean;
        automation?: "inherit" | "manual" | "suggest" | "auto";
        value?: SlpArcBlueprint | SlpEventBlueprint;
      }>;
    }) =>
      api.post<{ imported: number }>(`/slurp2/story-packs/previews/${encodeURIComponent(input.previewId)}/apply`, {
        choices: input.choices,
      }),
    // The calendar and timeline read the imported occasions too, so they refresh with settings.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: slpKeys.settings() }),
        queryClient.invalidateQueries({ queryKey: storyKey }),
      ]),
  });
}
/** Start a manual occasion now. Pack occasions are mostly manual, and nothing could start them. */
export function useStartStoryEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      api.post<{ occurrence: SlpEventOccurrence }>(`/slurp2/story/events/${encodeURIComponent(eventId)}/start`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: storyKey }),
  });
}
export function useSetStoryOccurrenceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: "active" | "dismissed" | "completed" | "cancelled" }) =>
      api.post(`/slurp2/story/occurrences/${encodeURIComponent(input.id)}/status`, { status: input.status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...storyKey, "timeline"] }),
  });
}
export async function exportSlpStoryPack(input: { id: string; name: string; arcIds: string[]; eventIds: string[] }) {
  return api.post<SlpStoryPack>("/slurp2/story-packs/export", input);
}
