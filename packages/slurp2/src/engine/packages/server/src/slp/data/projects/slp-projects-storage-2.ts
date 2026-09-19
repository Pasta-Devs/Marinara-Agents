import { and, or } from "../../../db/file-query.js";
import { createSlpPoll } from "../../../../../shared/src/slp/slp-polls.js";
import {
  makeSlurpProject,
  slurpCollabPartners,
  slurpProjectRecord,
  SlurpProject,
} from "../../modules/projects/slp-project.js";
import {
  activeSlurpProjects,
  slurpArcFanVotes,
  slurpProjectChoose,
  slurpProjectPollDue,
  slurpProjectTick,
} from "../../modules/projects/slp-arc-progress.js";
import {
  slurpArcAutoKey,
  slurpAutoArcCount,
  resolveSlurpArcConfig,
  slurpAutoArcPick,
  slurpArcTypeFromProject,
  slurpGeneratedArcProject,
} from "../../modules/projects/slp-arc-library.js";
import { isSlurpCrossover } from "../../modules/projects/slp-project.js";
import {
  slurpCrossoverPartner,
  slurpCrossoverStart,
  slurpCrossoverView,
} from "../../modules/projects/slp-arc-crossover.js";
import { newId, now } from "../../../utils/id-generator.js";
import { isSlurpViewerActorAccount } from "../../modules/settings/slp-settings.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createProjectsStorage2(context: SlurpStorageContext) {
  const {
    db,
    settingsStore,
    characters,
    readProjectEntries,
    isProjectEntry,
    loadProjects,
    writeProjects,
    readCreatorPrices,
    economyFrom,
    compensate,
    writeWallet,
    restoreSetting,
    restoreWallet,
    enqueueFinancial,
    writeEarnings,
    mutateCreatorStateNow,
    creditEarningsNow,
    getWalletNow,
    pruneFinishedRefreshRuns,
    reconcilePublicHandles,
    insertInteraction,
    normalizeLegacyNoodlerToggleInteraction,
    upsertPollVote,
    deleteInteractionChildren,
    deleteStoredInteraction,
  } = context;
  const storage = {
    /**
     * Votes per option for the arc's open choice: real votes on its poll post (the player's and
     * generated accounts'), plus seeded simulated fan votes while `arcFanReactions` is on. No poll
     * post means no votes at all, so the pick is left to chance.
     */
    async projectPollVotes(project: SlurpProject): Promise<number[]> {
      const choice = project.choices[project.chapter];
      if (!choice || !project.pollPostId) return [];
      const counts = (await this.getSettings()).arcFanReactions
        ? slurpArcFanVotes(project, choice.options.length)
        : choice.options.map(() => 0);
      for (const interaction of await this.listNoodlerInteractions([project.pollPostId])) {
        if (interaction.type !== "vote") continue;
        // Poll option ids are `option-1`… in option order (createSlpPoll).
        const index = Number(/^option-(\d+)$/.exec(interaction.content ?? "")?.[1]) - 1;
        if (index >= 0 && index < counts.length) counts[index]! += 1;
      }
      return counts;
    },
    /**
     * Move on every arc whose chapter has run out of time. Returns the arcs that moved, so the world
     * tick can tell the player about them. Writes nothing when nothing moved.
     */
    async tickProjects(creatorAccountId: string, at = new Date()): Promise<SlurpProject[]> {
      const projects = await this.listProjects(creatorAccountId);
      const { pace } = await this.resolveArcConfig(creatorAccountId);
      const ticked: SlurpProject[] = [];
      for (const project of projects) {
        // A crossover ticks once, in the list that stores it.
        if (isSlurpCrossover(project) && project.creatorIds[0] !== creatorAccountId) {
          ticked.push(project);
          continue;
        }
        if (slurpProjectPollDue(project, at, pace)) {
          ticked.push(slurpProjectChoose(project, at, await this.projectPollVotes(project)) ?? project);
          continue;
        }
        const next = slurpProjectTick(project, at, pace);
        ticked.push(next === project ? project : slurpProjectRecord(project, next, at));
      }
      const moved = ticked.filter((project, index) => project !== projects[index]);
      if (moved.length) await writeProjects(creatorAccountId, ticked, at);
      for (const [index, project] of ticked.entries()) {
        if (project !== projects[index]) await this.recordArcChange(creatorAccountId, projects[index]!, project);
      }
      return moved;
    },
    /**
     * Start or suggest an automatic arc for a Creator with none running, when the settings allow it
     * and the cooldown has passed. The cooldown starts at the suggestion, so dismissing one does not
     * bring the next one sooner.
     */
    async rollAutoArc(
      creatorAccountId: string,
      at = new Date(),
      /** Asks the model for an arc; resolves the raw JSON or null. Without it, generated picks start nothing. */
      generate?: (creatorAccountId: string, partnerIds: string[]) => Promise<unknown>,
    ): Promise<SlurpProject | null> {
      const settings = await this.getSettings();
      const config = resolveSlurpArcConfig(settings, await this.getArcConfig(creatorAccountId));
      if (config.autoMode === "off") return null;
      const creator = await this.getNoodlerAccountById(creatorAccountId, { includeHidden: true });
      const roll = async () => {
        const projects = await this.listProjects(creatorAccountId);
        // ponytail: reads every Creator's projects per roll (O(n²) per maintenance tick); pass the count in from the world tick if Creator counts grow large.
        let concurrentAuto = 0;
        for (const account of await this.listNoodlerAccounts({ includeHidden: true })) {
          concurrentAuto += slurpAutoArcCount(await loadProjects(account.id), account.id);
        }
        const pick = slurpAutoArcPick({
          creatorAccountId,
          at,
          projects,
          library: settings.arcLibrary,
          creatorTags: creator?.settings.profile.tags ?? [],
          lastAutoAt: await settingsStore.get(slurpArcAutoKey(creatorAccountId)),
          cooldownWeeks: config.cooldownWeeks,
          allowedTypeIds: config.allowedTypeIds,
          createdAt: creator?.createdAt ?? null,
          concurrentAuto,
          maxConcurrentAuto: settings.arcMaxConcurrentAuto,
          source: config.source,
        });
        return { pick, projects };
      };
      let { pick, projects } = await roll();
      if (!pick) return null;
      const partnerId = creator && config.crossovers ? await this.autoCrossoverPartner(creator, at) : null;
      const status = config.autoMode === "suggest" ? "suggested" : "active";
      let project: SlurpProject | null;
      if ("type" in pick) {
        project = makeSlurpProject(newId(), { type: pick.type, origin: "auto" }, at);
        if (project) project = { ...project, status };
      } else {
        if (!generate) return null;
        // The model call runs with nothing held; the roll is checked again before anything is written,
        // so another arc started meanwhile still counts against the cap and the cooldown.
        const raw = await generate(creatorAccountId, partnerId ? [partnerId] : []).catch(() => null);
        project = slurpGeneratedArcProject(newId(), raw, at, { origin: "auto", status });
        if (!project) return null;
        ({ pick, projects } = await roll());
        if (!pick) return null;
      }
      if (!project) return null;
      project = slurpCrossoverStart(project, partnerId ? [creatorAccountId, partnerId] : []);
      await writeProjects(creatorAccountId, [project, ...projects], at);
      if (partnerId)
        await writeProjects(
          partnerId,
          [slurpCrossoverView(project, partnerId), ...(await loadProjects(partnerId))],
          at,
        );
      // The cooldown starts for every participant.
      for (const id of isSlurpCrossover(project) ? project.creatorIds : [creatorAccountId]) {
        await settingsStore.set(slurpArcAutoKey(id), at.toISOString());
        await this.recordCreatorEvent(id, "arc_started", {
          actorLabel: project.title,
          subjectId: project.id,
        });
      }
      return slurpCrossoverView(project, creatorAccountId);
    },
    /**
     * A partner for an automatic crossover, or null. Only a Creator of the same owner, with an open
     * identity and nobody hidden from, whose own arc rules would allow an automatic arc right now. A
     * protected-identity Creator is never paired automatically: the other profile would reveal it.
     */
    async autoCrossoverPartner(
      creator: NonNullable<Awaited<ReturnType<typeof this.getNoodlerAccountById>>>,
      at: Date,
    ): Promise<string | null> {
      const open = (account: typeof creator) =>
        (account.settings.privacy.identityDisclosure ?? "open") === "open" &&
        account.settings.privacy.access.hiddenFromAccountIds.length === 0;
      if (!open(creator)) return null;
      const sameOwner = (account: typeof creator) =>
        (account.sourceKind === "persona") === (creator.sourceKind === "persona") &&
        (creator.sourceKind !== "persona" || account.sourceEntityId === creator.sourceEntityId);
      const ties = [
        ...(await this.listSubscriptionsForViewer(creator.id)),
        ...(await this.listSubscriptionsForCreator(creator.id)),
      ];
      const candidates = [];
      for (const account of await this.listNoodlerAccounts()) {
        if (account.id === creator.id || isSlurpViewerActorAccount(account)) continue;
        const config = await this.resolveArcConfig(account.id);
        const cooldown = Math.max(1, config.cooldownWeeks) * 7 * 86_400_000;
        const last = Date.parse((await settingsStore.get(slurpArcAutoKey(account.id))) ?? "");
        const created = Date.parse(account.createdAt ?? "");
        candidates.push({
          id: account.id,
          tags: account.settings.profile.tags ?? [],
          related: ties.some((tie) => tie.viewerAccountId === account.id || tie.creatorAccountId === account.id),
          eligible:
            config.autoMode !== "off" &&
            config.crossovers &&
            open(account) &&
            sameOwner(account) &&
            !(at.getTime() - last < cooldown) &&
            !(at.getTime() - created < cooldown) &&
            activeSlurpProjects(await loadProjects(account.id)).length < config.maxActive,
        });
      }
      return slurpCrossoverPartner({
        creatorAccountId: creator.id,
        collabIds: slurpCollabPartners((await this.getSettings()).creatorCollabs, creator.id).map(
          (entry) => entry.partnerId,
        ),
        at,
        creatorTags: creator.settings.profile.tags ?? [],
        candidates,
      });
    },
    /** Store a model-invented arc the player asked for. It waits as a suggestion until accepted. */
    async addGeneratedProject(creatorAccountId: string, raw: unknown): Promise<SlurpProject | null> {
      const project = slurpGeneratedArcProject(newId(), raw, new Date(), { origin: "manual", status: "suggested" });
      if (!project) return null;
      const projects = await this.listProjects(creatorAccountId);
      await writeProjects(creatorAccountId, [project, ...projects]);
      return project;
    },
    /** Copy an arc into the library as a custom type. */
    async saveProjectToLibrary(creatorAccountId: string, projectId: string) {
      const project = await this.getProject(creatorAccountId, projectId);
      if (!project) return null;
      const type = slurpArcTypeFromProject(project, `custom-${newId()}`);
      const settings = await this.updateSettings({ arcLibrary: [...(await this.getSettings()).arcLibrary, type] });
      return settings.arcLibrary.find((entry) => entry.id === type.id) ?? null;
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
