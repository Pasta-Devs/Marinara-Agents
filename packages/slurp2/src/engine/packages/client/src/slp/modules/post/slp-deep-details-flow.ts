import type {
  SlpDeepDetailsImageRun,
  SlpDeepDetailsRecord,
  SlpDeepDetailsResponse,
} from "../../../../../shared/src/slp/slp-deep-details.js";
import { mapOrigins, originTable } from "./slp-deep-details-origins";
import type { SlpStepStatus } from "./SlpDeepDetailsParts";

/**
 * One fact on a node. `value` is the short form that fits the card; `text` is the exact recorded
 * text behind it, opened on demand; `note` says what the step took from it or what it is for.
 */
export type SlpFlowRow = {
  label: string;
  value: string | null;
  text?: string | null;
  note?: string | null;
  /** Where the value comes from: a setting and where to change it, or the step that produced it. */
  from?: string | null;
};

/**
 * One post's generation as a graph: the steps Slurp ran, in order, and the inputs that fed each of
 * them. The vertical flowchart and the canvas both draw this one graph, so they can never disagree.
 */
export type SlpFlowNode = {
  id: string;
  /**
   * `source` is a place data is kept (a profile, a setting, a template); `input` is a value resolved
   * from sources for this post; `step` is on the main line; `model` is a step a model ran.
   */
  kind: "source" | "input" | "step" | "model";
  /** Text steps write the post; image steps draw its picture. */
  lane: "text" | "image";
  title: string;
  status: SlpStepStatus;
  /** The connection and model that ran this step, when a model ran it. */
  model: string | null;
  inputs: SlpFlowRow[];
  outputs: SlpFlowRow[];
  /** What the step does, mechanically. */
  what: string;
  /** Why the step exists. */
  why: string;
  /** Records that are neither an input nor an output, such as the provider attempt log. */
  details: { label: string; text: string }[];
  /** Main-line position. Inputs take the column of the step they feed. */
  column: number;
};

export type SlpFlowEdge = { from: string; to: string; label: string | null };

export type SlpFlowGraph = { nodes: SlpFlowNode[]; edges: SlpFlowEdge[] };

const clip = (text: string | null | undefined, length = 120) => {
  const value = text?.trim().replace(/\s+/gu, " ");
  if (!value) return null;
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
};

const chars = (text: string | null | undefined) => (text ? `${text.length.toLocaleString()} characters` : null);

const modelLabel = (model: string | null | undefined, connection: string | null | undefined) =>
  [model, connection].filter(Boolean).join(" · ") || null;

/** A row with its exact text. The text opens only when it says more than the short value. */
function row(label: string, text: string | null | undefined, options: { value?: string | null; note?: string } = {}) {
  const exact = text?.trim() || null;
  const value = options.value === undefined ? clip(exact) : options.value;
  return { label, value, text: exact && exact !== value ? exact : null, note: options.note ?? null };
}

const fact = (label: string, value: string | null | undefined, note?: string): SlpFlowRow => ({
  label,
  value: value ?? null,
  note: note ?? null,
});

const chat = (messages: { role: string; content: string }[]) =>
  messages.map((message) => `### ${message.role}\n${message.content}`).join("\n\n");

const json = (value: unknown) => (value ? JSON.stringify(value, null, 2) : null);

function postNodes(data: SlpDeepDetailsResponse, details: SlpDeepDetailsRecord): SlpFlowNode[] {
  const plan = details.plan;
  const weights = Object.entries(details.strategy.intentWeights).sort(([, a], [, b]) => b - a);
  const weightText = weights.map(([intent, weight]) => `${intent}: ${weight}`).join("\n");
  const topWeights = weights
    .slice(0, 3)
    .map(([intent, weight]) => `${intent} ${weight}`)
    .join(", ");
  const scene = details.modelOutput.scene;
  const sceneShort = scene ? [scene.setting, scene.action].filter(Boolean).join(" — ") : null;
  const project = plan.project
    ? `${plan.project.title}${plan.project.chapter ? ` — ${plan.project.chapter}` : ""}`
    : null;
  return [
    {
      id: "strategy",
      kind: "input",
      lane: "text",
      title: "Creator strategy",
      status: "done",
      model: null,
      inputs: [],
      outputs: [
        fact(
          "Production style",
          details.strategy.style,
          "Shapes how the post is written and how the picture is staged.",
        ),
        row("Intent weights", weightText, {
          value: topWeights || null,
          note: "The plan draws the post's intent from these odds.",
        }),
        fact("Quiet slots", `${details.strategy.skipRate}%`, "Chance that a scheduled slot stays empty."),
        fact("Lean on words", `${details.strategy.textOnlyRate} / 100`, "Chance of a text-only post."),
      ],
      what: "The Creator's saved posting habits, read from the profile before every post.",
      why: "They keep one Creator's feed consistent from post to post.",
      details: [],
      column: 0,
    },
    {
      id: "request",
      kind: "input",
      lane: "text",
      title: "Request and schedule",
      status: data.plan || details.direction ? "done" : "skipped",
      model: null,
      inputs: [],
      outputs: [
        fact("Workflow", data.plan?.workflow ?? null, "What asked for the post: the schedule, run now, or you."),
        fact("Due", data.plan?.dueAt ?? null),
        row("Player direction", details.direction, { note: "Copied into the writing prompt as your direction." }),
        fact("Subscribers asked for", plan.demandTopic, "A topic the post should answer."),
        fact("Campaign", plan.campaignId),
        fact("Project", project, "The story arc this post belongs to."),
      ],
      what: "The reason a post was made at this moment.",
      why: "A post answers a slot, a request, or your direction. Anything shown here was passed on.",
      details: [],
      column: 0,
    },
    {
      id: "plan",
      kind: "step",
      lane: "text",
      title: "Plan the post",
      status: "done",
      model: null,
      inputs: [
        fact("Post number", String(details.sequence + 1), "The seed. The same number always gives the same draw."),
        fact("Access setting", plan.access),
        row("Intent weights", weightText, { value: topWeights || null, note: "The odds for each intent." }),
      ],
      outputs: [
        fact("Intent", plan.intent, "What the post is for."),
        fact("Delivery", plan.delivery, "Text only, one picture, a set, or a picture reused from an earlier post."),
        fact("Access", plan.access, "Who can see the post."),
        fact(
          "Format",
          plan.rotatedFormat && plan.rotatedFormat !== plan.format
            ? `${plan.rotatedFormat} → ${plan.format}`
            : plan.format,
          "The shape of the text.",
        ),
        fact("Teaser", plan.teaser ? "yes" : null, "A free preview of a locked post."),
        fact("Reuses picture from", plan.reusedFromPostId, "No new picture is drawn for this post."),
      ],
      what: "A seeded draw picks the intent from the weights, then the delivery and the format. Access comes from the Creator's access setting.",
      why: "Every post gets one clear job, and the feed does not repeat itself.",
      details: [],
      column: 0,
    },
    {
      id: "angle",
      kind: "step",
      lane: "text",
      title: "Pick the angle",
      status: details.angle ? "done" : "skipped",
      model: null,
      inputs: [fact("Intent", plan.intent, "Some places and moments only fit some intents.")],
      outputs: [
        fact("Place", details.angle?.place ?? null),
        fact("Moment", details.angle?.moment ?? null),
        fact("Company", details.angle?.company ?? null, "Who else is in the scene."),
        fact("Camera", details.camera, "Who holds the camera, and why they are there."),
        fact("Effort", details.effort, "How staged or casual the post is."),
      ],
      what: "A second seeded draw picks a place, a moment, and company. The camera follows from what is in the scene.",
      why: "Without it, posts fall back to the same room and the same pose.",
      details: [],
      column: 1,
    },
    {
      id: "writing-prompt",
      kind: "step",
      lane: "text",
      title: "Build the writing prompt",
      status: "done",
      model: null,
      inputs: [
        fact(
          "Plan and angle",
          [plan.intent, plan.delivery, details.angle?.place].filter(Boolean).join(" · ") || null,
          "Written into the prompt as the task.",
        ),
        fact("Creator card and memory", "inside the chat", "Personality, appearance, and continuity notes."),
        fact("Prompt template", "Post writing prompt", "The rules and the order of the chat."),
      ],
      outputs: [
        row("Chat", chat(details.messages), {
          value: `${details.messages.length} messages · ${chars(chat(details.messages))}`,
          note: "Sent to the text model without changes.",
        }),
      ],
      what: "Slurp fills the post template: system rules, the Creator card, continuity notes, the plan, the angle, and your direction.",
      why: "The text model knows only what is in this chat.",
      details: [],
      column: 2,
    },
    {
      id: "write",
      kind: "model",
      lane: "text",
      title: "Write the post",
      status: details.attempts > 1 ? "retried" : "done",
      model: modelLabel(details.model.model, details.model.connectionName ?? details.model.provider),
      inputs: [
        row("Chat", chat(details.messages), { value: `${details.messages.length} messages` }),
        fact("Connection", modelLabel(details.model.model, details.model.connectionName ?? details.model.provider)),
        fact("Temperature", details.model.temperature?.toString() ?? null, "Higher means more varied wording."),
        fact("Max tokens", details.model.maxTokens?.toString() ?? null),
      ],
      outputs: [
        row("Title", details.modelOutput.title),
        row("Caption", details.modelOutput.content, { note: "Published as the post text." }),
        row("Scene", json(scene), { value: clip(sceneShort), note: "The image brief is built from this." }),
        row("Model image prompt", details.modelOutput.imagePrompt, {
          note: details.askedModelForImagePrompt
            ? "Used as the image brief."
            : "Not used; Slurp briefs the picture itself.",
        }),
        fact(
          "Wardrobe",
          details.wardrobeSelection?.selectedId ?? null,
          details.wardrobeSelection?.fallback
            ? "The requested look was missing, so a fallback look was used."
            : "The look worn in the picture.",
        ),
        row("Raw answer", details.rawResponse, {
          value: chars(details.rawResponse),
          note: "Exactly what the model returned.",
        }),
      ],
      what:
        details.attempts > 1
          ? "The text model answered with JSON. The first answer was not valid JSON, so Slurp asked once more."
          : "The text model answers with JSON: a title, a caption, and a scene plan (setting, action, expression, outfit).",
      why: "Structured output lets Slurp use each part for a different job.",
      details: [],
      column: 3,
    },
    {
      id: "brief",
      kind: "step",
      lane: "image",
      title: "Brief the picture",
      status: details.imageBrief ? "done" : "skipped",
      model: null,
      inputs: [
        row("Scene", json(scene), { value: clip(sceneShort) }),
        fact("Camera", details.camera),
        row("Model image prompt", details.askedModelForImagePrompt ? details.modelOutput.imagePrompt : null),
      ],
      outputs: [
        row("Image brief", details.imageBrief, { note: "The draft that the image template receives." }),
        row("Visual contract", json(details.visualBrief), {
          value: details.visualBrief
            ? [details.visualBrief.subject, details.visualBrief.setting].filter(Boolean).join(" · ")
            : null,
          note: "Subject, setting, clothes, camera, and content level. A rewrite that breaks it is discarded.",
        }),
        fact("Content level", details.visualBrief?.sexualLevel ?? null, "The most the picture may show."),
      ],
      what: details.askedModelForImagePrompt
        ? "The model's own image prompt becomes the brief."
        : "Slurp turns the scene plan into a short picture brief and a typed visual contract.",
      why: "The contract fixes what the picture must show, so later steps cannot drift from the post.",
      details: [],
      column: 4,
    },
  ];
}

const REWRITE_OUTCOME: Record<SlpDeepDetailsImageRun["rewrite"]["status"], string> = {
  skipped: "Not run",
  accepted: "Used, then styled again",
  rejected: "Discarded",
  failed: "No answer",
};

const REWRITE_STATUS: Record<SlpDeepDetailsImageRun["rewrite"]["status"], SlpStepStatus> = {
  skipped: "skipped",
  accepted: "done",
  rejected: "rejected",
  failed: "failed",
};

const APPEARANCE_SOURCE: Record<SlpDeepDetailsImageRun["appearance"]["source"], [string, string]> = {
  stage: ["Creator stage appearance", "Written on the Creator profile."],
  "source-card": ["Linked card appearance", "Taken from the linked character card; clothes are removed."],
  reference: ["Reference appearance block", "Built from the linked card for the reference images."],
  none: ["None", "The picture has no written look, so the image model invents one."],
};

function imageNodes(run: SlpDeepDetailsImageRun, brief: string | null, start: number): SlpFlowNode[] {
  const style = run.styleProfile;
  const lastAttempt = run.attempts.at(-1);
  const failures = run.attempts.filter((attempt) => !attempt.ok).length;
  const servedBy = run.attempts.find((attempt) => attempt.servedBy)?.servedBy;
  const effective = run.attempts.find((attempt) => attempt.effectivePrompt)?.effectivePrompt;
  const lastError = [...run.attempts].reverse().find((attempt) => attempt.error)?.error ?? null;
  const [appearanceLabel, appearanceNote] = APPEARANCE_SOURCE[run.appearance.source];
  const styleText = [style.styleText, style.positiveTags].filter(Boolean).join("\n");
  const chosen = run.rewrite.status === "accepted" ? run.rewrite.output : run.styledPrompt;
  return [
    {
      id: "appearance",
      kind: "input",
      lane: "image",
      title: "Appearance",
      status: run.appearance.source === "none" ? "skipped" : "done",
      model: null,
      inputs: [],
      outputs: [
        fact("Source", appearanceLabel, appearanceNote),
        row("Look", run.appearance.text, { note: "Put first in the prompt, word for word." }),
        fact(
          "Reference images",
          run.settings.avatarReferences ? String(run.referenceImages) : "off",
          "Avatar pictures sent to the provider when it supports them.",
        ),
      ],
      what: "The written look of the Creator: body, face, and hair.",
      why: "It keeps the Creator recognisable. The scene decides the clothes.",
      details: [],
      column: start,
    },
    {
      id: "template",
      kind: "step",
      lane: "image",
      title: "Fill the image template",
      status: run.templatePrompt ? "done" : "missing",
      model: null,
      inputs: [
        row("Image brief", brief, { note: "Becomes the scene part of the prompt." }),
        fact("Template", "Image post template", "Decides the order and wording around the brief."),
        fact("Image instructions", "Slurp and connection image instructions", "Added to the template."),
        row("Look", run.appearance.text, { note: "Leads the prompt." }),
      ],
      outputs: [row("Template prompt", run.templatePrompt, { value: chars(run.templatePrompt) })],
      what: "Slurp renders the image template: the look first, then the brief, then your image instructions. Personality is left out.",
      why: "Image models weigh the start of a prompt most, so the right person comes first. Personality words cannot be drawn.",
      details: [],
      column: start,
    },
    {
      id: "style-profile",
      kind: "input",
      lane: "image",
      title: "Style profile",
      status: style.name ? "done" : "missing",
      model: null,
      inputs: [],
      outputs: [
        fact(
          "Profile",
          style.name || null,
          { creator: "Chosen on the Creator.", slurp: "Chosen in Slurp settings.", none: "The default profile." }[
            style.chosenBy
          ],
        ),
        row("Style text", style.styleText, { note: "Added to the prompt and given to the rewrite as guidance." }),
        row("Tags", style.positiveTags, { note: "Added to the prompt." }),
        row("Negative tags", style.negativeTags, { note: "Added to the negative prompt." }),
      ],
      what: "The art direction saved in the image settings.",
      why: "The style belongs to your settings, not to a model, so Slurp applies it again after any rewrite.",
      details: [],
      column: start + 1,
    },
    {
      id: "style",
      kind: "step",
      lane: "image",
      title: "Apply the style",
      status: run.styledPrompt ? "done" : "missing",
      model: null,
      inputs: [
        row("Template prompt", run.templatePrompt, { value: chars(run.templatePrompt) }),
        row("Style", styleText, { value: style.name || null }),
      ],
      outputs: [
        row("Styled prompt", run.styledPrompt, {
          value: chars(run.styledPrompt),
          note: "Sent instead when the rewrite is not used.",
        }),
      ],
      what: "The compiler adds the profile's style text and tags. Words the prompt already has are not added twice.",
      why: "Every picture of this Creator gets the same look.",
      details: [],
      column: start + 1,
    },
    {
      id: "rewrite",
      kind: "model",
      lane: "image",
      title: "Rewrite the prompt",
      status: REWRITE_STATUS[run.rewrite.status],
      model: run.rewrite.model
        ? modelLabel(run.rewrite.model.model, run.rewrite.model.connectionName ?? run.rewrite.model.connectionId)
        : null,
      inputs: [
        row("Draft", run.rewrite.input, { value: chars(run.rewrite.input), note: "The styled brief to rewrite." }),
        fact(
          "Connection",
          run.rewrite.model
            ? modelLabel(run.rewrite.model.model, run.rewrite.model.connectionName ?? run.rewrite.model.connectionId)
            : run.rewrite.status === "skipped"
              ? null
              : "Not recorded",
        ),
        fact("Rewrite rules", run.rewrite.status === "skipped" ? null : "Image interpretation instruction"),
        row("Chat", run.rewrite.messages ? chat(run.rewrite.messages) : null, {
          value: run.rewrite.messages ? `${run.rewrite.messages.length} messages` : null,
          note: "Rules, the caption, the visual contract, the look, your instructions, and the style guidance.",
        }),
      ],
      outputs: [
        fact("Outcome", REWRITE_OUTCOME[run.rewrite.status]),
        fact("Reason", run.rewrite.reason),
        row("Answer", run.rewrite.output, { value: chars(run.rewrite.output) }),
      ],
      what:
        run.rewrite.status === "skipped"
          ? "Skipped: interpretation is off, or a reviewed prompt was used as is."
          : "A text model rewrites everything above into one provider-ready prompt. Slurp discards the answer when it copies private text, breaks the content level, or is empty.",
      why: "Image models follow a short, ordered prompt better than a filled template.",
      details: [],
      column: start + 2,
    },
    {
      id: "final",
      kind: "step",
      lane: "image",
      title: "Assemble the final prompt",
      status: run.finalPrompt ? "done" : "missing",
      model: null,
      inputs: [
        row(run.rewrite.status === "accepted" ? "Rewrite, styled again" : "Styled template", chosen, {
          value: chars(chosen),
          note:
            run.rewrite.status === "accepted"
              ? "The rewrite won."
              : "The rewrite was not used, so the styled template is capped and sent.",
        }),
        row("Look", run.appearance.source === "none" ? null : run.appearance.text, {
          note: "Added again if the text above lost it.",
        }),
      ],
      outputs: [
        row("Final prompt", run.finalPrompt, {
          value: chars(run.finalPrompt),
          note: "Handed to the image connection.",
        }),
        row("Negative prompt", run.negativePrompt, { note: "Style negatives and content-level negatives, merged." }),
        fact("Size", run.size.width && run.size.height ? `${run.size.width} × ${run.size.height}` : null),
      ],
      what: "Slurp takes the winning text, makes sure the look is in it, and merges the negative prompts.",
      why: "One exact prompt, which you can compare with the picture.",
      details: [],
      column: start + 3,
    },
    {
      id: "provider",
      kind: "model",
      lane: "image",
      title: "Draw the picture",
      status:
        run.attempts.length === 0
          ? run.result.status === "preview"
            ? "skipped"
            : "missing"
          : lastAttempt?.ok
            ? failures > 0 || servedBy
              ? "retried"
              : "done"
            : "failed",
      model: modelLabel(run.connection.model, run.connection.name ?? run.connection.id),
      inputs: [
        fact("Connection", modelLabel(run.connection.model, run.connection.name ?? run.connection.id)),
        row("Final prompt", run.finalPrompt, { value: chars(run.finalPrompt) }),
        row("Negative prompt", run.negativePrompt),
        fact("Reference images", String(run.referenceImages)),
        fact(
          "Fallback connection",
          run.connection.fallback
            ? modelLabel(run.connection.fallback.model, run.connection.fallback.name)
            : run.connection.hasFallback
              ? "configured"
              : "none",
          "Used by the Engine when this connection fails.",
        ),
      ],
      outputs: [
        fact("Attempts", run.attempts.length ? `${run.attempts.length} (${failures} failed)` : null),
        fact(
          "Served by fallback",
          servedBy ? modelLabel(servedBy.model, servedBy.name) : null,
          "The primary connection failed.",
        ),
        row("Prompt the provider received", effective, {
          value: chars(effective),
          note: "The Engine changed the prompt for this provider.",
        }),
        row("Last error", lastError),
      ],
      what: "Slurp sends the prompt, the negative prompt, the size, and any reference images to the image connection. A login error stops at once; other errors are retried.",
      why: "The image connection draws the picture. The fallback keeps a post from losing its picture to one outage.",
      details: run.attempts.map((attempt) => ({
        label: `Attempt ${attempt.attempt} · ${attempt.ok ? "succeeded" : "failed"} · ${(attempt.durationMs / 1000).toFixed(1)} s`,
        text: [
          `Started ${attempt.startedAt}`,
          `Route: ${attempt.route === "host" ? "Engine image service" : "bundled image service"}`,
          attempt.servedBy ? `Served by fallback: ${modelLabel(attempt.servedBy.model, attempt.servedBy.name)}` : "",
          attempt.error ? `Error: ${attempt.error}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      })),
      column: start + 4,
    },
    {
      id: "result",
      kind: "step",
      lane: "image",
      title: "Save the picture",
      status: run.result.status === "failed" ? "failed" : run.result.status === "preview" ? "skipped" : "done",
      model: null,
      inputs: [],
      outputs: [
        fact(
          "Outcome",
          run.result.status === "saved"
            ? "Picture saved"
            : run.result.status === "preview"
              ? "Prompt waits for your review"
              : "No picture",
        ),
        fact("File", run.result.mediaPath, "Private Creator media, served only through the post."),
        row("Error", run.result.error),
      ],
      what: "The picture is stored in the Creator's private media folder and linked to the post.",
      why: "Locked posts must never leak through the public gallery.",
      details: [],
      column: start + 5,
    },
  ];
}

const str = (value: unknown) => (typeof value === "string" && value ? value : null);

const REUSE_KIND: Record<string, string> = {
  existing_media: "An earlier picture, posted again.",
  cropped_preview: "A cropped preview of an earlier picture, as a teaser.",
  story: "An earlier picture, shown as a story.",
};

/**
 * The picture half of a post that has no recorded image run: a reused picture, a text-only post,
 * or a post drawn before runs were recorded. It shows what the post did keep and says plainly what
 * was never saved, instead of leaving the picture half of the chart empty.
 */
function pictureWithoutRun(data: SlpDeepDetailsResponse, details: SlpDeepDetailsRecord, start: number): SlpFlowNode[] {
  const metadata = data.post.metadata;
  const reusedFrom = details.plan.reusedFromPostId ?? str(metadata.reusedFromPostId);
  const delivery = details.plan.delivery ?? "";
  const stored = row("Stored image prompt", data.post.imagePrompt, {
    note: "Saved on the post. A redraw starts from it.",
  });
  const hasPicture = Boolean(data.post.imageUrl);
  const failed = metadata.imageGenerationFailed === true;
  const result: SlpFlowNode = {
    id: "result",
    kind: "step",
    lane: "image",
    title: "Save the picture",
    status: hasPicture ? "done" : failed ? "failed" : "skipped",
    model: null,
    inputs: [],
    outputs: [
      fact("Outcome", hasPicture ? "The post has a picture" : failed ? "No picture" : "No picture was planned"),
      fact("File", str(metadata.noodlerMediaPath), "Private Creator media, served only through the post."),
      row("Error", str(metadata.imageGenerationError)),
      fact(
        "Retries so far",
        typeof metadata.imageRetryAttempts === "number" ? String(metadata.imageRetryAttempts) : null,
      ),
    ],
    what: "The picture is stored in the Creator's private media folder and linked to the post.",
    why: "Locked posts must never leak through the public gallery.",
    details: [],
    column: start + 2,
  };
  if (delivery === "text_only" && !hasPicture) {
    return [
      {
        ...result,
        id: "no-picture",
        title: "No picture",
        status: "skipped",
        outputs: [fact("Delivery", "text_only", "The plan chose a text-only post.")],
        what: "Nothing is drawn for a text-only post.",
        why: "The Creator strategy's text-only rate makes some posts words only.",
        column: start,
      },
    ];
  }
  if (reusedFrom) {
    return [
      {
        id: "reuse",
        kind: "step",
        lane: "image",
        title: "Reuse an earlier picture",
        status: "done",
        model: null,
        inputs: [fact("Source post", reusedFrom, "The post the picture comes from.")],
        outputs: [fact("Delivery", delivery || null, REUSE_KIND[delivery] ?? "An earlier picture."), stored],
        what: "Slurp takes a picture the Creator already posted. No image model runs, so no image prompt was written for this post.",
        why: "Real creators repost and tease pictures they already have. It also saves a generation. Open the source post to see how its picture was made.",
        details: [],
        column: start,
      },
      { ...result, column: start + 1 },
    ];
  }
  const provider = str(metadata.imageProvider);
  const model = str(metadata.imageModel);
  return [
    {
      id: "final",
      kind: "step",
      lane: "image",
      title: "Final prompt",
      status: details.providerPrompt ? "done" : "missing",
      model: null,
      inputs: [
        fact(
          "Appearance, template, style, rewrite",
          "Not recorded",
          "This post was made before Slurp recorded each image step.",
        ),
      ],
      outputs: [
        row("Final prompt", details.providerPrompt, {
          value: chars(details.providerPrompt),
          note: "The exact prompt sent to the image connection.",
        }),
        stored,
      ],
      what: "Only the final prompt and the stored draft were saved for this post. Posts made after this update record every image step.",
      why: "Even without the steps, the final prompt shows what the image model was asked to draw.",
      details: [],
      column: start,
    },
    {
      id: "provider",
      kind: "model",
      lane: "image",
      title: "Draw the picture",
      status: hasPicture ? "done" : failed ? "failed" : "missing",
      model: modelLabel(model, provider),
      inputs: [row("Final prompt", details.providerPrompt, { value: chars(details.providerPrompt) })],
      outputs: [
        fact("Style profile", str(metadata.imageStyleProfileId)),
        fact("Attempts", "Not recorded"),
        row("Error", str(metadata.imageGenerationError)),
      ],
      what: "The image connection drew the picture from the final prompt.",
      why: "Provider, model, and style are what the post saved when it was drawn.",
      details: [],
      column: start + 1,
    },
    result,
  ];
}

/** Builds the graph for one post and one of its image runs. Returns null when nothing was recorded. */
export function buildSlpDeepDetailsFlow(
  data: SlpDeepDetailsResponse,
  run: SlpDeepDetailsImageRun | null,
): SlpFlowGraph | null {
  const details = data.details;
  if (!details) return null;
  const nodes = [
    ...postNodes(data, details),
    ...(run ? imageNodes(run, details.imageBrief, 5) : pictureWithoutRun(data, details, 5)),
  ];
  const main = nodes.filter((node) => node.kind === "step" || node.kind === "model");
  const edges: SlpFlowEdge[] = main.slice(1).map((node, index) => ({
    from: main[index]!.id,
    to: node.id,
    label: null,
  }));
  const feeds: [string, string, string][] = [
    ["strategy", "plan", "weights"],
    ["request", "plan", "why now"],
    ["appearance", "template", "look"],
    ["style-profile", "style", "style"],
    ["appearance", "rewrite", "character context"],
    ["style-profile", "rewrite", "style guidance"],
  ];
  for (const [from, to, label] of feeds) {
    if (nodes.some((node) => node.id === from) && nodes.some((node) => node.id === to)) {
      edges.push({ from, to, label });
    }
  }
  const mapped = mapOrigins(nodes, originTable(details, run));
  return { nodes: [...mapped.sources, ...nodes], edges: [...edges, ...mapped.edges] };
}
