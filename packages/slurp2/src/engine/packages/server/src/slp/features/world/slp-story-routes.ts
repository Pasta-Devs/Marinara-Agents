import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  slpArcBlueprintSchema,
  slpEventBlueprintSchema,
  slpStoryConditionInputSchema,
  slpStoryFactSchema,
  slpStoryPackSchema,
} from "../../../../../shared/src/slp/slp-story-engine.js";
import { slpDramaSchema, slpSituationSchema } from "../../../../../shared/src/slp/slp-drama.js";
import { applySlpDramaEntries } from "../../modules/world/events/slp-drama-library.js";
import { readSlurpDramaLibrary, writeSlurpDramaLibrary } from "../../data/world/slp-drama-storage.js";
import {
  applySlpStoryPack,
  exportSlpStoryPack,
  parseSlpStoryPack,
  previewSlpStoryPack,
  slpBundledStoryPacks,
  type SlpStoryPackApplyChoice,
  type SlpStoryPackPreview,
} from "../../modules/world/events/slp-story-packs.js";
import { projectSlpStoryCalendar } from "../../modules/world/events/slp-story-runtime.js";
import { slurpContentPackSummaries } from "../../modules/world/events/slp-content-packs.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { loadSlurpStoryState } from "./slp-story-context.js";

const PREVIEW_TTL_MS = 15 * 60_000;
type StagedPreview = { expiresAt: number; preview: SlpStoryPackPreview };

const applySchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            kind: z.enum(["arc", "event", "situation", "drama"]),
            contentId: z.string().trim().min(1).max(128),
            action: z.enum(["copy", "replace", "skip"]),
            enabled: z.boolean().optional(),
            automation: z.enum(["inherit", "manual", "suggest", "auto"]).optional(),
            value: z.unknown().optional(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();

/** Story-pack review and the World occurrence ledger share this deliberately small route module. */
export async function slpStoryRoutes(app: FastifyInstance, { noodle }: SlpRouteDeps) {
  const previews = new Map<string, StagedPreview>();
  const prune = () => {
    const now = Date.now();
    for (const [id, staged] of previews) if (staged.expiresAt <= now) previews.delete(id);
  };

  app.get("/story-packs/bundled", async () => ({
    packs: slpBundledStoryPacks().map(({ arcs, events, situations, dramas, ...metadata }) => ({
      ...metadata,
      arcCount: arcs.length,
      eventCount: events.length,
      situationCount: situations.length,
      dramaCount: dramas.length,
    })),
    // The packs Backstage switches on and off; their on/off is the `contentPacks` setting.
    contentPacks: slurpContentPackSummaries(),
  }));

  app.post("/story-packs/preview", async (req, reply) => {
    prune();
    const parsed = parseSlpStoryPack(req.body);
    if (!parsed.pack) return reply.code(400).send({ error: parsed.errors });
    const settings = await noodle.getSettings();
    const preview = previewSlpStoryPack(parsed.pack, {
      arcs: settings.arcLibrary,
      events: settings.platformEvents,
      drama: await readSlurpDramaLibrary(app.db),
    });
    const previewId = randomUUID();
    const expiresAt = Date.now() + PREVIEW_TTL_MS;
    previews.set(previewId, { preview, expiresAt });
    return { previewId, expiresAt: new Date(expiresAt).toISOString(), ...preview };
  });

  app.post("/story-packs/bundled/:id/preview", async (req, reply) => {
    prune();
    const selected = slpBundledStoryPacks().find((item) => item.id === (req.params as { id: string }).id);
    if (!selected) return reply.code(404).send({ error: "Story pack not found." });
    const settings = await noodle.getSettings();
    const preview = previewSlpStoryPack(selected, {
      arcs: settings.arcLibrary,
      events: settings.platformEvents,
      drama: await readSlurpDramaLibrary(app.db),
    });
    const previewId = randomUUID();
    const expiresAt = Date.now() + PREVIEW_TTL_MS;
    previews.set(previewId, { preview, expiresAt });
    return { previewId, expiresAt: new Date(expiresAt).toISOString(), ...preview };
  });

  app.post("/story-packs/previews/:id/apply", async (req, reply) => {
    prune();
    const staged = previews.get((req.params as { id: string }).id);
    if (!staged) return reply.code(410).send({ error: "This import preview expired. Preview the pack again." });
    const parsed = applySchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    // Reparse the normalized staged values before the single settings write.
    const normalized = slpStoryPackSchema.safeParse({
      format: "marinara-slurp-story-pack",
      schemaVersion: 1,
      ...staged.preview.pack,
      arcs: staged.preview.entries.filter((item) => item.kind === "arc" && item.value).map((item) => item.value),
      events: staged.preview.entries.filter((item) => item.kind === "event" && item.value).map((item) => item.value),
      situations: staged.preview.entries
        .filter((item) => item.kind === "situation" && item.value)
        .map((item) => item.value),
      dramas: staged.preview.entries.filter((item) => item.kind === "drama" && item.value).map((item) => item.value),
    });
    if (!normalized.success) return reply.code(409).send({ error: "The staged preview is no longer valid." });
    for (const choice of parsed.data.choices) {
      if (!choice.value) continue;
      const schema =
        choice.kind === "arc"
          ? slpArcBlueprintSchema
          : choice.kind === "event"
            ? slpEventBlueprintSchema
            : choice.kind === "situation"
              ? slpSituationSchema
              : slpDramaSchema;
      const edited = schema.safeParse(choice.value);
      if (!edited.success) return reply.code(400).send({ error: "An edited pack entry is invalid." });
      const contentId = ("contentId" in edited.data ? edited.data.contentId : undefined) ?? edited.data.id;
      if (contentId !== choice.contentId)
        return reply.code(400).send({ error: "An edited pack entry does not match its choice." });
    }
    const settings = await noodle.getSettings();
    const result = applySlpStoryPack(staged.preview, parsed.data.choices as SlpStoryPackApplyChoice[], {
      arcs: settings.arcLibrary,
      events: settings.platformEvents,
    });
    await noodle.updateSettings({ arcLibrary: result.arcs, platformEvents: result.events });
    // Drama entries (situations, dramas) land in their own library, switched off until the player turns them on.
    const dramaChoices = parsed.data.choices.filter(
      (choice) => choice.action !== "skip" && (choice.kind === "situation" || choice.kind === "drama"),
    );
    if (dramaChoices.length) {
      const entries = dramaChoices.flatMap((choice) => {
        const staged_ = staged.preview.entries.find(
          (item) => item.kind === choice.kind && item.contentId === choice.contentId,
        );
        const parsedValue = (choice.kind === "situation" ? slpSituationSchema : slpDramaSchema).safeParse(
          choice.value ?? staged_?.value,
        );
        return parsedValue.success ? [{ kind: choice.kind, value: parsedValue.data } as never] : [];
      });
      await writeSlurpDramaLibrary(
        app.db,
        applySlpDramaEntries(await readSlurpDramaLibrary(app.db), staged.preview.pack.id, entries),
      );
    }
    previews.delete((req.params as { id: string }).id);
    return { imported: parsed.data.choices.filter((item) => item.action !== "skip").length };
  });

  app.post("/story-packs/export", async (req, reply) => {
    const body = z
      .object({
        id: z.string().trim().min(1).max(128),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(1000).optional(),
        arcIds: z.array(z.string()).max(100).default([]),
        eventIds: z.array(z.string()).max(100).default([]),
        situationIds: z.array(z.string()).max(20).default([]),
        dramaIds: z.array(z.string()).max(40).default([]),
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const settings = await noodle.getSettings();
    return exportSlpStoryPack({
      ...body.data,
      arcs: settings.arcLibrary.filter((item) => body.data.arcIds.includes(item.id)),
      events: settings.platformEvents.filter((item) => body.data.eventIds.includes(item.id)),
      drama: await readSlurpDramaLibrary(app.db).then((library) => ({
        situations: library.situations.filter((item) => body.data.situationIds.includes(item.id)),
        dramas: library.dramas.filter((item) => body.data.dramaIds.includes(item.id)),
      })),
    });
  });

  app.get("/story/timeline", async () => ({
    occurrences: await noodle.listStoryOccurrences(),
    facts: await noodle.listStoryFacts(),
    opportunities: await noodle.listArcOpportunities(),
  }));
  app.get("/story/calendar", async (req, reply) => {
    const query = z
      .object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) })
      .strict()
      .safeParse(req.query ?? {});
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() });
    const from = new Date(query.data.from);
    const to = new Date(query.data.to);
    if (to <= from || to.getTime() - from.getTime() > 93 * 86_400_000)
      return reply.code(400).send({ error: "Choose a calendar range from 1 to 93 days." });
    const settings = await noodle.getSettings();
    const plans = (
      await Promise.all((await noodle.listNoodlerAccounts()).map((account) => noodle.listProjects(account.id)))
    ).flat();
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      items: projectSlpStoryCalendar({
        events: settings.platformEvents,
        occurrences: await noodle.listStoryOccurrences(),
        plans,
        from,
        to,
      }),
    };
  });
  app.post("/story/events/:id/start", async (req, reply) => {
    const occurrence = await noodle.startStoryEvent((req.params as { id: string }).id);
    return occurrence ? { occurrence } : reply.code(404).send({ error: "Event not found." });
  });
  app.post("/story/occurrences/:id/status", async (req, reply) => {
    const body = z
      .object({ status: z.enum(["active", "dismissed", "completed", "cancelled"]) })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const occurrence = await noodle.setStoryOccurrenceStatus((req.params as { id: string }).id, body.data.status);
    return occurrence ? { occurrence } : reply.code(404).send({ error: "Occurrence not found." });
  });
  // Life panel (docs/STORYLINES.md, PR 1): a Creator's conditions and what reaches the prompts.
  app.get("/story/state/:accountId", async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    if (!(await noodle.getNoodlerAccountById(accountId))) return reply.code(404).send({ error: "Creator not found." });
    const now = Date.now();
    const facts = (await noodle.listStoryFacts()).filter(
      (fact) =>
        fact.scope === "creator" &&
        fact.creatorId === accountId &&
        (!fact.expiresAt || Date.parse(fact.expiresAt) > now),
    );
    return { facts, state: (await loadSlurpStoryState(app.db, accountId, new Date(now))).state };
  });
  app.post("/story/state/:accountId", async (req, reply) => {
    const { accountId } = req.params as { accountId: string };
    const body = slpStoryConditionInputSchema.safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (!(await noodle.getNoodlerAccountById(accountId))) return reply.code(404).send({ error: "Creator not found." });
    const { days, tag, ...condition } = body.data;
    const at = new Date();
    // Checked as stored: the store drops a fact it cannot read, and the put has already freed the track.
    const fact = slpStoryFactSchema.safeParse({
      ...condition,
      id: `player:${randomUUID()}`,
      scope: "creator",
      creatorId: accountId,
      tag:
        tag ??
        (condition.label
          .toLocaleLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .slice(0, 64)
          .replace(/^-|-$/g, "") ||
          condition.track),
      sourceKind: "player",
      sourceId: "life-panel",
      createdAt: at.toISOString(),
      expiresAt: days ? new Date(at.getTime() + days * 86_400_000).toISOString() : null,
    });
    if (!fact.success) return reply.code(400).send({ error: fact.error.flatten() });
    await noodle.putStoryCondition(fact.data);
    return { fact: fact.data };
  });
  app.delete("/story/facts/:id", async (req, reply) =>
    (await noodle.removeStoryFact((req.params as { id: string }).id))
      ? reply.code(204).send()
      : reply.code(404).send({ error: "Fact not found." }),
  );
  app.delete("/story/opportunities/:id", async (req, reply) =>
    (await noodle.removeArcOpportunity((req.params as { id: string }).id))
      ? reply.code(204).send()
      : reply.code(404).send({ error: "Opportunity not found." }),
  );
}
