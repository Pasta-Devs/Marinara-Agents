import type { FastifyInstance } from "fastify";
import { createSlurpEventsStorage } from "../../data/notifications/slp-notification-storage.js";
import type { SlurpMessagesStorage } from "../../data/messages/slp-messages-storage.js";
import { createSlurpPopulationStorage } from "../../data/audience/slp-audience-storage-funnel.js";
import { groupSlurpEvents } from "../../modules/notifications/slp-event-weight.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

/** The activity-feed read model: stored events, resolved to names and grouped for display. */
export async function readSlpNotifications(
  db: FastifyInstance["db"],
  noodle: SlpRouteDeps["noodle"],
  messages: SlurpMessagesStorage,
  viewerId: string,
) {
  const events = createSlurpEventsStorage(db);
  const population = createSlurpPopulationStorage(db);
  const [items, unseen] = await Promise.all([events.list(viewerId), events.listUnseen(viewerId)]);
  const legacyCommissionIds = [
    ...new Set(
      items
        .concat(unseen)
        .filter((event) => event.kind === "commission_requested" && event.subjectId)
        .map((event) => event.subjectId!),
    ),
  ];
  const commissionThreads = new Map<string, string>();
  await Promise.all(
    legacyCommissionIds.map(async (id) => {
      const commission = await messages.getCommission(id);
      if (commission) commissionThreads.set(id, commission.threadId);
    }),
  );
  // Actors are stored as ids so a renamed or departed account still renders. Resolve to display
  // names here: "abc-123 subscribed" tells the player nothing, which is the whole failure this
  // surface exists to fix.
  const actorIds = [...new Set(items.concat(unseen).flatMap((event) => (event.actorLabel ? [event.actorLabel] : [])))];
  const actors = new Map<string, { displayName: string; avatarUrl: string | null }>();
  await Promise.all(
    actorIds.map(async (id) => {
      // Three id spaces reach this field: a persona, a Slurp account (ambient profiles), and a
      // generated population member. The population was added after this resolver and never
      // wired into it, so every world-driven event — the questions and commissions that are the
      // whole obligation layer — rendered as "Someone".
      const persona = await noodle.getViewer(id).catch(() => null);
      const account = await noodle.getNoodlerAccountById(id);
      const member = await population.get(id);
      const actor = persona ?? account ?? member;
      if (actor)
        actors.set(id, {
          displayName: actor.displayName,
          avatarUrl: actor.avatarUrl ?? null,
        });
    }),
  );
  const named = (list: typeof items) =>
    list.map((event) => ({
      ...event,
      subjectId: event.subjectId ? (commissionThreads.get(event.subjectId) ?? event.subjectId) : null,
      actorLabel: event.actorLabel ? (actors.get(event.actorLabel)?.displayName ?? null) : null,
      actorAvatarUrl: event.actorLabel ? (actors.get(event.actorLabel)?.avatarUrl ?? null) : null,
    }));
  return {
    items: groupSlurpEvents(named(items)),
    unseen: groupSlurpEvents(named(unseen)),
    unseenCount: unseen.length,
  };
}
