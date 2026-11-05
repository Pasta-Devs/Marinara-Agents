import { randomUUID } from "node:crypto";

import type { SlurpStorageContext } from "../host/slp-storage-context.js";
import { createWardrobeStorage } from "../creators/slp-wardrobe-storage.js";
import { slurpDramaStageFactor } from "./slp-drama-storage.js";
import { slurpStoryLookChange } from "../../modules/storylines/slp-story-state.js";
import type {
  SlpEventOccurrence,
  SlpInfluenceTarget,
  SlpStoryFact,
} from "../../../../../shared/src/slp/slp-story-engine.js";
import {
  slurpInfluenceMultiplier,
  type SlurpInfluenceStory,
} from "../../../../../shared/src/slp/slp-platform-events.js";
import {
  SLP_STORY_FACTS_KEY,
  SLP_STORY_OCCURRENCES_KEY,
  SLP_STORY_OPPORTUNITIES_KEY,
  applySlpStoryOutcomes,
  putSlpStoryFact,
  readSlpArcOpportunities,
  readSlpOccurrences,
  readSlpStoryFacts,
  reconcileSlpScheduledOccurrences,
  selectSlpEventParticipants,
} from "../../modules/world/events/slp-story-runtime.js";

import { normalizeSlpSupportDesk, slpDeskReachFactor } from "../../../../../shared/src/slp/slp-support-desk.js";
import { slurpSupportDeskKey } from "../creators/slp-support-desk-storage.js";
import { slpExtensionOn, slpLiveEvents } from "../../../../../shared/src/slp/slp-extensions.js";
import { slurpPackGate } from "../../modules/world/events/slp-content-packs.js";

export function createStoryEngineStorage(context: SlurpStorageContext) {
  const { settingsStore } = context;
  const wardrobe = createWardrobeStorage(context);
  const write = async (key: string, value: unknown) => settingsStore.set(key, JSON.stringify(value));
  const readDesk = async (creatorAccountId: string) => {
    try {
      return normalizeSlpSupportDesk(
        JSON.parse((await settingsStore.get(slurpSupportDeskKey(creatorAccountId))) ?? "null"),
      );
    } catch {
      return normalizeSlpSupportDesk(null);
    }
  };
  return {
    async listStoryOccurrences() {
      return readSlpOccurrences(await settingsStore.get(SLP_STORY_OCCURRENCES_KEY));
    },
    /** Occurrences plus the Creator's tags: what an event influence needs besides the date (R1-112). */
    async platformInfluenceStory(creatorAccountId?: string): Promise<SlurpInfluenceStory> {
      const [occurrences, creator] = await Promise.all([
        this.listStoryOccurrences().catch(() => []),
        creatorAccountId ? this.getNoodlerAccountById(creatorAccountId).catch(() => null) : null,
      ]);
      return {
        occurrences,
        creator: creatorAccountId ? { id: creatorAccountId, tags: creator?.settings.profile.tags ?? [] } : undefined,
      };
    },
    /** The running events' multiplier on one target, for one Creator or (no id) for everybody. */
    async platformInfluenceMultiplier(target: SlpInfluenceTarget, creatorAccountId?: string, at = new Date()) {
      const settings = await this.getSettings();
      // A running storyline's stage influences on its lead count with the events (PR 6).
      const stages =
        creatorAccountId && slpExtensionOn(settings, "storylines")
          ? await slurpDramaStageFactor(settingsStore, creatorAccountId, target)
          : 1;
      const events = slurpInfluenceMultiplier(
        slpLiveEvents(settings),
        at,
        target,
        await this.platformInfluenceStory(creatorAccountId),
      );
      // The Support desk's throttle, Discover feature and Partner badge reach the same place.
      return (
        stages *
        (target === "feed.reach" && creatorAccountId && slpExtensionOn(settings, "supportDesk")
          ? events * slpDeskReachFactor(await readDesk(creatorAccountId), at)
          : events)
      );
    },
    /**
     * Settings as the post reserve reads them: "feed.posting-rate" events scale posts per day for
     * everybody (it is one Slurp-wide setting), inside the setting's own 1–96 range.
     */
    async getPostingSettings(at = new Date()) {
      const settings = await this.getSettings();
      const rate = await this.platformInfluenceMultiplier("feed.posting-rate", undefined, at);
      return rate === 1
        ? settings
        : { ...settings, postsPerDay: Math.min(96, Math.max(1, Math.round(settings.postsPerDay * rate))) };
    },
    async listStoryFacts() {
      return readSlpStoryFacts(await settingsStore.get(SLP_STORY_FACTS_KEY));
    },
    async listArcOpportunities() {
      return readSlpArcOpportunities(await settingsStore.get(SLP_STORY_OPPORTUNITIES_KEY));
    },
    /** Apply outcomes outside an event: an arc chapter that just started (docs/STORYLINES.md, PR 1). */
    async applyStoryOutcomes(
      input: Omit<Parameters<typeof applySlpStoryOutcomes>[0], "facts" | "opportunities"> & {
        /** The storyline's name, shown as the source of a look it gives. */
        label?: string;
      },
    ) {
      const result = applySlpStoryOutcomes({
        ...input,
        facts: await this.listStoryFacts(),
        opportunities: await this.listArcOpportunities(),
      });
      await Promise.all([
        write(SLP_STORY_FACTS_KEY, result.facts),
        write(SLP_STORY_OPPORTUNITIES_KEY, result.opportunities),
      ]);
      for (const outcome of input.outcomes) {
        for (const creatorId of input.participants) {
          const change = slurpStoryLookChange(outcome, await wardrobe.listWardrobeLooks(creatorId), input.label);
          if (change && "remove" in change) await wardrobe.deleteWardrobeLook(creatorId, change.remove);
          // A full closet keeps what it has: the storyline goes on without the look.
          else if (change)
            await wardrobe
              .createWardrobeLooks(creatorId, [change.add], { kind: "storyline", label: input.label })
              .catch(() => undefined);
        }
      }
    },
    async reconcileStoryEvents(at = new Date()) {
      const [settings, accounts, existing] = await Promise.all([
        this.getSettings(),
        this.listNoodlerAccounts(),
        this.listStoryOccurrences(),
      ]);
      // Living world off: occurrences wait as they are (no start, no end) until it is on again.
      // ponytail: their dates do not move, so a window that passes while off ends on the next pass;
      // shift endsAt by the time spent off if players want a true pause.
      if (!slpExtensionOn(settings, "world")) return existing;
      const result = reconcileSlpScheduledOccurrences({
        events: slurpPackGate(settings.platformEvents, settings.contentPacks),
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
        // "Start now" is the player's own decision, so it runs whatever the automation choice is
        // (that choice governs what starts by itself) and applies its outcomes like any start (R1-111).
        status: "active",
        startsAt: at.toISOString(),
        endsAt: new Date(at.getTime() + duration * 86_400_000).toISOString(),
        createdAt: at.toISOString(),
        triggerEvidence: "Started manually",
      };
      const result = applySlpStoryOutcomes({
        outcomes: event.outcomes,
        participants: occurrence.participantIds,
        sourceKind: "event",
        sourceId: occurrence.id,
        at,
        facts: await this.listStoryFacts(),
        opportunities: await this.listArcOpportunities(),
      });
      await Promise.all([
        write(SLP_STORY_FACTS_KEY, result.facts),
        write(SLP_STORY_OPPORTUNITIES_KEY, result.opportunities),
        write(SLP_STORY_OCCURRENCES_KEY, [occurrence, ...(await this.listStoryOccurrences())]),
      ]);
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
    /**
     * Undo of "Start now" (Stir): cancel a running occurrence and take back the facts and chances it
     * granted. False once it has ended or changed; what it removed from the world stays removed.
     */
    async cancelStartedStoryEvent(id: string, at = new Date()) {
      const occurrences = await this.listStoryOccurrences();
      const occurrence = occurrences.find((item) => item.id === id);
      if (!occurrence || occurrence.status !== "active" || occurrence.endsAt <= at.toISOString()) return false;
      const own = (item: { sourceKind: string; sourceId: string }) =>
        item.sourceKind === "event" && item.sourceId === id;
      const [facts, opportunities] = await Promise.all([this.listStoryFacts(), this.listArcOpportunities()]);
      await Promise.all([
        write(
          SLP_STORY_FACTS_KEY,
          facts.filter((item) => !own(item)),
        ),
        write(
          SLP_STORY_OPPORTUNITIES_KEY,
          opportunities.filter((item) => !own(item)),
        ),
        write(
          SLP_STORY_OCCURRENCES_KEY,
          occurrences.map((item) => (item.id === id ? { ...item, status: "cancelled" as const } : item)),
        ),
      ]);
      return true;
    },
    /** A player condition (Life panel): it takes its track, replacing what was there. */
    async putStoryCondition(fact: SlpStoryFact) {
      await write(SLP_STORY_FACTS_KEY, putSlpStoryFact(await this.listStoryFacts(), fact));
      return fact;
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
