// ──────────────────────────────────────────────
// Otome Hearth: the toys on the client (0.34.0): what plays now, the remote in Messages, and Stop
// ──────────────────────────────────────────────
// The server's loop plays the cues (S/haptics.ts); this keeps it alive while what started it is on screen (a line in the
// reader, a message of his while he holds the remote), every KEEP_MS, and lets it go otherwise: without a keep the
// server ends it by itself, so a closed tab never leaves a toy running.
// - play(key, cues): what plays from now on, named by what started it. The same key again does nothing; a key the
//   player stopped does not start again (a later cue does).
// - release(key): what `key` started has left the screen. Stopping waits a tick, so a cue replaced by the next line's
//   never stops between them.
// - stop(): the player's Stop: the loop ends and every toy stops, and what was playing does not start again.
// - The remote: how long he holds it, per love interest, kept in this browser (it is the player's own hand-over, and
//   only her messages to him carry it to the server). It ends by itself; Take it back ends it at once.
// Haptics play only while the story's are on (SH/haptics.ts hapticsOn); turning them off stops the toys.
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useOtomeApi } from "../api";
import type { HapticCue, LiId, RunView } from "../shared/api-types";
import { hapticsOn } from "../shared/haptics";

/** How often the client says its line or message is still on screen (the server waits 15 seconds). */
const KEEP_MS = 5000;
/** How often a held remote is checked for running out. */
const REMOTE_CHECK_MS = 15_000;
/** The durations the player may hand the remote over for, in minutes. */
export const REMOTE_MINUTES = [15, 30, 60] as const;

const remoteStoreKey = (runKey: string) => `otome-forge:remote:${runKey}`;

type Post = <T>(path: string, body?: Record<string, unknown>) => Promise<T>;

export interface HapticsSnapshot {
  /** The toys are playing what the story or a message asked for. */
  playing: boolean;
  /** When each love interest's hold on the remote ends (ms since the epoch). */
  remote: Partial<Record<LiId, number>>;
}

/** The key a message of his plays under (Thread.tsx), so taking the remote back stops only his. */
export const phoneHapticKey = (li: LiId, messageId: string) => `phone:${li}:${messageId}`;

export class OtomeHapticsController {
  private snapshot: HapticsSnapshot = { playing: false, remote: {} };
  private readonly listeners = new Set<() => void>();
  private post: Post | null = null;
  private on = false;
  private playing: string | null = null;
  private stopped: string | null = null;
  private keepTimer: ReturnType<typeof setInterval> | null = null;
  private remoteTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(private readonly runKey: string) {
    this.snapshot = { ...this.snapshot, remote: this.loadRemote() };
    this.watchRemote();
  }

  setDeps({ post, on }: { post: Post; on: boolean }) {
    this.post = post;
    const was = this.on;
    this.on = on;
    if (was && !on && this.playing) this.stop();
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = () => this.snapshot;

  private update(change: Partial<HapticsSnapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }

  private path(action: string) {
    return `/runs/${encodeURIComponent(this.runKey)}/haptics/${action}`;
  }

  private send(action: string, body: Record<string, unknown> = {}) {
    return this.post ? this.post<unknown>(this.path(action), body) : Promise.resolve(null);
  }

  play(key: string, cues: readonly HapticCue[]) {
    if (this.disposed || !this.on || !this.post || key === this.playing || key === this.stopped) return;
    if (!cues.some((cue) => cue.action !== "stop")) {
      // A line of stops: the toys stop, and nothing plays until the next cue.
      this.end();
      void this.send("stop").catch(() => undefined);
      return;
    }
    this.playing = key;
    this.stopped = null;
    this.update({ playing: true });
    void this.send("play", { cues }).catch((error: unknown) => {
      console.warn("Otome Hearth could not play the toys", error);
      if (this.playing === key) this.end();
    });
    if (!this.keepTimer) {
      this.keepTimer = setInterval(() => {
        if (!this.playing) return;
        void this.send("keep")
          .then((result) => {
            // The loop ended on the server (another story played, or Stop elsewhere): nothing plays here either.
            if ((result as { kept?: boolean } | null)?.kept === false) this.end();
          })
          .catch(() => undefined);
      }, KEEP_MS);
    }
  }

  release(key: string) {
    setTimeout(() => {
      if (this.playing !== key) return;
      this.end();
      void this.send("stop").catch(() => undefined);
    }, 0);
  }

  /** The player's Stop: always sent, whatever is playing, so a toy another tab started stops too. */
  stop() {
    if (this.playing) this.stopped = this.playing;
    this.end();
    void this.send("stop").catch(() => undefined);
  }

  private end() {
    this.playing = null;
    if (this.keepTimer) clearInterval(this.keepTimer);
    this.keepTimer = null;
    if (this.snapshot.playing) this.update({ playing: false });
  }

  /** Minutes left on his hold of the remote, rounded up; 0 when he does not hold it. */
  remoteMinutes(li: LiId, now = Date.now()) {
    const until = this.snapshot.remote[li] ?? 0;
    return until > now ? Math.ceil((until - now) / 60_000) : 0;
  }

  giveRemote(li: LiId, minutes: number) {
    this.setRemote({ ...this.snapshot.remote, [li]: Date.now() + minutes * 60_000 });
  }

  takeRemote(li: LiId) {
    const { [li]: _held, ...rest } = this.snapshot.remote;
    this.setRemote(rest);
    if (this.playing?.startsWith(`phone:${li}:`)) this.stop();
  }

  private setRemote(remote: HapticsSnapshot["remote"]) {
    this.update({ remote });
    try {
      localStorage.setItem(remoteStoreKey(this.runKey), JSON.stringify(remote));
    } catch {
      // A browser that keeps nothing: the hold lasts while this tab does.
    }
  }

  private loadRemote(): HapticsSnapshot["remote"] {
    try {
      const saved = JSON.parse(localStorage.getItem(remoteStoreKey(this.runKey)) ?? "{}") as Record<string, unknown>;
      const now = Date.now();
      return Object.fromEntries(
        Object.entries(saved).filter(
          (entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > now,
        ),
      );
    } catch {
      return {};
    }
  }

  private watchRemote() {
    this.remoteTimer = setInterval(() => {
      const now = Date.now();
      for (const [li, until] of Object.entries(this.snapshot.remote)) {
        if ((until ?? 0) <= now) this.takeRemote(li);
      }
    }, REMOTE_CHECK_MS);
  }

  dispose() {
    if (this.disposed) return;
    if (this.playing) void this.send("stop").catch(() => undefined);
    this.end();
    this.disposed = true;
    if (this.remoteTimer) clearInterval(this.remoteTimer);
    this.listeners.clear();
  }
}

// ── React ──

const OtomeHapticsContext = createContext<OtomeHapticsController | null>(null);

/** The story's toys for everything inside it; nothing plays without a story, or while its haptics are off. */
export function OtomeHapticsProvider({ run, children }: { run: RunView | null; children: ReactNode }) {
  const otome = useOtomeApi();
  const runKey = run?.runKey ?? null;
  const [controller, setController] = useState<OtomeHapticsController | null>(null);

  useEffect(() => {
    if (!runKey) return;
    const made = new OtomeHapticsController(runKey);
    setController(made);
    // A tab put away or closed stops the toys (the server's lease is the backstop).
    const away = () => {
      if (made.getSnapshot().playing) made.stop();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") away();
    };
    window.addEventListener("pagehide", away);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", away);
      document.removeEventListener("visibilitychange", hidden);
      made.dispose();
      setController((current) => (current === made ? null : current));
    };
  }, [runKey]);

  controller?.setDeps({ post: otome.post, on: run ? hapticsOn(run.world) : false });

  return createElement(OtomeHapticsContext.Provider, { value: controller }, children);
}

/** The story's toys, or null outside a provider: then nothing plays. */
export function useOtomeHaptics(): OtomeHapticsController | null {
  return useContext(OtomeHapticsContext);
}

const IDLE: HapticsSnapshot = { playing: false, remote: {} };
const noSubscription = () => () => undefined;

/** Whether the toys play, and who holds the remote. */
export function useHapticsSnapshot(): HapticsSnapshot {
  const haptics = useOtomeHaptics();
  return useSyncExternalStore(
    haptics?.subscribe ?? noSubscription,
    haptics?.getSnapshot ?? (() => IDLE),
    haptics?.getSnapshot ?? (() => IDLE),
  );
}
