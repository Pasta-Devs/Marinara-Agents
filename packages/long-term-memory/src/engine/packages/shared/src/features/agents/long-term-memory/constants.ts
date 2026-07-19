import type {
  LtmExtractionReasoningEffort,
  LtmExtractionVerbosity,
} from "./schema.js";
import type { LtmEvidenceUnitBucket, LtmMode } from "./schema.js";
export type LongTermMemoryRecallStyle =
  | "balanced"
  | "exact"
  | "broad"
  | "story";

export const DEFAULT_LTM_EXTRACTION_REASONING_EFFORT =
  "low" satisfies LtmExtractionReasoningEffort;
export const DEFAULT_LTM_EXTRACTION_VERBOSITY =
  "low" satisfies LtmExtractionVerbosity;
export const DEFAULT_LTM_EXTRACTION_MAX_TOKENS = 8192;
export const DEFAULT_LTM_EXTRACTION_TEMPERATURE = 0;
export const DEFAULT_LTM_EXTRACTION_MAX_SOURCE_TOKENS = 8_192;
export const DEFAULT_LTM_EXTRACTION_MAX_EXISTING_NOTE_TOKENS = 4_096;
export const DEFAULT_LTM_EXTRACTION_EXISTING_NOTE_MAX_CHUNKS = 12;
export const DEFAULT_LTM_EXTRACTION_EXISTING_NOTE_MAX_TOKENS = 4_096;

export const IMPORTANCE_LEVELS = {
  critical: { emoji: "🔴", value: 5, label: "Critical" },
  major: { emoji: "🟠", value: 4, label: "Major" },
  moderate: { emoji: "🟡", value: 3, label: "Moderate" },
  minor: { emoji: "🟢", value: 2, label: "Minor" },
} as const;

export const RELATIONSHIP_DIMENSIONS = [
  "trust",
  "respect",
  "loyalty",
  "intimacy",
  "tension",
  "hostility",
  "dependency",
  "affection",
  "lust",
  "protectiveness",
] as const;

export const DEFAULT_RELATIONSHIP_BASELINE = 50;

export const QUEST_THREAD_SECTION_KEYS = [
  "objective",
  "stage",
  "resolution",
] as const;

export const CORE_LTM_EXTRACTION_RULES = [
  "Use exactly one extraction pass for all durable memory streams.",
  "Allowed buckets are timeline_event, character_fact, relationship_state, world_fact, thread, tone, and anchor.",
  "Never emit removed relationship-history, relationship-conflict, transient-character, or live-state buckets.",
  "Timeline events are canonical story history. Relationship and character facts should link to the event with caused_by, affects_relationship, or affects_character instead of duplicating event prose.",
  "Every unit must include importance: critical, major, moderate, or minor.",
  "Relationship_state units may include dimensions on a 0-100 scale and dimensionChanges from -100 to 100. Omit dimensions that stay at the neutral baseline.",
  "Use conservative relationship deltas. Small kindness, jokes, routine comfort, or brief warmth should not produce large trust/respect/loyalty/intimacy/protectiveness changes unless the source frames them as emotionally major.",
  "Relationship_state units describing a change must include a caused_by link to a timeline_event from the same extraction.",
  "For character_fact and relationship_state, copy source-visible character names into subjectNames; never choose database subject keys.",
  "Do not emit the same fact twice. Near-duplicate units in the same extraction are rejected.",
].join("\n");

export const LTM_EXTRACTION_EXAMPLE = [
  "Example unit shape:",
  '{"bucket":"timeline_event","subjectId":"alice_confession","subjectNames":[],"sectionKey":"event","text":"Alice confessed the map was stolen to protect Rowan.","importance":"major","links":[{"target":"char_alice","relation":"affects_character","aspect":"development"}],"confidence":0.92,"salience":0.8,"status":"active"}',
  '{"bucket":"relationship_state","subjectId":"alice_rowan","subjectNames":["Alice","Rowan"],"sectionKey":"state","text":"Alice and Rowan\'s trust is strained by the confession but not broken.","importance":"major","dimensions":{"trust":38,"tension":72},"dimensionChanges":{"trust":-18,"tension":24},"links":[{"target":"timeline_alice_confession","relation":"caused_by"}],"confidence":0.9,"salience":0.82,"status":"active"}',
].join("\n");

export const DEFAULT_LTM_EXTRACTION_PROMPT = [
  "You extract structured memory-stream evidence units from a source note.",
  "Return strict JSON only. Do not explain.",
  "Do not include thinking, analysis, markdown, or <think> tags. Output JSON object only.",
  "Source notes are audit evidence, not active recall memory.",
  "Do not output source summaries, transcript summaries, or final write operations.",
  "Extract every distinct durable memory stream supported by the source.",
  "Emit zero or more units per stream. Prefer a few substantial units that capture the complete fact over many fragmentary observations.",
  CORE_LTM_EXTRACTION_RULES,
  "Scan stream groups explicitly: timeline beats (timeline_event); relationship state changes (relationship_state); open loops (thread); character facts (character_fact); world facts (world_fact); style and motifs (tone, anchor).",
  "Use one best stream per fact. If a detail fits both a timeline and character/relationship stream, emit the plot-changing action as timeline_event and link relationship_state or character_fact to it instead of duplicating the event text.",
  "Do not duplicate the same fact across streams or sections.",
  "Write source-extracted memories in past-tense/outcome phrasing unless the fact is a durable present-tense rule or trait.",
  "",
  "SOURCE CONCEPT MAPPING:",
  '- Character developments (irreversible changes) → character_fact with sectionKey "developments".',
  '- Character abilities → character_fact with sectionKey "abilities".',
  '- Character voice/quotes → character_fact with sectionKey "voice".',
  '- Items tied to a character → character_fact with sectionKey "items" and the character\'s subjectId.',
  '- Items not tied to a character → world_fact with sectionKey "items".',
  "- Callbacks → thread. Prepend [CALLBACK] in the text. Include planted element, payoff target, and status.",
  "",
  "SECTION KEY CONVENTIONS:",
  "- character_fact: facts, developments, abilities, voice, or items. Never use it for ordinary actions, scene beats, decisions, arrivals, departures, promises, discoveries, relationship moments, moods, wounds, resources, aims, or location.",
  "- relationship_state: state. Include dimensions/dimensionChanges when the source supports them; relationship changes need a caused_by link.",
  "- world_fact: facts or items.",
  "- timeline_event: event.",
  '- thread: summary. The text must describe an unresolved situation and what would resolve it. When the thread is marked resolved, also emit a timeline_event capturing what changed in past-tense outcome phrasing. Link fan-out units back to the thread note id with relation "resolved_in".',
  "- tone: observations. World/session-level atmospheric register only, not one-scene mood.",
  "- anchor: the source section key. Recurring motif or planted callback only.",
  "",
  "Each unit must be assigned to one memory stream and be useful for future continuity.",
  "Every unit must include at least one supplied evidence string, including source_note:<id>.",
  "Use real lowercase snake_case subjectId and sectionKey values derived from the source.",
  "Never output placeholder values such as lowercase_snake_case_scope_id, lowercase_snake_case, target_note_id, or copied schema/example text.",
  "Do not copy schema/example placeholder values.",
  "Omit optional fields unless they are real and evidence-backed.",
  "Use timeline_event for historical source-summary scenes or beats; never call those current_scene.",
  "Memory streams may link to timeline_event notes using occurred_in, triggered_by, resolved_in, evidenced_by, caused_by, affects_character, or affects_relationship.",
  "Keep source-note provenance as source_note evidence; timeline links describe story structure, not source provenance.",
  "Use structured importance, dimensions, and dimensionChanges fields. Do not prefix text with importance symbols or dimension labels.",
  "Use sourceHash exactly as supplied.",
  "Set confidence and salience from 0 to 1.",
  "For voice/tone quotes, quote only exact text present in the source.",
  "Do not emit live scene state, transient character condition, relationship arc, boundary, or preference memories from source-summary extraction.",
  '"resolved" status is reserved for thread memories only. Never set status "resolved" on relationship, character, world, timeline, tone, or anchor streams.',
  "For enum fields, choose exactly one string from the allowed arrays. Do not join multiple values with |.",
].join("\n");

export const DEFAULT_LTM_EXTRACTION_PROMPT_CONVERSATION = [
  "You extract structured memory-stream evidence units from a chat transcript.",
  "Return strict JSON only. Do not explain.",
  "Do not include thinking, analysis, markdown, or <think> tags. Output JSON object only.",
  "Source notes are audit evidence, not active recall memory.",
  "Do not output source summaries, transcript summaries, or final write operations.",
  "Extract only durable, high-confidence facts that would be useful across future conversations.",
  "Emit zero or more units per stream. Prefer a few substantial units that capture the complete fact over many fragmentary observations.",
  "Scan stream groups explicitly: durable conversation events (timeline_event); relationship changes (relationship_state); character preferences or traits (character_fact); general knowledge or stated facts (world_fact); open questions or unresolved topics (thread); conversational style (tone); recurring motifs or inside jokes (anchor).",
  "Use timeline events and relationship changes conservatively, only when they remain useful beyond the immediate exchange.",
  "Use one best stream per fact. If a detail fits both a character and a world stream, emit the character's fact as character_fact and general facts as world_fact.",
  "Do not duplicate the same fact across streams or sections.",
  "Write durable facts in present tense unless the fact is a past event that has lasting relevance.",
  "",
  "SOURCE CONCEPT MAPPING:",
  '- Named-speaker preferences, stated intents, personality traits → character_fact with the source-visible speaker name in subjectNames and sectionKey "facts". Never use generic User or Assistant labels as identities.',
  '- Speaker voice or style quotes → character_fact with sectionKey "voice" and exact quote from source.',
  '- General knowledge or stated facts → world_fact with sectionKey "facts".',
  '- Open questions or unresolved topics → thread with sectionKey "summary".',
  "- Recurring motifs or callbacks → anchor.",
  '- Session or topic register → tone with sectionKey "observations".',
  '- Durable decisions, commitments, or consequential exchanges → timeline_event with sectionKey "event".',
  '- Durable relationship changes → relationship_state with sectionKey "state" and a caused_by timeline link.',
  "",
  "SECTION KEY CONVENTIONS:",
  "- character_fact: facts, developments, or voice. Never use it for ordinary conversational turns, transient opinions, or one-off statements.",
  "- world_fact: facts. Only for verified information, not speculation.",
  "- thread: summary. The text must describe an unresolved topic and what would resolve it.",
  "- tone: observations. Conversation-level register or recurring style only, not single-message mood.",
  "- anchor: the source section key. Recurring motif or planted callback only.",
  "",
  "Apply a high confidence bar. Only emit a unit when the fact is clearly durable — not a one-off mention, transient opinion, or casual aside.",
  "Each unit must include at least one supplied evidence string, including source_note:<id>.",
  "Use real lowercase snake_case subjectId and sectionKey values derived from the source.",
  "For character_fact, copy exactly one source-visible character name into subjectNames. All other Conversation streams use subjectNames: [].",
  "Never output placeholder values such as lowercase_snake_case_scope_id, lowercase_snake_case, target_note_id, or copied schema/example text.",
  "Omit optional fields unless they are real and evidence-backed.",
  "Use sourceHash exactly as supplied.",
  "Set confidence and salience from 0 to 1.",
  'Only output character_fact with sectionKey "items" when items are durably tied to a speaker (e.g. a pet, a house).',
  "Do not emit transient or scene-like units.",
  '"resolved" status is reserved for thread memories only.',
  "For enum fields, choose exactly one string from the allowed arrays. Do not join multiple values with |.",
].join("\n");

export const DEFAULT_LTM_EXTRACTION_PROMPT_GAME = [
  "You extract structured memory-stream evidence units from a game session transcript.",
  "Return strict JSON only. Do not explain.",
  "Do not include thinking, analysis, markdown, or <think> tags. Output JSON object only.",
  "Source notes are audit evidence, not active recall memory.",
  "Do not output source summaries, transcript summaries, or final write operations.",
  "Extract every distinct durable memory stream supported by the source.",
  "Emit zero or more units per stream. Prefer a few substantial units that capture the complete fact over many fragmentary observations.",
  CORE_LTM_EXTRACTION_RULES,
  "Scan stream groups explicitly: timeline beats (timeline_event); relationship state changes (relationship_state); open quests and objectives (thread); character facts (character_fact); world facts (world_fact); style and motifs (tone, anchor).",
  "Use one best stream per fact. If a detail fits both a timeline and character/relationship stream, emit the plot-changing action as timeline_event and link relationship_state or character_fact to it instead of duplicating the event text.",
  "Do not duplicate the same fact across streams or sections.",
  "Write source-extracted memories in past-tense/outcome phrasing unless the fact is a durable present-tense rule or trait.",
  "",
  "QUEST TRACKING:",
  '- Quests, objectives, and party goals → thread with sectionKey "objective", "stage", or "resolution".',
  "- A quest objective describes what the party is trying to achieve.",
  "- A quest stage describes progress or a completed milestone, with the stage number or name.",
  "- A quest resolution describes how the quest concluded and what changed as a result.",
  "- When a quest thread has multiple active objectives, emit separate thread units for each distinct goal.",
  "",
  "SOURCE CONCEPT MAPPING:",
  '- Character developments (irreversible changes) → character_fact with sectionKey "developments".',
  '- Character abilities → character_fact with sectionKey "abilities".',
  '- Character voice/quotes → character_fact with sectionKey "voice".',
  '- Items acquired or lost → timeline_event for the event; superseding character_fact with sectionKey "items" for current holdings.',
  '- Items not tied to a character → world_fact with sectionKey "items".',
  '- Level, XP, reputation, or progression changes → character_fact with sectionKey "progression". Use superseding lifecycle (single current value).',
  "- Callbacks → thread. Prepend [CALLBACK] in the text. Include planted element, payoff target, and status.",
  "",
  "SECTION KEY CONVENTIONS:",
  "- character_fact: facts, developments, abilities, voice, items, or progression. Never use it for ordinary actions, scene beats, or transient conditions like HP or buffs.",
  "- relationship_state: state. Include dimensions/dimensionChanges when the source supports them; relationship changes need a caused_by link.",
  "- world_fact: facts or items.",
  "- timeline_event: event.",
  "- thread: objective, stage, or summary. The text must describe an unresolved situation and what would resolve it. When the thread is marked resolved, also emit a timeline_event capturing what changed.",
  "- tone: observations. World/session-level atmospheric register only, not one-scene mood.",
  "- anchor: the source section key. Recurring motif or planted callback only.",
  "",
  "Do not track transient mechanical state such as HP, buffs, debuffs, or temporary conditions.",
  "Each unit must include at least one supplied evidence string, including source_note:<id>.",
  "Use real lowercase snake_case subjectId and sectionKey values derived from the source.",
  "Never output placeholder values.",
  "Omit optional fields unless they are real and evidence-backed.",
  "Use timeline_event for historical game beats; never call those current_scene.",
  "Use structured importance, dimensions, and dimensionChanges fields. Do not prefix text with importance symbols or dimension labels.",
  "Use sourceHash exactly as supplied.",
  "Set confidence and salience from 0 to 1.",
  '"resolved" status is reserved for thread (quest) memories only. Never set status "resolved" on relationship, character, world, timeline, tone, or anchor streams.',
  "For enum fields, choose exactly one string from the allowed arrays. Do not join multiple values with |.",
].join("\n");

export const DEFAULT_LTM_EXTRACTION_PROMPT_GAME_REFINE = [
  "You refine structured evidence units from a game session transcript.",
  "Return strict JSON only. Do not explain.",
  "Do not include thinking, analysis, markdown, or <think> tags. Output JSON object only.",
  "The input includes candidate evidence units. Refine them against the source transcript rather than re-extracting from scratch.",
  "These structural refinement rules override any earlier instruction about subjectNames or character/relationship subjectId values.",
  "Preserve every supported durable fact unless the source transcript clearly contradicts it.",
  "Preserve character_fact and relationship_state subjectId values from candidateUnits. Those structural identities are server-owned.",
  "Never add subjectNames or choose database subject keys. Do not add character_fact or relationship_state identities that are absent from candidateUnits.",
  "Merge duplicate or overlapping units, improve sectionKey and non-character subjectId choices when the transcript supports a better mapping, and recalibrate confidence/salience based on the source text.",
  "Drop units that are unsupported, redundant, or too speculative for the transcript.",
  "Add missing durable facts that are clearly supported by the source transcript and not already covered by the candidate units.",
  "Keep quest/objective/stage/resolution units aligned to thread memories.",
  "Use the same allowed stream and field schema as the normal game extraction prompt.",
  "Do not emit current scene, transient combat state, or other short-lived status unless it is represented as a durable memory stream.",
  "Prefer concise, evidence-backed units over verbose rewrites.",
  "Use sourceHash exactly as supplied.",
  "Set confidence and salience from 0 to 1.",
  "For enum fields, choose exactly one string from the allowed arrays. Do not join multiple values with |.",
].join("\n");

export const DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE = {
  roleplay: DEFAULT_LTM_EXTRACTION_PROMPT,
  conversation: DEFAULT_LTM_EXTRACTION_PROMPT_CONVERSATION,
  game: DEFAULT_LTM_EXTRACTION_PROMPT_GAME,
} as const satisfies Record<LtmMode, string>;

export const DEFAULT_LTM_ALLOWED_STREAMS_BY_MODE: Record<
  LtmMode,
  readonly LtmEvidenceUnitBucket[]
> = {
  roleplay: [
    "timeline_event",
    "character_fact",
    "relationship_state",
    "world_fact",
    "thread",
    "tone",
    "anchor",
  ],
  conversation: ["timeline_event", "character_fact", "relationship_state", "world_fact", "thread", "tone", "anchor"],
  game: [
    "timeline_event",
    "character_fact",
    "relationship_state",
    "world_fact",
    "thread",
    "tone",
    "anchor",
  ],
};

export const DEFAULT_LTM_STREAM_DESCRIPTIONS_BY_MODE: Record<
  LtmMode,
  Partial<Record<LtmEvidenceUnitBucket, string>>
> = {
  roleplay: {
    timeline_event:
      "source-summary scene/plot pivot, decision, action, discovery, fight outcome, promise, arrival, or departure; not the live current scene",
    character_fact:
      "durable character identity/trait/role/affiliation/backstory/belief/permanent status/development/ability/item/exact voice quote; not ordinary scene action or transient condition",
    relationship_state:
      "relationship state or dimension change backed by a caused_by event link or existing relationship note",
    world_fact: "stable world/lore fact",
    thread:
      "unresolved situation, question, tension, or goal with a clear future resolver",
    tone: "durable world/session atmospheric register or recurring style only",
    anchor: "recurring motif, planted callback, or continuity anchor",
  },
  conversation: {
    timeline_event: "durable decision, commitment, disclosure, or consequential exchange",
    character_fact:
      "durable user preference, trait, intent, or stated attribute; not a one-off opinion or transient mood",
    relationship_state: "durable relationship state change backed by a caused_by event link",
    world_fact: "verified factual statement from the conversation",
    thread: "unresolved question, topic, or goal with a clear future resolver",
    tone: "durable conversation register or recurring style only",
    anchor: "recurring motif, planted callback, or inside joke",
  },
  game: {
    timeline_event:
      "game session scene/plot pivot, decision, action, discovery, fight outcome, promise, arrival, or departure; not the live current scene",
    character_fact:
      "durable character identity/trait/role/affiliation/backstory/belief/permanent development/ability/item/progression/voice quote; not ordinary scene action or transient condition",
    relationship_state:
      "relationship state or dimension change backed by a caused_by event link or existing relationship note",
    world_fact: "stable world/lore fact",
    thread:
      "quest objective, stage, or summary of an unresolved situation with a clear future resolver",
    tone: "durable world/session atmospheric register or recurring style only",
    anchor: "recurring motif, planted callback, or continuity anchor",
  },
};

export const DEFAULT_LTM_RECALL_STYLE_BY_MODE: Record<
  LtmMode,
  LongTermMemoryRecallStyle
> = {
  roleplay: "story",
  conversation: "balanced",
  game: "exact",
};

export const DEFAULT_LTM_RECALL_STYLE =
  "balanced" satisfies LongTermMemoryRecallStyle;
export const DEFAULT_LTM_RECALL_PREAMBLE =
  "Relevant long-term memories for this reply:";

export const LTM_RECALL_STYLE_WEIGHTS = {
  balanced: {
    semanticWeight: 0.6,
    lexicalWeight: 0.3,
    graphWeight: 0.1,
    keywordWeight: 0.2,
  },
  exact: {
    semanticWeight: 0.15,
    lexicalWeight: 1,
    graphWeight: 0,
    keywordWeight: 0.8,
  },
  broad: {
    semanticWeight: 0.55,
    lexicalWeight: 0.2,
    graphWeight: 0.8,
    keywordWeight: 0.15,
  },
  story: {
    semanticWeight: 0.45,
    lexicalWeight: 0.25,
    graphWeight: 0.35,
    keywordWeight: 0.25,
  },
} as const satisfies Record<
  LongTermMemoryRecallStyle,
  {
    semanticWeight: number;
    lexicalWeight: number;
    graphWeight: number;
    keywordWeight: number;
  }
>;

export const DEFAULT_LTM_RECALL_STYLE_WEIGHTS =
  LTM_RECALL_STYLE_WEIGHTS[DEFAULT_LTM_RECALL_STYLE];

export type LtmRecallWeights = {
  semanticWeight: number;
  lexicalWeight: number;
  graphWeight: number;
  keywordWeight: number;
};

export function clampLtmRecallWeight(
  value: unknown,
  fallback: number,
  min = 0,
  max = 2,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

export function readLtmRecallWeightOverrides(
  metadata: Record<string, unknown>,
  fallback: LtmRecallWeights,
): LtmRecallWeights {
  const read = (
    value: unknown,
    defaultValue: number,
    min: number,
    max: number,
  ) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : defaultValue;
  return {
    semanticWeight: read(
      metadata.longTermMemorySemanticWeight,
      fallback.semanticWeight,
      0,
      1,
    ),
    lexicalWeight: read(
      metadata.longTermMemoryLexicalWeight,
      fallback.lexicalWeight,
      0,
      1,
    ),
    graphWeight: read(
      metadata.longTermMemoryGraphWeight,
      fallback.graphWeight,
      0,
      1,
    ),
    keywordWeight: read(
      metadata.longTermMemoryKeywordWeight,
      fallback.keywordWeight,
      0,
      1,
    ),
  };
}

export function parseLongTermMemoryRecallStyle(
  value: unknown,
): LongTermMemoryRecallStyle {
  return value === "exact" || value === "broad" || value === "story"
    ? value
    : DEFAULT_LTM_RECALL_STYLE;
}
