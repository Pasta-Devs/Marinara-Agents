/* global forgeConnectionVoices */
// Dialogue voice picking, shared by Gacha Forge's client bundle and Otome Forge. Gacha Forge's audio client lists a
// connection's voices with its own fetch helper (forgeConnectionVoices); Otome passes its own listVoices.

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

// The Engine's NPC default voice pool, as its tts-dialogue.ts resolveNpcDefaultVoice picks it. null = speech is off.
export function forgeVoicePool(config, gender) {
  if (!config || (!config.connectionId && config.enabled === false)) return null;
  const profile = config.connectionId ? config.connectionProfiles?.[config.connectionId] : config;
  const list = (value) => (Array.isArray(value) ? value : []).filter((voice) => typeof voice === "string" && voice);
  const male = list(profile?.npcDefaultMaleVoices);
  const female = list(profile?.npcDefaultFemaleVoices);
  const combined = [...new Set([...female, ...male])];
  // The same voices in both lists means the player did not split them by gender.
  const unpartitioned =
    male.length > 0 && male.length === female.length && male.every((voice) => female.includes(voice));
  if (gender === "female" && !unpartitioned && female.length) return female;
  if (gender === "male" && !unpartitioned && male.length) return male;
  return combined;
}

// A name always lands on the same voice of a pool (the Engine's stableTTSIndex over its normalized name).
export function forgeStableVoice(pool, name) {
  const seed =
    String(name ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || String(name ?? "");
  if (!seed || !pool?.length) return null;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  return pool[Math.abs(hash) % pool.length];
}

// Explicit Engine assignments always win. "Voice other characters" gives everyone else except the persona the
// Engine's NPC pool voice for their gender, or any voice of the connection while that pool is empty.
export async function forgeSpeakerVoice(config, speaker, others, listVoices = forgeConnectionVoices) {
  const explicit = forgeExplicitVoice(config, speaker?.characterId);
  if (explicit || !others || speaker?.persona || !String(speaker?.name ?? "").trim()) return explicit;
  const pool = forgeVoicePool(config, speaker.gender);
  if (!pool) return null;
  return forgeStableVoice(pool.length ? pool : await listVoices(config), speaker.name);
}

// The story cast resolver's protagonist aliases. A speaker the cast cannot settle (for example two cast entries share
// the persona's name or surname) whom that resolver would match to the run protagonist alone is the persona: its own
// voice or silence, never the pool. Like the resolver, one word may be any word of the name; more words share its first.
const forgeStoryPersonaAliases = new Set(["you", "yourself", "me", "myself", "i", "player", "protagonist"]);
export function forgeStoryPersona(protagonist, speaker) {
  const normalized = (value) =>
    String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const name = normalized(speaker);
  const own = normalized(protagonist?.name).split(" ");
  const named = name.includes(" ") ? name.split(" ")[0] === own[0] : own.includes(name);
  if (!name || !(forgeStoryPersonaAliases.has(name) || (own[0] && named))) return null;
  return {
    name: protagonist?.name || speaker,
    characterId: String(protagonist?.personaId || "").trim() || null,
    prota: true,
  };
}
