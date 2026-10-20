// ──────────────────────────────────────────────
// The Engine's voice playback, as package clients see it (Pasta-Devs/Marinara-Agents#1487)
// ──────────────────────────────────────────────
// A call's voice plays through the Engine's own TTS service (`__MARINARA_HOST__.services.tts`), so it and the chat's
// read-aloud stop each other and share one audio cache. A bundled copy played over the Engine's voice and opened the
// Engine's audio cache database itself. On an Engine without the member, the call says voice playback is unavailable.
import { hostMemberMissingMessage, marinaraHost } from "./marinara-host-bridge";

export type TTSState = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

/** The Engine's `ttsService`, as package code calls it. */
export interface TTSService {
  subscribe: (listener: (state: TTSState, activeId: string | null) => void) => () => void;
  getState: () => TTSState;
  getActiveId: () => string | null;
  getLastError: () => string | null;
  preparePlayback: () => void;
  setCurrentPlaybackVolume: (volume: number, muted?: boolean) => void;
  generateAudio: (text: string, options?: object) => Promise<Blob>;
  speak: (text: string, id?: string, options?: object) => Promise<void>;
  speakSequence: (requests: object[], id?: string, options?: object) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

const VOICE_UNAVAILABLE = "Voice playback needs a newer Marinara Engine.";

function unavailableVoice(): TTSService {
  const fail = () => Promise.reject(new Error(VOICE_UNAVAILABLE));
  const ignore = () => undefined;
  return {
    subscribe: () => ignore,
    getState: () => "error",
    getActiveId: () => null,
    getLastError: () => VOICE_UNAVAILABLE,
    preparePlayback: ignore,
    setCurrentPlaybackVolume: ignore,
    generateAudio: fail,
    speak: fail,
    speakSequence: fail,
    stop: ignore,
    pause: ignore,
    resume: ignore,
  };
}

const host = (marinaraHost()?.services?.tts as { ttsService?: Partial<TTSService> } | undefined)?.ttsService;

export const ttsService: TTSService = typeof host?.speak === "function" ? (host as TTSService) : unavailableVoice();

/** Why voice playback is unavailable, or null when the Engine provides it. */
export const ttsUnavailableReason: string | null =
  typeof host?.speak === "function" ? null : hostMemberMissingMessage("voice playback");
