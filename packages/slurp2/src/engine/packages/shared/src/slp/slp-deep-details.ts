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
  stats: { likes: number; replies: number; unlocks: number };
};
