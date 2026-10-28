// ──────────────────────────────────────────────
// Otome Forge: music and voices, through the Engine's own player (`services.audio.createPlayer()`) and voice service
// (`services.tts.ttsService`), as Gacha Forge's audio client does it.
// ──────────────────────────────────────────────
// - Music: the cue's generated track when this story has one, otherwise the Engine's stock track for its stand-in cue
//   (lib/audio.ts). With "Generate music" on, a cue without a track is made once on the audio connection: Otome's brief
//   (POST .../audio/brief), then POST /api/audio/generate (with debugMode, so the Engine logs the prompt), then the track
//   is recorded on the story (POST .../audio/track). A track the Engine already filed under the story's key (a record
//   that failed last time) is reused, never paid for twice. A failed generation is not tried again until the music
//   settings change; stock music plays meanwhile. Nothing is generated while generation is off, muted or silent as
//   saved: Settings → Audio's unsaved preview of Mute and the volumes changes only what is heard.
// - Voices: the kit's voice picking over the Engine's TTS settings (explicit assignments win; the protagonist uses her
//   persona's voice or stays silent; love interests and, with "voice everyone else", anyone else get the Engine's pool
//   voice for their gender). Narration and thoughts are never voiced. Each line has a cache key, so a replay from the
//   backlog plays the saved clip; a comfort line (M3's Rough day?) is voiced with none, so it never lands in the
//   Engine's audio cache (plan §1.9).
// - One controller per story. <OtomeAudioProvider> makes it; a provider inside another one adds nothing, so OtomeForgeView
//   can hold one for every screen and the reader still works on its own. A screen claims its music cue with
//   useMusicCue; the newest claim wins, and the provider's own cue plays when none is held.
import {
  Fragment,
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { forgeSoundtrackContextKey, normalizeForgeAudio } from "@forge-kit/audio-settings.mjs";
import { forgeSpeakerVoice } from "@forge-kit/voice-picking.mjs";
import { host } from "marinara:host";
import { api } from "../../../lib/api-client";
import { ttsService, ttsUnavailableReason } from "../../../lib/tts-service";
import { useOtomeApi } from "../api";
import {
  ENGINE_MUSIC_CUE,
  MUSIC_LENGTH_MS,
  MUSIC_SCOPE,
  lineSpeaker,
  runIdOf,
  voiceCacheKey,
  worldTracks,
  wouldVoice,
  type EngineMusicCue,
} from "../lib/audio";
import { useOtomeProps } from "../props";
import type { AudioSettings, Player, RunLiView, RunView, Segment, SoundtrackTrack } from "../shared/api-types";
import type { MusicMood } from "../shared/faces";
import { patchRun } from "./use-run";

// ── The Engine's audio service, as Otome reads it (lib/audio-service.ts, capability API 1.381) ──

type AssetMap = Record<string, { path: string }>;
interface AssetManifest {
  assets: AssetMap;
}
interface HostPlayer {
  unlock(): void;
  playMusic(tag: string, assets?: AssetMap | null): void;
  stopMusic(immediate?: boolean): void;
  playSfx(tag: string, assets?: AssetMap | null): void;
  setVolumes(volumes: { music: number; sfx: number }): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}
interface HostAudio {
  createPlayer(): HostPlayer;
  getAssetManifest(): Promise<AssetManifest>;
  selectDefaultMusic(
    cue: EngineMusicCue,
    manifest: AssetManifest,
    options?: { currentTag?: string | null },
  ): string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The Engine's audio service, or null on an Engine without it (the game then plays silently). */
function hostAudio(): HostAudio | null {
  const services = (host as Record<string, unknown>).services;
  const audio = isRecord(services) ? services.audio : undefined;
  return isRecord(audio) &&
    typeof audio.createPlayer === "function" &&
    typeof audio.getAssetManifest === "function" &&
    typeof audio.selectDefaultMusic === "function"
    ? (audio as unknown as HostAudio)
    : null;
}

/** GET /api/audio/config: whether the audio connection can make music. */
interface AudioReadiness {
  connectionId: string | null;
  configured: boolean;
  music: boolean;
}

/** A readiness check or voice list is kept this long, then read again. */
const PROBE_MS = 60_000;
const TTS_CONFIG_MS = 30_000;

export type SpeakOutcome = "spoken" | "silent" | "failed" | "stopped";
export type AudioNoticeKind = "musicFailed" | "voiceFailed";

interface AudioSnapshot {
  /** The newest notice; `id` changes with each one. */
  notice: { id: number; kind: AudioNoticeKind } | null;
  /** The ref of the line being voiced, or null. */
  speaking: string | null;
  /** Changes with the voice settings, so a screen asks wouldSpeak again (the provider applies them after its children). */
  settings: number;
}

interface ControllerDeps {
  post: ReturnType<typeof useOtomeApi>["post"];
  debugMode: boolean;
  lis: readonly RunLiView[];
  player: Pick<Player, "name" | "personaId">;
  onTracks: (tracks: SoundtrackTrack[]) => void;
}

/** A screen's music: a cue, null for silence, or undefined for no opinion (the cue beneath it plays on). */
type HeldCue = MusicMood | null | undefined;

interface CueClaim {
  set(cue: HeldCue): void;
  release(): void;
}

export class OtomeAudioController {
  readonly runKey: string;
  private readonly audio = hostAudio();
  private readonly player: HostPlayer | null;
  private readonly manifest: Promise<AssetManifest | null>;
  private deps: ControllerDeps | null = null;
  private settings: AudioSettings = normalizeForgeAudio({});
  /** The story's saved settings: only these start or stop music generation (`settings` may be a preview). */
  private saved: AudioSettings = this.settings;
  private tracks: SoundtrackTrack[] = [];
  /** Tracks made in this visit: the manifest read at the start does not list them. */
  private readonly fresh = new Set<string>();
  private baseCue: MusicMood | null = null;
  private claims: Array<{ id: number; cue: HeldCue }> = [];
  private claimId = 0;
  private currentCue: MusicMood | null = null;
  private currentTag: string | null = null;
  private revision = 0;
  private readiness: { at: number; connection: string; promise: Promise<AudioReadiness | null> } | null = null;
  private probedConnection = "";
  private readonly pending = new Map<string, Promise<SoundtrackTrack | null>>();
  /** `${connection}:${cue}` that failed: never generated again until the music settings change. */
  private readonly failed = new Set<string>();
  private readonly requests = new Set<AbortController>();
  private ttsConfig: { at: number; promise: Promise<unknown> } | null = null;
  private readonly voiceLists = new Map<string, Promise<string[]>>();
  private voiceAbort: AbortController | null = null;
  private voiceIndex = 0;
  private disposed = false;
  private snapshot: AudioSnapshot = { notice: null, speaking: null, settings: 0 };
  private noticeId = 0;
  private readonly listeners = new Set<() => void>();

  constructor(runKey: string) {
    this.runKey = runKey;
    this.player = this.audio?.createPlayer() ?? null;
    // A manifest that cannot be read (or reads oddly) is no manifest: stock music is then simply not played.
    this.manifest = this.audio
      ? this.audio
          .getAssetManifest()
          .then((manifest) => (isRecord(manifest) && isRecord(manifest.assets) ? manifest : null))
          .catch(() => null)
      : Promise.resolve(null);
  }

  // ── State for React ──

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  private update(change: Partial<AudioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }

  private notify(kind: AudioNoticeKind) {
    if (!this.disposed) this.update({ notice: { id: (this.noticeId += 1), kind } });
  }

  // ── Settings ──

  setDeps(deps: ControllerDeps) {
    this.deps = deps;
  }

  get audioSettings(): AudioSettings {
    return this.settings;
  }

  /** `next` plays now; `saved` is the story's (Settings → Audio passes both while it previews Mute and the volumes). */
  configure(next: AudioSettings, saved: AudioSettings = next) {
    const previous = this.settings;
    const before = this.saved;
    this.settings = next;
    this.saved = saved;
    const source = before.generate !== saved.generate || before.audioConnectionId !== saved.audioConnectionId;
    if (source) {
      // A new source starts clean: what failed on the old one may work now (the player changed it, never a timer).
      this.abortGeneration();
      this.failed.clear();
      this.readiness = null;
      this.probedConnection = "";
    }
    if (!this.canGenerate()) this.abortGeneration();
    this.player?.setVolumes({ music: next.musicVolume, sfx: next.sfxVolume });
    this.player?.setMuted(next.muted);
    if (next.muted || !next.tts || next.dialogueVolume <= 0) this.stopVoice();
    else if (ttsService.getActiveId()?.startsWith(this.voicePrefix)) {
      ttsService.setCurrentPlaybackVolume(next.dialogueVolume, next.muted);
    }
    // A save that opens or closes generation plays the cue again (a preview only changes the levels it plays at).
    if (source || before.muted !== saved.muted || before.musicVolume <= 0 !== saved.musicVolume <= 0) {
      void this.applyCue(true);
    }
    const voices = (value: AudioSettings) =>
      [value.tts, value.otherVoices, value.muted, value.dialogueVolume > 0].join();
    if (voices(previous) !== voices(next)) this.update({ settings: this.snapshot.settings + 1 });
  }

  /** The story's recorded tracks (a refetched view); tracks made in this visit stay until the record lists them. */
  setTracks(tracks: SoundtrackTrack[]) {
    const known = new Set(this.tracks.map((track) => track.tag));
    const listed = new Set(tracks.map((track) => track.tag));
    const added = tracks.some((track) => !known.has(track.tag));
    this.tracks = [...tracks, ...this.tracks.filter((track) => this.fresh.has(track.tag) && !listed.has(track.tag))];
    if (added) void this.applyCue(true);
  }

  // ── Music ──

  setBaseCue(cue: MusicMood | null) {
    this.baseCue = cue;
    void this.applyCue();
  }

  /** Holds a cue while a screen shows; the newest hold wins. */
  claim(cue: HeldCue): CueClaim {
    const id = (this.claimId += 1);
    this.claims.push({ id, cue });
    void this.applyCue();
    return {
      set: (next) => {
        const held = this.claims.find((item) => item.id === id);
        if (!held || held.cue === next) return;
        held.cue = next;
        void this.applyCue();
      },
      release: () => {
        this.claims = this.claims.filter((item) => item.id !== id);
        void this.applyCue();
      },
    };
  }

  private effectiveCue(): MusicMood | null {
    for (let index = this.claims.length - 1; index >= 0; index -= 1) {
      const held = this.claims[index]!.cue;
      if (held !== undefined) return held;
    }
    return this.baseCue;
  }

  /** A stock sound from the Engine's library (`sfx:ui:<name>`) at the effects volume; silent while muted (M4). */
  playSfx(tag: string) {
    if (!this.player || this.disposed || this.settings.muted || this.settings.sfxVolume <= 0) return;
    void this.manifest.then((manifest) => {
      if (!this.disposed) this.player?.playSfx(tag, manifest?.assets ?? null);
    });
  }

  /** Lets the player start music: the Engine waits for an interaction before it plays anything. */
  unlock() {
    this.player?.unlock();
  }

  /** Generation is on as saved, and on the connection a request started with (compared by value, not identity). */
  private canGenerate(connection = this.saved.audioConnectionId) {
    const settings = this.saved;
    return (
      settings.generate && !settings.muted && settings.musicVolume > 0 && settings.audioConnectionId === connection
    );
  }

  private play(tag: string, assets: AssetMap | null) {
    if (!this.player || tag === this.currentTag) return;
    this.player.playMusic(tag, assets);
    this.currentTag = tag;
  }

  /** A recorded track whose file the Engine still lists (or one made in this visit, which its manifest predates). */
  private listed(track: SoundtrackTrack, manifest: AssetManifest | null) {
    return !manifest || !!manifest.assets[track.tag] || this.fresh.has(track.tag);
  }

  /** The story's track for a cue: the current connection's first, then any other (playing one costs nothing). */
  private trackFor(cue: MusicMood, connection: string, manifest: AssetManifest | null) {
    const usable = (track: SoundtrackTrack) => track.cue === cue && this.listed(track, manifest);
    return (
      this.tracks.find((track) => usable(track) && !!connection && track.connectionId === connection) ??
      this.tracks.find(usable) ??
      null
    );
  }

  /** Plays the cue now held (never throws: a scene goes on without music). */
  private async applyCue(force = false) {
    try {
      await this.playCue(force);
    } catch (error) {
      console.warn("Otome Forge could not play music", error);
    }
  }

  private async playCue(force: boolean) {
    if (!this.player || this.disposed) return;
    const cue = this.effectiveCue();
    if (!force && cue === this.currentCue) return;
    const revision = (this.revision += 1);
    this.currentCue = cue;
    if (!cue) {
      if (this.currentTag) this.player.stopMusic();
      this.currentTag = null;
      return;
    }
    const manifest = await this.manifest;
    if (this.disposed || revision !== this.revision) return;
    const connection = this.settings.audioConnectionId || this.probedConnection;
    const track = this.trackFor(cue, connection, manifest);
    if (track) this.play(track.tag, { [track.tag]: { path: track.path } });
    else {
      const stock = manifest
        ? this.audio?.selectDefaultMusic(ENGINE_MUSIC_CUE[cue], manifest, { currentTag: this.currentTag })
        : null;
      if (stock && manifest) this.play(stock, manifest.assets);
    }
    if (!this.canGenerate() || (track && !!connection && track.connectionId === connection)) return;
    const made = await this.generate(cue);
    if (made && !this.disposed && revision === this.revision) this.play(made.tag, { [made.tag]: { path: made.path } });
  }

  private abortGeneration() {
    for (const request of this.requests) request.abort();
    this.requests.clear();
  }

  private ready(connection: string): Promise<AudioReadiness | null> {
    const cached = this.readiness;
    if (cached && cached.connection === connection && Date.now() - cached.at < PROBE_MS) return cached.promise;
    const query = connection ? `?audioConnectionId=${encodeURIComponent(connection)}` : "";
    const promise = api.get<AudioReadiness>(`/audio/config${query}`).catch(() => null);
    this.readiness = { at: Date.now(), connection, promise };
    return promise;
  }

  /** Makes the cue's track once on this story's audio connection; null when it cannot or did not. */
  private generate(cue: MusicMood): Promise<SoundtrackTrack | null> {
    const chosen = this.saved.audioConnectionId;
    const deps = this.deps;
    if (!deps) return Promise.resolve(null);
    const job = (async (): Promise<SoundtrackTrack | null> => {
      const readiness = await this.ready(chosen);
      const manifest = await this.manifest;
      if (this.disposed || !this.canGenerate(chosen)) return null;
      if (!readiness?.configured || !readiness.connectionId || readiness.music !== true) return null;
      const connectionId = chosen || readiness.connectionId;
      this.probedConnection = connectionId;
      const id = `${connectionId}:${cue}`;
      // A record whose file is gone from the Engine is made again (the stock track plays meanwhile).
      const owned = this.tracks.find(
        (track) => track.cue === cue && track.connectionId === connectionId && this.listed(track, manifest),
      );
      if (owned) return owned;
      if (this.failed.has(id)) return null;
      const running = this.pending.get(id);
      if (running) return running;
      const request = this.makeTrack(cue, chosen, connectionId, deps).finally(() => this.pending.delete(id));
      this.pending.set(id, request);
      return request;
    })();
    return job;
  }

  private async makeTrack(
    cue: MusicMood,
    chosen: string,
    connectionId: string,
    deps: ControllerDeps,
  ): Promise<SoundtrackTrack | null> {
    const key = forgeSoundtrackContextKey(runIdOf(this.runKey), connectionId, cue);
    const abort = new AbortController();
    this.requests.add(abort);
    try {
      // A track the Engine already filed under this story's key (its record failed last time) is never paid twice.
      const manifest = await this.manifest;
      const prefix = `music:contexts:${MUSIC_SCOPE}:${key}:`;
      const filed = Object.entries(manifest?.assets ?? {}).find(([tag]) => tag.startsWith(prefix));
      let asset: { tag: string; path: string };
      if (filed) asset = { tag: filed[0], path: filed[1].path };
      else {
        const brief = await deps.post<{ prompt?: unknown }>(
          `/runs/${encodeURIComponent(this.runKey)}/audio/brief`,
          { cue },
          { signal: abort.signal },
        );
        const prompt = typeof brief?.prompt === "string" ? brief.prompt.trim() : "";
        if (!prompt) throw new Error("The music brief was empty");
        // The player may have turned generation off while the brief was written: the paid call is then never made.
        if (!this.canGenerate(chosen)) abort.abort();
        abort.signal.throwIfAborted();
        const made = await api.post<{ tag?: unknown; path?: unknown }>(
          "/audio/generate",
          {
            kind: "music",
            prompt,
            audioConnectionId: connectionId,
            debugMode: deps.debugMode,
            context: { scope: MUSIC_SCOPE, key, lengthMs: MUSIC_LENGTH_MS },
          },
          { signal: abort.signal },
        );
        if (typeof made?.tag !== "string" || typeof made.path !== "string") throw new Error("No audio asset came back");
        asset = { tag: made.tag, path: made.path };
      }
      const track: SoundtrackTrack = { cue, connectionId, tag: asset.tag, path: asset.path };
      this.fresh.add(track.tag);
      this.tracks = [...this.tracks.filter((item) => item.tag !== track.tag), track];
      // Recorded on the story, so the next visit plays it with no new call. A failed record keeps it for this visit;
      // the next one finds the file under the same key.
      try {
        const saved = await deps.post<{ tracks?: unknown }>(`/runs/${encodeURIComponent(this.runKey)}/audio/track`, {
          ...track,
        });
        if (Array.isArray(saved?.tracks)) deps.onTracks(saved.tracks as SoundtrackTrack[]);
      } catch (error) {
        console.warn("Otome Forge could not record a generated track", error);
      }
      return track;
    } catch (error) {
      if (!abort.signal.aborted && (error as { name?: string })?.name !== "AbortError") {
        this.failed.add(`${connectionId}:${cue}`);
        console.warn("Otome Forge could not generate music", error);
        this.notify("musicFailed");
      }
      return null;
    } finally {
      this.requests.delete(abort);
    }
  }

  // ── Voices ──

  private get voicePrefix() {
    return `otome-forge:${this.runKey}:`;
  }

  /** True when this line would be voiced with the current settings (its voice may still turn out to be none). */
  wouldSpeak(segment: Segment): boolean {
    const deps = this.deps;
    if (!deps || ttsUnavailableReason) return false;
    return wouldVoice(this.settings, lineSpeaker(segment, deps.lis, deps.player));
  }

  private readTtsConfig(): Promise<unknown> {
    const cached = this.ttsConfig;
    if (cached && Date.now() - cached.at < TTS_CONFIG_MS) return cached.promise;
    const promise = api.get<unknown>("/tts/config").catch((error: unknown) => {
      this.ttsConfig = null;
      throw error;
    });
    this.ttsConfig = { at: Date.now(), promise };
    return promise;
  }

  /** The connection's voices, once per connection for this visit; a failed read is not kept. */
  private listVoices = (config: unknown): Promise<string[]> => {
    const id = isRecord(config) && typeof config.connectionId === "string" ? config.connectionId : "";
    const listed = this.voiceLists.get(id);
    if (listed) return listed;
    const request = api
      .get<{ voices?: unknown }>(`/tts/voices${id ? `?connectionId=${encodeURIComponent(id)}` : ""}`)
      .then((result) =>
        [
          ...new Set(
            (Array.isArray(result?.voices) ? result.voices : []).filter(
              (voice): voice is string => typeof voice === "string" && !!voice,
            ),
          ),
        ].sort(),
      )
      .catch((error: unknown) => {
        this.voiceLists.delete(id);
        throw error;
      });
    this.voiceLists.set(id, request);
    return request;
  };

  /**
   * Voices one line (stopping any other); resolves when it has played, or at once when nobody would voice it. `cache`
   * false voices it with no cache key.
   */
  async speak(segment: Segment, ref: string, { cache = true }: { cache?: boolean } = {}): Promise<SpeakOutcome> {
    const deps = this.deps;
    const settings = this.settings;
    const speaker = deps ? lineSpeaker(segment, deps.lis, deps.player) : null;
    if (this.disposed || ttsUnavailableReason || !wouldVoice(settings, speaker)) return "silent";
    this.stopVoice();
    const abort = new AbortController();
    this.voiceAbort = abort;
    this.update({ speaking: ref });
    try {
      const config = await this.readTtsConfig();
      const voice = await forgeSpeakerVoice(config, speaker, speaker.cast || settings.otherVoices, this.listVoices);
      if (abort.signal.aborted || this.disposed) return "stopped";
      if (!voice) return "silent";
      const connectionId = isRecord(config) && typeof config.connectionId === "string" ? config.connectionId : "";
      await ttsService.speakSequence(
        [
          {
            text: segment.text,
            speaker: segment.speaker,
            voice,
            ...(speaker.characterId ? { characterId: speaker.characterId } : {}),
            ...(cache ? { cacheKey: voiceCacheKey(this.runKey, ref) } : {}),
          },
        ],
        `${this.voicePrefix}${(this.voiceIndex += 1)}`,
        {
          signal: abort.signal,
          volume: settings.dialogueVolume,
          muted: settings.muted,
          throwOnError: true,
          audioConnectionId: connectionId,
        },
      );
      return abort.signal.aborted ? "stopped" : "spoken";
    } catch (error) {
      if (abort.signal.aborted || (error as { name?: string })?.name === "AbortError") return "stopped";
      console.warn("Otome Forge could not voice a line", error);
      this.notify("voiceFailed");
      return "failed";
    } finally {
      if (this.voiceAbort === abort) {
        this.voiceAbort = null;
        this.update({ speaking: null });
      }
    }
  }

  stopVoice() {
    this.voiceAbort?.abort();
    this.voiceAbort = null;
    if (this.snapshot.speaking) this.update({ speaking: null });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortGeneration();
    this.stopVoice();
    this.player?.dispose();
    this.listeners.clear();
  }
}

// ── React ──

const OtomeAudioContext = createContext<OtomeAudioController | null>(null);

interface ProviderProps {
  /** The story whose music and voices play; none, no audio. */
  run: RunView | null;
  /** The cue while no screen holds one (Home and the story screens: "home"); null is silence. */
  cue?: MusicMood | null;
  children: ReactNode;
}

/** The story's audio for everything inside it. Inside another provider it adds nothing: the outer one plays. */
export function OtomeAudioProvider({ run, cue = null, children }: ProviderProps) {
  const outer = useContext(OtomeAudioContext);
  return outer ? createElement(Fragment, null, children) : createElement(AudioScope, { run, cue, children });
}

function AudioScope({ run, cue = null, children }: ProviderProps) {
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const { debugMode } = useOtomeProps();
  const runKey = run?.runKey ?? null;
  const [controller, setController] = useState<OtomeAudioController | null>(null);

  useEffect(() => {
    if (!runKey) return;
    const made = new OtomeAudioController(runKey);
    setController(made);
    return () => {
      made.dispose();
      setController((current) => (current === made ? null : current));
    };
  }, [runKey]);

  controller?.setDeps({
    post: otome.post,
    debugMode,
    lis: run?.lis ?? [],
    player: run?.player ?? { name: "", personaId: "" },
    onTracks: (tracks) => {
      if (!runKey) return;
      patchRun(queryClient, runKey, (view) => ({
        ...view,
        world: { ...view.world, audio: { ...view.world.audio, tracks } },
      }));
    },
  });

  // Keyed on the saved values, not the record: a track landing (or a refetch) gives world.audio a new identity, and
  // configuring again then would undo a Settings → Audio preview of Mute or the volumes.
  const settingsKey = JSON.stringify(normalizeForgeAudio(run?.world.audio));
  const settings = useMemo(() => JSON.parse(settingsKey) as AudioSettings, [settingsKey]);
  useEffect(() => controller?.configure(settings), [controller, settings]);
  const world = run?.world ?? null;
  useEffect(() => {
    if (controller && world) controller.setTracks(worldTracks(world));
  }, [controller, world]);
  useEffect(() => controller?.setBaseCue(cue), [controller, cue]);

  // The Engine starts no sound before an interaction; any tap or key inside the game counts.
  useEffect(() => {
    if (!controller) return;
    const unlock = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-otome-forge-root]")) controller.unlock();
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
  }, [controller]);

  return createElement(OtomeAudioContext.Provider, { value: controller }, children);
}

/** The story's audio controller, or null outside a provider (or before it is ready): then nothing plays. */
export function useOtomeAudio(): OtomeAudioController | null {
  return useContext(OtomeAudioContext);
}

const NO_SNAPSHOT: AudioSnapshot = { notice: null, speaking: null, settings: 0 };
const noSubscription = () => () => undefined;

/** The newest audio notice and the line being voiced. */
export function useAudioSnapshot(): AudioSnapshot {
  const audio = useOtomeAudio();
  return useSyncExternalStore(
    audio?.subscribe ?? noSubscription,
    audio ? audio.getSnapshot : () => NO_SNAPSHOT,
    () => NO_SNAPSHOT,
  );
}

/** Holds a music cue while the calling screen shows; null holds silence, undefined lets the cue beneath play. */
export function useMusicCue(cue: HeldCue) {
  const audio = useOtomeAudio();
  const claim = useRef<CueClaim | null>(null);
  const latest = useRef(cue);
  latest.current = cue;
  useEffect(() => {
    if (!audio) return;
    const held = audio.claim(latest.current);
    claim.current = held;
    return () => {
      held.release();
      if (claim.current === held) claim.current = null;
    };
  }, [audio]);
  useEffect(() => claim.current?.set(cue), [cue]);
}
