// Shared by the browser and server bundle; persisted settings contain no provider credentials.
export function normalizeForgeAudio(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const bounded = (number, fallback, maximum = 1) => {
    if ((typeof number !== "number" && typeof number !== "string") || number === "") return fallback;
    const parsed = Number(number);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, parsed)) : fallback;
  };
  return {
    tts: input.tts === true,
    combatVoices: input.combatVoices === true,
    generate: input.generate === true,
    homeMusic:
      typeof input.homeMusic === "string" &&
      input.homeMusic.startsWith("music:") &&
      input.homeMusic.length <= 700 &&
      !/[/\\\p{Cc}]/u.test(input.homeMusic)
        ? input.homeMusic
        : "",
    audioConnectionId: typeof input.audioConnectionId === "string" ? input.audioConnectionId.trim().slice(0, 200) : "",
    muted: input.muted === true,
    musicVolume: bounded(input.musicVolume, 0.5),
    dialogueVolume: bounded(input.dialogueVolume, 1),
    sfxVolume: bounded(input.sfxVolume, 0.5),
    autoplayPauseSeconds: bounded(input.autoplayPauseSeconds, 3, 30),
  };
}

export function normalizeForgeMusicMood(value) {
  return ["happy", "tense", "sad"].includes(value) ? value : "happy";
}

export const forgeSoundtrackCues = ["home", "combat", "boss", "happy", "tense", "sad", "bond"];

export function forgeSoundtrackContextKey(runId, connectionId, cue) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify([runId, connectionId])))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return `world-${hash.toString(16)}-${cue}`;
}

export function forgeBannerSoundtrack(bannerId, featured, standard) {
  if (!/^(?:char|wpn)-(?:standard|featured)$/u.test(bannerId)) return null;
  const rotation = featured ? String(featured.key || "") : "standard";
  if (!/^[a-z0-9-]{1,32}$/u.test(rotation)) return null;
  return {
    cue: `banner-${bannerId}-${rotation}`,
    title: String(featured?.title || standard?.title || bannerId).slice(0, 200),
  };
}

export function rememberForgeBannerSoundtrack(session, descriptor, unlock = false) {
  if (!descriptor) return;
  const previous = session.audioBanners?.[descriptor.cue];
  session.audioBanners = {
    ...session.audioBanners,
    [descriptor.cue]: { ...descriptor, unlocked: previous?.unlocked === true || unlock },
  };
}

export function recordForgeSoundtrack(session, runId, track) {
  if (!track || typeof track.connectionId !== "string" || track.connectionId.length > 200) return false;
  if (!forgeSoundtrackCues.includes(track.cue) && !Object.hasOwn(session.audioBanners || {}, track.cue)) return false;
  const key = forgeSoundtrackContextKey(runId, track.connectionId, track.cue);
  if (typeof track.tag !== "string" || !track.tag.startsWith(`music:contexts:gacha-forge:${key}:`)) return false;
  if (typeof track.path !== "string" || !track.path.startsWith(`music/contexts/gacha-forge/${key}/`)) return false;
  const file = track.path.slice(`music/contexts/gacha-forge/${key}/`.length);
  if (
    file.startsWith(".") ||
    /[/\\\p{Cc}]/u.test(file) ||
    !/\.(?:mp3|wav|ogg|m4a|flac|aac|webm)$/iu.test(file) ||
    track.tag !== `music:contexts:gacha-forge:${key}:${file.replace(/\.[^.]+$/u, "")}`
  )
    return false;
  const tracks = Array.isArray(session.audioTracks) ? session.audioTracks : [];
  session.audioTracks = [
    ...tracks.filter((item) => item.tag !== track.tag),
    {
      cue: track.cue,
      connectionId: track.connectionId,
      tag: track.tag,
      path: track.path,
    },
  ];
  return true;
}

export function availableForgeSoundtracks(session) {
  return (Array.isArray(session?.audioTracks) ? session.audioTracks : [])
    .filter((track) => forgeSoundtrackCues.includes(track.cue) || session.audioBanners?.[track.cue]?.unlocked === true)
    .map((track) => ({ ...track, title: session.audioBanners?.[track.cue]?.title || "" }));
}
