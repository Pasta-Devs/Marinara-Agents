// ──────────────────────────────────────────────
// Otome Hearth: the toys (0.34.0), through the Engine's one Intiface Central connection
// ──────────────────────────────────────────────
// api.runtime.integrations.haptics (Capability API 1.341, the `network` permission): status, connect and one command at
// a time. The Engine plays a pattern once, so the loop is Otome's: every CYCLE_MS it sends each cue again to the toys it
// is for, each command lasting about one cycle, so the toys go quiet within a cycle of the loop ending.
// - A cue names a toy (matched by name, as the device list gives it) or is for every connected toy that can do it; a
//   toy that can do none of what is asked takes its own first output, so a cue never goes nowhere.
// - play() replaces every cue before it (a line's cues are all the toys do from it on), and stops the toys it no longer
//   names. A stop cue stops the toy it names, or every toy.
// - The client keeps the loop alive (keep, every few seconds) while its line or message is on screen; without it the
//   loop ends after LEASE_MS, so a closed tab or a lost connection never leaves a toy running.
// The maintainer's rules (2026-11-15): no cap on strength anywhere (the cue's 0–1 goes to the Engine as written), every
// pattern loops, and Stop always works (stop() ends the loop and stops every toy, whatever started it).
// ponytail: one loop per Engine, the last story to play wins, and the Engine's other users of Intiface (a chat's Haptic
// agent, a call) replace each other's commands on a toy. The upgrade path is an Engine-side owner per device.
import type { CapabilityRuntimeHost, HapticDevice, HapticDeviceCommand } from "@marinara-engine/shared";
import type { HapticCue } from "../../../../client/src/features/otome-forge/shared/api-types.js";

/** How often each cue is sent again. Short, so a pattern repeats as one (the Engine's patterns fit two seconds). */
export const CYCLE_MS = 2000;
/** How long the loop runs without the client's keep. */
export const LEASE_MS = 15_000;
/** How long a connect may take before the player is told it did not answer. */
const CONNECT_MS = 8000;
/** The test: every toy, its own first output, a pulse at full strength. */
const TEST_SECONDS = 2;

/** The outputs in the order a toy that can do several prefers for a cue it cannot do. */
const PRIMARY = ["vibrate", "oscillate", "rotate", "position", "constrict", "inflate"] as const;

export interface HapticsView {
  /** The Engine offers haptics to packages (Capability API 1.341 and the network permission). */
  available: boolean;
  connected: boolean;
  devices: Array<{ index: number; name: string; capabilities: string[] }>;
  /** The loop is running. */
  playing: boolean;
  /** Why the last connect failed (the Engine's or Intiface's words); absent once connected. */
  error?: string;
}

export interface HapticTestResult {
  index: number;
  name: string;
  ok: boolean;
  /** The Engine's own words, when the toy could not be moved. */
  error?: string;
}

export interface OtomeHaptics {
  view(): HapticsView;
  /** Never throws: a connect that fails says why in the view's `error`. */
  connect(url?: string): Promise<HapticsView>;
  test(): Promise<HapticTestResult[]>;
  play(runId: string, cues: readonly HapticCue[]): Promise<void>;
  keep(runId: string): boolean;
  stop(): Promise<void>;
  /** The connected toys as the prompts list them, or "" with none. */
  devicesText(): string;
  dispose(): void;
}

type HapticsClient = NonNullable<NonNullable<CapabilityRuntimeHost["integrations"]>["haptics"]>;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A toy's first output, in PRIMARY order. */
const primaryOf = (device: HapticDevice) =>
  PRIMARY.find((action) => (device.capabilities as readonly string[]).includes(action)) ?? device.capabilities[0];

/** The toys a cue is for (see the header). */
export function cueTargets(cue: HapticCue, devices: readonly HapticDevice[]): HapticDevice[] {
  if (cue.device) {
    const name = cue.device.toLowerCase();
    const named = devices.filter((device) => {
      const own = device.name.toLowerCase();
      return own.includes(name) || name.includes(own);
    });
    if (named.length) return named;
  }
  if (cue.action === "stop") return [...devices];
  const able = devices.filter((device) => (device.capabilities as readonly string[]).includes(cue.action));
  return able.length ? able : [...devices];
}

/** The command for one toy in one cycle: the cue's action when the toy can do it, else the toy's own. */
export function cueCommand(cue: HapticCue, device: HapticDevice): HapticDeviceCommand | null {
  const can = (device.capabilities as readonly string[]).includes(cue.action);
  const action = can ? cue.action : primaryOf(device);
  if (!action || action === "stop") return null;
  const pattern = cue.pattern ?? "steady";
  return {
    deviceIndex: device.index,
    action: action as HapticDeviceCommand["action"],
    intensity: cue.intensity ?? 0.6,
    pattern,
    // A steady one outlasts the cycle a little so it never gaps; a pattern fills the cycle and plays again.
    duration: pattern === "steady" ? CYCLE_MS / 1000 + 0.5 : CYCLE_MS / 1000,
  };
}

export function createOtomeHaptics(runtime: Pick<CapabilityRuntimeHost, "integrations" | "logger">): OtomeHaptics {
  const client = (): HapticsClient | undefined => runtime.integrations?.haptics;
  let loop: { runId: string; cues: HapticCue[]; until: number; targets: Set<number> } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;

  const devices = (): HapticDevice[] => {
    try {
      const status = client()?.status();
      return status?.connected ? status.devices : [];
    } catch {
      return [];
    }
  };

  const send = async (command: HapticDeviceCommand) => {
    const haptics = client();
    if (!haptics) return "Haptics need a newer Marinara Engine.";
    try {
      await haptics.executeCommand(command);
      return null;
    } catch (error) {
      runtime.logger.debug("[otome-forge] Haptic command not played: %s", messageOf(error));
      return messageOf(error);
    }
  };

  const stopAll = async () => {
    if (devices().length) await send({ deviceIndex: "all", action: "stop" });
  };

  /** One cycle: every cue to its toys; the toys sent to. */
  const cycle = async (): Promise<Set<number>> => {
    const targets = new Set<number>();
    if (!loop) return targets;
    const list = devices();
    for (const cue of loop.cues) {
      for (const device of cueTargets(cue, list)) {
        const command = cueCommand(cue, device);
        if (!command || targets.has(device.index)) continue;
        targets.add(device.index);
        await send(command);
      }
    }
    return targets;
  };

  const clear = () => {
    if (timer) clearInterval(timer);
    timer = null;
    loop = null;
  };

  const stop = async () => {
    clear();
    await stopAll();
  };

  const tick = async () => {
    if (!loop) return;
    if (Date.now() > loop.until) {
      await stop();
      return;
    }
    loop.targets = await cycle();
  };

  const view = (): HapticsView => {
    const haptics = client();
    let connected = false;
    let list: HapticDevice[] = [];
    try {
      const status = haptics?.status();
      connected = !!status?.connected;
      list = connected ? (status?.devices ?? []) : [];
    } catch {
      connected = false;
    }
    return {
      available: !!haptics,
      connected,
      devices: list.map(({ index, name, capabilities }) => ({ index, name, capabilities: [...capabilities] })),
      playing: !!loop,
    };
  };

  return {
    view,
    async connect(url) {
      const haptics = client();
      if (!haptics) return { ...view(), error: "Haptics need a newer Marinara Engine." };
      let late: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          haptics.connect(url || undefined),
          new Promise<never>((_, reject) => {
            late = setTimeout(() => reject(new Error("Intiface Central did not answer.")), CONNECT_MS);
          }),
        ]);
      } catch (error) {
        return { ...view(), error: messageOf(error) };
      } finally {
        clearTimeout(late);
      }
      return view();
    },
    async test() {
      const results: HapticTestResult[] = [];
      for (const device of devices()) {
        const action = primaryOf(device);
        const error = action
          ? await send({
              deviceIndex: device.index,
              action: action as HapticDeviceCommand["action"],
              intensity: 1,
              pattern: "pulse",
              duration: TEST_SECONDS,
            })
          : "This toy reports no output.";
        results.push({ index: device.index, name: device.name, ok: !error, ...(error ? { error } : {}) });
      }
      return results;
    },
    async play(runId, cues) {
      if (disposed) return;
      const before = loop?.targets ?? new Set<number>();
      const running = cues.filter((cue) => cue.action !== "stop");
      // A stop cue for a named toy stops it; one for every toy (or a line of stops alone) ends the loop.
      for (const cue of cues.filter((entry) => entry.action === "stop")) {
        if (!cue.device) {
          await stop();
          return;
        }
        for (const device of cueTargets(cue, devices())) await send({ deviceIndex: device.index, action: "stop" });
      }
      if (!running.length) {
        await stop();
        return;
      }
      loop = { runId, cues: running, until: Date.now() + LEASE_MS, targets: new Set() };
      loop.targets = await cycle();
      for (const index of before) if (!loop?.targets.has(index)) await send({ deviceIndex: index, action: "stop" });
      if (!timer) timer = setInterval(() => void tick(), CYCLE_MS);
    },
    keep(runId) {
      if (!loop || loop.runId !== runId) return false;
      loop.until = Date.now() + LEASE_MS;
      return true;
    },
    stop,
    devicesText() {
      return devices()
        .map((device) => `- ${device.name}: ${device.capabilities.join(", ") || "no outputs reported"}`)
        .join("\n");
    },
    dispose() {
      disposed = true;
      const running = !!loop;
      clear();
      if (running) void stopAll();
    },
  };
}
