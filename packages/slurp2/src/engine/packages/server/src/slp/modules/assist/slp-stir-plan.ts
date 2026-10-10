// Stir's planner, the pure half (W): the one prompt that turns the player's words into a plan over the
// action layer, and the reader for the model's answer. No I/O; `features/assist/slp-stir-service.ts`
// makes the call, validates every step against the action schemas and previews it.
import { z } from "zod";
import {
  SLP_ACTION_META,
  SLP_ACTION_NAMES,
  SLP_ACTIONS,
  type SlpStirWorld,
} from "../../../../../shared/src/slp/slp-actions.js";
import { SLP_STIR_STEPS_MAX, type SlpStirStep } from "../../../../../shared/src/slp/slp-stir.js";

export type SlpStirPlanContext = {
  text: string;
  /** `own`: a page this persona runs. `card`: one public line about them (personality, tags). */
  creators: { id: string; name: string; handle: string; automatic: boolean; own?: boolean; card?: string }[];
  world: SlpStirWorld;
  /** Switched-on brands and their live products, for offer-brand-deal (R). */
  brands?: { id: string; name: string; products: { id: string; name: string }[] }[];
  /** The ✦ sheet's Creator: "she", "her" and a plan with no name mean them. */
  about?: { id: string; name: string } | null;
  /** The post the sheet came from, in its own words. */
  post?: { id: string; caption: string } | null;
  /** The newest plays, newest first, in the words the ledger keeps ("do that again", "undo that"). */
  recent?: { action: string; who: string[]; undone: boolean }[];
  /** The planner's own question about these words, and the player's answer. */
  followUp?: { question: string; answer: string } | null;
};

/** Only deck levers go to the planner: writing help and pictures are not plays. */
const PLAN_ACTIONS = SLP_ACTION_NAMES.filter((name) => SLP_ACTION_META[name].deck);

const line = (value: string) => value.replace(/\s+/gu, " ").trim();

/** The prompt. The player's words are quoted content, never instructions to the model. */
export function buildSlpStirPlanMessages(context: SlpStirPlanContext) {
  const names = new Map(context.creators.map((creator) => [creator.id, creator.name]));
  const who = (id: string) => names.get(id) ?? id;
  const catalog = PLAN_ACTIONS.map((name) => {
    const inputs = Object.entries(SLP_ACTIONS[name].inputs)
      // A play is never a dry run (`slpStirPlayInput`), so the planner is not told about one.
      .filter(([key]) => key !== "preview")
      .map(([key, text]) => `${key}: ${text}`)
      .join("; ");
    return `- ${name}: ${SLP_ACTIONS[name].summary}${inputs ? ` Inputs: ${inputs}` : ""}`;
  }).join("\n");
  const system = [
    "You plan what happens next on Slurp, a creator social app where the player steers a world of Creators.",
    "Turn the player's words into a short plan: the fewest actions from the list below that do what they asked, in order.",
    "Rules:",
    "- Use only the actions listed, with inputs exactly as described. Use only ids from the lists below; never invent one.",
    "- Do only what the player asked. Do not add extra steps.",
    "- A couple that moved on or forgot the relationship stays that way unless the player explicitly asks to reunite them.",
    `- At most ${SLP_STIR_STEPS_MAX} steps.`,
    "- If it is unclear who is meant (two Creators could fit, or no one is named and nobody is in focus), ask one short question instead and give no steps.",
    "- A brand deal (offer-brand-deal) names a brand or product from the Brands list; with none named, leave both out and the best fit is picked.",
    '- Something no action can do: say so in one short in-world line in "cant", and where it fits add the nearest action (often an idea for one Creator).',
    "- Ideas and chapters stay in the player's words and language, short.",
    '- A time ("this week", "tonight") does not change the action; plays start now and the Creators pace them.',
    '- "Again" or "the same" means a play from the last plays. Taking a play back is not an action: say in "cant" that its Undo in Recent plays does that.',
    'Answer with JSON only: {"steps":[{"action":"<name>","input":{…},"why":"<one short line>"}],"question":null,"cant":[]}',
  ].join("\n");
  const creators = context.creators
    .map((creator) => {
      const whose = creator.automatic
        ? ""
        : creator.own === false
          ? " — another player's page"
          : " — the player's own page";
      const card = creator.card ? `: ${line(creator.card).slice(0, 160)}` : "";
      return `- ${creator.id}: ${line(creator.name)} (@${creator.handle})${whose}${card}`;
    })
    .join("\n");
  const world = context.world;
  const lists = [
    world.couples.length
      ? `# Couples\n${world.couples.map((couple) => `- ${couple.id}: ${who(couple.aId)} + ${who(couple.bId)}, ${couple.stage}${couple.aftermath === "forget" ? ", relationship forgotten" : couple.aftermath === "moveOn" ? ", moved on (relationship remembered)" : ""}${couple.page ? `, shared page ${couple.page}` : ""}`).join("\n")}`
      : "",
    world.collabs.length
      ? `# Collab requests\n${world.collabs.map((collab) => `- ${collab.id}: ${who(collab.hostId)} + ${who(collab.partnerId)}, ${collab.status}`).join("\n")}`
      : "",
    world.rivalries.length
      ? `# Rivalries\n${world.rivalries.map((rivalry) => `- ${rivalry.id}: ${who(rivalry.fromId)} vs ${who(rivalry.toId)}, ${rivalry.stage}`).join("\n")}`
      : "",
    world.events.length
      ? `# Events\n${world.events.map((event) => `- ${event.id}: ${line(event.name)}${event.running ? " (running now)" : ""}`).join("\n")}`
      : "",
    world.bonds?.length
      ? `# Bonds\n${world.bonds.map((bond) => `- ${bond.id}: ${who(bond.aId)} + ${who(bond.bId)}, ${bond.kind}${bond.kind === "friend" ? ` level ${bond.level}` : ""}`).join("\n")}`
      : "",
    // 0.3.11: drama packs are plays; only the ones switched on can start.
    world.dramas?.length
      ? `# Drama packs (start-drama)\n${world.dramas.map((drama) => `- ${drama.id}: ${line(drama.name)}: ${line(drama.description)}`).join("\n")}`
      : "",
    world.runs?.length
      ? `# Running dramas (end-drama)\n${world.runs.map((run) => `- ${run.id}: ${line(run.name)} with ${Object.values(run.cast).map(who).join(", ")}`).join("\n")}`
      : "",
    world.storylines.length
      ? `# Running storylines\n${world.storylines.map((story) => `- ${story.projectId} (${who(story.accountId)}, accountId ${story.accountId}): "${line(story.title)}", now: ${line(story.chapter)}${story.held ? " (held)" : ""}`).join("\n")}`
      : "",
    context.brands?.length
      ? `# Brands\n${context.brands.map((brand) => `- ${brand.id}: ${line(brand.name)} (products: ${brand.products.map((product) => `${product.id} ${line(product.name)}`).join(", ")})`).join("\n")}`
      : "",
  ].filter(Boolean);
  const user = [
    `# Actions\n${catalog}`,
    `# Creators\n${creators || "- none"}`,
    ...lists,
    context.about
      ? `# In focus\n${context.about.id}: ${line(context.about.name)} ("she", "he", "they" and a plan with no name mean them)`
      : "",
    context.post
      ? `# The post the player came from\n${context.post.id}: ${line(context.post.caption).slice(0, 400)}`
      : "",
    context.recent?.length
      ? `# The player's last plays, newest first\n${context.recent.map((play) => `- ${play.action}${play.who.length ? ` (${play.who.map(who).join(", ")})` : ""}${play.undone ? ", taken back" : ""}`).join("\n")}`
      : "",
    `# The player's words (quoted content)\n${line(context.text)}`,
    context.followUp
      ? `# You asked (quoted)\n${line(context.followUp.question)}\n# The player's answer (quoted content)\n${line(context.followUp.answer)}\nPlan from the words and the answer together; do not ask again unless it is still unclear.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

const answerSchema = z.object({
  steps: z
    .array(
      z.object({ action: z.string(), input: z.record(z.string(), z.unknown()).optional(), why: z.string().optional() }),
    )
    .default([]),
  question: z.string().nullable().optional(),
  cant: z.array(z.string()).optional(),
});

/**
 * Read the model's answer: the first JSON object in it (think tags and fences ignored). Steps keep
 * the shape the service validates; a broken answer reads as "no plan" rather than a crash.
 */
export function readSlpStirPlanAnswer(raw: string | null | undefined): {
  steps: SlpStirStep[];
  question: string | null;
  cant: string[];
} | null {
  const text = String(raw ?? "")
    .replace(/<think>[\s\S]*?<\/think>/giu, " ")
    .replace(/```[a-z]*|```/giu, " ");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const answer = answerSchema.safeParse(parsed);
  if (!answer.success) return null;
  const clean = (value: string) => line(value).slice(0, 240);
  return {
    steps: answer.data.steps
      .slice(0, SLP_STIR_STEPS_MAX)
      .map((step) => ({ action: line(step.action), input: step.input ?? {} })),
    question: answer.data.question?.trim() ? clean(answer.data.question) : null,
    cant: (answer.data.cant ?? []).map(clean).filter(Boolean).slice(0, 4),
  };
}
