const forgeEventText = (value, max = 2000) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const forgeEventCount = (value) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(value)))) : 0;
export const forgeSeasonalEventDays = 21;
export function forgeSeasonalEnabled(run) {
  return run?.story?.seasonalEvents === true;
}
export function forgeSeasonalChapter(value) {
  return typeof value === "string" && /^event-[1-9]\d{0,8}$/u.test(value);
}
// A finished event's fights also open on Hard, then Very Hard (1.27.0), as a main chapter's do; anything else asked
// for is Normal, as main reads it.
const forgeSeasonalDifficulty = (value) => (value === "hard" || value === "veryhard" ? value : "normal");
// How far an event is played on one difficulty: {normal, hard, veryhard}, like a main chapter's. A save from before
// 1.27.0 holds only normal, so Hard and Very Hard read 0.
export function forgeSeasonalProgress(session, chapter, difficulty = "normal") {
  return forgeEventCount(session?.progress?.[chapter]?.[difficulty]);
}
export function forgeValidateSeasonalReward(reward) {
  const limits = { funds: 20000, aether: 800, xp: 12, character: 1, outfit: 1 };
  if (
    !reward ||
    !Object.hasOwn(limits, reward.kind) ||
    !Number.isInteger(reward.qty) ||
    reward.qty < 1 ||
    reward.qty > limits[reward.kind] ||
    !Number.isInteger(reward.nodeIndex) ||
    reward.nodeIndex < 0 ||
    reward.nodeIndex > 9
  )
    return null;
  if (reward.kind === "xp" && reward.tier !== "core") return null;
  if (
    ["character", "outfit"].includes(reward.kind) &&
    (typeof reward.unitId !== "string" || reward.unitId.length > 300)
  )
    return null;
  return reward;
}

// Failed optional artwork uses the same advertised fallback on read and at claim time.
const forgePreparedSeasonalReward = (reward) =>
  forgeValidateSeasonalReward(reward)?.kind === "outfit" && !reward.outfit?.url
    ? { nodeIndex: reward.nodeIndex, kind: "aether", qty: 320 }
    : reward;

// A model chooses the brief and a bounded reward schedule, never storage keys or executable rules.
export function normalizeForgeSeasonalOverview(value, cast) {
  const title = forgeEventText(value?.title, 100),
    theme = forgeEventText(value?.theme, 1500),
    premise = forgeEventText(value?.premise, 2000);
  if (!title || !theme || !premise) return null;
  const known = new Map(cast.map((unit) => [unit.id, unit]));
  const ids = [...new Set(Array.isArray(value.cast) ? value.cast : [])].filter((id) => known.has(id)).slice(0, 4);
  if (!ids.length && cast.length) ids.push(...cast.slice(0, 3).map((unit) => unit.id));
  const guest = value.newCharacter;
  const newCharacter =
    guest && forgeEventText(guest.name, 80) && forgeEventText(guest.description, 1000)
      ? Object.fromEntries(
          ["name", "description", "personality", "backstory", "appearance"].map((key) => [
            key,
            forgeEventText(guest[key], key === "name" ? 80 : 2000),
          ]),
        )
      : null;
  const bounded = (number, min, max) => Math.max(min, Math.min(max, forgeEventCount(number) || min));
  return {
    title,
    theme,
    premise,
    cast: ids,
    newCharacter,
    bannerPrompt: forgeEventText(value.bannerPrompt, 2000) || theme,
    musicPrompt: forgeEventText(forgeEventText(value.musicPrompt, 1000) || theme, 1000),
    rewards: [
      { nodeIndex: 2, kind: "funds", qty: bounded(value.rewards?.funds, 5000, 20000) },
      { nodeIndex: 5, kind: "aether", qty: bounded(value.rewards?.aether, 160, 800) },
      { nodeIndex: 8, kind: "xp", tier: "core", qty: bounded(value.rewards?.insight, 3, 12) },
    ],
    special: ["character", "outfit", "resources"].includes(value.special) ? value.special : "character",
    outfitName: forgeEventText(value.outfitName, 80) || title,
    outfitPrompt: forgeEventText(value.outfitPrompt, 2000) || theme,
  };
}

export function forgeSeasonalOverviewMessages(run, cast, date) {
  return [
    {
      role: "system",
      content:
        "Design a substantial, self-contained seasonal story event for this world's current season. " +
        "It runs for 21 local calendar days, about once or twice each month. Invent an original festival, expedition, " +
        "celebration or crisis that belongs to this setting; a winter celebration can suit December, but do not force " +
        "Earth holidays into a world where they make no sense. Center two to four known characters and their authored " +
        "relationships. Optionally introduce ONE new character. Plan only the event's identity and rewards now: " +
        "do NOT write its scenes, chapter nodes, dialogue or a fixed placement in the main plot. The actual chapter " +
        "will be written when the player starts, against the then-current canon. It must have a complete confined " +
        "story with both narrative and battles, without resolving the main storyline. Never retcon authored canon. " +
        "Return JSON only: {title,theme,premise,cast:[existing unit IDs],newCharacter:null|{name,description,personality," +
        "backstory,appearance},bannerPrompt,musicPrompt,rewards:{funds:5000..20000,aether:160..800,insight:3..12}," +
        'special:"character"|"outfit"|"resources",outfitName,outfitPrompt}. ' +
        "special=character offers a server-selected existing four-star unit; outfit is a themed outfit for a known " +
        "character when image generation is enabled. Banner/outfit prompts and an original instrumental musical brief " +
        "are English; all player-facing writing follows the world's language. Music should have a distinctive motif, " +
        "specific instruments, harmonic/rhythmic nuance and a natural loop, leaving room for dialogue.",
    },
    {
      role: "user",
      content: JSON.stringify({ world: run.scenario, language: run.language || "English", localDate: date, cast }),
    },
  ];
}

export function createForgeSeasonalEvents({
  packageId,
  persistence,
  documents: guardedDocuments = persistence.documents,
  readRun,
  readSession,
  cast,
  addCalendarDays,
  localDate,
  generateOverview,
  generatePlan,
  prepareMedia,
  grantReward,
  allNodes,
  readBeat,
  choices,
  battle,
  replayBattle,
  spendVigor,
  onComplete,
  // The bundle's main-chapter unlock (cc): the highest difficulty open at or below the one asked for.
  clampDifficulty,
  // Pays a fight's first win on Hard or Very Hard as a main chapter's (the adapter's payFight).
  payFight,
  now = Date.now,
  log,
}) {
  const pending = new Map();
  const documents = guardedDocuments;
  const eventId = (runId, seq) => `${runId}:story-event:${seq}`;
  const sessionId = (runId) => `${runId}:session`;
  const planId = (runId, chapter) => `${runId}:chapter:${chapter}`;
  const indexExists = async (runId, store = documents) => {
    const index = await store.getById(packageId, "index");
    return Array.isArray(index?.data?.runs) && index.data.runs.some((run) => run?.runId === runId);
  };
  const serial = (key, work) => {
    const task = (pending.get(key) || Promise.resolve()).catch(() => {}).then(work);
    pending.set(key, task);
    return task.finally(() => {
      if (pending.get(key) === task) pending.delete(key);
    });
  };
  const save = async (store, doc, data) => {
    if (
      !(await store.update({
        id: doc.id,
        packageId,
        expectedRevision: doc.revision,
        name: doc.name,
        description: doc.description,
        data,
        updatedAt: new Date(now()).toISOString(),
      }))
    )
      throw new Error("story-event-write-conflict");
  };
  const rows = async (runId) =>
    (await documents.list(packageId, "story-event"))
      .filter((row) => row.id.startsWith(`${runId}:story-event:`) && Number.isSafeInteger(row.data?.seq))
      .sort((left, right) => right.data.seq - left.data.seq);
  const progress = (session, chapter) => forgeSeasonalProgress(session, chapter);
  const fights = (plan) => allNodes(plan).filter((node) => node.type === "combat");
  // Only a story in progress closes the window: a main chapter or a Character Story part with some, but not all, of
  // it played. One forged but not started yet does not; it waits behind the open event (guardMain).
  const frontier = async (runId, session, store = documents) => {
    const plans = (await store.list(packageId, "chapter-plan"))
      .filter((row) => row.id.startsWith(`${runId}:chapter:`))
      .map((row) => ({ chapter: Number(row.id.slice(`${runId}:chapter:`.length)), plan: row.data }))
      .filter((row) => Number.isInteger(row.chapter) && row.chapter >= 1)
      .sort((left, right) => left.chapter - right.chapter);
    let after = 0;
    for (const row of plans) {
      const played = progress(session, row.chapter);
      if (!played) continue;
      if (row.chapter !== after + 1 || played < allNodes(row.plan).length)
        return { after, ready: false, blockedBy: { kind: "chapter", chapter: row.chapter } };
      after = row.chapter;
    }
    for (const [unitId, entry] of Object.entries(session?.bondChapters || {}))
      for (const [key, value] of Object.entries(entry || {}))
        if (/^beats\d*$/u.test(key) && forgeEventCount(value) > 0 && forgeEventCount(value) < 3)
          return { after, ready: false, blockedBy: { kind: "character-story", unitId } };
    return after > 0 ? { after, ready: true } : { after, ready: false, blockedBy: { kind: "chapter", chapter: 1 } };
  };

  async function ensure(runId, retry = false) {
    return serial(`${runId}:overview`, async () => {
      const run = await readRun(runId);
      if (!run || !forgeSeasonalEnabled(run)) return null;
      let current = (await rows(runId))[0];
      if (!current || now() >= current.data.endsAt) {
        const seq = (current?.data.seq || 0) + 1;
        if (seq > 999999999) return null;
        const startedAt = now(),
          data = {
            seq,
            chapter: `event-${seq}`,
            startedAt,
            endsAt: addCalendarDays(startedAt, forgeSeasonalEventDays),
            state: "preparing",
          },
          at = new Date(startedAt).toISOString();
        // Reserve a single current window before provider work. Offline windows are not generated.
        current = await documents.create({
          id: eventId(runId, seq),
          packageId,
          kind: "story-event",
          name: "Story event",
          description: "Seasonal story event",
          data,
          createdAt: at,
          updatedAt: at,
        });
        if (!current) throw new Error("story-event-write-conflict");
      } else if (current.data.state !== "ready" && !retry) return current;
      if (current.data.state === "ready") return current;
      const units = await cast(runId, run),
        known = units.filter((unit) => unit.known !== false);
      try {
        const result = await generateOverview({
          runId,
          run,
          cast: known,
          messages: forgeSeasonalOverviewMessages(run, known, localDate(now())),
        });
        const brief = result?.ok && normalizeForgeSeasonalOverview(result.value, known);
        if (!brief) throw new Error(result?.error || "invalid-event-overview");
        if (!(await indexExists(runId)) || !forgeSeasonalEnabled(await readRun(runId))) return null;
        const fresh = await documents.getById(packageId, current.id);
        if (!fresh || now() >= fresh.data.endsAt) return fresh;
        const four = units.filter((unit) => Number(unit.rarity) === 4);
        const candidate = four[(brief.cast.length + fresh.data.seq) % Math.max(1, four.length)];
        const special =
          brief.special === "character" && candidate
            ? { nodeIndex: 9, kind: "character", unitId: candidate.id, qty: 1, name: candidate.name }
            : brief.special === "outfit" && units.some((unit) => brief.cast.includes(unit.id))
              ? {
                  nodeIndex: 9,
                  kind: "outfit",
                  unitId: brief.cast[0],
                  qty: 1,
                  name: brief.outfitName,
                  prompt: brief.outfitPrompt,
                }
              : { nodeIndex: 9, kind: "aether", qty: 320 };
        let data = { ...fresh.data, ...brief, rewards: [...brief.rewards, special], state: "ready" };
        await save(documents, fresh, data);
        // Media failures do not discard a valid event or trigger an automatic paid retry.
        try {
          const media = await prepareMedia({ runId, run, event: data, units });
          const latest = await documents.getById(packageId, current.id);
          if (latest && (await indexExists(runId))) {
            data = { ...latest.data, ...media };
            data.rewards = data.rewards.map(forgePreparedSeasonalReward);
            await save(documents, latest, data);
          }
        } catch (error) {
          log?.(error, "Story event media could not be prepared");
        }
        return await documents.getById(packageId, current.id);
      } catch (error) {
        const latest = await documents.getById(packageId, current.id);
        if (latest && (await indexExists(runId))) await save(documents, latest, { ...latest.data, state: "error" });
        log?.(error, "Story event preparation failed");
        return await documents.getById(packageId, current.id);
      }
    });
  }

  async function list(body) {
    const runId = forgeEventText(body?.runId, 200),
      run = await readRun(runId);
    if (!run) return { ok: false, error: "not-found" };
    await retireInactiveFight(runId);
    if (forgeSeasonalEnabled(run)) await ensure(runId, body?.retry === true);
    const session = await readSession(runId),
      boundary = await frontier(runId, session),
      events = [];
    // The card names what to finish first, so a closed window is never a mystery.
    if (boundary.blockedBy?.kind === "character-story")
      boundary.blockedBy.name = forgeEventText(
        (await documents.getById(packageId, boundary.blockedBy.unitId))?.data?.name,
        80,
      );
    for (const row of await rows(runId)) {
      const event = row.data,
        played = progress(session, event.chapter),
        live = now() < event.endsAt;
      if ((!live || !forgeSeasonalEnabled(run)) && !played) continue;
      events.push({
        ...event,
        rewards: event.rewards?.map(forgePreparedSeasonalReward),
        played,
        hard: forgeSeasonalProgress(session, event.chapter, "hard"),
        veryhard: forgeSeasonalProgress(session, event.chapter, "veryhard"),
        // Very Hard opens once every fight is won on Hard; a plan holds 3 to 6 of them.
        combats:
          played || event.opened
            ? fights((await documents.getById(packageId, planId(runId, event.chapter)))?.data).length
            : 0,
        live,
        canStart: live && forgeSeasonalEnabled(run) && boundary.ready,
        ...(boundary.ready ? {} : { blockedBy: boundary.blockedBy }),
        archived: !live,
      });
    }
    return {
      ok: true,
      serverNow: now(),
      enabled: forgeSeasonalEnabled(run),
      events,
      boundary,
      storyRevision: forgeEventCount(session?.storyRevision),
    };
  }

  async function selected(body, { live = false, store = documents } = {}) {
    const runId = forgeEventText(body?.runId, 200),
      chapter = body?.chapter;
    if (!runId || !forgeSeasonalChapter(chapter) || !(await indexExists(runId, store)))
      return { ok: false, error: "bad-request" };
    const doc = await store.getById(packageId, eventId(runId, Number(chapter.slice(6))));
    if (!doc || doc.data?.chapter !== chapter || doc.data.state !== "ready")
      return { ok: false, error: "event-not-ready" };
    if (live) {
      const index = await store.getById(packageId, "index"),
        run = index?.data?.runs?.find((entry) => entry.runId === runId);
      if (!forgeSeasonalEnabled(run)) return { ok: false, error: "events-off" };
    }
    const session = await store.getById(packageId, sessionId(runId)),
      data = structuredClone(session?.data || {}),
      played = progress(data, chapter);
    if (live && now() >= doc.data.endsAt) return { ok: false, error: "event-expired" };
    if (!live && now() >= doc.data.endsAt && !played) return { ok: false, error: "event-expired" };
    return { ok: true, runId, chapter, doc, event: doc.data, session, data, played };
  }

  // cachedOnly answers null for a plan not written yet, so only writing one waits on the world's generation queue
  // (forgeChoices.readOrGenerate, as main /chapter-plan): a played event's map opens while a scene is written elsewhere.
  async function plan(body, { cachedOnly = false } = {}) {
    return serial(`${body?.runId}:plan`, async () => {
      await retireInactiveFight(body?.runId);
      let target = await selected(body);
      if (!target.ok) return target;
      const { runId, chapter } = target;
      const cached = await documents.getById(packageId, planId(runId, chapter));
      if (cached)
        return { ok: true, plan: cached.data, progress: target.data.progress, event: target.event, cached: true };
      if (cachedOnly) return null;
      target = await selected(body, { live: true });
      if (!target.ok) return target;
      const run = await readRun(runId);
      if (!forgeSeasonalEnabled(run)) return { ok: false, error: "events-off" };
      const boundary = await frontier(runId, target.data);
      if (!boundary.ready) return { ok: false, error: "event-needs-chapter-boundary" };
      // The event follows chapter `after`: a choice in a main chapter after it (forged, not played yet) is held with
      // that chapter once the event opens, so it does not stop the event from opening. Character Story and event
      // choices are not held, so they still do.
      const waiting = await choices.guard(runId, { heldAfter: boundary.after });
      if (waiting) return waiting;
      const result = await generatePlan({ runId, run, event: target.event, after: boundary.after });
      if (!result?.ok || !allNodes(result.plan).length) return result || { ok: false, error: "generation-failed" };
      return persistence.transaction(async ({ documents: store }) => {
        const current = await selected(body, { live: true, store });
        if (!current.ok) return current;
        const currentIndex = await store.getById(packageId, "index"),
          currentRun = currentIndex?.data?.runs?.find((entry) => entry.runId === runId);
        if (!forgeSeasonalEnabled(currentRun)) return { ok: false, error: "events-off" };
        const currentBoundary = await frontier(runId, current.data, store);
        if (!currentBoundary.ready || currentBoundary.after !== boundary.after)
          return { ok: false, error: "event-needs-chapter-boundary" };
        const at = new Date(now()).toISOString();
        const value = { ...result.plan, chapter, eventId: current.doc.id, after: boundary.after, opened: now() };
        const created = await store.create({
          id: planId(runId, chapter),
          packageId,
          kind: "chapter-plan",
          name: value.title,
          description: value.premise,
          data: value,
          createdAt: at,
          updatedAt: at,
        });
        if (!created) throw new Error("story-event-write-conflict");
        await save(store, current.doc, { ...current.event, after: boundary.after, opened: now() });
        return {
          ok: true,
          plan: value,
          progress: current.data.progress,
          event: { ...current.event, after: boundary.after, opened: value.opened },
        };
      });
    });
  }

  // A node's place on its difficulty's list: every node on Normal; on Hard and Very Hard only the fights, as a main
  // chapter's Hard map lists them, so there a fight's place is its combat index.
  const difficultyNodes = (plan, difficulty) => (difficulty === "normal" ? allNodes(plan) : fights(plan));
  // Refused, never clamped as main /battle does: the client offers only open difficulties, so a locked one comes from
  // a stale tab, and clamping would start another fight than the one its briefing names.
  const lockedDifficulty = (data, chapter, plan, difficulty) =>
    clampDifficulty(difficulty, data.progress?.[chapter] || {}, fights(plan).length) !== difficulty
      ? { ok: false, error: "locked-difficulty", difficulty }
      : null;

  async function guardNode(body, type, indexField, replay = true) {
    const target = await selected(body);
    if (!target.ok) return target;
    // Only a fight has Hard and Very Hard: scenes are read on Normal.
    const difficulty = type === "combat" ? forgeSeasonalDifficulty(body?.difficulty) : "normal";
    const plan = await documents.getById(packageId, planId(target.runId, target.chapter)),
      nodes = difficultyNodes(plan?.data, difficulty),
      index = Number(body[indexField]);
    const typed = nodes.filter((node) => node.type === type),
      nodeIndex = indexField === "nodeIndex" ? index : nodes.indexOf(typed[index]);
    if (!Number.isInteger(index) || index < 0 || nodeIndex < 0 || nodes[nodeIndex]?.type !== type)
      return { ok: false, error: "bad-request" };
    const locked = lockedDifficulty(target.data, target.chapter, plan.data, difficulty);
    if (locked) return locked;
    const reached = forgeSeasonalProgress(target.data, target.chapter, difficulty);
    if (nodeIndex > reached) return { ok: false, error: "event-node-locked" };
    if (nodeIndex === reached && !forgeSeasonalEnabled(await readRun(target.runId)))
      return { ok: false, error: "events-off" };
    if (nodeIndex === reached && now() >= target.event.endsAt) return { ok: false, error: "event-expired" };
    if (!replay && nodeIndex < reached) return { ok: false, error: "event-already-played" };
    return { ...target, plan: plan.data, nodeIndex, node: nodes[nodeIndex], replay: nodeIndex < reached, difficulty };
  }

  async function complete(body) {
    await retireInactiveFight(body?.runId);
    const initial = await selected(body);
    if (!initial.ok) return initial;
    const planDoc = await documents.getById(packageId, planId(initial.runId, initial.chapter));
    const difficulty = forgeSeasonalDifficulty(body?.difficulty),
      nodeIndex = Number(body.nodeIndex),
      node = difficultyNodes(planDoc?.data, difficulty)[nodeIndex];
    const locked = lockedDifficulty(initial.data, initial.chapter, planDoc?.data, difficulty);
    if (locked) return locked;
    const reached = forgeSeasonalProgress(initial.data, initial.chapter, difficulty);
    if (!Number.isInteger(nodeIndex) || !node || nodeIndex > reached) return { ok: false, error: "event-node-locked" };
    if (nodeIndex < reached)
      return { ok: true, progress: initial.data.progress, gained: [], reward: null, cached: true };
    const live = await selected(body, { live: true });
    if (!live.ok) return live;
    // Hard and Very Hard replay a fight already won on Normal: no choice, scene or event reward rides on them.
    if (difficulty === "normal") {
      const waiting = await choices.completeGuard(initial.runId, initial.chapter, { nodeIndex });
      if (waiting) return waiting;
      if (node.type === "story") {
        const storyIndex = allNodes(planDoc.data)
          .slice(0, nodeIndex)
          .filter((entry) => entry.type === "story").length;
        if (!(await readBeat(initial.runId, initial.chapter, storyIndex))) return { ok: false, error: "beat-missing" };
      }
    }
    const response = await persistence.transaction(async ({ documents: store }) => {
      const current = await selected(body, { store });
      if (!current.ok) return current;
      const done = forgeSeasonalProgress(current.data, current.chapter, difficulty);
      if (done !== nodeIndex)
        return done > nodeIndex
          ? { ok: true, progress: current.data.progress, gained: [], cached: true }
          : { ok: false, error: "event-node-locked" };
      const active = await selected(body, { live: true, store });
      if (!active.ok) return active;
      const data = active.data;
      if (node.type === "combat") {
        const pendingFight = data.combatPending;
        // An event fight started before 1.27.0 stored no difficulty: it was Normal.
        if (
          pendingFight?.chapter !== current.chapter ||
          pendingFight.nodeIndex !== nodeIndex ||
          (pendingFight.difficulty || "normal") !== difficulty ||
          !pendingFight.fight
        )
          return { ok: false, error: "battle-not-started" };
        if (replayBattle(pendingFight.fight, body.log) !== "win") return { ok: false, error: "lost" };
        delete data.combatPending;
      }
      if (!current.session) throw new Error("story-event-session-missing");
      if (difficulty !== "normal") {
        data.progress = {
          ...data.progress,
          [current.chapter]: { ...data.progress?.[current.chapter], [difficulty]: nodeIndex + 1 },
        };
        // The first win on each difficulty pays once, as a main chapter's Hard fight does; data.reading is left alone
        // (no scene was played, and it may mark the player's place in a main chapter).
        const paid = payFight({ data, runId: current.runId, difficulty, event: current.event });
        await save(store, current.session, data);
        return { ok: true, progress: data.progress, gained: [], ...paid };
      }
      const gained = [];
      for (const reward of current.event.rewards
        .map(forgePreparedSeasonalReward)
        .filter((entry) => entry.nodeIndex === nodeIndex)) {
        if (!forgeValidateSeasonalReward(reward)) throw new Error("story-event-invalid-reward");
        gained.push(
          ...(await grantReward({ documents: store, runId: current.runId, event: current.event, data, reward })),
        );
      }
      data.progress = {
        ...data.progress,
        [current.chapter]: { ...data.progress?.[current.chapter], normal: nodeIndex + 1 },
      };
      if (data.reading?.chapter === current.chapter) delete data.reading;
      await save(store, current.session, data);
      return { ok: true, progress: data.progress, gained, reward: null, wallet: data.wallet };
    });
    // Story memory learns from Normal play only, as main schedules it.
    if (response.ok && difficulty === "normal") onComplete?.(initial.runId);
    return response;
  }

  async function retireInactiveFight(runId) {
    const pendingFight = (await readSession(runId))?.combatPending;
    if (!forgeSeasonalChapter(pendingFight?.chapter)) return false;
    return persistence.transaction(async ({ documents: store }) => {
      const index = await store.getById(packageId, "index"),
        run = index?.data?.runs?.find((entry) => entry.runId === runId),
        session = await store.getById(packageId, sessionId(runId)),
        chapter = session?.data?.combatPending?.chapter;
      if (!run || !forgeSeasonalChapter(chapter)) return false;
      const event = await store.getById(packageId, eventId(runId, Number(chapter.slice(6))));
      if (
        !event ||
        event.data?.chapter !== chapter ||
        (forgeSeasonalEnabled(run) && !(Number.isFinite(event.data.endsAt) && now() >= event.data.endsAt))
      )
        return false;
      const data = structuredClone(session.data);
      delete data.combatPending;
      await save(store, session, data);
      return true;
    });
  }

  // An opened, live, unfinished event holds every main chapter after the one it follows. This only reads, so
  // pre-forge and the choice guards can ask it; guardMain retires an inactive event fight first.
  async function mainHold(runId, chapter) {
    if (!forgeSeasonalEnabled(await readRun(runId))) return null;
    const session = await readSession(runId);
    for (const row of await rows(runId)) {
      const event = row.data,
        played = progress(session, event.chapter);
      if (event.opened && now() < event.endsAt && chapter > event.after && played < 10)
        return { ok: false, error: "story-event-open", eventChapter: event.chapter, title: event.title };
    }
    return null;
  }

  return {
    ensure,
    list,
    plan,
    selected,
    guardNode,
    complete,
    retireInactiveFight,
    // An event chapter is active while it is live. A main chapter is not while an open event holds it: pre-forge
    // does not write it, and its pending choice does not stop the event (Pasta-Devs/Marinara-Agents#1786).
    async choiceActive(runId, chapter) {
      if (!forgeSeasonalChapter(chapter)) return !Number.isInteger(chapter) || !(await mainHold(runId, chapter));
      const event = await documents.getById(packageId, eventId(runId, Number(chapter.slice(6))));
      return (
        !!event &&
        event.data?.chapter === chapter &&
        now() < event.data.endsAt &&
        forgeSeasonalEnabled(await readRun(runId))
      );
    },
    async startStory(body) {
      const target = await guardNode(body, "story", "storyIndex");
      if (!target.ok) return target;
      if (await readBeat(target.runId, target.chapter, Number(body.storyIndex)))
        return { ok: true, spent: 0, resumed: true, wallet: target.data.wallet };
      return persistence.transaction(async ({ documents: store }) => {
        const current = await selected(body, { live: true, store });
        if (!current.ok) return current;
        if (current.played !== target.nodeIndex) return { ok: false, error: "event-node-locked" };
        const key = `${target.chapter}:${body.storyIndex}`;
        if (current.data.storyEventStarts?.[key]) return { ok: true, spent: 0, wallet: current.data.wallet };
        const charge = spendVigor(current.data, target.runId, "story");
        if (!charge.ok) return charge;
        current.data.storyEventStarts = { ...current.data.storyEventStarts, [key]: true };
        await save(store, current.session, current.data);
        return charge;
      });
    },
    async guardMain(runId, chapter) {
      await retireInactiveFight(runId);
      return mainHold(runId, chapter);
    },
    async runBattle(body, start = false) {
      // A fight cleared on its difficulty is never loaded either: it could not start (each difficulty pays a fight
      // once), so the fight screen says why at once instead of offering a Start that is refused. Main /battle does not
      // check this; an event's fights do, since 1.26.3.
      const target = await guardNode(body, "combat", "combatIndex", false);
      return target.ok ? battle({ body, target, start }) : target;
    },
    async mediaBanner(runId, bannerId) {
      if (!/^story-event-[1-9]\d{0,8}$/u.test(bannerId)) return null;
      const doc = await documents.getById(packageId, eventId(runId, Number(bannerId.slice(12))));
      const run = await readRun(runId);
      const event = doc?.data;
      const generateAllowed = forgeSeasonalEnabled(run) && !!event && now() < event.endsAt;
      if (event && !generateAllowed && !progress(await readSession(runId), event.chapter)) return null;
      const match = /^global-gallery:([A-Za-z0-9_-]{1,100})$/u.exec(event?.artRef || "");
      return run && event
        ? {
            connectionId: run.animationConnectionId || "",
            identity: doc.id,
            art: event.art || "",
            galleryImageId: match?.[1] || "",
            generateAllowed,
          }
        : null;
    },
    async narrationContext(runId, plan) {
      if (!plan?.eventId) return "";
      const row = await documents.getById(packageId, plan.eventId);
      if (!row || !row.id.startsWith(`${runId}:story-event:`)) return "";
      const units = await cast(runId, await readRun(runId));
      return (
        "SEASONAL EVENT CHARACTER CANON — preserve these current references and the guest’s established identity. " +
        "Do not replace authored relationships with generic rivalry. Center this selected cast; other summon-pool entries are not automatically familiar characters.\n" +
        JSON.stringify({
          cast: units.filter((unit) => row.data.cast.includes(unit.id)),
          newCharacter: row.data.newCharacter,
        })
      );
    },
  };
}
