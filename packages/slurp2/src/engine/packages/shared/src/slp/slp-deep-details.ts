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
  angle: { place: string; moment: string; company: string; framing: string } | null;
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
  modelOutput: { title: string | null; content: string; imagePrompt: string | null };
  /** The picture brief built from the situation, or the model's own image prompt when there was none. */
  imageBrief: string | null;
  askedModelForImagePrompt: boolean;
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
  } | null;
  links: { fromType: string; fromId: string; toType: string; toId: string; relation: string }[];
  stats: { likes: number; replies: number; unlocks: number };
};
