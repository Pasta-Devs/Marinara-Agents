import { z } from "zod";
import {
  SLP_WARDROBE_LOOK_LIMIT,
  slpWardrobeImportDraftSchema,
  slpWardrobeLookInputSchema,
} from "../../../../../shared/src/slp/slp-wardrobe.js";
import type { FastifyInstance } from "fastify";
import { createLorebooksStorage } from "../../../services/storage/lorebooks.storage.js";
import { resolveSlurpTextConnection } from "../../base/identity/slp-connection.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { slpCreatorSourceText } from "../../base/prompting/slp-prompt-safety.js";
import { createSlurpStorage } from "../../data/slp-storage.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";
import { previewSlpWardrobeImport } from "./slp-wardrobe-import-service.js";

const importSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("character") }).strict(),
  z
    .object({
      kind: z.literal("lorebook"),
      lorebookIds: z.array(z.string().min(1)).min(1).max(10),
      entryIds: z.array(z.string().min(1)).min(1).max(100).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("text"), text: z.string().trim().min(1).max(24_000) }).strict(),
  z.object({ kind: z.literal("legacy"), text: z.string().trim().min(1).max(2_000) }).strict(),
]);

const importPreviewSchema = z
  .object({ connectionId: z.string().min(1).optional(), source: importSourceSchema })
  .strict();

const importSaveSchema = z
  .object({
    source: z.object({
      kind: z.enum(["character", "lorebook", "text", "legacy"]),
      label: z.string().max(160).optional(),
    }),
    looks: z
      .array(slpWardrobeImportDraftSchema.omit({ evidence: true }))
      .min(1)
      .max(SLP_WARDROBE_LOOK_LIMIT),
  })
  .strict();

const text = (value: unknown) => (typeof value === "string" ? value : "");

async function wardrobeImportSource(
  app: FastifyInstance,
  deps: SlpRouteDeps,
  creatorId: string,
  source: z.infer<typeof importSourceSchema>,
) {
  if (source.kind === "text") return { label: "Pasted text", text: source.text };
  if (source.kind === "legacy") return { label: "Legacy wardrobe notes", text: source.text };
  const noodle = createSlurpStorage(app.db);
  if (source.kind === "character") {
    const account = await noodle.getNoodlerAccountById(creatorId);
    const linked = account ? await noodle.resolveAccountSource(account) : null;
    if (!linked) return null;
    const record =
      linked.kind === "character"
        ? await deps.characters.getById(linked.entityId)
        : linked.kind === "persona"
          ? await deps.characters.getPersona(linked.entityId)
          : null;
    if (!record) return null;
    const data = "data" in record ? record.data : record;
    return { label: `Linked ${linked.kind}: ${linked.displayName}`, text: slpCreatorSourceText(data) };
  }
  const lorebooks = createLorebooksStorage(app.db);
  const parts: string[] = [];
  const names: string[] = [];
  for (const id of source.lorebookIds) {
    const book = await lorebooks.getById(id);
    if (!book) continue;
    names.push(text((book as { name?: unknown }).name) || id);
    const entries = await lorebooks.listEntries(id);
    for (const entry of entries) {
      if (entry.enabled === false) continue;
      const row = entry as { id?: unknown; name?: unknown; content?: unknown };
      if (source.entryIds && !source.entryIds.includes(text(row.id))) continue;
      const content = text(row.content).trim();
      if (content) parts.push(`## ${text(row.name) || "Untitled"}\n${content}`);
    }
  }
  if (parts.length === 0) return null;
  return { label: `Lorebook: ${names.join(", ")}`, text: parts.join("\n\n").slice(0, 24_000) };
}

export async function slpWardrobeRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const noodle = createSlurpStorage(app.db);
  const creator = async (id: string) => noodle.getNoodlerAccountById(id);

  app.get("/slurp/accounts/:id/wardrobe", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await creator(id))) return reply.code(404).send({ error: "Creator account not found" });
    return { looks: await noodle.listWardrobeLooks(id), limit: SLP_WARDROBE_LOOK_LIMIT };
  });

  app.post("/slurp/accounts/:id/wardrobe", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = slpWardrobeLookInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await creator(id))) return reply.code(404).send({ error: "Creator account not found" });
    const locked = await tryCreatorAccountOperation(id, () =>
      noodle.createWardrobeLooks(id, [parsed.data], { kind: "manual" }),
    );
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    return reply.code(201).send(locked.value[0]);
  });

  app.patch("/slurp/accounts/:id/wardrobe/:lookId", async (req, reply) => {
    const { id, lookId } = req.params as { id: string; lookId: string };
    const parsed = slpWardrobeLookInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await creator(id))) return reply.code(404).send({ error: "Creator account not found" });
    const locked = await tryCreatorAccountOperation(id, () => noodle.updateWardrobeLook(id, lookId, parsed.data));
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    return locked.value ?? reply.code(404).send({ error: "Wardrobe look not found" });
  });

  app.delete("/slurp/accounts/:id/wardrobe/:lookId", async (req, reply) => {
    const { id, lookId } = req.params as { id: string; lookId: string };
    if (!(await creator(id))) return reply.code(404).send({ error: "Creator account not found" });
    const locked = await tryCreatorAccountOperation(id, () => noodle.deleteWardrobeLook(id, lookId));
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    if (!locked.value) return reply.code(404).send({ error: "Wardrobe look not found" });
    return { deleted: true };
  });

  app.get("/slurp/wardrobe/lorebooks", async () => ({
    items: (await createLorebooksStorage(app.db).list())
      .map((book) => ({
        id: text((book as { id?: unknown }).id),
        name: text((book as { name?: unknown }).name) || text((book as { id?: unknown }).id),
      }))
      .filter((book) => book.id),
  }));

  app.post("/slurp/wardrobe/lorebook-entries", async (req, reply) => {
    const parsed = z
      .object({ lorebookIds: z.array(z.string().min(1)).min(1).max(10) })
      .strict()
      .safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const lorebooks = createLorebooksStorage(app.db);
    const items: { id: string; name: string; lorebookId: string; lorebookName: string }[] = [];
    for (const lorebookId of parsed.data.lorebookIds) {
      const book = await lorebooks.getById(lorebookId);
      if (!book) continue;
      const lorebookName = text((book as { name?: unknown }).name) || lorebookId;
      for (const entry of await lorebooks.listEntries(lorebookId)) {
        if (entry.enabled === false) continue;
        const row = entry as { id?: unknown; name?: unknown; content?: unknown };
        const id = text(row.id);
        if (!id || !text(row.content).trim()) continue;
        items.push({
          id,
          name: text(row.name) || "Untitled",
          lorebookId,
          lorebookName,
        });
      }
    }
    return { items };
  });

  app.post("/slurp/accounts/:id/wardrobe/import-preview", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = importPreviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await creator(id))) return reply.code(404).send({ error: "Creator account not found" });
    const resolved = await wardrobeImportSource(app, deps, id, parsed.data.source);
    if (!resolved) return reply.code(404).send({ error: "That import source has no readable content." });
    const settings = await noodle.getSettings();
    const connection = await resolveSlurpTextConnection(
      deps.connections,
      parsed.data.connectionId ?? settings.generationConnectionId,
    );
    if (!connection) return reply.code(409).send({ error: "Select a text generation connection first." });
    try {
      return {
        source: { kind: parsed.data.source.kind, label: resolved.label },
        looks: await previewSlpWardrobeImport(app.db, {
          connection,
          sourceLabel: resolved.label,
          sourceText: resolved.text,
          existing: await noodle.listWardrobeLooks(id),
        }),
      };
    } catch (error) {
      req.log.warn({ err: error }, "Wardrobe import preview failed");
      return reply.code(502).send({ error: "The generation connection did not return a usable wardrobe preview." });
    }
  });

  app.post("/slurp/accounts/:id/wardrobe/import", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = importSaveSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await creator(id))) return reply.code(404).send({ error: "Creator account not found" });
    const locked = await tryCreatorAccountOperation(id, () =>
      noodle.createWardrobeLooks(id, parsed.data.looks, parsed.data.source),
    );
    if (!locked.acquired) return reply.code(409).send({ error: "Another Creator operation is already running." });
    return reply.code(201).send({ looks: locked.value });
  });
}
