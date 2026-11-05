// A line becomes ready only when its text is revealed AND its own voice has settled.
export function forgeVoiceCharacter(cast, speaker, existingResolver) {
  const normalized = (name) =>
    String(name || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
      .trim();
  const name = normalized(speaker);
  if (!name) return null;
  const exact = cast.filter((character) => normalized(character?.name) === name);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const candidate = existingResolver(cast, speaker);
  if (!candidate) return null;
  return cast.filter((character) => normalized(character?.name) === normalized(candidate.name)).length === 1
    ? candidate
    : null;
}

export function createForgeVoiceLine(audio, onReady) {
  let revision = 0;
  let abort = null;
  let revealed = false;
  let finished = false;
  let disposed = false;
  const cancel = () => {
    revision += 1;
    abort?.abort();
    abort = null;
    finished = true;
  };
  return {
    start(segment, character, silent = false) {
      cancel();
      const own = revision;
      revealed = false;
      finished = false;
      abort = new AbortController();
      Promise.resolve()
        .then(() => {
          if (disposed || own !== revision || silent) return;
          return audio?.speak(segment, character, abort.signal);
        })
        .catch(() => {})
        .finally(() => {
          if (disposed || own !== revision) return;
          finished = true;
          if (revealed) onReady();
        });
    },
    reveal() {
      revealed = true;
      if (finished) onReady();
    },
    ready: () => revealed && finished && !disposed,
    dispose() {
      disposed = true;
      cancel();
    },
  };
}

export function forgeStoryAudioOptions(host, options) {
  return { ...options, audio: host._forgeAudio };
}
