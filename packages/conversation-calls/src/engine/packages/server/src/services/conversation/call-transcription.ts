// ──────────────────────────────────────────────
// Call transcription: the Engine's speech-to-text server, or Local Whisper
// ──────────────────────────────────────────────

/**
 * `api.runtime.integrations.speech` on an Engine with Speech to Text in Connections
 * (Pasta-Devs/Marinara-Engine#7353). Older Engines have none, so every member is optional.
 */
export interface CallSpeechHost {
  /** Resolves the transcript, or null while the user has no speech-to-text server turned on. */
  transcribe?(
    audio: Uint8Array,
    options?: { filename?: string; mimeType?: string; signal?: AbortSignal },
  ): Promise<string | null>;
}

export interface CallTranscription {
  transcript: string;
  /** True when the Engine's speech-to-text server wrote the transcript, false for Local Whisper. */
  speechServer: boolean;
}

/**
 * Transcribe a recorded call clip (WAV) with the speech-to-text server set in Connections. Local Whisper
 * takes over while that server is off, on an Engine without it, or when it fails.
 */
export async function transcribeCallAudio(
  wav: Buffer,
  options: {
    speech?: CallSpeechHost | null;
    signal?: AbortSignal;
    localWhisper: (wav: Buffer) => Promise<string>;
    onSpeechServerError?: (error: unknown) => void;
  },
): Promise<CallTranscription> {
  let serverError: unknown;
  if (typeof options.speech?.transcribe === "function") {
    try {
      const transcript = await options.speech.transcribe(wav, {
        filename: "call-audio.wav",
        mimeType: "audio/wav",
        signal: options.signal,
      });
      if (typeof transcript === "string") return { transcript: transcript.trim(), speechServer: true };
    } catch (error) {
      // The browser went away, so nobody is waiting for Local Whisper either.
      if (options.signal?.aborted) throw error;
      serverError = error;
      options.onSpeechServerError?.(error);
    }
  }
  try {
    return { transcript: (await options.localWhisper(wav)).trim(), speechServer: false };
  } catch (error) {
    // With a server turned on, its failure says more than a missing Local Whisper download.
    throw serverError ?? error;
  }
}
