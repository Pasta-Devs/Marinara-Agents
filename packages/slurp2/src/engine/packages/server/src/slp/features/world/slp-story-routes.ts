import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  slpArcBlueprintSchema,
  slpEventBlueprintSchema,
  slpStoryPackSchema,
} from "../../../../../shared/src/slp/slp-story-engine.js";
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
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

const PREVIEW_TTL_MS = 15 * 60_000;
type StagedPreview = { expiresAt: number; preview: SlpStoryPackPreview };

const applySchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            kind: z.enum(["arc", "event"]),
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
    packs: slpBundledStoryPacks().map(({ arcs, events, ...metadata }) => ({
      ...metadata,
      arcCount: arcs.length,
      eventCount: events.length,
    })),
  }));

  app.post("/story-packs/preview", async (req, reply) => {
    prune();
    const parsed = parseSlpStoryPack(req.body);
    if (!parsed.pack) return reply.code(400).send({ error: parsed.errors });
    const settings = await noodle.getSettings();
    const preview = previewSlpStoryPack(parsed.pack, { arcs: settings.arcLibrary, events: settings.platformEvents });
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
    const preview = previewSlpStoryPack(selected, { arcs: settings.arcLibrary, events: settings.platformEvents });
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
    });
    if (!normalized.success) return reply.code(409).send({ error: "The staged preview is no longer valid." });
    for (const choice of parsed.data.choices) {
      if (!choice.value) continue;
      const schema = choice.kind === "arc" ? slpArcBlueprintSchema : slpEventBlueprintSchema;
      const edited = schema.safeParse(choice.value);
      if (!edited.success) return reply.code(400).send({ error: "An edited pack entry is invalid." });
      const contentId = edited.data.contentId ?? edited.data.id;
      if (contentId !== choice.contentId)
        return reply.code(400).send({ error: "An edited pack entry does not match its choice." });
    }
    const settings = await noodle.getSettings();
    const result = applySlpStoryPack(staged.preview, parsed.data.choices as SlpStoryPackApplyChoice[], {
      arcs: settings.arcLibrary,
      events: settings.platformEvents,
    });
    await noodle.updateSettings({ arcLibrary: result.arcs, platformEvents: result.events });
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
      })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const settings = await noodle.getSettings();
    return exportSlpStoryPack({
      ...body.data,
      arcs: settings.arcLibrary.filter((item) => body.data.arcIds.includes(item.id)),
      events: settings.platformEvents.filter((item) => body.data.eventIds.includes(item.id)),
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
