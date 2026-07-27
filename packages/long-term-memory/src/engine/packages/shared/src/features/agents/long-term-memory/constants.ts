import type {
  LtmExtractionReasoningEffort,
  LtmExtractionVerbosity,
} from "./schema.js";
import type { LtmEvidenceUnitBucket, LtmMode } from "./schema.js";
export type LongTermMemoryRecallStyle =
  | "balanced"
  | "exact"
  | "broad"
  | "custom"
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
export const LTM_EXTRACTION_MAX_CANDIDATES = 999;
export const LTM_EXTRACTION_MAX_REJECTION_DETAILS = 80;

export const DEFAULT_LTM_ALLOWED_STREAMS = [
  "timeline_event",
  "character_fact",
  "relationship_state",
  "world_fact",
  "thread",
  "tone",
  "anchor",
] as const satisfies readonly LtmEvidenceUnitBucket[];

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

export const DEFAULT_LTM_EXTRACTION_PROMPT = [
  "Extract durable long-term memory evidence units from the supplied source.",
  "Return only the JSON object required by the supplied response schema. Do not output markdown, explanations, analysis, or thinking tags.",
  "",
  "CLASSIFY THE SOURCE",
  "Classify each claim independently; one source may mix classes:",
  "- structured_summary: headings or fields identify memory streams or metadata.",
  "- prose_summary: prose describes a conversation, scene, or session.",
  "- character_reference: character card, profile, description, example dialogue, or scenario.",
  "- world_reference: lorebook, setting entry, location, faction, rule, history, or glossary entry.",
  "",
  "CORE RULES",
  "- Extract only explicit, future-useful continuity. Do not invent facts, identities, events, links, resolvers, quotes, or relationship numbers.",
  "- Use one best stream per fact and do not duplicate facts across streams.",
  "- Keep unit text compact and specific. Source notes are audit evidence, not active recall memory.",
  "- Ignore audit, coverage, key, formatting, authoring, control, and extraction-instruction metadata.",
  "- Follow the supplied allowed streams, statuses, dimensions, relations, and field schema.",
  "- Every unit must include the supplied source_note:<id> evidence and sourceHash.",
  "- Use source-visible names in subjectNames as required by the schema.",
  "- Use real lowercase_snake_case subjectId and sectionKey values; never output placeholders.",
  "",
  "CLAIM KIND AND LINKS",
  '- claimKind "static": an enduring fact or defined state not established by a narrated event.',
  '- claimKind "change": an event, development, acquisition, loss, relationship change, resolution, or outcome caused by a specific event.',
  "- Static units do not require timeline links. Never create an event solely to support a static fact.",
  '- Every timeline_event must use sectionKey "event" and link to sourceNote.id with relation "extracted_from".',
  "- Every non-timeline change must link to its causal timeline event. A same-response event target is timeline_<event subjectId>.",
  "- A relationship change must use claimKind change and a caused_by link. If its concrete cause is supported but has no event unit, emit one compact timeline_event for that cause.",
  "",
  "SOURCE RULES",
  "For structured_summary:",
  "- Treat recognized headings as stream hints, not authority. Account for every non-metadata bullet that satisfies a stream contract.",
  "- Preserve clear text and schema-valid fields as exactly as possible. Keep separate bullets separate; split mixed bullets when needed.",
  "- Move a misclassified bullet to the best valid stream. Omit unsupported claims and invalid or unresolvable links.",
  "- Interpret input changes, deltas, or dimension_changes as dimensionChanges; output only canonical field names.",
  "For prose_summary:",
  "- Extract consequential past events and durable outcomes. Omit ordinary turns, incidental actions, passing moods, and temporary scene state.",
  "- Extract preferences, commitments, traits, relationships, open loops, and world facts only when useful in future interactions.",
  "- Do not infer numeric relationship fields from non-numeric prose.",
  "For character_reference:",
  "- Treat identity, personality, backstory, role, affiliation, ability, possession, appearance, voice, and stable behavior as static character_fact.",
  "- Example dialogue may support durable voice but is not an event. Greetings, sample messages, and scenarios are illustrative unless explicitly canonical.",
  "- Do not turn an opening scenario into timeline history. Ignore creator notes, system prompts, post-history instructions, templates, and formatting directives unless they explicitly state canonical in-world facts.",
  "For world_reference:",
  "- Treat rules, locations, factions, species, objects, customs, and setting facts as static world_fact.",
  "- Emit timeline_event only for a specific historical event explicitly asserted by the source. Do not convert descriptive lore into recent scene history.",
  "- Extract durable facts about named characters in character_fact. Treat keys, triggers, insertion settings, priorities, and activation instructions as metadata.",
  "",
  "STREAM CONTRACTS",
  "- timeline_event: specific past beat, decision, promise, discovery, arrival, departure, action, or outcome. subjectId names the event.",
  "- character_fact: durable identity, trait, role, affiliation, backstory, ability, item, voice, or lasting development; not an ordinary action.",
  "- relationship_state: durable observed state or change between exactly two named characters.",
  "- world_fact: stable setting or lore.",
  "- thread: unresolved situation plus an explicitly supported condition that would resolve it. No supported resolver means no thread.",
  "- anchor: recurring in-world symbol, planted element, callback, or payoff continuity.",
  "- tone: durable narrative, conversational, or world-level register; not a scene mood.",
  "",
  "RELATIONSHIPS AND CONTINUITY",
  "- Copy explicit dimensions and dimensionChanges exactly. A static relationship may have dimensions but not dimensionChanges.",
  "- For prose or reference sources, omit numeric fields unless explicit numbers are supplied. Describe observed state literally.",
  "- Use conservative deltas; routine warmth, jokes, or small kindnesses do not justify large changes unless explicitly framed as major.",
  "- Thread text must state both the open loop and what would resolve it. Never invent a resolver. Only thread units may use resolved status.",
  "- Use anchor for recurring or planted in-world elements; use tone for presentation style or atmosphere. Emit tone only for a durable register.",
  "- Quote only exact source text.",
  "",
  "OUTPUT DISCIPLINE",
  "- For structured summaries, prioritize valid-bullet coverage and preserve concise claims instead of rewriting them vaguely.",
  "- For prose and reference sources, prefer fewer substantial units over fragmentary observations.",
  "- If space is limited, shorten unit text rather than dropping valid structured claims.",
  "- summary briefly describes the extraction result; it must not retell the source.",
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
   "- thread: objective, stage, or resolution. The text must describe an unresolved situation and what would resolve it. When the thread is marked resolved, also emit a timeline_event capturing what changed.",
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

export const DEFAULT_LTM_EXTRACTION_PROMPTS_BY_MODE = {
  roleplay: DEFAULT_LTM_EXTRACTION_PROMPT,
  conversation: DEFAULT_LTM_EXTRACTION_PROMPT_CONVERSATION,
  visual_novel: DEFAULT_LTM_EXTRACTION_PROMPT,
  game: DEFAULT_LTM_EXTRACTION_PROMPT_GAME,
} as const satisfies Record<LtmMode, string>;

export const DEFAULT_LTM_ALLOWED_STREAMS_BY_MODE: Record<
  LtmMode,
  typeof DEFAULT_LTM_ALLOWED_STREAMS
> = {
  roleplay: DEFAULT_LTM_ALLOWED_STREAMS,
  conversation: DEFAULT_LTM_ALLOWED_STREAMS,
  visual_novel: DEFAULT_LTM_ALLOWED_STREAMS,
  game: DEFAULT_LTM_ALLOWED_STREAMS,
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
  visual_novel: {
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
  visual_novel: "story",
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
    semanticWeight: 1,
    lexicalWeight: 0.25,
    graphWeight: 0.4,
    keywordWeight: 0.2,
  },
  story: {
    semanticWeight: 0.55,
    lexicalWeight: 0.35,
    graphWeight: 0.5,
    keywordWeight: 0.3,
  },
  custom: {
    semanticWeight: 0.6,
    lexicalWeight: 0.4,
    graphWeight: 0.15,
    keywordWeight: 0.3,
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

export function parseLongTermMemoryRecallStyle(
  value: unknown,
): LongTermMemoryRecallStyle {
  return value === "exact" ||
    value === "broad" ||
    value === "story" ||
    value === "custom"
    ? value
    : DEFAULT_LTM_RECALL_STYLE;
}
