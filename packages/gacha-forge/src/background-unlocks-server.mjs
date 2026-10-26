// Generated documents are not proof that a player has experienced their scenes.
// Keep witnessed image snapshots in the public session transaction, alongside progress.
export function createForgeBackgroundUnlocks({ packageId, persistence, rawOptions, allNodes, now = Date.now }) {
  const text = (value) => (typeof value === "string" ? value.trim() : "");
  const count = (value) => Math.max(0, Math.floor(Number(value) || 0));
  const same = (left, right) => left.src === right.src && left.key === right.key && left.url === right.url;
  const normalize = (value) => text(value).normalize("NFC").toLocaleLowerCase().replace(/\s+/gu, " ");
  const sessionId = (runId) => `${runId}:session`;
  const planId = (runId, chapter) => `${runId}:chapter:${chapter}`;
  const beatId = (runId, chapter, index) => `${runId}:beat:${chapter}:${index}`;
  const snapshot = (src, item) => ({
    src,
    key: item.key,
    name: item.name,
    url: item.url,
    ...(/^global-gallery:[A-Za-z0-9_-]+$/u.test(text(item.ref)) ? { ref: item.ref } : {}),
  });

  async function read(store, runId) {
    const index = await store.getById(packageId, "index");
    const run = index?.data?.runs?.find((entry) => entry?.runId === runId);
    if (!run) return null;
    const session = await store.getById(packageId, sessionId(runId));
    if (!session) return null;
    return { run, session, data: structuredClone(session.data || {}) };
  }
  async function save(store, session, data) {
    if (
      !(await store.update({
        ...session,
        packageId,
        expectedRevision: session.revision,
        data,
        updatedAt: new Date(now()).toISOString(),
      }))
    )
      throw new Error("background-unlock-write-conflict");
  }
  function records(data) {
    return Array.isArray(data.backgroundUnlocks?.images)
      ? data.backgroundUnlocks.images.filter(
          (row) => row && ["story", "cg", "banner", "bond"].includes(row.src) && text(row.key) && text(row.url),
        )
      : [];
  }
  function add(data, items) {
    const images = records(data).slice();
    let added = 0;
    for (const item of items) {
      if (!item?.url || !item.key || !["story", "cg", "banner", "bond"].includes(item.src)) continue;
      if (!images.some((row) => same(row, item))) {
        images.push(item);
        added += 1;
      }
    }
    data.backgroundUnlocks = { version: 1, images };
    return added;
  }
  function progress(data, plan, chapter) {
    if (plan.bondUnitId) {
      const suffix = Number(plan.bondPart || 1) > 1 ? String(plan.bondPart) : "";
      return count(data.bondChapters?.[plan.bondUnitId]?.[`beats${suffix}`]);
    }
    return count(data.progress?.[String(chapter)]?.normal);
  }
  function selectedSegments(beat, at, selection) {
    const main = beat.segments?.[at];
    if (!main) return [];
    const segments = [main];
    if (selection?.choiceId || selection?.optionId) {
      const choice = beat.choices?.find(
        (row) => row.id === selection.choiceId && row.at === at && row.kind === "small",
      );
      const option = choice?.options?.find((row) => row.id === selection.optionId);
      if (!option || (!selection.replayAllowed && beat.choiceCanon?.[choice.id] !== option.id)) return [];
      return [main, ...(option.segments || [])];
    }
    for (const choice of beat.choices || []) {
      if (choice.at !== at) continue;
      const option = choice.options?.find((row) => row.id === beat.choiceCanon?.[choice.id]);
      if (option) segments.push(...(option.segments || []));
    }
    return segments;
  }
  async function context(store, runId, chapter, storyIndex, raw) {
    const beat = (await store.getById(packageId, beatId(runId, chapter, storyIndex)))?.data;
    const cg = (raw.cg || []).find((row) => row.key === `${runId}:cg:${chapter}:${storyIndex}`);
    const cgDoc = cg && (await store.getById(packageId, cg.key))?.data;
    return { beat, cg, cgDoc };
  }
  async function scene(store, runId, chapter, storyIndex, at, raw, place, selection, loaded) {
    const { beat, cg, cgDoc } = loaded || (await context(store, runId, chapter, storyIndex, raw));
    if (!Array.isArray(beat?.segments) || at < 0 || at >= beat.segments.length) return [];
    // A later mainline must not bypass a still-unselected choice.
    if (
      !selection?.replayAllowed &&
      (beat.choices || []).some(
        (choice) => choice.at < at && !choice.options?.some((row) => row.id === beat.choiceCanon?.[choice.id]),
      )
    )
      return [];
    if (cgDoc && at >= count(cgDoc.from) && at <= count(cgDoc.to)) return [snapshot("cg", cg)];
    const segments = selectedSegments(beat, at, selection);
    const candidates = place == null ? segments : segments.filter((row) => normalize(row.place) === normalize(place));
    return (raw.story || [])
      .filter((row) => candidates.some((segment) => normalize(segment.place) === normalize(row.name)))
      .map((row) => snapshot("story", row));
  }
  async function migrate(store, runId, state, raw) {
    if (state.data.backgroundUnlocks?.version === 1) return;
    const images = new Map();
    for (const doc of await store.list(packageId, "chapter-plan")) {
      if (!doc.id?.startsWith(`${runId}:chapter:`) || !doc.data) continue;
      const chapter = doc.id.slice(`${runId}:chapter:`.length);
      const nodes = allNodes(doc.data);
      let index = 0;
      for (const [position, node] of nodes.entries()) {
        if (node.type !== "story") continue;
        const complete = doc.data.bondUnitId
          ? index < progress(state.data, doc.data, chapter)
          : position < progress(state.data, doc.data, chapter);
        if (complete) {
          const loaded = await context(store, runId, chapter, index, raw);
          for (let at = 0; at < (loaded.beat?.segments?.length || 0); at += 1)
            for (const item of await scene(store, runId, chapter, index, at, raw, undefined, undefined, loaded))
              images.set(JSON.stringify([item.src, item.key, item.url]), item);
        }
        index += 1;
      }
    }
    // Existing decoration is a player's explicit legacy selection, never a new generated default.
    const selected = state.data.decor?.bg;
    const legacy =
      selected?.key && (raw[selected.src] || []).find((row) => row.key === selected.key || row.url === selected.key);
    if (legacy) images.set("legacy", snapshot(selected.src, legacy));
    add(state.data, [...images.values()]);
    if (legacy) {
      const at = records(state.data).findIndex(
        (row) => row.src === selected.src && row.key === legacy.key && row.url === legacy.url,
      );
      if (at >= 0) state.data.decor.bg = { ...records(state.data)[at], key: `unlocked:${at}` };
    }
    await save(store, state.session, state.data);
  }
  async function options(runId) {
    if (!text(runId)) return { story: [], cg: [], banner: [], bond: [] };
    return persistence.transaction(async ({ documents: store }) => {
      const state = await read(store, runId);
      if (!state) return { story: [], cg: [], banner: [], bond: [] };
      const raw = await rawOptions(runId, store);
      await migrate(store, runId, state, raw);
      const output = { story: [], cg: [], banner: raw.banner || [], bond: raw.bond || [] };
      for (const [index, item] of records(state.data).entries()) {
        // Keep earned snapshots even if a later generation replaces the same logical location.
        output[item.src] = output[item.src].filter((row) => row.key.startsWith("unlocked:") || row.url !== item.url);
        output[item.src]?.push({ ...item, key: `unlocked:${index}` });
      }
      return output;
    });
  }
  async function select(runId, src, key) {
    if (!["story", "cg", "banner", "bond"].includes(src)) return null;
    const available = await options(runId);
    const item = available[src]?.find((row) => row.key === key || row.url === key);
    if (item) return snapshot(src, item);
    // An old Home render may still hold its pre-migration logical key. Resolve it
    // only against earned snapshots, never against a newer raw image document.
    const saved = (await persistence.documents.getById(packageId, sessionId(runId)))?.data;
    const index = records(saved || {}).findIndex((row) => row.src === src && row.key === key);
    return index >= 0 ? { ...records(saved)[index], key: `unlocked:${index}` } : null;
  }
  async function witness(body) {
    const runId = text(body?.runId),
      chapter = text(String(body?.chapter ?? ""));
    const storyIndex = Number(body?.storyIndex),
      at = Number(body?.at);
    if (
      !runId ||
      !chapter ||
      !Number.isInteger(storyIndex) ||
      storyIndex < 0 ||
      !Number.isInteger(at) ||
      at < 0 ||
      !text(body.url)
    )
      return { ok: false, error: "bad-request" };
    return persistence.transaction(async ({ documents: store }) => {
      const state = await read(store, runId);
      if (!state) return { ok: false, error: "not-found" };
      if (Number(body.storyRevision || 0) !== count(state.data.storyRevision))
        return { ok: false, error: "story-changed" };
      const plan = (await store.getById(packageId, planId(runId, chapter)))?.data;
      const nodes = plan && allNodes(plan),
        stories = nodes?.filter((node) => node.type === "story");
      if (!stories?.[storyIndex]) return { ok: false, error: "scene-locked" };
      const played = progress(state.data, plan, chapter);
      const position = plan.bondUnitId ? storyIndex : nodes.indexOf(stories[storyIndex]);
      if (position > played) return { ok: false, error: "scene-locked" };
      if (plan.bondUnitId && !state.data.roster?.[plan.bondUnitId]) return { ok: false, error: "scene-locked" };
      if (plan.eventId && position === played) {
        const event = (await store.getById(packageId, plan.eventId))?.data;
        if (state.run.story?.seasonalEvents !== true || !event || now() >= event.endsAt)
          return { ok: false, error: "scene-locked" };
      }
      if (/^[1-9]\d*$/u.test(chapter)) {
        for (const earlier of await store.list(packageId, "chapter-plan")) {
          const number = Number(earlier.id?.slice(`${runId}:chapter:`.length));
          if (
            earlier.id?.startsWith(`${runId}:chapter:`) &&
            Number.isInteger(number) &&
            number > 0 &&
            number < Number(chapter) &&
            progress(state.data, earlier.data, number) < allNodes(earlier.data).length
          )
            return { ok: false, error: "scene-locked" };
        }
      }
      const raw = await rawOptions(runId, store);
      await migrate(store, runId, state, raw);
      const images = (
        await scene(store, runId, chapter, storyIndex, at, raw, body.place, {
          choiceId: text(body.choiceId),
          optionId: text(body.optionId),
          replayAllowed: body.replay === true && position < played,
        })
      ).filter((item) => item.url === body.url);
      if (!images.length) return { ok: false, error: "image-not-visible" };
      const unlocked = add(state.data, images);
      if (unlocked) {
        // Migration may already have incremented this revision inside the same transaction.
        const current = await store.getById(packageId, state.session.id);
        await save(store, current, state.data);
      }
      return { ok: true, unlocked };
    });
  }
  return { options, select, witness };
}
