import {
  resolveCreatorAvatarAbsolutePath,
  resolveCreatorBannerAbsolutePath,
  stageCreatorAvatar,
  unlinkCreatorAvatar,
  stageCreatorBanner,
  unlinkCreatorBanner,
} from "../../base/identity/slp-avatar.js";
import { basename, dirname } from "path";
import { existsSync } from "fs";
import { z } from "zod";
import { resolveCreatorMediaVariant } from "../../base/media/slp-media.js";
import { tryCreatorAccountOperation } from "../../base/locking/slp-account-operation-lock.js";
import { generateCreatorArtwork } from "../creators/slp-creators-contract.js";
import type { FastifyInstance } from "fastify";
import { readCreatorMultipart, sendCreatorMediaError } from "../../base/host/slp-multipart.js";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

export async function slpMediaRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { noodle } = deps;
  app.get("/noodler/accounts/:id/avatar/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const account = await noodle.getNoodlerAccountById(id);
    const candidates = account
      ? [
          resolveCreatorAvatarAbsolutePath(id, account.avatarUrl),
          // Banners generated before the banner route existed were stored under this prefix.
          resolveCreatorBannerAbsolutePath(id, account.settings.profile.bannerUrl ?? null),
        ]
      : [];
    const absolute = candidates.find(
      (candidate) => candidate && basename(candidate) === fileName && existsSync(candidate),
    );
    if (!absolute) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveCreatorMediaVariant(absolute, width.success ? width.data : undefined);
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(served), dirname(served));
  });

  app.get("/noodler/accounts/:id/banner/:fileName", async (req, reply) => {
    const { id, fileName } = req.params as { id: string; fileName: string };
    const account = await noodle.getNoodlerAccountById(id);
    const absolute = account ? resolveCreatorBannerAbsolutePath(id, account.settings.profile.bannerUrl ?? null) : null;
    if (!absolute || basename(absolute) !== fileName || !existsSync(absolute)) {
      return reply.code(404).send({ error: "Not Found" });
    }
    const width = z.coerce
      .number()
      .int()
      .optional()
      .safeParse((req.query as { width?: string }).width);
    const served = await resolveCreatorMediaVariant(absolute, width.success ? width.data : undefined);
    return reply
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .sendFile(basename(served), dirname(served));
  });

  app.post("/noodler/accounts/:id/avatar", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { media } = await readCreatorMultipart(req);
      const locked = await tryCreatorAccountOperation(id, async () => {
        const account = await noodle.getNoodlerAccountById(id);
        if (!account) return null;
        const staged = stageCreatorAvatar(id, media);
        try {
          staged.promote();
          const updated = await noodle.updateNoodlerAvatar(id, staged.avatarUrl);
          if (!updated) {
            staged.compensate();
            return null;
          }
          unlinkCreatorAvatar(id, account.avatarUrl);
          return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
        } catch (error) {
          staged.compensate();
          throw error;
        }
      });
      if (!locked.acquired)
        return reply.code(409).send({ error: "Another operation for this Slurp account is already running." });
      if (!locked.value) return reply.code(404).send({ error: "Slurp stage profile not found" });
      return locked.value;
    } catch (error) {
      return sendCreatorMediaError(reply, error);
    }
  });

  app.patch("/noodler/accounts/:id/avatar/source", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryCreatorAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      if (!account || (account.settings.privacy.identityDisclosure ?? "open") !== "open") return null;
      const source = await noodle.resolveAccountSource(account);
      if (!source?.avatarUrl) return false;
      const oldAvatarUrl = account.avatarUrl;
      const updated = await noodle.updateNoodlerAvatar(id, source.avatarUrl);
      if (updated) unlinkCreatorAvatar(id, oldAvatarUrl);
      return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
    });
    if (!locked.acquired)
      return reply.code(409).send({ error: "Another operation for this Slurp account is already running." });
    if (locked.value === false) return reply.code(409).send({ error: "The linked source does not have an avatar." });
    if (!locked.value) return reply.code(404).send({ error: "An Open Slurp stage profile was not found." });
    return locked.value;
  });

  app.delete("/noodler/accounts/:id/avatar", async (req, reply) => {
    const { id } = req.params as { id: string };
    const locked = await tryCreatorAccountOperation(id, async () => {
      const account = await noodle.getNoodlerAccountById(id);
      if (!account) return null;
      const updated = await noodle.updateNoodlerAvatar(id, null);
      if (updated) unlinkCreatorAvatar(id, account.avatarUrl);
      return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
    });
    if (!locked.acquired)
      return reply.code(409).send({ error: "Another operation for this Slurp account is already running." });
    if (!locked.value) return reply.code(404).send({ error: "Slurp stage profile not found" });
    return locked.value;
  });

  app.post("/noodler/accounts/:id/banner", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { media } = await readCreatorMultipart(req);
      const locked = await tryCreatorAccountOperation(id, async () => {
        const account = await noodle.getNoodlerAccountById(id);
        if (!account) return null;
        const staged = stageCreatorBanner(id, media);
        try {
          staged.promote();
          const updated = await noodle.updateNoodlerBanner(id, staged.bannerUrl);
          if (!updated) {
            staged.compensate();
            return null;
          }
          unlinkCreatorBanner(id, account.settings.profile.bannerUrl ?? null);
          return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id) ?? null;
        } catch (error) {
          staged.compensate();
          throw error;
        }
      });
      if (!locked.acquired)
        return reply.code(409).send({ error: "Another operation for this Creator is already running." });
      if (!locked.value) return reply.code(404).send({ error: "Creator profile not found" });
      return locked.value;
    } catch (error) {
      return sendCreatorMediaError(reply, error);
    }
  });

  app.post("/noodler/accounts/:id/artwork/generate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z
      .object({
        kind: z.enum(["avatar", "banner"]),
        guidance: z.string().max(2000).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await generateCreatorArtwork(app.db, {
      accountId: id,
      ...parsed.data,
    });
    if (result === "missing") return reply.code(404).send({ error: "Creator profile not found" });
    if (result === "busy") return reply.code(409).send({ error: "Another Creator operation is running." });
    if (result === "unavailable")
      return reply.code(400).send({ error: "No image generation connection is available." });
    return (await noodle.listNoodlerStageProfiles()).find((profile) => profile.id === id);
  });
}
