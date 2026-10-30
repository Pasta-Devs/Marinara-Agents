import { normalizeSubjectName } from "../ltm-utils.js";

export const SOURCE_BACKED_NPC_NAME_PATTERN = /\b[\p{Lu}][\p{L}\p{N}'-]*(?:\s+[\p{Lu}][\p{L}\p{N}'-]*){0,3}\b/gu;
const SOURCE_BACKED_PROPER_NAME_PATTERN = /^[\p{L}][\p{L}\p{N}'’.-]*(?:\s+[\p{L}][\p{L}\p{N}'’.-]*){0,3}$/u;
const SOURCE_BACKED_NAME_BOUNDARY_PATTERN = /[\p{L}\p{N}'-]/u;
// Korean postpositions written directly after a name. The choice follows the name's last syllable
// (이수 takes 가, so 이수이 is a name rather than 이수 + 이); a final ㄹ takes 로 like an open syllable.
// ponytail: fixed particle set, 2-into-3-syllable tails and stems of 2+ syllables only; chained
// particles (이라는, 에게서), 4-syllable names and 1-syllable names keep the old matching. Add a
// Hangul morphology table if real chats need them.
const HANGUL_PARTICLE_ANY = /^(?:[의도]|(?:에게|에서|한테)[는도]?)$/u;
const HANGUL_PARTICLE_OPEN = /^(?:[는가를와]|로[는도]?)$/u;
const HANGUL_PARTICLE_CLOSED = /^(?:[은이을과]|으로[는도]?)$/u;
const HANGUL_NAME_PATTERN = /^\p{Script=Hangul}+$/u;
const GENERIC_ROLE_SUFFIXES = ["arian", "eer", "ician", "ist", "keeper", "ologist", "ographer"];
const GENERIC_ROLE_QUALIFIERS = new Set([
  "a",
  "an",
  "assistant",
  "bass",
  "chief",
  "city",
  "court",
  "deputy",
  "head",
  "junior",
  "lead",
  "local",
  "master",
  "medical",
  "military",
  "night",
  "palace",
  "rhythm",
  "royal",
  "school",
  "senior",
  "session",
  "temple",
  "the",
  "town",
  "unknown",
  "unnamed",
  "village",
]);
const GENERIC_SUBJECT_NAMES = new Set([
  "accountant",
  "administrator",
  "adviser",
  "advisor",
  "agent",
  "actor",
  "ai",
  "ally",
  "alchemist",
  "ambassador",
  "apprentice",
  "archer",
  "architect",
  "archivist",
  "artist",
  "assistant",
  "author",
  "baker",
  "bandmate",
  "barber",
  "bard",
  "bartender",
  "blacksmith",
  "boy",
  "bot",
  "boss",
  "brewer",
  "butcher",
  "captain",
  "caretaker",
  "carpenter",
  "cartographer",
  "cashier",
  "character",
  "classmate",
  "chef",
  "chief",
  "clerk",
  "coach",
  "companion",
  "commander",
  "constable",
  "consultant",
  "courier",
  "customer",
  "dancer",
  "dentist",
  "developer",
  "detective",
  "diplomat",
  "director",
  "doctor",
  "driver",
  "drummer",
  "editor",
  "employee",
  "enemy",
  "engineer",
  "farmer",
  "fisherman",
  "friend",
  "girl",
  "game_master",
  "gamer",
  "guard",
  "guitarist",
  "guide",
  "gm",
  "he",
  "host",
  "human",
  "hunter",
  "journalist",
  "judge",
  "innkeeper",
  "king",
  "knight",
  "lady",
  "leader",
  "librarian",
  "lawyer",
  "lord",
  "man",
  "manager",
  "mage",
  "magician",
  "mayor",
  "mechanic",
  "merchant",
  "member",
  "miner",
  "minister",
  "monk",
  "musician",
  "narrator",
  "npc",
  "nurse",
  "officer",
  "owner",
  "oracle",
  "passenger",
  "patron",
  "persona",
  "person",
  "pilot",
  "pianist",
  "player",
  "partner",
  "priest",
  "prince",
  "princess",
  "professor",
  "programmer",
  "protagonist",
  "queen",
  "ranger",
  "receptionist",
  "reporter",
  "researcher",
  "scientist",
  "scout",
  "secretary",
  "sheriff",
  "she",
  "shopkeeper",
  "singer",
  "soldier",
  "someone",
  "speaker",
  "smith",
  "stranger",
  "student",
  "surgeon",
  "system",
  "teacher",
  "technician",
  "therapist",
  "they",
  "unknown",
  "unnamed",
  "user",
  "vendor",
  "veterinarian",
  "villain",
  "violinist",
  "waiter",
  "waitress",
  "warrior",
  "wizard",
  "worker",
  "woman",
]);

// A strict token-subset of a longer trusted character/persona name is a short or partial
// surface form ("Alex" for "Alex Rivera"). It is never identity evidence on its own, so
// callers route it to review instead of binding it by first name alone.
export function partialNameTokensMatch(name: string, entryName: string, splitCamelCase = true) {
  if (isHangulNameSuffix(name, entryName)) return true;
  const parts = (value: string) =>
    normalizeSubjectName(splitCamelCase ? value : value.toLowerCase())
      .split("_")
      .filter(Boolean);
  const tokenTokens = parts(name);
  const entryTokens = parts(entryName);
  if (tokenTokens.length === 0 || entryTokens.length <= tokenTokens.length) return false;
  return tokenTokens.every((part) => entryTokens.includes(part));
}

// LTM's own characters relate in either direction: a new "Preston" to a saved "Preston Farraday",
// and a new "Preston Farraday" to a saved "Preston", on the same whole-token rule. Parts split on
// whitespace and punctuation only, so "Ann" never binds to a saved "JoAnn".
export function nameTokensRelated(name: string, entryName: string) {
  return partialNameTokensMatch(name, entryName, false) || partialNameTokensMatch(entryName, name, false);
}

export function sourceBackedNpcNames(sources: Array<string | undefined>) {
  const names = new Map<string, string>();
  for (const source of sources) {
    if (!source) continue;
    for (const match of source.matchAll(SOURCE_BACKED_NPC_NAME_PATTERN)) {
      const words = match[0]!.trim().split(/\s+/g);
      for (let start = 0; start < words.length; start += 1) {
        for (let length = 1; length <= Math.min(4, words.length - start); length += 1) {
          const name = words.slice(start, start + length).join(" ");
          if (!isSourceBackedProperName(name, [source])) continue;
          const slug = normalizeSubjectName(name);
          if (slug && !names.has(slug)) names.set(slug, name);
        }
      }
    }
  }
  return names;
}

export function isSourceBackedProperName(name: string, sources: Array<string | undefined>) {
  const trimmed = name.trim();
  if (!SOURCE_BACKED_PROPER_NAME_PATTERN.test(trimmed)) return false;
  if (isGenericSubjectName(trimmed)) return false;
  return sources.some((source) => sourceContainsWholeName(source, trimmed));
}

function isGenericSubjectName(name: string) {
  const slug = normalizeSubjectName(name);
  const withoutArticle = slug.startsWith("the_") ? slug.slice(4) : slug;
  if (GENERIC_SUBJECT_NAMES.has(slug) || GENERIC_SUBJECT_NAMES.has(withoutArticle)) return true;

  const tokens = withoutArticle.split("_").filter(Boolean);
  const finalToken = tokens.at(-1) ?? "";
  const explicitGenericFinalToken = GENERIC_SUBJECT_NAMES.has(finalToken);
  if (tokens.length <= 1) return explicitGenericFinalToken;
  const genericFinalToken =
    explicitGenericFinalToken ||
    GENERIC_ROLE_SUFFIXES.some((suffix) => finalToken.length > suffix.length + 2 && finalToken.endsWith(suffix));
  return genericFinalToken && tokens.slice(0, -1).every((token) => GENERIC_ROLE_QUALIFIERS.has(token));
}

// Hangul names carry no spaces, so "진욱" is the 2-syllable tail of "도진욱" rather than a shared token.
function isHangulNameSuffix(name: string, entryName: string) {
  const short = name.trim().normalize("NFC");
  const long = entryName.trim().normalize("NFC");
  return (
    short.length === 2 &&
    long.length === 3 &&
    HANGUL_NAME_PATTERN.test(short) &&
    HANGUL_NAME_PATTERN.test(long) &&
    long.endsWith(short)
  );
}

export function isHangulParticle(stem: string, particle: string) {
  const syllable = stem.charCodeAt(stem.length - 1) - 0xac00;
  if (syllable < 0 || syllable > 11171) return false;
  if (HANGUL_PARTICLE_ANY.test(particle)) return true;
  const final = syllable % 28;
  if (final === 0) return HANGUL_PARTICLE_OPEN.test(particle);
  if (final === 8 && particle.startsWith("으")) return false;
  return HANGUL_PARTICLE_CLOSED.test(final === 8 ? particle.replace(/^로/u, "으로") : particle);
}

// True when `rest` begins with one whole permitted particle for `name` and then a name boundary.
// A single-syllable name is too ambiguous against a following particle to count as present.
function followedByHangulParticle(name: string, rest: string) {
  if (name.length < 2) return false;
  for (let length = 1; length <= 4; length += 1) {
    if (
      isHangulParticle(name, rest.slice(0, length)) &&
      !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(rest[length] ?? "")
    ) {
      return true;
    }
  }
  return false;
}

function sourceContainsWholeName(source: string | undefined, name: string) {
  if (!source) return false;
  const searchable = source.toLowerCase();
  const needle = name.toLowerCase();
  let offset = searchable.indexOf(needle);
  while (offset >= 0) {
    const before = offset > 0 ? searchable[offset - 1]! : "";
    const afterIndex = offset + needle.length;
    const after = searchable[afterIndex] ?? "";
    const possessiveEnd =
      (after === "'" || after === "\u2019") &&
      /s/i.test(searchable[afterIndex + 1] ?? "") &&
      !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(searchable[afterIndex + 2] ?? "");
    if (
      (!before || !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(before)) &&
      (!after ||
        !SOURCE_BACKED_NAME_BOUNDARY_PATTERN.test(after) ||
        possessiveEnd ||
        followedByHangulParticle(needle, searchable.slice(afterIndex)))
    ) {
      return true;
    }
    offset = searchable.indexOf(needle, offset + 1);
  }
  return false;
}

export function nameTokenCount(name: string) {
  return name.trim().split(/\s+/g).filter(Boolean).length;
}

export function damerauLevenshtein(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, row) =>
    Array.from({ length: right.length + 1 }, (_, column) => row + column),
  );
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
        ...(row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]
          ? [rows[row - 2]![column - 2]! + 1]
          : []),
      );
    }
  }
  return rows[left.length]![right.length]!;
}

export function subjectLabelFromKey(key: string) {
  if (key.startsWith("local_character:")) {
    const name = key.slice("local_character:".length).split(":").at(-1) ?? key;
    return name.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  const suffix = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return normalizeSubjectIdentifier(suffix, "subject").replace(/_/g, " ");
}

export function stripNotePrefix(identifier: string) {
  return identifier.replace(/^(?:char|rel)_/, "");
}

export function normalizeSubjectIdentifier(value: unknown, fallback = "subject") {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 120)
    .replace(/_+$/g, "");
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(normalized) ? normalized : fallback;
}
