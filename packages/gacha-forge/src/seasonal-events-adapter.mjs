/* global createForgeSeasonalEvents, forgeHydrateStoryCharacters, forgeComposeMemoryPrompt, forgeChoicePlanMessages,
forgeChoicesEnabled, forgeSeasonalChapter, forgeAddCalendarDays, forgeWallDate,
a, n, r, be, Ae, pe, Gn, Le, _t, It, Vt, uh, gS, yS, Uo, _r, fu, Ei, tr, wy, Ur, Cr,
nt, nn, vn, ch, P0, Ph, vS, ES, U0, rt, Vr, gc, H0, zo, yu, I, ze, forgeEnemyCombatMetadata,
forgeEncounterPresentation, dh, W, Gs, ro, Bo, Wf, at, ie, forgeChoices, forgeStoryMemory, forgeStoryCancellation,
forgeStoryPost, B, k, q, bgSlug, l, Xt, vf, jg, Qn, forgeBannerAnimations, xn, Bf, cc, ty, Mi, vr, Bn, qn, Xe */
/* global forgeFormationClassicFields, forgeFormationEncounterMessages, forgeFormationMode, forgeFormationNormalizeGuide, forgeCanonicalSegments, forgeSeasonalEnabled, forgeSeasonalProgress */

// ponytail: this is the narrow adapter for the contributed bundle; move its aliases to imports when that source lands.
function createForgeSeasonalLegacyAdapter() {
  // An event's fights scale like the main chapter after the one it followed.
  const eventScale = (event) => Math.max(1, (Number(event?.after) || 0) + 1);
  const readRun = async (runId) => Ae((await be()).data, runId);
  const readSession = async (runId) => (await pe(runId)).data;
  const cast = async (runId) => {
    const session = await readSession(runId);
    const appeared = new Set(),
      plans = new Map(
        (await a.list(n.id, "chapter-plan"))
          .filter((doc) => doc.id.startsWith(`${runId}:chapter:`))
          .map((doc) => [doc.id.slice(`${runId}:chapter:`.length), doc.data]),
      );
    for (const doc of await a.list(n.id, "beat")) {
      if (!doc.id.startsWith(`${runId}:beat:`) || !doc.data) continue;
      const chapter = String(doc.data.chapter),
        plan = plans.get(chapter);
      if (!plan) continue;
      const nodes = tr(plan),
        node = nodes.filter((entry) => entry.type === "story")[doc.data.storyIndex];
      const played = plan.bondUnitId
        ? Number(session.bondChapters?.[plan.bondUnitId]?.[`beats${Number(plan.bondPart) > 1 ? plan.bondPart : ""}`]) >
          doc.data.storyIndex
        : Number(session.progress?.[chapter]?.normal) > nodes.indexOf(node);
      if (!played || !node) continue;
      for (const segment of forgeCanonicalSegments(doc.data) || [])
        if (segment.speaker) appeared.add(String(segment.speaker).trim().toLowerCase());
    }
    const docs = (await a.list(n.id, "unit")).filter(
      (doc) => doc.id.startsWith(`${runId}:unit:`) && doc.data?.kind === "character" && !doc.data.isProtagonist,
    );
    const hydrated = await forgeHydrateStoryCharacters(
      docs.map((doc) => doc.data),
      (id) => Le().characterCard(id),
      r.logger,
    );
    return hydrated
      .map((unit, index) => ({
        id: docs[index].id,
        name: unit.name,
        rarity: unit.rarity,
        role: unit.role || "",
        affinity: unit.affinity || "",
        identitySex: unit.identitySex || "",
        known: !!session.roster?.[docs[index].id] || appeared.has(String(unit.name).trim().toLowerCase()),
        ...(unit.forgeCardCanon || {
          description: unit.description || "",
          personality: unit.personality || "",
          backstory: unit.backstory || "",
          appearance: unit.appearance || "",
        }),
      }))
      .sort((left, right) => Number(right.known) - Number(left.known));
  };
  const generate = (runId, run, messages, label, parse, maxTokens = 2500) =>
    _t({
      runtime: r,
      runId,
      run,
      messages,
      label,
      options: { temperature: 0.8, maxTokens: It(maxTokens) },
      parse: Vt(r, parse),
    });
  const prepareMedia = async ({ runId, event }) => {
    const media = {},
      units = [];
    const canPaint = (run) => !!run && forgeSeasonalEnabled(run) && Date.now() < event.endsAt && !nt(run).off;
    const run = await readRun(runId),
      connection = canPaint(run) ? await nn(run) : null;
    if (connection) {
      try {
        for (const id of event.cast) {
          const unit = await Gn(id);
          if (unit && canPaint(await readRun(runId))) units.push(await ch(run, id, unit));
        }
        if (event.newCharacter) units.push({ ...event.newCharacter, kind: "character", imageTags: [] });
        const current = await readRun(runId);
        if (!canPaint(current)) throw new Error("story-event-media-disabled");
        const image = await Le().generateBannerArt({
          connectionId: connection.id,
          name: event.title,
          units,
          scene: `${event.bannerPrompt}\nAn event key visual, no text, logos or lettering.`,
          styleProfileId: nt(run).styleProfileId,
          size: nt(run),
          framing: "scene",
        });
        const filed = await Le().uploadToGallery({
          image,
          name: event.title,
          prompt: image.prompt,
          provider: connection.provider,
          model: connection.model,
        });
        media.art = filed.url;
        media.artRef = vn(filed.id);
      } catch (error) {
        r.logger.warn(error, "[gacha-forge] Story event banner could not be painted");
        media.mediaError = true;
      }
    }
    const outfit = event.rewards.find((reward) => reward.kind === "outfit");
    if (outfit) {
      const current = await readRun(runId),
        outfitConnection = canPaint(current) ? await nn(current) : null;
      if (!outfitConnection)
        media.rewards = event.rewards.map((reward) =>
          reward === outfit ? { nodeIndex: 9, kind: "aether", qty: 320 } : reward,
        );
      else {
        const unit = await Gn(outfit.unitId);
        if (unit) {
          try {
            if (!canPaint(await readRun(runId))) throw new Error("story-event-media-disabled");
            const image = await Le().generateOutfit({
              connectionId: outfitConnection.id,
              name: unit.name,
              unit,
              outfit: { name: outfit.name, prompt: outfit.prompt, tags: [] },
              styleProfileId: nt(current).styleProfileId,
              size: nt(current),
            });
            const filed = await Le().uploadToGallery({
              image,
              name: outfit.name,
              prompt: image.prompt,
              provider: outfitConnection.provider,
              model: outfitConnection.model,
            });
            media.rewards = event.rewards.map((reward) =>
              reward === outfit
                ? {
                    ...reward,
                    outfit: {
                      id: `outfit:story-event:${event.seq}:${outfit.unitId}`,
                      themeKey: `story-event:${event.seq}`,
                      name: outfit.name,
                      prompt: outfit.prompt,
                      tags: [],
                      url: filed.url,
                      ref: vn(filed.id),
                      at: new Date().toISOString(),
                      history: [],
                    },
                  }
                : reward,
            );
          } catch (error) {
            r.logger.warn(error, "[gacha-forge] Story event outfit could not be painted");
            media.rewards = event.rewards.map((reward) =>
              reward === outfit ? { nodeIndex: 9, kind: "aether", qty: 320 } : reward,
            );
            media.mediaError = true;
          }
        }
      }
    }
    // The dedicated event cue is available immediately; it has no summon or five-star unlock condition.
    {
      const cue = `banner-story-event-${event.seq}`;
      const saved = await xn(runId, (data) => {
        data.audioBanners = {
          ...data.audioBanners,
          [cue]: { cue, title: event.title, event: true, theme: event.theme, unlocked: true },
        };
        data.audioPrompts = { ...data.audioPrompts, [cue]: { prompt: event.musicPrompt, event: true } };
      });
      if (saved) media.music = { cue, title: event.title };
      else media.mediaError = true;
    }
    return media;
  };
  const grantReward = async ({ documents, runId, event, data, reward }) => {
    data.wallet = data.wallet || {};
    if (["funds", "aether"].includes(reward.kind)) {
      data.wallet[reward.kind] = Math.max(0, Number(data.wallet[reward.kind]) || 0) + reward.qty;
      return [{ qty: reward.qty, material: reward.kind === "funds" ? "Funds" : "Aether", kind: reward.kind }];
    }
    if (reward.kind === "xp") {
      const insight = Qn(data.wallet);
      insight.core += reward.qty;
      data.wallet.insight = insight;
      return [{ qty: reward.qty, material: "Insight Core", kind: "xp" }];
    }
    if (!reward.unitId?.startsWith(`${runId}:unit:`)) throw new Error("story-event-invalid-reward");
    const unit = await documents.getById(n.id, reward.unitId);
    if (unit?.data?.kind !== "character") throw new Error("story-event-invalid-reward");
    if (reward.kind === "character") {
      if (Number(unit.data.rarity) !== 4) throw new Error("story-event-invalid-reward");
      data.roster = data.roster || {};
      if (!data.roster[unit.id]) data.roster[unit.id] = { level: 1, bondFights: 0 };
      else {
        const facet = vf(data.roster[unit.id].facet);
        data.roster[unit.id].facet = facet.facet;
        if (!facet.gained) data.wallet.glimmer = (Number(data.wallet.glimmer) || 0) + jg(false, 4);
      }
      return [{ qty: 1, material: unit.data.name, kind: "character" }];
    }
    if (
      reward.kind === "outfit" &&
      reward.outfit?.url &&
      reward.outfit.id === `outfit:story-event:${event.seq}:${unit.id}`
    ) {
      const next = structuredClone(unit.data);
      next.outfits = Array.isArray(next.outfits) ? next.outfits : [];
      if (!next.outfits.some((outfit) => outfit.id === reward.outfit.id)) next.outfits.push(reward.outfit);
      if (
        !(await documents.update({
          id: unit.id,
          packageId: n.id,
          expectedRevision: unit.revision,
          name: unit.name,
          description: unit.description,
          data: next,
          updatedAt: new Date().toISOString(),
        }))
      )
        throw new Error("story-event-write-conflict");
      return [{ qty: 1, material: reward.name, kind: "outfit" }];
    }
    throw new Error("story-event-reward-not-ready");
  };
  // Designs an event fight once: when its battle opens, or ahead of it while pre-forge writes the event. Both
  // share the fight's dedupe key, so opening a battle the chain is designing joins that design.
  const designFight = (runId, chapter, combatIndex) => {
    const combatId = I(runId, chapter, combatIndex);
    return ze(combatId, async () => {
      const saved = await a.getById(n.id, combatId);
      if (saved?.data) return { ok: true, guide: saved.data, cached: true };
      const target = await events.selected({ runId, chapter });
      if (!target.ok) return target;
      const run = await readRun(runId),
        plan = (await a.getById(n.id, `${runId}:chapter:${chapter}`))?.data,
        nodes = tr(plan),
        node = nodes.filter((entry) => entry.type === "combat")[combatIndex];
      if (!run || !node) return { ok: false, error: "bad-request" };
      const scale = eventScale(target.event),
        storyIndex = nodes.slice(0, nodes.indexOf(node)).filter((entry) => entry.type === "story").length,
        history = await _r(runId, chapter, storyIndex, {
          query: { plan: [node.title, node.setup, target.event.theme].filter(Boolean).join(" ") },
          job: "structured",
          // A fight's design needs no one's private conversations.
          cast: [],
        });
      let messages = forgeComposeMemoryPrompt(vS, [
        run.scenario,
        plan.premise,
        node,
        history,
        run.protagonist,
        scale,
        "",
        run.language,
        {
          enemies: !nt(run).off && nt(run).enemyArt,
          place: !nt(run).off && nt(run).battleBackgrounds,
          tags: false,
          places: [],
        },
      ]);
      const characterContext = await events.narrationContext(runId, plan);
      if (characterContext) messages.push({ role: "user", content: characterContext });
      let formationElements = null;
      if (typeof forgeFormationEncounterMessages === "function") {
        const session = await readSession(runId),
          units = (await a.list(n.id, "unit")).filter(
            (unit) => unit.id.startsWith(`${runId}:unit:`) && session.roster?.[unit.id],
          ),
          available = [
            ...new Set(units.map((unit) => String(unit.data?.affinity || "").toLowerCase()).filter(Boolean)),
          ];
        messages = forgeFormationEncounterMessages(messages, run, available);
        if (forgeFormationMode(run) === "formation") formationElements = available;
      }
      // Classic event fights parse exactly as before; a Formation world also reads the kits and rules it asked for.
      const result = await generate(runId, run, messages, "story-event-combat", (value) =>
        formationElements
          ? forgeFormationNormalizeGuide(
              value,
              ES(forgeFormationClassicFields(value), U0(scale), node),
              formationElements,
            )
          : ES(value, U0(scale), node),
      );
      if (!result.ok) return result;
      const at = new Date().toISOString();
      const doc =
        (await a.create({
          id: combatId,
          packageId: n.id,
          kind: "combat",
          name: node.title,
          description: target.event.title,
          data: { chapter, combatIndex, ...result.value },
          createdAt: at,
          updatedAt: at,
        })) || (await a.getById(n.id, combatId));
      return doc?.data ? { ok: true, guide: doc.data } : { ok: false, error: "write-conflict" };
    });
  };
  const prepareBattle = async ({ body, target, start }) => {
    const run = await readRun(target.runId),
      chapter = target.chapter,
      combatIndex = Number(body.combatIndex),
      difficulty = target.difficulty,
      scale = eventScale(target.event),
      combatId = I(target.runId, chapter, combatIndex);
    let designed;
    if (difficulty === "normal") designed = await designFight(target.runId, chapter, combatIndex);
    else {
      // Hard and Very Hard fight what Normal designed (a fight's guide is saved before its first start), so they
      // never ask a model for one.
      const guide = (await a.getById(n.id, combatId))?.data;
      designed = guide ? { ok: true, guide } : { ok: false, error: "event-fight-missing" };
    }
    if (!designed.ok) return designed;
    const guide = designed.guide,
      party = await Vr(target.runId, run, body.presetIndex);
    if (!party.ok) return party;
    const known = await dh(target.runId, run),
      power = H0(scale),
      enemies = gc(
        (guide.formation || []).map((enemy, index) => ({
          id: `enemy-${index}`,
          name: enemy.name,
          role: enemy.role,
          affinity: enemy.affinity,
          position: enemy.position || "front",
          stats: power === 1 ? enemy.stats : zo(enemy.stats, power),
          power: 1,
          skill: enemy.skill,
          passive: enemy.passive || null,
          ...(enemy.formationKit ? { formationKit: enemy.formationKit } : {}),
          ...forgeEnemyCombatMetadata(enemy, known),
        })),
        // The same fight, calibrated to the difficulty's power, as main us() does; its seed and key stay Normal's.
        yu(scale, difficulty),
      );
    if (!start) {
      const presentation = await rt(run, target.runId, enemies, {
        place: guide.place ? { name: guide.place, tags: guide.placeTags } : null,
      });
      return {
        ok: true,
        allies: party.allies,
        enemies: presentation.enemies,
        ...forgeEncounterPresentation(guide, presentation.enemies),
        background: presentation.background,
        opening: guide.opening,
        objective: guide.objective,
        formationRules: guide.formationRules || [],
        battleKey: combatId,
        presets: party.presets,
        activePreset: party.usedIdx,
        cost: Bo,
        cp: yu(scale, difficulty),
        difficulty,
        enemyPower: enemies[0]?.power || 1,
      };
    }
    const fight = W(party.allies, enemies, Gs(combatId), run, guide.formationRules || []);
    return r.persistence.transaction(async ({ documents }) => {
      const doc = await documents.getById(n.id, `${target.runId}:session`);
      if (!doc) return { ok: false, error: "not-found" };
      const data = structuredClone(doc.data),
        current = await events.selected(body, { live: true, store: documents });
      if (!current.ok) return current;
      // Still the fight this difficulty reached (progress only grows, so a match is enough).
      if (forgeSeasonalProgress(current.data, chapter, difficulty) !== target.nodeIndex)
        return { ok: false, error: "event-node-locked" };
      const charged = ro(data, target.runId, Bo, Date.now());
      if (!charged.ok) return charged;
      data.combatPending = {
        chapter,
        combatIndex,
        nodeIndex: target.nodeIndex,
        difficulty,
        fight,
        at: Date.now(),
      };
      if (
        !(await documents.update({
          id: doc.id,
          packageId: n.id,
          expectedRevision: doc.revision,
          name: doc.name,
          description: doc.description,
          data,
          updatedAt: new Date().toISOString(),
        }))
      )
        throw new Error("story-event-write-conflict");
      return { ok: true, spent: Bo, loss: { spent: Bo, again: Bo }, wallet: at(charged.wallet, data) };
    });
  };
  // ponytail: a copy of main /complete's first-clear fight pay (rank XP with its level-up Vigor, the node-clear and
  // hard-clear counts, and the tier's Funds and Aether; ty pays no Insight). A change to main pay does not reach it:
  // share one helper once the bundle's source lands.
  const payFight = ({ data, runId, difficulty, event }) => {
    const from = { ...Bn(data.account), vigorMax: qn(data) },
      level = Mi(data, vr.combat),
      reward = ty(eventScale(event), difficulty),
      time = Date.now();
    Xt(data, runId, "node-clear", 1, time);
    Xt(data, runId, "hard-clear", 1, time);
    const wallet = data.wallet || { ...Xe };
    wallet.funds = (Number(wallet.funds) || 0) + reward.funds;
    wallet.aether = (Number(wallet.aether) || 0) + reward.aether;
    data.wallet = wallet;
    return {
      reward,
      rank: {
        gain: vr.combat,
        levels: level.levels,
        vigor: level.vigor || 0,
        ...Bn(data.account),
        vigorMax: qn(data),
        from,
      },
      account: Bn(data.account),
      wallet: at(data.wallet, data),
    };
  };
  const events = createForgeSeasonalEvents({
    packageId: n.id,
    persistence: r.persistence,
    documents: a,
    readRun,
    readSession,
    cast,
    addCalendarDays: forgeAddCalendarDays,
    localDate: (time) => forgeWallDate(time).toISOString().slice(0, 10),
    generateOverview: ({ runId, run, messages }) =>
      generate(runId, run, messages, "story-event-overview", (value) => value),
    generatePlan: async ({ runId, run, event, after }) => {
      const reference = await cast(runId),
        selected = reference.filter((unit) => event.cast.includes(unit.id));
      const context = { pool: JSON.stringify(selected), index: "" };
      // Only the event's own cast's conversations, both listed and recalled.
      const conversations = await Ei(runId, { only: selected.map((unit) => unit.name), limit: 6 });
      const messages = forgeChoicePlanMessages(
        forgeComposeMemoryPrompt(gS, [
          run.scenario,
          after + 1,
          3,
          run.protagonist,
          context,
          "",
          run.language,
          Uo(run, "chapter"),
          await _r(runId, after + 1, 0, {
            current: true,
            query: { plan: [event.title, event.theme].filter(Boolean).join(" ") },
            job: "structured",
            // The event's own cast are the only units whose private conversations it may draw on.
            cast: Array.isArray(event.cast) ? event.cast : [],
            listed: conversations,
          }),
          "",
          "",
          fu(conversations),
        ]),
        forgeChoicesEnabled(run),
      );
      messages[0].content +=
        "\nSEASONAL EVENT: This is a confined optional event chapter, not the next main chapter. Use exactly three combat nodes and seven story nodes. End its own storyline conclusively; do not resolve or independently advance the main arc. Tie its opening neatly to current canonical history. A lasting choice must not strand an expired event. Respect current authored relationships and all four authored character fields. The event overview is a brief, not already-played canon.";
      messages.push({
        role: "user",
        content: JSON.stringify({
          event: { title: event.title, theme: event.theme, premise: event.premise, newCharacter: event.newCharacter },
          currentCharacterCanon: selected,
        }),
      });
      const result = await generate(runId, run, messages, "story-event-plan", (value) => yS(value, after + 1), 16384);
      return result.ok ? { ok: true, plan: result.value } : result;
    },
    prepareMedia,
    grantReward,
    allNodes: tr,
    readBeat: async (runId, chapter, index) => (await a.getById(n.id, `${runId}:beat:${chapter}:${index}`))?.data,
    choices: forgeChoices,
    battle: prepareBattle,
    replayBattle: ie,
    spendVigor: (data, runId) => {
      const charge = ro(data, runId, Wf, Date.now());
      return charge.ok ? { ok: true, spent: Wf, wallet: at(charge.wallet, data) } : charge;
    },
    onComplete: (runId) => forgeStoryMemory.schedule(runId),
    clampDifficulty: cc,
    payFight,
    log: (error, message) => r.logger.warn(error, `[gacha-forge] ${message}`),
  });
  const post = (path, handler) => forgeStoryPost(path, (request) => handler(request?.body || {}));
  post("/story-events", (body) => events.list(body));
  post("/story-event/plan", async (body) => {
    const result = await forgeChoices.readOrGenerate(body.runId, (cachedOnly) => events.plan(body, { cachedOnly }));
    // The map's Recommended BP per difficulty, as main /chapter-plan answers it.
    return result?.ok && result.event ? { ...result, cp: Bf(eventScale(result.event)) } : result;
  });
  post("/story-event/start", (body) => events.startStory(body));
  post("/story-event/complete", (body) => events.complete(body));
  post("/story-event/beat", async (body) => {
    const target = await events.guardNode(body, "story", "storyIndex");
    return target.ok ? Cr(target.runId, target.chapter, Number(body.storyIndex)) : target;
  });
  post("/story-event/choice", async (body) => {
    const target = await events.guardNode(body, "story", "storyIndex");
    return target.ok ? forgeChoices.select(body) : target;
  });
  post("/story-event/combat-guide", async (body) => {
    const target = await events.guardNode(body, "combat", "combatIndex");
    return target.ok ? { ok: true } : target;
  });
  post("/story-event/battle", (body) => events.runBattle(body));
  post("/story-event/battle/start", (body) => events.runBattle(body, true));
  post("/story-event/cg-art", async (body) => {
    const target = await events.guardNode(body, "story", "storyIndex");
    return target.ok ? B(target.runId, await readRun(target.runId), target.chapter, Number(body.storyIndex)) : target;
  });
  post("/story-event/beat/mark", async (body) => {
    const target = await events.guardNode(body, "story", "storyIndex");
    if (!target.ok) return target;
    if (target.replay) return { ok: true };
    return r.persistence.transaction(async ({ documents }) => {
      const doc = await documents.getById(n.id, `${target.runId}:session`);
      if (!doc) return { ok: false, error: "not-found" };
      const data = structuredClone(doc.data),
        position = Math.max(0, Math.floor(Number(body.at) || 0));
      if (position) data.reading = { chapter: target.chapter, storyIndex: Number(body.storyIndex), at: position };
      else delete data.reading;
      const saved = await documents.update({
        id: doc.id,
        packageId: n.id,
        expectedRevision: doc.revision,
        name: doc.name,
        description: doc.description,
        data,
        updatedAt: new Date().toISOString(),
      });
      return { ok: !!saved, ...(saved ? {} : { error: "write-conflict" }) };
    });
  });
  // Pre-forge uses the main /preforge* and /story/cancel routes, which read an event-N key like a chapter's.
  return Object.assign(events, { designFight });
}
