import { and, like, or } from "../../../db/file-query.js";
import { openSlurpGoal, readSlurpGoal, slurpGoalKey, SlurpGoal } from "../../modules/projects/slp-goal.js";
import {
  makeSlurpProject,
  readSlurpProjects,
  SLURP_PROJECT_CHAPTER_MAX_LENGTH,
  SLURP_PROJECT_DIRECTION_MAX_LENGTH,
  SLURP_PROJECT_MAX_CHAPTERS,
  SLURP_PROJECT_TITLE_MAX_LENGTH,
  SlurpArcEffectStat,
  slurpProjectRecord,
  slurpProjectsKey,
  SLURP_ARC_INTENSITIES,
  SLURP_PROJECT_STATUSES,
  SlurpArcIntensity,
  SlurpProject,
  SlurpProjectStatus,
} from "../../modules/projects/slp-project.js";
import {
  slurpArcChapterMood,
  slurpArcEffectMultiplier,
  slurpArcResolveProfile,
  slurpProjectDirect,
  SlurpArcDirectorAction,
} from "../../modules/projects/slp-arc-progress.js";
import {
  activeSlurpProjects,
  slurpProjectAdvance,
  slurpProjectChapter,
  slurpArcsWithoutFocus,
} from "../../modules/projects/slp-arc-progress.js";
import {
  slurpArcAutoKey,
  slurpArcConfigKey,
  readSlurpCreatorArcConfig,
  resolveSlurpArcConfig,
  SlurpCreatorArcConfig,
  SlurpResolvedArcConfig,
} from "../../modules/projects/slp-arc-library.js";
import { isSlurpCrossover } from "../../modules/projects/slp-project.js";
import {
  slurpCrossoverLeave,
  slurpCrossoverStart,
  slurpCrossoverView,
} from "../../modules/projects/slp-arc-crossover.js";
import { newId, now } from "../../../utils/id-generator.js";
import { addSlurpModifier } from "../../modules/creators/slp-creator-state.js";

import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export function createProjectsStorage1(context: SlurpStorageContext) {
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
    async getGoal(creatorAccountId: string): Promise<SlurpGoal | null> {
      return readSlurpGoal(await settingsStore.get(slurpGoalKey(creatorAccountId)));
    },
    /** Open or replace a Creator's tip goal. Passing a null label clears it. */
    async setGoal(creatorAccountId: string, label: string | null, target: number): Promise<SlurpGoal | null> {
      if (label === null) {
        await settingsStore.remove(slurpGoalKey(creatorAccountId));
        return null;
      }
      const earnings = await this.getEarnings(creatorAccountId);
      const goal = openSlurpGoal(label, target, earnings.lifetime, new Date());
      if (!goal) return null;
      await settingsStore.set(slurpGoalKey(creatorAccountId), JSON.stringify(goal));
      return goal;
    },
    /** This Creator's stored arc overrides. Missing fields use the global settings. */
    async getArcConfig(creatorAccountId: string): Promise<SlurpCreatorArcConfig> {
      return readSlurpCreatorArcConfig(await settingsStore.get(slurpArcConfigKey(creatorAccountId)));
    },
    /** Replace this Creator's overrides. An empty config is "Reset to global". */
    async setArcConfig(creatorAccountId: string, config: SlurpCreatorArcConfig): Promise<SlurpCreatorArcConfig> {
      const next = readSlurpCreatorArcConfig(config);
      if (Object.keys(next).length) await settingsStore.set(slurpArcConfigKey(creatorAccountId), JSON.stringify(next));
      else await settingsStore.remove(slurpArcConfigKey(creatorAccountId));
      return next;
    },
    async resolveArcConfig(creatorAccountId: string): Promise<SlurpResolvedArcConfig> {
      return resolveSlurpArcConfig(await this.getSettings(), await this.getArcConfig(creatorAccountId));
    },
    /** Every project this Creator has, newest first. Paused and complete ones are included. */
    async listProjects(creatorAccountId: string): Promise<SlurpProject[]> {
      const projects = await loadProjects(creatorAccountId);
      // The other participants by public display name, never the source character behind them.
      for (const project of projects.filter(isSlurpCrossover)) {
        const names: string[] = [];
        for (const id of project.creatorIds.filter((entry) => entry !== creatorAccountId)) {
          const account = await this.getNoodlerAccountById(id, { includeHidden: true });
          if (account) names.push(account.displayName);
        }
        project.partnerNames = names;
      }
      return projects;
    },
    /** Whether every Creator in the arc (or this Creator, for a single arc) is below `maxActive`. */
    async arcHasRoom(creatorAccountId: string, project?: SlurpProject | null): Promise<boolean> {
      for (const id of project && isSlurpCrossover(project) ? project.creatorIds : [creatorAccountId]) {
        if (activeSlurpProjects(await loadProjects(id)).length >= (await this.resolveArcConfig(id)).maxActive)
          return false;
      }
      return true;
    },
    /**
     * Take a deleted Creator out of every crossover. The record moves to the next participant when it
     * was stored with the deleted one; below two participants it becomes a normal arc of whoever is left.
     */
    async leaveCrossovers(creatorAccountId: string): Promise<void> {
      for (const project of (await loadProjects(creatorAccountId)).filter(isSlurpCrossover)) {
        const stored = readSlurpProjects(await settingsStore.get(slurpProjectsKey(project.creatorIds[0]!))).find(
          (entry) => entry.id === project.id,
        );
        if (!stored) continue;
        const left = slurpCrossoverLeave(stored, creatorAccountId);
        const newOwner = stored.creatorIds.find((id) => id !== creatorAccountId)!;
        for (const id of stored.creatorIds) {
          const entries = await readProjectEntries(id);
          const next =
            id === creatorAccountId
              ? entries.filter((entry) => !isProjectEntry(entry, project.id))
              : entries.map((entry) =>
                  !isProjectEntry(entry, project.id)
                    ? entry
                    : id === newOwner
                      ? left
                      : { crossoverOf: { ownerCreatorId: newOwner, projectId: project.id } },
                );
          await settingsStore.set(slurpProjectsKey(id), JSON.stringify(next));
        }
      }
    },
    /** The projects that may claim a post right now. */
    async listActiveProjects(creatorAccountId: string): Promise<SlurpProject[]> {
      return activeSlurpProjects(await this.listProjects(creatorAccountId));
    },
    async getProject(creatorAccountId: string, projectId: string): Promise<SlurpProject | null> {
      return (await this.listProjects(creatorAccountId)).find((project) => project.id === projectId) ?? null;
    },
    /**
     * Open a project.
     *
     * Refuses past the Creator's resolved `maxActive` rather than opening a fourth that would publish too
     * rarely to follow. Returns null on an unusable title, which is the one field it cannot invent.
     */
    async createProject(
      creatorAccountId: string,
      input: {
        title?: string;
        direction?: string;
        chapters?: string[];
        typeId?: string | null;
        durationDays?: number | null;
        intensity?: SlurpArcIntensity;
        /** Up to two more Creators for a crossover. The caller checks ownership. */
        crossoverWith?: string[];
      },
    ): Promise<SlurpProject | null> {
      const projects = await this.listProjects(creatorAccountId);
      const creatorIds = [...new Set([creatorAccountId, ...(input.crossoverWith ?? [])])];
      // A crossover counts against every participant's limit.
      for (const id of creatorIds) {
        if (activeSlurpProjects(await loadProjects(id)).length >= (await this.resolveArcConfig(id)).maxActive)
          return null;
      }
      const type = input.typeId
        ? ((await this.getSettings()).arcLibrary.find((entry) => entry.id === input.typeId) ?? null)
        : null;
      const made = makeSlurpProject(newId(), { ...input, type }, new Date());
      if (!made) return null;
      const project = slurpCrossoverStart(made, creatorIds);
      const rest = project.intensity === "focus" ? slurpArcsWithoutFocus(projects) : projects;
      await writeProjects(creatorAccountId, [project, ...rest]);
      for (const id of project.creatorIds.slice(1))
        await writeProjects(id, [slurpCrossoverView(project, id), ...(await loadProjects(id))]);
      return slurpCrossoverView(project, creatorAccountId);
    },
    /**
     * Edit a project.
     *
     * Only the fields the player owns. `posts` is not one of them: it counts what was published and
     * a hand-set value would make the Studio disagree with the feed.
     */
    async updateProject(
      creatorAccountId: string,
      projectId: string,
      patch: {
        title?: string;
        direction?: string;
        chapters?: string[];
        chapter?: number;
        status?: SlurpProjectStatus;
        intensity?: SlurpArcIntensity;
        durationDays?: number | null;
      },
    ): Promise<SlurpProject | null> {
      const projects = await this.listProjects(creatorAccountId);
      const index = projects.findIndex((project) => project.id === projectId);
      if (index < 0) return null;
      const current = projects[index]!;
      // Resuming a project that would make a fourth active one is refused for the same reason
      // opening one is: the rotation would starve all of them.
      if (
        patch.status === "active" &&
        current.status !== "active" &&
        !(await this.arcHasRoom(creatorAccountId, current))
      )
        return null;
      const chapters = patch.chapters
        ? patch.chapters
            .map((chapter) => chapter.trim().slice(0, SLURP_PROJECT_CHAPTER_MAX_LENGTH))
            .filter(Boolean)
            .slice(0, SLURP_PROJECT_MAX_CHAPTERS)
        : current.chapters;
      const title =
        patch.title === undefined ? current.title : patch.title.trim().slice(0, SLURP_PROJECT_TITLE_MAX_LENGTH);
      if (!title) return null;
      // Clamped here as well as on read, so a shortened chapter list cannot leave the pointer
      // past the end and strand the project one post short of finishing.
      const chapter = Math.min(
        Math.max(0, patch.chapter === undefined ? current.chapter : Math.floor(patch.chapter)),
        Math.max(0, chapters.length - 1),
      );
      const updatedAt = now();
      const edited: SlurpProject = {
        ...current,
        title,
        direction:
          patch.direction === undefined
            ? current.direction
            : patch.direction.trim().slice(0, SLURP_PROJECT_DIRECTION_MAX_LENGTH),
        chapters,
        chapter,
        durationDays: patch.durationDays === undefined ? current.durationDays : patch.durationDays,
        // Day ranges stay with the chapter at the same index; a chapter the player added has none.
        phaseDays: current.phaseDays.slice(0, chapters.length),
        reach: current.reach.slice(0, chapters.length),
        // A chapter set by hand starts its clock now, or it would time out on the next tick.
        chapterStartedAt: chapter === current.chapter ? current.chapterStartedAt : updatedAt,
        status: SLURP_PROJECT_STATUSES.includes(patch.status as SlurpProjectStatus)
          ? (patch.status as SlurpProjectStatus)
          : current.status,
        intensity: SLURP_ARC_INTENSITIES.includes(patch.intensity as SlurpArcIntensity)
          ? (patch.intensity as SlurpArcIntensity)
          : current.intensity,
        updatedAt,
      };
      const next = slurpProjectRecord(current, edited, new Date(updatedAt));
      const saved = next.intensity === "focus" ? slurpArcsWithoutFocus(projects) : projects;
      saved[index] = next;
      await writeProjects(creatorAccountId, saved);
      return next;
    },
    /**
     * Forget a project.
     *
     * Posts published into it keep their `projectId`. Deleting the thread must not delete the feed,
     * and a post that has already been read cannot be un-published by tidying the Studio.
     */
    async deleteProject(creatorAccountId: string, projectId: string): Promise<boolean> {
      const removed = (await loadProjects(creatorAccountId)).find((project) => project.id === projectId);
      if (!removed) return false;
      // A crossover is one arc: deleting it removes the record and every participant's reference.
      const ids = isSlurpCrossover(removed) ? removed.creatorIds : [creatorAccountId];
      for (const id of ids) {
        const entries = await readProjectEntries(id);
        await settingsStore.set(
          slurpProjectsKey(id),
          JSON.stringify(entries.filter((entry) => !isProjectEntry(entry, projectId))),
        );
      }
      // Dismissing an automatic suggestion restarts the cooldown, so the next one does not follow at once.
      if (removed.status === "suggested" && removed.origin === "auto")
        for (const id of ids) await settingsStore.set(slurpArcAutoKey(id), now());
      return true;
    },
    /**
     * Record that a post published into a project.
     *
     * Called after publication, never at generation: advancing on a draft would skip a chapter
     * every time a generation failed.
     */
    async advanceProject(creatorAccountId: string, projectId: string, postId?: string): Promise<SlurpProject | null> {
      const projects = await this.listProjects(creatorAccountId);
      const index = projects.findIndex((project) => project.id === projectId);
      if (index < 0) return null;
      const current = projects[index]!;
      const at = new Date();
      // The first published post that carries a poll opens the chapter's choice.
      // ponytail: two posts prepared before the first publishes both carry the poll; only the first one's votes count.
      const pollPost =
        postId && current.choices[current.chapter] && !current.pollPostId
          ? await this.getNoodlerPostById(postId)
          : null;
      const poll = pollPost?.metadata.poll
        ? { postId: pollPost.id, hours: (await this.getSettings()).arcPollHours }
        : undefined;
      // The twist was used by this post, so it is cleared here, at publication.
      // ponytail: posts prepared before this one publishes also carry the twist; clear at prepare time if that shows.
      const { pace } = await this.resolveArcConfig(creatorAccountId);
      const next = slurpProjectRecord(
        current,
        { ...slurpProjectAdvance(current, at, pace, poll), twist: "" },
        at,
        postId,
        creatorAccountId,
      );
      projects[index] = next;
      await writeProjects(creatorAccountId, projects, at);
      await this.recordArcChange(creatorAccountId, current, next);
      return next;
    },
    /**
     * One Director mode action. Null when it does not apply, or when resuming would pass `maxActive`.
     * The caller checks `arcDirectorMode`.
     */
    async directProject(
      creatorAccountId: string,
      projectId: string,
      action: SlurpArcDirectorAction,
      value?: string,
    ): Promise<SlurpProject | null> {
      const projects = await this.listProjects(creatorAccountId);
      const index = projects.findIndex((project) => project.id === projectId);
      if (index < 0) return null;
      const current = projects[index]!;
      if (action === "resume" && !(await this.arcHasRoom(creatorAccountId, current))) return null;
      const votes = action === "choose" ? await this.projectPollVotes(current) : [];
      const next = slurpProjectDirect(current, action, new Date(), value, Math.random, votes);
      if (!next) return null;
      projects[index] = next;
      await writeProjects(creatorAccountId, projects);
      await this.recordArcChange(creatorAccountId, current, next);
      return next;
    },
    /** The running arcs' multiplier for one stat, under `arcStatEffects`. */
    async arcEffectMultiplier(creatorAccountId: string, stat: SlurpArcEffectStat): Promise<number> {
      return slurpArcEffectMultiplier(
        await this.listProjects(creatorAccountId),
        stat,
        (await this.getSettings()).arcStatEffects,
      );
    },
    /**
     * Apply or reject an arc's pending profile change. Apply writes through the ordinary profile
     * update and keeps the replaced values for a revert. Null when nothing is pending.
     */
    async resolveArcProfile(creatorAccountId: string, projectId: string, apply: boolean): Promise<SlurpProject | null> {
      const projects = await this.listProjects(creatorAccountId);
      const index = projects.findIndex((project) => project.id === projectId);
      const creator = index < 0 ? null : await this.getNoodlerAccountById(creatorAccountId);
      if (!creator) return null;
      const resolved = slurpArcResolveProfile(projects[index]!, apply, {
        bio: creator.bio ?? "",
        location: creator.settings.profile.location ?? "",
      });
      if (!resolved) return null;
      if (resolved.write)
        await this.updateAccountProfile(creatorAccountId, {
          ...(resolved.write.bio !== undefined ? { bio: resolved.write.bio } : {}),
          ...(resolved.write.location !== undefined ? { profile: { location: resolved.write.location } } : {}),
        });
      projects[index] = { ...resolved.project, updatedAt: now() };
      await writeProjects(creatorAccountId, projects);
      return projects[index]!;
    },
    /**
     * Tell the player an arc moved on or finished. An open-ended arc that only counted a post is
     * not news, so nothing is recorded for it.
     */
    async recordArcChange(creatorAccountId: string, before: SlurpProject, after: SlurpProject): Promise<void> {
      // A choice settled by this change: the fans hear what won.
      const poll =
        before.choices[before.chapter] && !after.choices[before.chapter]
          ? [...after.history].reverse().find((entry) => entry.poll)?.poll
          : undefined;
      const pollNote = poll ? `, fans chose: ${poll.winner}` : "";
      const label = `${after.chapters.length ? `${after.title} (${slurpProjectChapter(after)})` : after.title}${pollNote}`;
      // A chapter's mood arrives through the ordinary modifier list, so it expires like any other feeling.
      const mood =
        after.chapter !== before.chapter && after.status !== "complete"
          ? slurpArcChapterMood(after, (await this.getSettings()).arcAffectsMood)
          : null;
      // A crossover moves every participant: mood and events reach each of them.
      for (const id of isSlurpCrossover(after) ? after.creatorIds : [creatorAccountId]) {
        if (mood) await mutateCreatorStateNow(id, (state) => addSlurpModifier(state, mood, after.title));
        if (after.status === "complete" && before.status !== "complete") {
          await this.recordCreatorEvent(id, "arc_complete", {
            actorLabel: `${after.title}${pollNote}`,
            subjectId: after.id,
          });
        } else if (after.chapter !== before.chapter) {
          await this.recordCreatorEvent(id, "arc_phase", { actorLabel: label, subjectId: after.id });
        }
      }
    },
  } satisfies ThisType<Record<string, any>>;
  return storage;
}
