/**
 * Everything that went into one generated post, recorded when it was written.
 *
 * Read only by the Creator's own Deep details view. It holds the full prompt, including the source
 * card and continuity notes, so it never travels with the post to viewers: the post carries only
 * `metadata.deepDetailsId`, and the record is served by the managed route.
 */
export type SlpDeepDetailsRecord = {
  version: 1;
  generatedAt: string;
  publicationTime: string | null;
  /** How many posts the Creator had made; every seeded draw keys off it. */
  sequence: number;
  /** The player's own direction, when the post was directed. */
  direction: string | null;
  model: {
    provider: string;
    model: string;
    /** Absent on records made before 0.2.36. */
    connectionId?: string | null;
    connectionName?: string | null;
    temperature: number | null;
    topP: number | null;
    maxTokens: number | null;
  };
  /** 2 when the first answer was not valid JSON and a correction turn was needed. */
  attempts: number;
  plan: {
    opportunityId: string | null;
    intent: string | null;
    delivery: string | null;
    access: string;
    teaser: boolean;
    story: boolean;
    format: string;
    rotatedFormat: string | null;
    campaignId: string | null;
    shootId: string | null;
    reusedFromPostId: string | null;
    demandTopic: string | null;
    project: { id: string; title: string; chapter: string | null } | null;
  };
  /** `framing` appears only on older records; the camera source replaced it. */
  angle: { place: string; moment: string; company: string; framing?: string } | null;
  camera: string | null;
  effort: string | null;
  strategy: {
    style: string;
    skipRate: number;
    textOnlyRate: number;
    intentWeights: Record<string, number>;
  };
  messages: { role: string; content: string }[];
  rawResponse: string;
  /** Server-side only, never sent: locked bodies the fan seat's view masks. */
  paidBodies?: string[];
  modelOutput: {
    title: string | null;
    content: string;
    imagePrompt: string | null;
    scene?: {
      wardrobeId?: string | null;
      setting: string;
      action: string;
      expression: string;
      visualDirection: string;
      outfit?: string;
    } | null;
  };
  wardrobeSelection?: { selectedId: string | null; requestedId: string | null; fallback: boolean };
  /** The picture brief built from the situation, or the model's own image prompt when there was none. */
  imageBrief: string | null;
  /** The typed scene contract used to constrain image prompt interpretation, when available. */
  visualBrief?: {
    subject: string;
    action: string;
    setting: string;
    company: string;
    clothing: string | null;
    camera: string;
    mood: string | null;
    sexualLevel: "none" | "suggestive" | "nudity" | "explicit";
  } | null;
  /** Exact positive prompt sent to the image provider, stored only in this Creator-private record. */
  providerPrompt?: string | null;
  /** Every image run for this post, oldest first, capped to the last few. Absent on older records. */
  imageRuns?: SlpDeepDetailsImageRun[];
  askedModelForImagePrompt: boolean;
  /**
   * Which planner wrote the post, the beat it chose (with its anchor, cast, and place), and the
   * writer's claim check. `beat` is null when the post was intent-first or fell back to classic.
   * Absent on records made before 0.2.42.
   */
  planner?: {
    mode: "classic" | "beats";
    beat: {
      type: string;
      anchorKind: string;
      anchor: string;
      line: string;
      cast: string[];
      place: string | null;
      /** The callback this post could refer back to. Absent before 0.2.50. */
      reference?: { kind: string; text: string };
      /** The player's one-off idea this beat carried out (7b0). */
      nudgeId?: string;
      /** The shared idea it came from; `poll:<id>` when it answers a Story poll (3b). */
      sharedId?: string;
      /** The collab, brand deal, rivalry or couple moment it carried out (7b-c, U). */
      tie?: { kind: string; partnerId?: string; brand?: string; hostShare?: number; moment?: string };
    } | null;
    claimCheck: {
      ok: boolean;
      problems: string[];
      claims: { people: string[]; earlierEvents: string[]; stateChanges: string[] } | null;
      revised?: boolean;
    } | null;
    /** The Creator's dial and the level this post was planned at (Beats). Absent before 0.2.49. */
    heat?: { dial: string; planned: string };
  };
  /** What shaped the voice of this post (the 7b0 flavour brief). Absent on records made before it was recorded. */
  flavour?: SlpDeepDetailsFlavour | null;
};

/**
 * The flavour brief of one post, as parts rather than prompt text, so Deep details can say in plain
 * words what shaped it. The values are the brief's own (card sentences, the player's steering).
 */
export type SlpDeepDetailsFlavour = {
  /**
   * The true details about them drawn for this post. `kind` is people, places, work, objects, habit
   * or jokes for a card anchor (`text` is the bare anchor), else a card sentence (voice, never, life…)
   * or another Agent's note (lately).
   */
  details: { kind: string; text: string }[];
  /** A line of theirs shown to the model as their voice. */
  voice: string | null;
  /** An opener they had used a lot: asked to avoid it, or allowed once in a while. */
  opener: { phrase: string; allowed: boolean } | null;
  /** A day texture, drawn when the player set no mood. */
  day: "flat" | "good" | "small" | null;
  /** Their love life, one sentence, when they have one. */
  relationship: string | null;
  /** The steering that reached the brief. Null when the player set none. */
  steering: {
    mood: string | null;
    life: string | null;
    focus: string | null;
    /** The one pushed topic this post carried. */
    topic: string | null;
    leftOut: string[];
  } | null;
};

/**
 * One pass through the image pipeline, recorded as it ran. Values are the ones in force at that
 * moment, never re-read from current settings. Holds no API key, base URL, or other credential.
 */
export type SlpDeepDetailsImageRun = {
  /** What started the run: the first post generation, a prompt review, a reviewed confirmation, a retry, or the reserve. */
  trigger: "generation" | "review" | "reviewed" | "retry" | "reserve";
  startedAt: string;
  connection: {
    id: string;
    name: string | null;
    provider: string | null;
    model: string | null;
    source: string | null;
    service: string | null;
    hasFallback: boolean;
    /** Which setting picked this connection: the Creator's own, Slurp's default, or the Engine default. */
    chosenBy?: "creator" | "slurp" | "engine";
    /** The connection the Engine retries on when this one fails. Absent before 0.2.36. */
    fallback?: { id: string; name: string; model: string | null } | null;
  };
  size: { width: number | null; height: number | null };
  styleProfile: {
    id: string;
    name: string;
    /** Where the choice came from: the Creator's own setting, or the Slurp-wide one. */
    chosenBy: "creator" | "slurp" | "none";
    styleText: string;
    positiveTags: string;
    negativeTags: string;
  };
  settings: { includeDescriptions: boolean; avatarReferences: boolean; interpretation: boolean };
  appearance: { source: "stage" | "source-card" | "reference" | "none"; text: string };
  /**
   * The viewpoint phrase Slurp kept in the prompt (P), in the words of the image model's family:
   * tags for tag models, e621 tags for a drawn furry, natural words otherwise. Absent before it was recorded.
   */
  viewpoint?: { source: string; family: "tags" | "e621" | "natural"; phrase: string } | null;
  referenceImages: number;
  /** The image template as rendered, before the style profile was applied. */
  templatePrompt: string;
  /** The template after the style profile was applied. */
  styledPrompt: string;
  rewrite: {
    status: "skipped" | "accepted" | "rejected" | "failed";
    /** The text connection and model that ran the rewrite. Absent before 0.2.36. */
    model?: { connectionId: string; connectionName: string | null; model: string } | null;
    /** The full chat sent to the rewrite model. Absent before 0.2.36. */
    messages?: { role: string; content: string }[];
    input: string | null;
    output: string | null;
    reason: string | null;
  };
  finalPrompt: string | null;
  negativePrompt: string | null;
  attempts: {
    attempt: number;
    startedAt: string;
    durationMs: number;
    route: "host" | "bundled";
    ok: boolean;
    error: string | null;
    /** Set when the primary connection failed and the Engine's fallback connection drew the picture. */
    servedBy?: { id: string; name: string; model: string | null } | null;
    /** The prompt the provider actually received, when the Engine changed it (a flattened or fallback prompt). */
    effectivePrompt?: string | null;
  }[];
  result: { status: "saved" | "preview" | "failed"; mediaPath: string | null; error: string | null };
};

export type SlpDeepDetailsResponse = {
  post: {
    id: string;
    title: string | null;
    content: string;
    access: string;
    source: string;
    createdAt: string;
    updatedAt: string;
    imageUrl: string | null;
    imagePrompt: string | null;
    images: { position: number; imageUrl: string; imagePrompt: string | null }[];
    metadata: Record<string, unknown>;
  };
  creator: { id: string; displayName: string; handle: string };
  details: SlpDeepDetailsRecord | null;
  plan: {
    id: string;
    workflow: string;
    plannedAt: string;
    dueAt: string | null;
    completedAt: string | null;
    sourceEventId: string | null;
    slotId: string | null;
    /** What a kept promise delivers, in the Creator's own label. */
    topic?: string | null;
  } | null;
  links: { fromType: string; fromId: string; toType: string; toId: string; relation: string }[];
  /** The Creators a collab, couple or rivalry post names, by account id. Absent before M. */
  people?: Record<string, { displayName: string; handle: string }>;
  /** The posts its purpose points at (the drop of a tease, the tease of a drop, the Story poll). Absent before M. */
  related?: Record<string, { text: string; createdAt: string; access: string }>;
  stats: { likes: number; replies: number; unlocks: number };
};

/**
 * Everything that went into one generated direct-message reply, recorded when it was written.
 *
 * Like the post record it holds the full prompt, the source card and private notes included, so it
 * never travels with the message: a thread's reader gets only the ids of the records it keeps, and the
 * record is served by the managed route. `chat` holds the facts the generator had, never re-read later.
 */
export type SlpMessageDeepDetailsRecord = {
  version: 1;
  generatedAt: string;
  model: SlpDeepDetailsRecord["model"];
  messages: { role: string; content: string }[];
  rawResponse: string;
  chat: {
    rapport: { tier: string; score: number };
    subscribed: boolean;
    /** The reply answered a message request, before the chat was accepted. */
    request: boolean;
    /** Why a scheduled follow-up or a redo was written, when the reply had such a direction. */
    direction: string | null;
    /** The resolved position and every layer behind it. Null in Slurp Support's thread, which has none. */
    stance: {
      warmth: string;
      latitude: string;
      imageMode: string;
      evidence: { layer: string; value: string; effect: string }[];
    } | null;
    /** How this fan stands with the Creator, and how far the chat may go. */
    relationship: { posture: string; adultLevel: string } | null;
    creator: { emotion: string; intent: string } | null;
    /** What the Creator remembered about this fan, as the prompt carried it. */
    memories: { tier: string; text: string }[];
    /** The lorebook scan behind the reply. Absent on records made before 0.3.42. */
    lore?: SlpLoreReport;
  };
};

/**
 * What one lorebook scan put into a prompt, in words a player can check against their lorebooks:
 * whether the scan ran at all, the entries it used, and the entries it found but had no room for.
 */
export type SlpLoreReport = {
  /** Settings → Lorebook context. Off: nothing was scanned. */
  enabled: boolean;
  included: { name: string; book: string }[];
  /** Matched, then left out because the lore budget was full. */
  skipped: { name: string; book: string }[];
};

/**
 * The record a message belongs to. A reply's later bubbles are stored as `<first bubble id>:<n>`,
 * so every bubble of one reply leads to the one record.
 */
export const slpMessageDeepDetailsId = (messageId: string) => messageId.split(":")[0]!;

export type SlpMessageDeepDetailsResponse = {
  message: { id: string; content: string; createdAt: string };
  creator: { id: string; displayName: string; handle: string };
  details: SlpMessageDeepDetailsRecord | null;
};
