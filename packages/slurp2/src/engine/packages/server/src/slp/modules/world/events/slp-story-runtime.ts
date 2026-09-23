import {
  slpArcOpportunityRecordSchema,
  slpEventOccurrenceSchema,
  slpStoryFactSchema,
  type SlpArcOpportunityRecord,
  type SlpEventBlueprint,
  type SlpEventOccurrence,
  type SlpStoryFact,
  type SlpStoryCalendarItem,
  type SlpStoryOutcome,
} from "../../../../../../shared/src/slp/slp-story-engine.js";
import type { SlpAccount } from "../../../../../../shared/src/slp/slp-social.types.js";
import { hash } from "../../projects/slp-project.js";
import type { SlurpProject } from "../../projects/slp-project.js";

const DAY = 86_400_000;
export const SLP_STORY_OCCURRENCES_KEY = "slurp2.story.occurrences";
export const SLP_STORY_FACTS_KEY = "slurp2.story.facts";
export const SLP_STORY_OPPORTUNITIES_KEY = "slurp2.story.opportunities";

export const readSlpOccurrences = (raw: string | null): SlpEventOccurrence[] => {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? value.flatMap((item) => {
          const parsed = slpEventOccurrenceSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
};
export const readSlpStoryFacts = (raw: string | null): SlpStoryFact[] => {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? value.flatMap((item) => {
          const parsed = slpStoryFactSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
};
export const readSlpArcOpportunities = (raw: string | null): SlpArcOpportunityRecord[] => {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? value.flatMap((item) => {
          const parsed = slpArcOpportunityRecordSchema.safeParse(item);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
};

function annualWindow(event: SlpEventBlueprint, at: Date): { key: string; startsAt: Date; endsAt: Date } | null {
  if (event.activation.kind === "window") {
    const startsAt = new Date(event.activation.startsAt);
    const endsAt = new Date(event.activation.endsAt);
    return at >= startsAt && at < endsAt ? { key: `window:${event.activation.startsAt}`, startsAt, endsAt } : null;
  }
  if (event.activation.kind !== "annual") return null;
  for (const offset of [0, -1]) {
    const startsAt = new Date(Date.UTC(at.getUTCFullYear() + offset, event.activation.month - 1, event.activation.day));
    const endsAt = new Date(startsAt.getTime() + event.activation.durationDays * DAY);
    if (at >= startsAt && at < endsAt)
      return { key: `annual:${startsAt.toISOString().slice(0, 10)}`, startsAt, endsAt };
  }
  return null;
}

function annualOccurrences(event: SlpEventBlueprint, from: Date, to: Date): SlpStoryCalendarItem[] {
  if (event.activation.kind !== "annual") return [];
  const items: SlpStoryCalendarItem[] = [];
  for (let year = from.getUTCFullYear() - 1; year <= to.getUTCFullYear() + 1; year += 1) {
    const startsAt = new Date(Date.UTC(year, event.activation.month - 1, event.activation.day));
    const endsAt = new Date(startsAt.getTime() + event.activation.durationDays * DAY);
    if (endsAt <= from || startsAt >= to) continue;
    items.push({
      id: `${event.id}:${startsAt.toISOString().slice(0, 10)}`,
      kind: "occasion",
      title: event.name,
      description: event.guidance,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "scheduled",
      sourceId: event.id,
    });
  }
  return items;
}

export function projectSlpStoryCalendar(input: {
  events: readonly SlpEventBlueprint[];
  occurrences: readonly SlpEventOccurrence[];
  plans?: readonly SlurpProject[];
  from: Date;
  to: Date;
}): SlpStoryCalendarItem[] {
  const items = input.events.flatMap((event) => {
    if (!event.enabled) return [];
    if (event.activation.kind === "annual") return annualOccurrences(event, input.from, input.to);
    if (event.activation.kind !== "window") return [];
    const startsAt = new Date(event.activation.startsAt);
    const endsAt = new Date(event.activation.endsAt);
    return endsAt > input.from && startsAt < input.to
      ? [
          {
            id: `${event.id}:${event.activation.startsAt}`,
            kind: "occasion" as const,
            title: event.name,
            description: event.guidance,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            status: "scheduled" as const,
            sourceId: event.id,
          },
        ]
      : [];
  });
  for (const occurrence of input.occurrences) {
    const startsAt = new Date(occurrence.startsAt);
    const endsAt = new Date(occurrence.endsAt);
    if (endsAt <= input.from || startsAt >= input.to) continue;
    items.push({
      id: occurrence.id,
      kind: "occurrence",
      title: occurrence.blueprint.name,
      description: occurrence.blueprint.guidance,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      status: occurrence.status,
      sourceId: occurrence.blueprintId,
    });
  }
  // An occasion that already has an occurrence in the same window is shown once, as the occurrence.
  const scheduled = items.filter((item) => item.kind === "occurrence");
  const deduped = items.filter(
    (item) =>
      item.kind !== "occasion" ||
      !scheduled.some(
        (occurrence) =>
          occurrence.sourceId === item.sourceId &&
          Date.parse(occurrence.startsAt) < Date.parse(item.endsAt) &&
          Date.parse(item.startsAt) < Date.parse(occurrence.endsAt),
      ),
  );
  items.length = 0;
  items.push(...deduped);
  for (const plan of input.plans ?? []) {
    if (!["active", "paused", "complete", "suggested"].includes(plan.status)) continue;
    const startsAt = new Date(plan.startedAt);
    const endsAt = plan.completedAt
      ? new Date(plan.completedAt)
      : plan.durationDays
        ? new Date(startsAt.getTime() + plan.durationDays * DAY)
        : new Date(Math.max(input.to.getTime(), startsAt.getTime() + DAY));
    if (endsAt <= input.from || startsAt >= input.to) continue;
    items.push({
      id: plan.id,
      kind: "plan",
      title: plan.title,
      description: plan.direction,
      startsAt: plan.startedAt,
      endsAt: endsAt.toISOString(),
      status: plan.status === "complete" ? "completed" : plan.status === "suggested" ? "suggested" : plan.status,
      sourceId: plan.id,
    });
  }
  return items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.title.localeCompare(b.title));
}

function matchesTags(account: SlpAccount, mode: "any" | "all", wanted: readonly string[]) {
  const actual = new Set((account.settings.profile.tags ?? []).map((item) => item.toLocaleLowerCase()));
  const checks = wanted.map((item) => actual.has(item.toLocaleLowerCase()));
  return mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

export function selectSlpEventParticipants(
  event: SlpEventBlueprint,
  accounts: readonly SlpAccount[],
  activationKey: string,
): string[] {
  const visible = accounts.filter((account) => !account.hiddenAt);
  if (event.target.kind === "all") return visible.map((account) => account.id);
  if (event.target.kind === "selected") {
    const known = new Set(visible.map((account) => account.id));
    return event.target.creatorIds.filter((id) => known.has(id));
  }
  if (event.target.kind === "tags")
    return visible
      .filter((account) => matchesTags(account, event.target.mode, event.target.tags))
      .map((account) => account.id);
  const eligible = event.target.filter
    ? visible.filter((account) => matchesTags(account, event.target.filter!.mode, event.target.filter!.tags))
    : visible;
  const ordered = [...eligible].sort(
    (a, b) => hash(`${event.id}:${activationKey}:${a.id}`) - hash(`${event.id}:${activationKey}:${b.id}`),
  );
  const low = Math.min(event.target.min, event.target.max, ordered.length);
  const high = Math.min(Math.max(event.target.min, event.target.max), ordered.length);
  const count = low + (high > low ? hash(`${event.id}:${activationKey}:count`) % (high - low + 1) : 0);
  return ordered.slice(0, count).map((account) => account.id);
}

function resolvedStatus(
  event: SlpEventBlueprint,
  global: "manual" | "suggest" | "auto",
): "suggested" | "active" | null {
  const mode = event.automation === "inherit" ? global : event.automation;
  return mode === "manual" ? null : mode === "auto" ? "active" : "suggested";
}

export function reconcileSlpScheduledOccurrences(input: {
  events: readonly SlpEventBlueprint[];
  occurrences: readonly SlpEventOccurrence[];
  accounts: readonly SlpAccount[];
  at: Date;
  automation: "manual" | "suggest" | "auto";
}): { occurrences: SlpEventOccurrence[]; activated: SlpEventOccurrence[] } {
  const now = input.at.toISOString();
  const occurrences = input.occurrences.map((item) =>
    item.status === "active" && Date.parse(item.endsAt) <= input.at.getTime()
      ? { ...item, status: "completed" as const }
      : item,
  );
  const activated: SlpEventOccurrence[] = [];
  for (const event of input.events) {
    if (!event.enabled) continue;
    const window = annualWindow(event, input.at);
    const status = resolvedStatus(event, input.automation);
    if (!window || !status) continue;
    const activationKey = `${event.id}:${window.key}`;
    if (occurrences.some((item) => item.activationKey === activationKey)) continue;
    const item = slpEventOccurrenceSchema.parse({
      id: `occurrence-${hash(activationKey).toString(36)}-${Date.parse(window.startsAt.toISOString()).toString(36)}`,
      blueprintId: event.id,
      activationKey,
      blueprint: structuredClone(event),
      participantIds: selectSlpEventParticipants(event, input.accounts, activationKey),
      status,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      createdAt: now,
      triggerEvidence: event.activation.kind === "annual" ? "Scheduled annual date" : "Scheduled date window",
    });
    occurrences.push(item);
    if (status === "active") activated.push(item);
  }
  const oneYearAgo = input.at.getTime() - 365 * DAY;
  const terminal = occurrences.filter((item) => ["completed", "dismissed", "cancelled"].includes(item.status));
  const retainedTerminal = new Set([
    ...terminal.filter((item) => Date.parse(item.endsAt) >= oneYearAgo).map((item) => item.id),
    ...terminal
      .slice()
      .sort((a, b) => Date.parse(b.endsAt) - Date.parse(a.endsAt))
      .slice(0, 500)
      .map((item) => item.id),
  ]);
  return {
    occurrences: occurrences.filter(
      (item) => !["completed", "dismissed", "cancelled"].includes(item.status) || retainedTerminal.has(item.id),
    ),
    activated,
  };
}

const expiry = (at: Date, days?: number) => (days ? new Date(at.getTime() + days * DAY).toISOString() : null);

export function applySlpStoryOutcomes(input: {
  outcomes: readonly SlpStoryOutcome[];
  participants: readonly string[];
  sourceKind: "arc" | "event";
  sourceId: string;
  at: Date;
  facts: readonly SlpStoryFact[];
  opportunities: readonly SlpArcOpportunityRecord[];
}) {
  let facts = input.facts.filter((item) => !item.expiresAt || Date.parse(item.expiresAt) > input.at.getTime());
  const opportunities = input.opportunities.filter(
    (item) => !item.expiresAt || Date.parse(item.expiresAt) > input.at.getTime(),
  );
  input.outcomes.forEach((outcome, index) => {
    const source = `${input.sourceKind}:${input.sourceId}:${index}`;
    if (outcome.kind === "add-world-fact") {
      if (!facts.some((item) => item.id === source))
        facts.push({
          id: source,
          scope: "world",
          tag: outcome.tag,
          label: outcome.label,
          sourceKind: input.sourceKind,
          sourceId: input.sourceId,
          createdAt: input.at.toISOString(),
          expiresAt: expiry(input.at, outcome.expiresAfterDays),
        });
    } else if (outcome.kind === "remove-world-fact") {
      facts = facts.filter((item) => !(item.scope === "world" && item.tag === outcome.tag));
    } else {
      for (const creatorId of input.participants) {
        const id = `${source}:${creatorId}`;
        if (outcome.kind === "add-creator-fact" && !facts.some((item) => item.id === id))
          facts.push({
            id,
            scope: "creator",
            creatorId,
            tag: outcome.tag,
            label: outcome.label,
            sourceKind: input.sourceKind,
            sourceId: input.sourceId,
            createdAt: input.at.toISOString(),
            expiresAt: expiry(input.at, outcome.expiresAfterDays),
          });
        if (outcome.kind === "remove-creator-fact")
          facts = facts.filter(
            (item) => !(item.scope === "creator" && item.creatorId === creatorId && item.tag === outcome.tag),
          );
        if (outcome.kind === "grant-arc-opportunity" && !opportunities.some((item) => item.id === id))
          opportunities.push({
            id,
            creatorId,
            storyTags: outcome.storyTags,
            weight: outcome.weight,
            consume: outcome.consume,
            sourceKind: input.sourceKind,
            sourceId: input.sourceId,
            createdAt: input.at.toISOString(),
            expiresAt: expiry(input.at, outcome.expiresAfterDays),
          });
      }
    }
  });
  return { facts, opportunities };
}
