import { randomUUID } from "node:crypto";

import type { SlurpStorageContext } from "../host/slp-storage-context.js";
import type { SlpEventOccurrence } from "../../../../../shared/src/slp/slp-story-engine.js";
import {
  SLP_STORY_FACTS_KEY,
  SLP_STORY_OCCURRENCES_KEY,
  SLP_STORY_OPPORTUNITIES_KEY,
  applySlpStoryOutcomes,
  readSlpArcOpportunities,
  readSlpOccurrences,
  readSlpStoryFacts,
  reconcileSlpScheduledOccurrences,
  selectSlpEventParticipants,
} from "../../modules/world/events/slp-story-runtime.js";

export function createStoryEngineStorage({ settingsStore }: SlurpStorageContext) {
  const write = async (key: string, value: unknown) => settingsStore.set(key, JSON.stringify(value));
  return {
    async listStoryOccurrences() {
      return readSlpOccurrences(await settingsStore.get(SLP_STORY_OCCURRENCES_KEY));
    },
    async listStoryFacts() {
      return readSlpStoryFacts(await settingsStore.get(SLP_STORY_FACTS_KEY));
    },
    async listArcOpportunities() {
      return readSlpArcOpportunities(await settingsStore.get(SLP_STORY_OPPORTUNITIES_KEY));
    },
    async reconcileStoryEvents(at = new Date()) {
      const [settings, accounts, existing] = await Promise.all([
        this.getSettings(),
        this.listNoodlerAccounts(),
        this.listStoryOccurrences(),
      ]);
      const result = reconcileSlpScheduledOccurrences({
        events: settings.platformEvents,
        occurrences: existing,
        accounts,
        at,
        automation: settings.storyAutomation,
      });
      let facts = await this.listStoryFacts();
      let opportunities = await this.listArcOpportunities();
      for (const occurrence of result.activated) {
        ({ facts, opportunities } = applySlpStoryOutcomes({
          outcomes: occurrence.blueprint.outcomes,
          participants: occurrence.participantIds,
          sourceKind: "event",
          sourceId: occurrence.id,
          at,
          facts,
          opportunities,
        }));
      }
      await Promise.all([
        write(SLP_STORY_OCCURRENCES_KEY, result.occurrences),
        write(SLP_STORY_FACTS_KEY, facts),
        write(SLP_STORY_OPPORTUNITIES_KEY, opportunities),
      ]);
      return result.occurrences;
    },
    async startStoryEvent(eventId: string, at = new Date()) {
      const settings = await this.getSettings();
      const event = settings.platformEvents.find((item) => item.id === eventId);
      if (!event) return null;
      const accounts = await this.listNoodlerAccounts();
      const duration = "durationDays" in event.activation ? event.activation.durationDays : 1;
      const activationKey = `${event.id}:manual:${at.toISOString()}`;
      const occurrence: SlpEventOccurrence = {
        id: `occurrence-${randomUUID()}`,
        blueprintId: event.id,
        activationKey,
        blueprint: structuredClone(event),
        participantIds: selectSlpEventParticipants(event, accounts, activationKey),
        status: event.automation === "auto" ? "active" : "suggested",
        startsAt: at.toISOString(),
        endsAt: new Date(at.getTime() + duration * 86_400_000).toISOString(),
        createdAt: at.toISOString(),
        triggerEvidence: "Started manually",
      };
      await write(SLP_STORY_OCCURRENCES_KEY, [occurrence, ...(await this.listStoryOccurrences())]);
      return occurrence;
    },
    async setStoryOccurrenceStatus(
      id: string,
      status: "active" | "dismissed" | "completed" | "cancelled",
      at = new Date(),
    ) {
      const occurrences = await this.listStoryOccurrences();
      const index = occurrences.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const before = occurrences[index]!;
      const after = { ...before, status, ...(status === "active" ? { startsAt: at.toISOString() } : {}) };
      occurrences[index] = after;
      if (status === "active" && before.status !== "active") {
        const result = applySlpStoryOutcomes({
          outcomes: after.blueprint.outcomes,
          participants: after.participantIds,
          sourceKind: "event",
          sourceId: after.id,
          at,
          facts: await this.listStoryFacts(),
          opportunities: await this.listArcOpportunities(),
        });
        await Promise.all([
          write(SLP_STORY_FACTS_KEY, result.facts),
          write(SLP_STORY_OPPORTUNITIES_KEY, result.opportunities),
        ]);
      }
      await write(SLP_STORY_OCCURRENCES_KEY, occurrences);
      return after;
    },
    async removeStoryFact(id: string) {
      const before = await this.listStoryFacts();
      const after = before.filter((item) => item.id !== id);
      await write(SLP_STORY_FACTS_KEY, after);
      return after.length !== before.length;
    },
    async removeArcOpportunity(id: string) {
      const before = await this.listArcOpportunities();
      const after = before.filter((item) => item.id !== id);
      await write(SLP_STORY_OPPORTUNITIES_KEY, after);
      return after.length !== before.length;
    },
  } satisfies ThisType<Record<string, any>>;
}
