// Package-owned orchestration over the Engine's isolated player and shared voice service.
/* global normalizeForgeAudio, normalizeForgeMusicMood, forgeAudioEnglish, forgeAudioFields, forgeSoundtrackContextKey, forgeSoundtrackCues, recordForgeSoundtrack, Ze */
const forgeAudioIcons = {
  sound:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  muted:
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const forgeStockSfx = {
  click: "sfx:ui:click",
  start: "sfx:combat:sword-unsheathe",
  act: "sfx:combat:sword-swing",
  ult: "sfx:combat:magic-cast",
  hit: "sfx:combat:spell-hit",
  critical: "sfx:combat:sword-swing-2",
  heal: "sfx:ui:potion",
  guard: "sfx:combat:chainmail",
  broken: "sfx:combat:metal-ring",
  win: "sfx:ui:coin-pickup",
  lose: "sfx:ui:menu-cancel",
};
let forgeAudioSession = 0;
const forgeAudioRetryMs = 60_000;

export function forgeMusicContextKey(runId, connectionId, cue) {
  return forgeSoundtrackContextKey(runId, connectionId, cue);
}

async function forgeAudioJson(path, options) {
  const response = await Ze(path, options);
  if (!response.ok) {
    const error = new Error(`Audio request failed (${response.status})`);
    error.httpStatus = response.status;
    try {
      const body = await response.json();
      // Older hosts expose only detail; newer hosts provide a bounded, redacted provider reason.
      const upstream = /^(?:ElevenLabs|SunoAPI) audio request returned HTTP ([45]\d{2})$/.exec(body?.detail);
      if (upstream) error.httpStatus = Number(upstream[1]);
      if (
        body?.error === "Audio generation failed" &&
        Number.isInteger(body.providerStatus) &&
        body.providerStatus >= 400 &&
        body.providerStatus <= 599
      ) {
        error.httpStatus = body.providerStatus;
        if (typeof body.reason === "string")
          error.reason = body.reason
            .replace(/\p{Cc}/gu, " ")
            .trim()
            .slice(0, 300);
      }
    } catch (parseError) {
      if (parseError?.name === "AbortError") throw parseError;
    }
    throw error;
  }
  return response.json();
}

export function forgeExplicitVoice(config, characterId) {
  if (!characterId || !config || (!config.connectionId && config.enabled === false)) return null;
  const profile = config.connectionId ? config.connectionProfiles?.[config.connectionId] : null;
  const assignments = config.connectionId ? profile?.voiceAssignments : config.voiceAssignments;
  const rows = (Array.isArray(assignments) ? assignments : []).filter(
    (row) => row?.characterId === characterId && typeof row.voice === "string" && row.voice.trim(),
  );
  // Contradictory duplicate rows must not silently choose a different character's voice.
  const voices = [...new Set(rows.map((row) => row.voice.trim()))];
  return voices.length === 1 ? voices[0] : null;
}

export function forgeVoiceCacheKey(runId, segment, character, config, voice) {
  const profile = (config.connectionId && config.connectionProfiles?.[config.connectionId]) || config;
  const identity = JSON.stringify([
    character.characterId,
    segment.speaker,
    segment.text,
    voice,
    config.connectionId || "",
    config.source,
    config.baseUrl,
    config.model,
    profile.audioFormat,
    profile.speed,
    profile.elevenLabsStability,
    profile.elevenLabsLanguageCode,
  ]);
  // Reuse the package's stable world hash; playback IDs remain unique for cancellation.
  return `gacha-voice-v1:${forgeSoundtrackContextKey(runId, identity, "line")}`;
}

export class ForgeAudioController {
  constructor(host, services = globalThis.__MARINARA_HOST__?.services) {
    this.host = host;
    this.runId = host._run?.runId;
    this.audio = services?.audio;
    this.tts = services?.tts?.ttsService;
    this.player = this.audio?.createPlayer();
    this.disposed = false;
    this.voiceSession = ++forgeAudioSession;
    this.voiceIndex = 0;
    this.generated = new Map();
    this.pending = new Map();
    this.failures = new Map();
    this.requests = new Set();
    this.settings = normalizeForgeAudio(host._run?.audio);
    this.manifest = this.audio?.getAssetManifest().catch(() => null) ?? Promise.resolve(null);
    this.library = [];
    this.libraryRevision = 0;
    this.unrecordedTracks = new Map();
    this.libraryRequest = this.refreshLibrary();
    this.configure(this.settings);
    this.onClick = (event) => {
      const button = event.target?.closest?.("button");
      if (!button || button.classList.contains("gf-mute")) return;
      this.player?.unlock();
      void this.effect("click");
    };
    host._root.addEventListener("click", this.onClick);
  }

  configure(value) {
    const previous = this.settings;
    this.settings = normalizeForgeAudio(value);
    if (previous && previous.homeMusic !== this.settings.homeMusic) this.currentCue = null;
    if (
      previous &&
      (previous.generate !== this.settings.generate || previous.audioConnectionId !== this.settings.audioConnectionId)
    ) {
      this.generationConfig = undefined;
      this.generationConnection = undefined;
      this.musicRevision = undefined;
    }
    if (
      previous &&
      (previous.homeMusic !== this.settings.homeMusic ||
        previous.muted !== this.settings.muted ||
        (previous.musicVolume === 0) !== (this.settings.musicVolume === 0))
    )
      this.musicRevision = undefined;
    if (
      previous &&
      ((!this.settings.generate && previous.generate) ||
        (this.settings.muted && !previous.muted) ||
        previous.audioConnectionId !== this.settings.audioConnectionId)
    ) {
      for (const request of this.requests) request.abort();
    }
    this.player?.setVolumes({ music: this.settings.musicVolume, sfx: this.settings.sfxVolume });
    this.player?.setMuted(this.settings.muted);
    if (this.settings.muted || !this.settings.tts || this.settings.dialogueVolume === 0) this.voiceAbort?.abort();
    if (this.tts?.getActiveId()?.startsWith(`gacha-forge:${this.runId}:`)) {
      this.tts.setCurrentPlaybackVolume(this.settings.dialogueVolume, this.settings.muted);
    }
  }

  refreshLibrary(track) {
    if (track) this.unrecordedTracks.set(track.tag, track);
    const revision = ++this.libraryRevision;
    this.libraryRequest = (this.libraryQueue ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.loadLibrary(revision));
    this.libraryQueue = this.libraryRequest;
    return this.libraryRequest;
  }

  async loadLibrary(revision) {
    if (this.disposed || this.host._run?.runId !== this.runId || typeof this.host._postJson !== "function")
      return this.library;
    try {
      let result;
      for (const track of this.unrecordedTracks.values()) {
        result = await this.host._postJson("/audio/library", { runId: this.runId, track });
        if (result?.error === "bad-request" || result?.error === "not-found") {
          this.unrecordedTracks.delete(track.tag);
          result = undefined;
          continue;
        }
        if (!result?.ok) return this.library;
        this.unrecordedTracks.delete(track.tag);
      }
      result ??= await this.host._postJson("/audio/library", { runId: this.runId });
      if (!result?.ok || !Array.isArray(result.tracks)) return this.library;
      // Older worlds already have context files in the Engine, before this package kept a song list.
      // Recover only this world's known cues and source, without making a generation request.
      try {
        const manifest = await this.manifest;
        const assets = Object.entries(manifest?.assets || {});
        if (assets.some(([tag]) => tag.startsWith("music:contexts:gacha-forge:world-"))) {
          const connectionId =
            this.settings.audioConnectionId ||
            this.generationConnection ||
            (await forgeAudioJson("/api/audio/config"))?.connectionId;
          if (connectionId)
            for (const cue of forgeSoundtrackCues) {
              if (this.disposed || this.host._run?.runId !== this.runId) return this.library;
              const key = forgeMusicContextKey(this.runId, connectionId, cue);
              const asset = assets.find(([tag]) => tag.startsWith(`music:contexts:gacha-forge:${key}:`));
              if (!asset || result.tracks.some((track) => track.tag === asset[0])) continue;
              const track = { cue, connectionId, tag: asset[0], path: asset[1].path };
              if (!recordForgeSoundtrack({}, this.runId, track)) continue;
              const saved = await this.host._postJson("/audio/library", { runId: this.runId, track });
              if (saved?.ok && Array.isArray(saved.tracks)) result = saved;
            }
        }
      } catch {
        /* A failed manifest/config read must preserve the persisted library. */
      }
      if (!this.disposed && this.host._run?.runId === this.runId && revision === this.libraryRevision)
        this.library = result.tracks;
    } catch {
      /* Keep the last successful library during temporary failures. */
    }
    return this.library;
  }

  notice(key, httpStatus, reason = "") {
    if (this.disposed) return;
    let status = this.host._root.querySelector("[data-forge-audio-status]");
    if (!status) {
      status = document.createElement("span");
      status.setAttribute("data-forge-audio-status", "");
      status.setAttribute("role", "status");
      status.className = "gf-audio-status";
      this.host._root.querySelector(".gf-stage")?.append(status);
    }
    this.noticeResize?.disconnect();
    status.textContent = forgeAudioEnglish[key]
      .replace("{status}", String(httpStatus))
      .replace("{reason}", () => reason);
    const dismiss = () => {
      clearTimeout(this.noticeTimer);
      this.noticeResize?.disconnect();
      status.onfocus = null;
      status.onblur = null;
      status.remove();
    };
    this.dismissNotice = dismiss;
    const scheduleDismissal = () => {
      clearTimeout(this.noticeTimer);
      if (!this.disposed && !(this.host._root.activeElement === status && status.tabIndex === 0)) {
        this.noticeTimer = setTimeout(dismiss, 6000);
      }
    };
    const measure = () => {
      if (this.disposed || !status.isConnected) return dismiss();
      const scrollable = status.clientHeight > 0 && status.scrollHeight > status.clientHeight;
      const changed = scrollable !== (status.tabIndex === 0);
      status.style.pointerEvents = scrollable ? "auto" : "none";
      status.tabIndex = scrollable ? 0 : -1;
      if (changed) scheduleDismissal();
    };
    status.onfocus = scheduleDismissal;
    status.onblur = scheduleDismissal;
    measure();
    this.noticeResize = new ResizeObserver(measure);
    this.noticeResize.observe(status);
    scheduleDismissal();
  }

  async generate(kind, cue, musicRevision) {
    const settings = this.settings;
    if (!settings.generate || this.disposed || settings.muted) return null;
    let probe = this.generationConfig;
    if (!probe || Date.now() - probe.at >= forgeAudioRetryMs) {
      const query = settings.audioConnectionId
        ? `?audioConnectionId=${encodeURIComponent(settings.audioConnectionId)}`
        : "";
      probe = this.generationConfig = {
        at: Date.now(),
        promise: forgeAudioJson(`/api/audio/config${query}`).catch(() => null),
      };
    }
    const config = await probe.promise;
    if (
      this.disposed ||
      probe !== this.generationConfig ||
      !this.settings.generate ||
      this.settings.muted ||
      this.settings.audioConnectionId !== settings.audioConnectionId ||
      (musicRevision !== undefined && musicRevision !== this.musicRevision) ||
      !config?.configured ||
      !config.connectionId ||
      config[kind === "music" ? "music" : "soundEffects"] !== true
    )
      return null;
    // Readiness can canonicalize a trusted legacy ID; retain the saved request and cache identity.
    const connectionId = settings.audioConnectionId || config.connectionId;
    this.generationConnection = connectionId;
    const cacheKey = `${connectionId}:${kind}:${cue}`;
    if (this.generated.has(cacheKey)) {
      const cached = this.generated.get(cacheKey);
      if (this.unrecordedTracks.has(cached.tag)) void this.refreshLibrary();
      return cached;
    }
    if (this.pending.has(cacheKey)) return this.pending.get(cacheKey);
    if (Date.now() - (this.failures.get(cacheKey) ?? 0) < forgeAudioRetryMs) return null;
    const abort = new AbortController();
    this.requests.add(abort);
    const world = String(this.host._run?.scenario || "").slice(0, 2000);
    const request = (async () => {
      let prompt = `A short game sound effect for ${cue}, no music or speech. World: ${world}`.slice(0, 500);
      if (kind === "music") {
        try {
          const brief = await forgeAudioJson("/api/gacha-forge/audio/prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abort.signal,
            body: JSON.stringify({ runId: this.runId, cue, debugMode: this.host.capabilityProps?.debugMode === true }),
          });
          if (
            this.disposed ||
            !this.settings.generate ||
            this.settings.muted ||
            this.settings.musicVolume === 0 ||
            this.settings.audioConnectionId !== settings.audioConnectionId ||
            (musicRevision !== undefined && musicRevision !== this.musicRevision) ||
            this.host._run?.runId !== this.runId
          )
            abort.abort();
          abort.signal.throwIfAborted();
          if (!brief?.ok || typeof brief.prompt !== "string" || !brief.prompt.trim() || brief.prompt.length > 1000)
            throw new Error("Music brief generation failed");
          prompt = brief.prompt.trim();
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          const failure = new Error("Music brief generation failed", { cause: error });
          failure.audioStage = "prompt";
          throw failure;
        }
      }
      abort.signal.throwIfAborted();
      return forgeAudioJson("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          kind,
          audioConnectionId: connectionId,
          prompt,
          ...(kind === "music"
            ? {
                context: {
                  scope: "gacha-forge",
                  key: forgeMusicContextKey(this.runId, connectionId, cue),
                  lengthMs: 60_000,
                },
              }
            : {}),
          debugMode: this.host.capabilityProps?.debugMode === true,
        }),
      });
    })()
      .then((result) => {
        if (typeof result?.tag !== "string" || typeof result?.path !== "string") throw new Error("Missing audio asset");
        this.generated.set(cacheKey, result);
        if (kind === "music") {
          void this.refreshLibrary({ ...result, cue, connectionId });
          // Keep this controller's manifest current without waiting for another scan.
          void this.manifest.then((manifest) => {
            if (manifest?.assets) manifest.assets[result.tag] = { path: result.path };
          });
        }
        return result;
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          this.failures.set(cacheKey, Date.now());
          this.notice(
            error.audioStage === "prompt"
              ? "audio.promptFailed"
              : error.reason
                ? "audio.generationReason"
                : error.httpStatus
                  ? "audio.generationRejected"
                  : "audio.generationFailed",
            error.httpStatus,
            ...(error.reason ? [error.reason] : []),
          );
        }
        return null;
      })
      .finally(() => {
        this.pending.delete(cacheKey);
        this.requests.delete(abort);
      });
    this.pending.set(cacheKey, request);
    return request;
  }

  async cue(cue) {
    if (!this.player || this.disposed) return;
    if (!cue) {
      this.musicRevision = null;
      return;
    }
    const enabled = this.settings.generate && !this.settings.muted && this.settings.musicVolume > 0;
    const revision = `${cue}:${enabled}:${this.settings.audioConnectionId}:${this.settings.homeMusic}`;
    if (revision === this.musicRevision && (!enabled || Date.now() - this.musicAttemptAt < forgeAudioRetryMs)) return;
    this.musicRevision = revision;
    this.musicAttemptAt = Date.now();
    const manifest = await this.manifest;
    if (this.disposed || revision !== this.musicRevision) return;
    const fallbackCue = cue.startsWith("banner-") ? "home" : cue;
    let selected;
    if (fallbackCue === "home" && this.settings.homeMusic) {
      await this.libraryRequest;
      if (this.disposed || revision !== this.musicRevision) return;
      selected = this.library.find((track) => track.tag === this.settings.homeMusic && manifest?.assets?.[track.tag]);
      if (selected && cue === "home") {
        this.currentCue = cue;
        if (selected.tag !== this.currentTag) this.player.playMusic(selected.tag, manifest.assets);
        this.currentTag = selected.tag;
        this.currentGenerated = false;
        return;
      }
    }
    if (
      cue !== this.currentCue ||
      (this.currentGenerated &&
        (!this.settings.generate || this.generatedConnection !== this.settings.audioConnectionId))
    ) {
      this.currentCue = cue;
      const tag =
        selected?.tag ??
        (manifest && this.audio.selectDefaultMusic(fallbackCue, manifest, { currentTag: this.currentTag }));
      if (tag) {
        if (tag !== this.currentTag) this.player.playMusic(tag, manifest.assets);
        this.currentTag = tag;
        this.currentGenerated = false;
      }
    }
    if (!enabled || (cue === "home" && this.settings.homeMusic)) return;
    const asset = await this.generate("music", cue, revision);
    if (asset && !this.disposed && revision === this.musicRevision && asset.tag !== this.currentTag) {
      this.currentTag = asset.tag;
      this.currentGenerated = true;
      this.generatedConnection = this.settings.audioConnectionId;
      this.player.playMusic(asset.tag, { [asset.tag]: { path: asset.path } });
    }
  }

  async effect(name) {
    if (!this.player || this.disposed || this.settings.muted || this.settings.sfxVolume === 0) return;
    const manifest = await this.manifest;
    if (this.disposed || this.settings.muted || this.settings.sfxVolume === 0) return;
    const asset = this.settings.generate
      ? this.generated.get(`${this.settings.audioConnectionId || this.generationConnection}:sfx:${name}`)
      : null;
    const tag = asset?.tag || forgeStockSfx[name];
    if (tag) this.player.playSfx(tag, asset ? { [tag]: { path: asset.path } } : manifest?.assets);
    // The first action stays immediate; a generated replacement is reused by later actions.
    void this.generate("sfx", name);
  }

  async speak(segment, cast, signal) {
    const initial = this.settings;
    if (
      !initial.tts ||
      initial.muted ||
      initial.dialogueVolume === 0 ||
      !this.tts ||
      !segment?.speaker ||
      segment.thought
    )
      return;
    const character = cast;
    if (!character?.characterId) return;
    const abort = new AbortController();
    this.voiceAbort?.abort();
    this.voiceAbort = abort;
    const cancel = () => abort.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) abort.abort();
    try {
      const config = await forgeAudioJson("/api/tts/config", { signal: abort.signal });
      const voice = forgeExplicitVoice(config, character.characterId);
      if (!voice || abort.signal.aborted || this.disposed) return;
      await this.tts.speakSequence(
        [
          {
            text: segment.text,
            speaker: segment.speaker,
            voice,
            characterId: character.characterId,
            cacheKey: forgeVoiceCacheKey(this.runId, segment, character, config, voice),
          },
        ],
        `gacha-forge:${this.runId}:${this.voiceSession}:${++this.voiceIndex}`,
        {
          signal: abort.signal,
          volume: this.settings.dialogueVolume,
          muted: this.settings.muted,
          throwOnError: true,
          audioConnectionId: config.connectionId || "",
        },
      );
    } catch (error) {
      if (error?.name !== "AbortError") this.notice("audio.voiceFailed");
    } finally {
      signal?.removeEventListener("abort", cancel);
      if (this.voiceAbort === abort) this.voiceAbort = null;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.noticeTimer);
    this.dismissNotice?.();
    this.voiceAbort?.abort();
    for (const request of this.requests) request.abort();
    this.host._root.removeEventListener("click", this.onClick);
    this.player?.dispose();
  }
}

export function forgeAudioCue(host) {
  const state = host._state?.();
  if (
    typeof state !== "string" ||
    ["boot", "themes", "runs", "unreachable", "setup", "banner", "art", "forge"].includes(state)
  )
    return null;
  if (state === "combat") {
    if (!["prebattle", "battle"].includes(host._combatPhase) || !host._combat) return null;
    return host._combat?.enemies?.some(
      (enemy) => enemy.boss || enemy.tier === "boss" || (Array.isArray(enemy.mech) && enemy.mech.length > 0),
    )
      ? "boss"
      : "combat";
  }
  if (state === "beat")
    return host._beatState === "ready"
      ? host._bondUnit
        ? "bond"
        : normalizeForgeMusicMood(host._forgeMusicMood)
      : null;
  if (host._hudView === "summon") {
    if (host._summonBannerState !== "ready" || !host._summonBanner?.banner?.music?.cue) return null;
    return host._summonBanner.banner.music.cue;
  }
  return "home";
}

export function disposeForgeAudio(host) {
  host._forgeAudio?.dispose();
  host._forgeAudio = null;
}

export function syncForgeAudio(host) {
  if (!host._run?.runId) {
    disposeForgeAudio(host);
    return null;
  }
  if (host._forgeAudio?.runId !== host._run.runId) disposeForgeAudio(host);
  const audio = (host._forgeAudio ??= new ForgeAudioController(host));
  audio.configure(host._run.audio);
  void audio.cue(forgeAudioCue(host));
  return audio;
}

export function wireForgeAudio(host) {
  const audio = syncForgeAudio(host);
  const root = host._root;
  const songs = root.querySelector('[data-input="audio.homeMusic"]');
  if (songs && !songs.dataset.forgeSongsLoading) {
    songs.dataset.forgeSongsLoading = "true";
    const selected = normalizeForgeAudio(host._run?.audio).homeMusic;
    songs.replaceChildren(new Option(forgeAudioEnglish["audio.settings.homeMusicDefault"], ""));
    if (selected) songs.add(new Option(forgeAudioEnglish["audio.soundtrackUnavailable"], selected));
    songs.value = selected;
    songs.disabled = true;
    Promise.all([audio?.refreshLibrary(), audio?.manifest]).then(([tracks, manifest]) => {
      if (!songs.isConnected || host._forgeAudio !== audio) return;
      const available = (tracks || []).filter((track) => manifest?.assets?.[track.tag]);
      songs.replaceChildren(new Option(forgeAudioEnglish["audio.settings.homeMusicDefault"], ""));
      for (const [index, track] of available.entries())
        songs.add(
          new Option(
            `${track.title || forgeAudioEnglish[`audio.song.${track.cue}`] || track.cue} (${index + 1})`,
            track.tag,
          ),
        );
      if (selected && !available.some((track) => track.tag === selected)) {
        const missing = new Option(forgeAudioEnglish["audio.soundtrackUnavailable"], selected);
        missing.disabled = true;
        songs.add(missing);
      }
      songs.value = selected;
      songs.disabled = false;
    });
  }
  // Combat's toolbar replaces the floating fullscreen control and its paired mute.
  for (const fullscreen of root.querySelectorAll(
    ".gf-fs-bar, .gf-fs-chapter, .gf-fs-portrait, .gf-stage:not(:has(.gf-view .gf-fs-bar)) > .gf-fs-exit",
  )) {
    if (host._run?.runId && !fullscreen.previousElementSibling?.classList.contains("gf-mute")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `icon-button gf-mute${fullscreen.classList.contains("gf-fs-chapter") ? " gf-mute-chapter" : ""}`;
      fullscreen.before(button);
    }
  }
  for (const button of root.querySelectorAll(".gf-mute")) {
    const muted = normalizeForgeAudio(host._run?.audio).muted;
    button.setAttribute("aria-label", forgeAudioEnglish[muted ? "audio.unmute" : "audio.mute"]);
    button.setAttribute("aria-pressed", String(muted));
    button.disabled = !host._run?.runId;
    button.title = button.getAttribute("aria-label");
    button.innerHTML = forgeAudioIcons[muted ? "muted" : "sound"];
    button.onclick = async (event) => {
      event.stopPropagation();
      audio?.player?.unlock();
      button.disabled = true;
      await host._setSources({ audio: { muted: !muted } });
      wireForgeAudio(host);
    };
  }
  for (const field of forgeAudioFields().filter((item) => item.type === "range")) {
    const input = root.querySelector(`[data-input="${field.id}"]`);
    if (!input) continue;
    input.oninput = () => {
      const label = root.querySelector(`[data-range-say="${field.id}"]`);
      if (label) label.textContent = field.rangeLabel(input.value);
      if (host._run && field.id !== "audio.autoplayPauseSeconds") {
        audio?.configure({ ...host._run.audio, [field.id.split(".")[1]]: Number(input.value) });
      }
    };
  }
}

export function saveForgeAudioSources(host, sources) {
  if (!sources?.audio) return host._setSourcesNow(sources);
  const runId = host._run?.runId;
  const save = () => {
    if (host._run?.runId !== runId) return;
    return host
      ._setSourcesNow({ ...sources, audio: normalizeForgeAudio({ ...host._run.audio, ...sources.audio }) })
      .finally(() => wireForgeAudio(host));
  };
  const next = (host._forgeAudioSave ?? Promise.resolve()).catch(() => {}).then(save);
  host._forgeAudioSave = next;
  return next;
}

export function forgeCombatSound(audio, event) {
  const name =
    event.op === "hit" && event.crit
      ? "critical"
      : event.op === "end"
        ? event.result === "lose"
          ? "lose"
          : "win"
        : event.op;
  if (forgeStockSfx[name]) void audio?.effect(name);
}

export async function loadForgeAudioConnections(root, values) {
  const select = root.querySelector('[data-input="audio.audioConnectionId"]');
  if (!select || select.dataset.forgeAudioLoading) return;
  select.dataset.forgeAudioLoading = "true";
  const selected = values?.["audio.audioConnectionId"] || "";
  const isTrue = (value) => value === true || value === "true";
  const populate = (entries, emptyLabel = forgeAudioEnglish["audio.settings.connectionEmpty"]) => {
    select.replaceChildren(new Option(emptyLabel, ""));
    for (const connection of entries) {
      const channels =
        isTrue(connection.audioMusic) && isTrue(connection.audioSoundEffects)
          ? ""
          : forgeAudioEnglish[isTrue(connection.audioMusic) ? "audio.settings.musicOnly" : "audio.settings.sfxOnly"];
      const name = connection.name || connection.model || connection.id;
      select.add(new Option(channels ? `${name} (${channels})` : name, connection.id));
    }
    if (selected && !entries.some((connection) => connection.id === selected)) {
      const unavailable = new Option(forgeAudioEnglish["audio.settings.connectionUnavailable"], selected);
      unavailable.disabled = true;
      select.add(unavailable);
    }
    select.value = selected;
  };
  // Preserve restored setup values before its synchronous form reader runs, including during a failed fetch.
  populate([]);
  select.disabled = true;
  try {
    const response = await forgeAudioJson("/api/connections");
    const connections = Array.isArray(response) ? response : response?.connections || [];
    const entries = connections.filter(
      (connection) =>
        connection?.provider === "audio_generation" &&
        !isTrue(connection.profileImportReviewRequired) &&
        (isTrue(connection.audioMusic) || isTrue(connection.audioSoundEffects)),
    );
    populate(entries);
  } catch {
    populate([], forgeAudioEnglish["audio.connectionsFailed"]);
  } finally {
    select.disabled = false;
  }
}
