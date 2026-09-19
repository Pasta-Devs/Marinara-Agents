import { z } from "zod";
import {
  SLURP_GOAL_LABEL_MAX_LENGTH,
  SLURP_GOAL_MIN_TARGET,
  SLURP_GOAL_MAX_TARGET,
  slurpGoalProgress,
} from "../../modules/projects/slp-goal.js";
import {
  SLURP_PROJECT_CHAPTER_MAX_LENGTH,
  SLURP_PROJECT_MAX_CHAPTERS,
  SLURP_PROJECT_TITLE_MAX_LENGTH,
  SLURP_PROJECT_DIRECTION_MAX_LENGTH,
  SLURP_ARC_INTENSITIES,
  SLURP_PROJECT_STATUSES,
  SLURP_ARC_PACES,
  SLURP_PROJECT_MAX_ACTIVE,
} from "../../modules/projects/slp-project.js";
import { SLURP_ARC_DIRECTOR_ACTIONS } from "../../modules/projects/slp-arc-progress.js";
import { SLURP_ARC_TWIST_MAX_LENGTH } from "../../modules/projects/slp-project.js";
import {
  SLURP_ARC_AUTO_MODES,
  SLURP_ARC_SOURCES,
  slurpGeneratedArcProject,
  slurpArcTypeFromProject,
} from "../../modules/projects/slp-arc-library.js";
import { slurpCrossoverForViewer } from "../../modules/projects/slp-arc-crossover.js";
import { isSlurpViewerActorAccount } from "../../modules/settings/slp-settings.js";
import { isNoodlerHiddenFromViewer } from "../../base/identity/slp-access.js";
import { generateSlurpArc, SlurpArcGenerationFailure } from "./slp-arc-generation-service.js";
import { isConnectionAdmissionFailure } from "../../../services/generation/connection-admission.js";
import type { FastifyInstance } from "fastify";
import type { SlpRouteDeps } from "../viewer/slp-viewer-contract.js";

export async function slpProjectsRoutes(app: FastifyInstance, deps: SlpRouteDeps) {
  const { creatorBelongsToViewer, noodle, resolveViewerPersona } = deps;
  app.post("/arc-library/:id/reset", async (req, reply) => {
    const settings = await noodle.resetArcType((req.params as { id: string }).id);
    return settings ?? reply.code(404).send({ error: "Not a built-in arc type." });
  });

  /**
   * The Creator home: one answer to "how am I doing", per Creator this persona operates.
   *
   * A review found the world had cause and effect the player could never see. Reach moved, posts
   * performed differently, and nothing surfaced why. This is the legibility surface: every number
   * the world produces becomes visible and attributable here.
   *
   * Deltas need a mark to measure from, so the first read stores a snapshot and reports no change.
   * That is correct rather than a special case: nothing has happened since a visit that never
   * happened.
   */
  /**
   * Open, replace, or clear a Creator's tip goal.
   *
   * A milestone is a target the player aims at. A tip goal is one they show the audience, which is
   * what gives anyone a reason to tip. Only the operating persona may set it.
   */
  app.put("/noodler/accounts/:id/goal", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        label: z.string().trim().max(SLURP_GOAL_LABEL_MAX_LENGTH).nullable(),
        target: z.number().int().min(SLURP_GOAL_MIN_TARGET).max(SLURP_GOAL_MAX_TARGET).default(SLURP_GOAL_MIN_TARGET),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const goal = await noodle.setGoal(creator.id, parsed.data.label, parsed.data.target);
    if (parsed.data.label !== null && !goal) {
      return reply.code(400).send({ error: "A goal needs a label and a target." });
    }
    const earnings = await noodle.getEarnings(creator.id);
    return { goal: goal ? slurpGoalProgress(goal, earnings.lifetime) : null };
  });

  /**
   * A Creator's projects.
   *
   * Player-managed, all of them. A project is production notes — what this thread is about, what is
   * coming next — and the opposite of a tip goal, which exists to be shown. Nothing here reaches
   * the audience except the posts it produces.
   */
  app.get("/noodler/accounts/:id/projects", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    return { projects: await noodle.listProjects(creator.id) };
  });

  const projectChapters = z
    .array(z.string().trim().max(SLURP_PROJECT_CHAPTER_MAX_LENGTH))
    .max(SLURP_PROJECT_MAX_CHAPTERS);

  /** Open a project. Refused past the active limit rather than opening one that would never post. */
  app.post("/noodler/accounts/:id/projects", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        // Optional for a library type, which brings its own title.
        title: z.string().trim().max(SLURP_PROJECT_TITLE_MAX_LENGTH).default(""),
        direction: z.string().trim().max(SLURP_PROJECT_DIRECTION_MAX_LENGTH).default(""),
        chapters: projectChapters.default([]),
        typeId: z.string().trim().min(1).max(128).nullable().default(null),
        durationDays: z.number().int().min(1).max(365).nullable().optional(),
        intensity: z.enum(SLURP_ARC_INTENSITIES).default("background"),
        // A crossover: up to two more of the player's own Creators.
        crossoverWith: z.array(z.string().trim().min(1).max(128)).max(2).default([]),
      })
      .refine((body) => body.title.length > 0 || body.typeId !== null, {
        message: "A custom arc needs a title.",
        path: ["title"],
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id } = req.params as { id: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    if (
      parsed.data.typeId &&
      !parsed.data.title &&
      !(await noodle.getSettings()).arcLibrary.some((type) => type.id === parsed.data.typeId)
    ) {
      return reply.code(400).send({ error: "Unknown arc type. Pick a type from the library or give the arc a title." });
    }
    for (const partnerId of parsed.data.crossoverWith) {
      const partner = await noodle.getNoodlerAccountById(partnerId);
      if (partnerId === creator.id || !partner) {
        return reply.code(403).send({ error: "A crossover partner must be a different, existing Creator." });
      }
    }
    const project = await noodle.createProject(creator.id, {
      title: parsed.data.title,
      direction: parsed.data.direction,
      chapters: parsed.data.chapters,
      typeId: parsed.data.typeId,
      durationDays: parsed.data.durationDays,
      intensity: parsed.data.intensity,
      crossoverWith: parsed.data.crossoverWith,
    });
    if (!project) {
      const { maxActive } = await noodle.resolveArcConfig(creator.id);
      return reply
        .code(409)
        .send({ error: `This Creator can run ${maxActive} projects at once. Pause or finish one first.` });
    }
    return { project };
  });

  /**
   * Edit a project.
   *
   * Posts already published into it keep the chapter they were written for. A feed that rewrote
   * its own history every time the plan changed would be worse than one with no plan.
   */
  app.patch("/noodler/accounts/:id/projects/:projectId", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        title: z.string().trim().min(1).max(SLURP_PROJECT_TITLE_MAX_LENGTH).optional(),
        direction: z.string().trim().max(SLURP_PROJECT_DIRECTION_MAX_LENGTH).optional(),
        chapters: projectChapters.optional(),
        chapter: z.number().int().min(0).optional(),
        status: z.enum(SLURP_PROJECT_STATUSES).optional(),
        intensity: z.enum(SLURP_ARC_INTENSITIES).optional(),
        durationDays: z.number().int().min(1).max(365).nullable().optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id, projectId } = req.params as { id: string; projectId: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const existing = await noodle.getProject(creator.id, projectId);
    if (!existing) return reply.code(404).send({ error: "Project not found" });
    const project = await noodle.updateProject(creator.id, projectId, {
      title: parsed.data.title,
      direction: parsed.data.direction,
      chapters: parsed.data.chapters,
      chapter: parsed.data.chapter,
      status: parsed.data.status,
      intensity: parsed.data.intensity,
      durationDays: parsed.data.durationDays,
    });
    if (!project) {
      const { maxActive } = await noodle.resolveArcConfig(creator.id);
      return reply
        .code(409)
        .send({ error: `This Creator can run ${maxActive} projects at once. Pause or finish one first.` });
    }
    return { project };
  });

  /**
   * One Director mode action on an arc. Refused with 403 while `arcDirectorMode` is off, so the
   * arcs run by themselves unless the player turned directing on.
   */
  app.post("/noodler/accounts/:id/projects/:projectId/director", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        action: z.enum(SLURP_ARC_DIRECTOR_ACTIONS),
        value: z.string().trim().max(Math.max(SLURP_ARC_TWIST_MAX_LENGTH, SLURP_PROJECT_CHAPTER_MAX_LENGTH)).optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    if (!(await noodle.getSettings()).arcDirectorMode) {
      return reply.code(403).send({ error: "Turn on Director mode in Settings → Arcs to direct arcs." });
    }
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id, projectId } = req.params as { id: string; projectId: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    if (!(await noodle.getProject(creator.id, projectId))) {
      return reply.code(404).send({ error: "Project not found" });
    }
    const project = await noodle.directProject(creator.id, projectId, parsed.data.action, parsed.data.value);
    if (!project) return reply.code(409).send({ error: "That action does not apply to this arc right now." });
    return { project };
  });

  /**
   * Apply or reject an arc's pending profile change. Owner-only, and not a Director action: a
   * proposal always waits for the player, whether or not Director mode is on.
   */
  app.post("/noodler/accounts/:id/projects/:projectId/profile", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1), apply: z.boolean() }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id, projectId } = req.params as { id: string; projectId: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const project = await noodle.resolveArcProfile(creator.id, projectId, parsed.data.apply);
    if (!project) return reply.code(409).send({ error: "This arc has no profile change waiting." });
    return { project };
  });

  /**
   * The arc timeline for a profile. Unlike `/projects`, any viewer may read it, but only the story
   * parts: title, tone, chapters, history. Never the direction, the twist, or suggestions. A Creator
   * hidden from the viewer shows nothing, and a Creator with a protected identity shows arcs to the
   * owner only, because arc text is typed by the player and is not passed through disclosure.
   */
  app.get("/noodler/accounts/:id/arcs", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await noodle.getNoodlerAccountById((req.params as { id: string }).id);
    if (!creator || isSlurpViewerActorAccount(creator)) return { arcs: [] };
    const owner = creatorBelongsToViewer(creator, viewer);
    if (
      !owner &&
      (isNoodlerHiddenFromViewer(creator, viewer.id) ||
        (creator.settings.privacy.identityDisclosure ?? "open") !== "open")
    )
      return { arcs: [] };
    const projects = await noodle.listProjects(creator.id);
    // Crossover participants go through the same rules one by one: a participant hidden from this
    // viewer, or with a protected identity, is left out, and so are the posts they published.
    const participants = new Map<string, NonNullable<typeof creator>>();
    for (const id of new Set(projects.flatMap((project) => project.creatorIds))) {
      const account = await noodle.getNoodlerAccountById(id);
      if (account) participants.set(id, account);
    }
    const visible = (id: string) => {
      const account = participants.get(id);
      return Boolean(
        account &&
        (creatorBelongsToViewer(account, viewer) ||
          (!isNoodlerHiddenFromViewer(account, viewer.id) &&
            (account.settings.privacy.identityDisclosure ?? "open") === "open")),
      );
    };
    return {
      arcs: projects
        .filter((project) => project.status !== "suggested")
        .map((project) => {
          const { id, title, tone, chapters, chapter, status, startedAt, completedAt, choices, pollClosesAt } = project;
          const crossover = slurpCrossoverForViewer(project, creator.id, visible);
          return {
            id,
            title,
            tone,
            chapters,
            chapter,
            status,
            startedAt,
            completedAt,
            history: crossover.history,
            partners: crossover.partnerIds.map((partnerId) => {
              const account = participants.get(partnerId)!;
              return {
                id: account.id,
                handle: account.handle,
                displayName: account.displayName,
                avatarUrl: account.avatarUrl,
              };
            }),
            // Only the open question, not the branches it would add.
            openChoice: choices[chapter] ? { question: choices[chapter]!.question, closesAt: pollClosesAt } : null,
          };
        }),
    };
  });

  /** A Creator's arc overrides. Owner-only, like the projects they shape. */
  app.get("/noodler/accounts/:id/arc-config", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await noodle.getNoodlerAccountById((req.params as { id: string }).id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    return { config: await noodle.getArcConfig(creator.id) };
  });

  /** Replace a Creator's arc overrides. A field left out uses the global setting; `{}` resets all. */
  app.put("/noodler/accounts/:id/arc-config", async (req, reply) => {
    const parsed = z
      .object({
        personaId: z.string().trim().min(1),
        autoMode: z.enum(SLURP_ARC_AUTO_MODES).optional(),
        source: z.enum(SLURP_ARC_SOURCES).optional(),
        cooldownWeeks: z.number().int().min(1).max(8).optional(),
        pace: z.enum(SLURP_ARC_PACES).optional(),
        allowedTypeIds: z.array(z.string().trim().min(1).max(128)).max(200).optional(),
        maxActive: z.number().int().min(1).max(SLURP_PROJECT_MAX_ACTIVE).optional(),
        crossovers: z.boolean().optional(),
      })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await noodle.getNoodlerAccountById((req.params as { id: string }).id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const { personaId: _personaId, ...config } = parsed.data;
    return { config: await noodle.setArcConfig(creator.id, config) };
  });

  /** Forget a project. Its posts stay published and keep pointing at it. */
  app.delete("/noodler/accounts/:id/projects/:projectId", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id, projectId } = req.params as { id: string; projectId: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    if (!(await noodle.deleteProject(creator.id, projectId))) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return { deleted: true };
  });

  /** Ask the model for an arc for this Creator. It is stored as a suggestion for the player to review. */
  app.post("/noodler/accounts/:id/projects/generate", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await noodle.getNoodlerAccountById((req.params as { id: string }).id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    let raw: Record<string, unknown> | null;
    try {
      raw = await generateSlurpArc(app.db, creator.id, [], "", { kind: "foreground" });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: "Generation already in progress" });
      if (error instanceof SlurpArcGenerationFailure)
        return reply.code(502).send({ error: error.message, debug: { rawResponse: error.rawResponse } });
      throw error;
    }
    const project = await noodle.addGeneratedProject(creator.id, raw);
    if (!project) return reply.code(502).send({ error: "The model did not return a usable arc. Try again." });
    return { project };
  });

  /** Generate an unsaved Arc Library draft from a player brief. */
  app.post("/noodler/accounts/:id/arc-library/generate", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), brief: z.string().trim().min(1).max(2_000) })
      .safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const creator = await noodle.getNoodlerAccountById((req.params as { id: string }).id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    let raw: Record<string, unknown> | null;
    try {
      raw = await generateSlurpArc(app.db, creator.id, [], parsed.data.brief, { kind: "foreground" });
    } catch (error) {
      if (isConnectionAdmissionFailure(error)) return reply.code(409).send({ error: "Generation already in progress" });
      if (error instanceof SlurpArcGenerationFailure)
        return reply.code(502).send({ error: error.message, debug: { rawResponse: error.rawResponse } });
      throw error;
    }
    const draftId = `draft-${Date.now().toString(36)}`;
    const project = raw
      ? slurpGeneratedArcProject(draftId, raw, new Date(), { origin: "manual", status: "suggested" })
      : null;
    if (!project) return reply.code(502).send({ error: "The model did not return a usable arc. Try again." });
    return { type: slurpArcTypeFromProject(project, draftId) };
  });

  /** Copy an arc into the arc library as a custom type. */
  app.post("/noodler/accounts/:id/projects/:projectId/library", async (req, reply) => {
    const parsed = z.object({ personaId: z.string().trim().min(1) }).safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id, projectId } = req.params as { id: string; projectId: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    const type = await noodle.saveProjectToLibrary(creator.id, projectId);
    if (!type) return reply.code(404).send({ error: "Project not found" });
    return { type };
  });

  /** One project's own posts, so the Studio can show the thread rather than the whole page. */
  app.get("/noodler/accounts/:id/projects/:projectId/posts", async (req, reply) => {
    const parsed = z
      .object({ personaId: z.string().trim().min(1), limit: z.coerce.number().int().min(1).max(50).default(20) })
      .safeParse(req.query ?? {});
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const viewer = await resolveViewerPersona(parsed.data.personaId);
    if (!viewer) return reply.code(404).send({ error: "Slurp persona not found" });
    const { id, projectId } = req.params as { id: string; projectId: string };
    const creator = await noodle.getNoodlerAccountById(id);
    if (!creator) return reply.code(404).send({ error: "Creator account not found" });
    if (!(await noodle.getProject(creator.id, projectId))) {
      return reply.code(404).send({ error: "Project not found" });
    }
    return { posts: await noodle.listPostsByProject(projectId, parsed.data.limit) };
  });
}
