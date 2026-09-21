import type { SlpDeepDetailsRecord } from "../../../../../shared/src/slp/slp-deep-details.js";
import type { ChatMessage } from "../../../services/llm/base-provider.js";
import type { SlurpCreatorStrategy } from "../../modules/creators/slp-creator-strategy.js";
import type { SlurpPostVariation } from "../../modules/feed/slp-post-variation.js";
import type { SlurpVisualBrief } from "../../base/media/slp-visual-brief.js";

const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);

/** The generator's state at the moment a post was written, as the Deep details record. */
export function buildSlurpDeepDetailsRecord(ctx: {
  input: {
    generatedAt?: Date;
    publicationTime?: Date;
    request: { noodlerPostGuide?: string; access: string };
    connection: { provider?: unknown; model?: unknown };
  };
  sequence: number;
  completionOptions: object;
  attempts: number;
  opportunity: { id: string } | null | undefined;
  axes: { intent: string; delivery: string } | null | undefined;
  isTeaser: boolean;
  storyVariation: boolean;
  format: string;
  variation: SlurpPostVariation | null;
  campaignId: string | null | undefined;
  shootId: string | null;
  reusedSource: { id: string } | null | undefined;
  demandTopic: string | null | undefined;
  project: { id: string; title: string } | null;
  projectChapter: string | null;
  camera: string | null | undefined;
  effort: string;
  strategy: SlurpCreatorStrategy;
  sentMessages: ChatMessage[];
  content: string;
  generated: { title?: string | null; content: string; imagePrompt?: string | null };
  draftImagePrompt: string | null | undefined;
  visualBrief?: SlurpVisualBrief | null;
  askModelForImagePrompt: boolean;
}): SlpDeepDetailsRecord {
  return {
    version: 1,
    generatedAt: (ctx.input.generatedAt ?? new Date()).toISOString(),
    publicationTime: ctx.input.publicationTime?.toISOString() ?? null,
    sequence: ctx.sequence,
    direction: ctx.input.request.noodlerPostGuide?.trim() || null,
    model: {
      provider: String(ctx.input.connection.provider ?? ""),
      model: String(ctx.input.connection.model ?? ""),
      temperature: numberOrNull((ctx.completionOptions as Record<string, unknown>).temperature),
      topP: numberOrNull((ctx.completionOptions as Record<string, unknown>).topP),
      maxTokens: numberOrNull((ctx.completionOptions as Record<string, unknown>).maxTokens),
    },
    attempts: ctx.attempts,
    plan: {
      opportunityId: ctx.opportunity?.id ?? null,
      intent: ctx.axes?.intent ?? null,
      delivery: ctx.axes?.delivery ?? null,
      access: ctx.input.request.access,
      teaser: ctx.isTeaser,
      story: ctx.storyVariation,
      format: ctx.format,
      rotatedFormat: ctx.variation?.format ?? null,
      campaignId: ctx.campaignId ?? null,
      shootId: ctx.shootId,
      reusedFromPostId: ctx.reusedSource?.id ?? null,
      demandTopic: ctx.demandTopic ?? null,
      project: ctx.project ? { id: ctx.project.id, title: ctx.project.title, chapter: ctx.projectChapter } : null,
    },
    angle: ctx.variation
      ? {
          place: ctx.variation.place,
          moment: ctx.variation.moment,
          company: ctx.variation.company,
          framing: ctx.variation.framing,
        }
      : null,
    camera: ctx.camera ?? null,
    effort: ctx.variation ? ctx.effort : null,
    strategy: {
      style: ctx.strategy.production.style,
      skipRate: ctx.strategy.skipRate,
      textOnlyRate: ctx.strategy.textOnlyRate,
      intentWeights: { ...ctx.strategy.intentWeights } as Record<string, number>,
    },
    messages: ctx.sentMessages.map((message) => ({
      role: message.role,
      content: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
    })),
    rawResponse: ctx.content,
    modelOutput: {
      title: ctx.generated.title ?? null,
      content: ctx.generated.content,
      imagePrompt: ctx.generated.imagePrompt ?? null,
    },
    imageBrief: ctx.draftImagePrompt ?? null,
    visualBrief: ctx.visualBrief ?? null,
    askedModelForImagePrompt: ctx.askModelForImagePrompt,
  };
}
