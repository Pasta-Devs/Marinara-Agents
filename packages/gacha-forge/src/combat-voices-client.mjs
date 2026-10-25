/* global forgeExplicitVoice, forgeVoiceCacheKey, forgeAudioJson, forgeCombatVoiceEnglish, createForgeUltimatePresentation, bt */
const forgeCombatClipSlots = ["death", "kill", "ultimateA", "ultimateB"];
const forgeCombatClipUrl =
  /^\/api\/gacha-forge\/combat-voices\/file\/[a-f0-9]{64}\/[a-f0-9]{64}\.(?:wav|ogg|flac|m4a|webm|mp3|aac)$/u;

async function forgeCombatVoiceBase64(blob) {
  if (!blob || blob.size < 12 || blob.size > 512 * 1024) throw new Error("Invalid combat voice size");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768)
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return btoa(binary);
}

export function createForgeCombatVoiceController({
  host,
  audio,
  services = globalThis.__MARINARA_HOST__?.services,
  getConfig = () => forgeAudioJson("/api/tts/config"),
}) {
  const runId = host._run?.runId;
  const entries = new Map();
  const completed = new Set();
  const jobs = new Map();
  const failures = new Map();
  let disposed = false;
  let player = null;
  let status = null;
  let voiceRevision = 0;
  const active = () => !disposed && host._run?.runId === runId && !audio.disposed;
  const enabled = () =>
    active() &&
    host._run?.combat?.mode === "formation" &&
    audio.settings?.combatVoices === true &&
    !audio.settings.muted &&
    audio.settings.dialogueVolume > 0 &&
    typeof services?.tts?.ttsService?.generateAudio === "function" &&
    typeof services?.audio?.createPlayer === "function";
  const inBattle = () => !host._state || host._state() === "combat";
  const identity = (actor, config, voice) =>
    forgeVoiceCacheKey(runId, { speaker: actor.name, text: "fixed-combat-voices-v1" }, actor, config, voice);
  const bodyFor = (actor, voiceIdentity) => ({
    runId,
    unitId: actor.id,
    characterId: actor.characterId,
    voiceIdentity,
  });
  const post = async (path, body, settlement = false) => {
    if (!active() && !settlement) return null;
    const result = await host._postJson(path, body);
    return active() || settlement ? result : null;
  };
  const showStatus = () => {
    if (!active() || !host._root) return;
    const visible = enabled() && inBattle() && failures.size > 0;
    if (!visible) {
      if (status) status.hidden = true;
      return;
    }
    if (!status?.isConnected) {
      status = document.createElement("section");
      status.className = "gf-combat-voice-status";
      status.setAttribute("role", "status");
      const message = document.createElement("span");
      message.textContent = forgeCombatVoiceEnglish["combat.voices.failed"];
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = forgeCombatVoiceEnglish["combat.voices.retry"];
      retry.addEventListener("click", async (event) => {
        event.stopPropagation();
        const confirm = services?.dialogs?.showConfirmDialog;
        if (!enabled() || retry.disabled || typeof confirm !== "function") return;
        retry.disabled = true;
        try {
          const accepted = await confirm({
            title: forgeCombatVoiceEnglish["combat.voices.retryTitle"],
            message: forgeCombatVoiceEnglish["combat.voices.retryWarning"],
            confirmLabel: forgeCombatVoiceEnglish["combat.voices.retry"],
            cancelLabel: forgeCombatVoiceEnglish["combat.voices.cancel"],
          });
          if (accepted && enabled()) await warm([...failures.values()], true);
        } finally {
          retry.disabled = false;
          showStatus();
        }
      });
      status.append(message, retry);
      host._root.querySelector(".gf-stage")?.append(status);
    }
    status.hidden = false;
  };
  const prepareActor = (actor, config, retry) => {
    const voice = forgeExplicitVoice(config, actor.characterId);
    if (!voice) {
      failures.delete(actor.id);
      return Promise.resolve();
    }
    const voiceIdentity = identity(actor, config, voice);
    const key = `${actor.id}:${voiceIdentity}`;
    if (jobs.has(key)) return jobs.get(key).promise;
    if (completed.has(key) && !retry) return Promise.resolve();
    const job = { controller: new AbortController() };
    const request = bodyFor(actor, voiceIdentity);
    job.promise = (async () => {
      try {
        if (!enabled()) return;
        const prepared = await post("/combat-voices/prepare", { ...request, retry });
        if (!enabled() || job.controller.signal.aborted) return;
        if (!prepared?.ok || !Array.isArray(prepared.clips)) throw new Error("Combat voice lines unavailable");
        const clips = entries.get(key) || new Map();
        entries.set(key, clips);
        for (const slot of forgeCombatClipSlots) {
          const clip = prepared.clips.find((item) => item?.slot === slot);
          if (!clip || typeof clip.text !== "string" || !clip.text.trim() || clip.text.length > 180)
            throw new Error("Invalid fixed combat voice set");
          if (clip.state === "ready" && forgeCombatClipUrl.test(clip.url || "")) {
            clips.set(slot, clip.url);
            continue;
          }
          if (!enabled() || job.controller.signal.aborted) return;
          if (clip.state !== "missing" && !retry) throw new Error("Combat voice retry requires confirmation");
          const reserved = await post("/combat-voices/reserve", { ...request, slot, retry });
          if (!reserved?.ok && !enabled()) return;
          if (!reserved?.ok) throw new Error("Combat voice reservation unavailable");
          if (reserved.cached && forgeCombatClipUrl.test(reserved.url || "")) {
            clips.set(slot, reserved.url);
            continue;
          }
          if (typeof reserved.token !== "string") throw new Error("Invalid combat voice reservation");
          try {
            // Keep an unspent reservation on this job while muted; a new token could repeat paid work.
            while (active() && !enabled() && !job.controller.signal.aborted) {
              await new Promise((resolve) => {
                const resume = () => {
                  if (job.resume === resume) delete job.resume;
                  job.controller.signal.removeEventListener("abort", resume);
                  resolve();
                };
                job.resume = resume;
                job.controller.signal.addEventListener("abort", resume, { once: true });
                if (!active() || enabled() || job.controller.signal.aborted) resume();
              });
            }
            if (!enabled() || job.controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
            const blob = await services.tts.ttsService.generateAudio(clip.text, {
              speaker: actor.name,
              characterId: actor.characterId,
              voice,
              audioConnectionId: config.connectionId || "",
              signal: job.controller.signal,
            });
            // Saving already generated bytes is safe after mute; playback remains separately gated.
            const base64 = await forgeCombatVoiceBase64(blob);
            const saved = await post(
              "/combat-voices/commit",
              { ...request, slot, token: reserved.token, base64 },
              true,
            );
            if (!saved?.ok || !forgeCombatClipUrl.test(saved.url || "")) throw new Error("Combat voice save failed");
            clips.set(slot, saved.url);
          } catch (error) {
            // A response lost after commit must not downgrade a ready clip. The token CAS protects it.
            await post("/combat-voices/fail", { ...request, slot, token: reserved.token }, true).catch(() => {});
            throw error;
          }
        }
        if (!active()) return;
        entries.set(key, clips);
        completed.add(key);
        failures.delete(actor.id);
      } catch {
        if (active()) failures.set(actor.id, actor);
      } finally {
        if (jobs.get(key) === job) jobs.delete(key);
        showStatus();
      }
    })();
    jobs.set(key, job);
    return job.promise;
  };
  async function warm(actors, retry = false) {
    if (!enabled()) return;
    for (const job of jobs.values()) job.resume?.();
    const candidates = actors.filter((actor) => actor?.id && actor.characterId);
    if (!candidates.length) return;
    try {
      const config = await getConfig();
      if (!enabled()) return;
      // The party is at most four actors; each actor's four clips are generated sequentially.
      await Promise.all(candidates.map((actor) => prepareActor(actor, config, retry)));
    } catch {
      if (active()) for (const actor of candidates) failures.set(actor.id, actor);
    }
    showStatus();
  }
  return {
    warm,
    configure() {
      if (!enabled()) {
        ++voiceRevision;
        // Muting pauses new requests. Finish and save an already paid clip instead of forcing a paid retry.
        if (!active()) for (const job of jobs.values()) job.controller.abort();
      } else {
        for (const job of jobs.values()) job.resume?.();
      }
      player?.setVolumes({ music: 0, sfx: audio.settings?.dialogueVolume ?? 1 });
      player?.setMuted(!enabled());
      showStatus();
    },
    async play(actor, slot) {
      if (!enabled() || !inBattle() || !actor?.characterId || !forgeCombatClipSlots.includes(slot)) return;
      const revision = ++voiceRevision;
      try {
        const config = await getConfig();
        const voice = forgeExplicitVoice(config, actor.characterId);
        if (!voice || !enabled() || revision !== voiceRevision) return;
        const clips = entries.get(`${actor.id}:${identity(actor, config, voice)}`);
        const url = clips?.get(slot);
        if (!forgeCombatClipUrl.test(url || "")) return;
        // One owned player per audible callout prevents overlapping character voices.
        player?.dispose();
        player = services.audio.createPlayer();
        player.setVolumes({ music: 0, sfx: audio.settings.dialogueVolume });
        player.setMuted(false);
        player.unlock();
        const tag = `voice:gacha-forge:${actor.id}:${slot}`;
        player.playSfx(tag, { [tag]: { path: "", url } });
      } catch {
        // A missing config or temporary playback error never starts another paid synthesis.
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ++voiceRevision;
      for (const job of jobs.values()) job.controller.abort();
      player?.dispose();
      status?.remove();
      entries.clear();
      completed.clear();
      failures.clear();
    },
  };
}

export function createForgeCombatPresentation(root, { payload, run, host, audio }) {
  const actors = [...(payload?.allies || []), ...(payload?.enemies || [])];
  const formation = payload?.combatMode === "formation" || host?._run?.combat?.mode === "formation";
  const ultimate = formation
    ? createForgeUltimatePresentation(root, { actors, glyphs: typeof bt === "object" ? bt : {} })
    : null;
  const allies = new Map((payload?.allies || []).map((actor) => [String(actor.id), actor]));
  const enemies = new Set((payload?.enemies || []).map((actor) => String(actor.id)));
  const state = (run._forgeCombatVoices ??= { seen: new WeakSet(), ultimates: new Map() });
  const voices =
    formation && audio && host
      ? (audio._forgeCombatVoices ??= createForgeCombatVoiceController({ host, audio }))
      : null;
  let disposed = false;
  voices?.configure();
  void voices?.warm([...allies.values()]);
  return {
    event(event) {
      if (disposed || !event || typeof event !== "object" || state.seen.has(event)) return;
      state.seen.add(event);
      ultimate?.event(event);
      // Saved enemy dialogue remains the priority voice when its blocking panel is open.
      if (root.querySelector("[data-forge-combat-dialogue]:not([hidden])")) return;
      if (event.op === "ult" && !event.weapon) {
        const actor = allies.get(String(event.id));
        const count = state.ultimates.get(event.id) || 0;
        state.ultimates.set(event.id, count + 1);
        if (actor) void voices?.play(actor, count % 2 ? "ultimateB" : "ultimateA");
      } else if (event.op === "death") {
        const actor = allies.get(String(event.id));
        const killer = enemies.has(String(event.id)) && allies.get(String(event.killerId));
        if (actor) void voices?.play(actor, "death");
        else if (killer) void voices?.play(killer, "kill");
      }
    },
    dispose() {
      disposed = true;
      ultimate?.dispose();
      // Voice preparation belongs to the run's audio controller, surviving fullscreen/theme rerenders.
    },
  };
}
