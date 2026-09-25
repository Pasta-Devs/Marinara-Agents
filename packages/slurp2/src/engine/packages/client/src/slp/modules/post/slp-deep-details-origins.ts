import type { SlpDeepDetailsImageRun, SlpDeepDetailsRecord } from "../../../../../shared/src/slp/slp-deep-details.js";
import type { SlpFlowEdge, SlpFlowNode } from "./slp-deep-details-flow";

/**
 * The data map behind Deep details: every place a post's data is kept, and which value on the
 * chart came from where.
 */
type SourceId = "creator" | "card" | "memory" | "slurp" | "prompts" | "engine";

/** Every place a post's data is kept, and where to change it. */
const SOURCES: Record<SourceId, { title: string; where: string; what: string }> = {
  creator: {
    title: "Creator profile",
    where: "Backstage › Creators › this Creator",
    what: "The Creator's own settings: posting strategy, appearance, access, image style, and image connection.",
  },
  card: {
    title: "Linked character card",
    where: "The character or persona card in Marinara",
    what: "The source character behind the Creator: personality, description, appearance, and avatar.",
  },
  memory: {
    title: "Memory and schedule",
    where: "Backstage › Stories & events, Backstage › Posting › Automation, and the Creator's history",
    what: "What already happened and what is due: continuity notes, storylines, subscriber requests, earlier posts, and the schedule.",
  },
  slurp: {
    title: "Slurp settings",
    where: "Backstage › Posting › Images and Connections",
    what: "Slurp-wide defaults: text and image connections, image style, image size, and appearance options.",
  },
  prompts: {
    title: "Prompt Studio",
    where: "Backstage › Prompts › Prompt Studio",
    what: "The templates and instructions Slurp sends to the models.",
  },
  engine: {
    title: "Engine settings",
    where: "Marinara Settings › Connections and Settings › Generation",
    what: "The connections themselves (model, parameters, image instructions, fallback) and the style profile library.",
  },
};

type Origin = { sources: SourceId[]; field: string; where?: string };

const from = (sources: SourceId | SourceId[], field: string, where?: string): Origin => ({
  sources: Array.isArray(sources) ? sources : [sources],
  field,
  where,
});
/** A value produced by an earlier step of this same generation. */
const step = (title: string, output: string): Origin => ({ sources: [], field: `${title} › ${output}` });

/**
 * Where every value on the map comes from, keyed by `node:row label`. This one table is the map:
 * the "From" line on each row and every source arrow are drawn from it, so they cannot drift apart.
 */
export function originTable(details: SlpDeepDetailsRecord, run: SlpDeepDetailsImageRun | null): Record<string, Origin> {
  const creator = SOURCES.creator.where;
  const appearance: Origin = !run
    ? from("creator", "Appearance")
    : run.appearance.source === "stage"
      ? from("creator", "Appearance", `${creator} › Profile`)
      : run.appearance.source === "none"
        ? from("slurp", "Include descriptions (off, or nothing written)", "Backstage › Posting › Images")
        : from(
            ["card", "slurp"],
            "Appearance, used because the Creator has none",
            "the card's Appearance field; mode in Slurp › Images",
          );
  const chosenBy = run?.styleProfile.chosenBy;
  const styleChoice: Origin =
    chosenBy === "creator"
      ? from("creator", "Image style", `${creator} › Images`)
      : chosenBy === "slurp"
        ? from("slurp", "Image style", "Backstage › Posting › Images")
        : from("engine", "Connection or Engine default style");
  const connectionBy = run?.connection.chosenBy;
  const imageConnection: Origin =
    connectionBy === "creator"
      ? from("creator", "Image connection", `${creator} › Images`)
      : connectionBy === "slurp"
        ? from("slurp", "Image generation connection", "Backstage › Posting › Connections")
        : connectionBy === "engine"
          ? from("engine", "Default image connection", "Marinara Settings › Connections")
          : from(["creator", "slurp", "engine"], "Image connection: Creator, then Slurp, then Engine default");
  const chosenText =
    run?.rewrite.status === "accepted"
      ? step("Rewrite the prompt", "Answer")
      : step("Apply the style", "Styled prompt");
  return {
    "strategy:Production style": from("creator", "Posting strategy › Production style", creator),
    "strategy:Intent weights": from("creator", "Posting strategy › Intent weights", creator),
    "strategy:Skipped posts": from("creator", "Posting strategy › Skipped posts", creator),
    "strategy:Posts without pictures": from("creator", "Posting strategy › Text-only rate", creator),
    "request:Workflow": from("memory", "Schedule or run-now request"),
    "request:Due": from("memory", "Schedule slot"),
    "request:Player direction": from("memory", "Your direction for this post (Guide)"),
    "request:Subscribers asked for": from("memory", "Subscriber requests"),
    "request:Campaign": from("memory", "Campaigns"),
    "request:Project": from("memory", "Storylines", "Backstage › Stories & events › Storylines"),
    "plan:Post number": from("memory", "The Creator's post count"),
    "plan:Intent weights": step("Creator strategy", "Intent weights"),
    "plan:Access setting": from("creator", "Automatic post access", creator),
    "angle:Intent": step("Plan the post", "Intent"),
    "writing-prompt:Plan and angle": step("Plan the post and Pick the angle", "all outputs"),
    "writing-prompt:Creator card and memory": from(
      ["card", "memory"],
      "Personality, description, and continuity notes",
    ),
    "writing-prompt:Prompt template": from("prompts", "Post writing prompt blocks"),
    "write:Chat": step("Build the writing prompt", "Chat"),
    "write:Connection": from(
      ["slurp", "engine"],
      "Text generation connection",
      "Slurp › Connections picks it; its model is set in Marinara Settings › Connections",
    ),
    "write:Temperature": from("engine", "Connection parameters (Slurp default 0.9)"),
    "write:Max tokens": from(["engine", "slurp"], "Connection limit, raised to fit the post length setting"),
    "brief:Scene": step("Write the post", "Scene"),
    "brief:Camera": step("Pick the angle", "Camera"),
    "brief:Model image prompt": step("Write the post", "Model image prompt"),
    "appearance:Source": appearance,
    "appearance:Look": appearance,
    "appearance:Reference images": from(
      ["card", "slurp", "engine"],
      "Card avatar; Avatar references setting; the connection must support references",
    ),
    "template:Image brief": step("Brief the picture", "Image brief"),
    "template:Look": step("Appearance", "Look"),
    "template:Template": from("prompts", "Image post template"),
    "template:Image instructions": from(
      ["prompts", "engine"],
      "Image instructions, plus the connection's image prompt instructions",
    ),
    "style-profile:Profile": styleChoice,
    "style-profile:Style text": from("engine", "Style profiles", "Marinara Settings › Generation"),
    "style-profile:Tags": from("engine", "Style profiles", "Marinara Settings › Generation"),
    "style-profile:Negative tags": from("engine", "Style profiles", "Marinara Settings › Generation"),
    "style:Template prompt": step("Fill the image template", "Template prompt"),
    "style:Style": step("Style profile", "Style text and tags"),
    "rewrite:Draft": step("Apply the style", "Styled draft"),
    "rewrite:Connection": from(["slurp", "engine"], "Text generation connection", "Slurp › Connections"),
    "rewrite:Rewrite rules": from(["prompts", "slurp"], "Image interpretation instruction; interpretation on or off"),
    "rewrite:Chat": step("Earlier steps", "caption, visual contract, look, image instructions, and style guidance"),
    "final:Rewrite, styled again": chosenText,
    "final:Styled template": chosenText,
    "final:Look": step("Appearance", "Look"),
    "final:Size": from("slurp", "Image width and height (Story size for stories)", "Backstage › Posting › Images"),
    "final:Negative prompt": step("Style profile and Brief the picture", "Negative tags and content level"),
    "provider:Connection": imageConnection,
    "provider:Final prompt": step("Assemble the final prompt", "Final prompt"),
    "provider:Negative prompt": step("Assemble the final prompt", "Negative prompt"),
    "provider:Reference images": step("Appearance", "Reference images"),
    "provider:Fallback connection": from(
      "engine",
      "Fallback connection for image generation",
      "Marinara Settings › Connections",
    ),
    "provider:Style profile": from(["creator", "slurp"], "Image style at the time"),
    "reuse:Source post": from("memory", "The Creator's earlier posts"),
    "final:Stored image prompt": step("Brief the picture", "Image brief, saved on the post"),
    "result:File": step("Draw the picture", "Picture"),
  };
}

function originText(origin: Origin) {
  const places = origin.sources.map((source) => SOURCES[source].title).join(" + ");
  const head = places ? `${places} › ${origin.field}` : `Step: ${origin.field}`;
  return origin.where ? `${head} (${origin.where})` : head;
}

/** Stamps every row with its origin and adds the source nodes and their arrows. */
export function mapOrigins(
  nodes: SlpFlowNode[],
  table: Record<string, Origin>,
): { sources: SlpFlowNode[]; edges: SlpFlowEdge[] } {
  const uses = new Map<SourceId, Map<string, Set<string>>>();
  for (const node of nodes) {
    for (const entry of [...node.inputs, ...node.outputs]) {
      const origin = table[`${node.id}:${entry.label}`];
      if (!origin || (!entry.value && !entry.text)) continue;
      entry.from = originText(origin);
      for (const source of origin.sources) {
        const fields = uses.get(source) ?? new Map<string, Set<string>>();
        const users = fields.get(origin.field) ?? new Set<string>();
        users.add(node.id);
        fields.set(origin.field, users);
        uses.set(source, fields);
      }
    }
  }
  const title = new Map(nodes.map((node) => [node.id, node.title]));
  const sources: SlpFlowNode[] = [];
  const edges: SlpFlowEdge[] = [];
  for (const [id, fields] of uses) {
    const source = SOURCES[id];
    sources.push({
      id: `source-${id}`,
      kind: "source",
      lane: "text",
      title: source.title,
      status: "done",
      model: null,
      inputs: [],
      outputs: [...fields].map(([field, users]) => ({
        label: field,
        value: [...users].map((user) => title.get(user)).join(", "),
        note: "Used in these steps.",
      })),
      what: `${source.what} Change it in ${source.where}.`,
      why: "Every value on the map starts in one of these places.",
      details: [],
      column: 0,
    });
    const byNode = new Map<string, string[]>();
    for (const [field, users] of fields) {
      for (const user of users) byNode.set(user, [...(byNode.get(user) ?? []), field]);
    }
    for (const [user, list] of byNode) {
      edges.push({
        from: `source-${id}`,
        to: user,
        label: list.length > 1 ? `${list[0]} +${list.length - 1}` : list[0]!,
      });
    }
  }
  return { sources, edges };
}
