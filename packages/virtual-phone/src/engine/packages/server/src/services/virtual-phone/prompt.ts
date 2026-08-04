// ──────────────────────────────────────────────
// Virtual Phone — prompt construction
//
// Two shapes: fill the slots of a known template, or generate a whole page for
// an app that has no template. Both return JSON so the route never has to parse
// prose out of a page.
// ──────────────────────────────────────────────
import type { PhoneApp } from "./apps.js";
import type { PhoneChatMessage } from "./package-runtime.js";
import type { PhoneTemplate } from "./templates.js";

export type PhonePageContext = {
  url: string;
  chatSummary?: string;
  characters?: string[];
  persona?: string;
  worldInfo?: string;
  recentMessages?: Array<{ role: string; content: string }>;
  /** What the user just did in the frame, e.g. "Tapped @mira_k". */
  lastAction?: string;
  formData?: Record<string, unknown>;
  /** Observer text from the last visit to this same URL, for continuity. */
  pageHistory?: string;
  navHistory?: Array<{ url: string; title: string }>;
};

const PHONE_RULES = [
  "You are writing a page as it appears on a character's phone inside a story. Never break that frame.",
  "Never state or imply that the page, the app, or the wider internet is simulated or AI-generated.",
  "Write as an author inside the story world, not as an assistant.",
  "The screen is 390px wide in portrait. Single column, large tap targets, no side rails, no multi-column dashboards.",
  "Every link must carry a plausible absolute URL on the app's own domain. Never use href='#'.",
];

function formatMessages(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter((message) => message && typeof message.content === "string")
    .map((message) => `${message.role || "user"}: ${message.content}`)
    .join("\n");
}

function sceneBlock(context: PhonePageContext): string[] {
  const lines: string[] = [];
  if (context.characters?.length) lines.push(`Characters in the scene: ${context.characters.join(", ")}`);
  if (context.persona) lines.push(`The phone belongs to: ${context.persona}`);
  if (context.chatSummary) lines.push(`Scene: ${context.chatSummary}`);
  if (context.worldInfo) lines.push(`World info: ${context.worldInfo}`);
  if (context.recentMessages?.length) lines.push(`Recent chat:\n${formatMessages(context.recentMessages)}`);
  if (context.pageHistory) lines.push(`Previous visit to this page: ${context.pageHistory}. Keep names and facts consistent.`);
  if (context.navHistory?.length) {
    lines.push(`Navigation path: ${context.navHistory.map((entry) => `${entry.title || entry.url}`).join(" → ")}`);
  }
  if (context.lastAction) lines.push(`Exact user action: ${context.lastAction}`);
  if (context.formData && Object.keys(context.formData).length) {
    lines.push(`Submitted form data: ${JSON.stringify(context.formData)}`);
  }
  return lines;
}

const OBSERVER_RULE =
  'observerText must briefly describe what is visible and name the exact link, control, or submitted text the user acted on. Describe the screen, not internal thoughts.';

export function buildSlotFillPrompt(
  app: PhoneApp,
  template: PhoneTemplate,
  context: PhonePageContext,
): PhoneChatMessage[] {
  const system = [
    `Fill the content slots of the ${app.name} app on a character's phone.`,
    `App: ${app.name} (${app.domain}) — URL: ${context.url}`,
    `Slots to fill: ${template.slots.join(", ")}`,
    "",
    template.slotDoc,
    "",
    ...PHONE_RULES,
    "Do not recreate app chrome, headers, or navigation inside a slot. The template owns all stable structure; supply only the documented content.",
    "Populate every requested slot with complete, realistic content, not placeholders.",
    OBSERVER_RULE,
    ...sceneBlock(context),
    "",
    'Return only JSON: {"slots":{"slotName":"<HTML string>"},"title":"...","observerText":"...","observerName":"..."}',
  ];
  return [
    { role: "system", content: system.join("\n") },
    { role: "user", content: `Fill the slots for ${context.url}.` },
  ];
}

export function buildFullPagePrompt(app: PhoneApp, context: PhonePageContext): PhoneChatMessage[] {
  const system = [
    `Generate the ${app.name} app screen at ${context.url} as it appears on a character's phone.`,
    `App purpose: ${app.description}`,
    "Return one complete HTML document with semantic markup and all CSS in a <style> element.",
    "Design it like a real, polished native app screen: a sticky top bar, a bottom tab bar with 3-5 tabs, cards or list rows with real spacing, and a dark theme that suits the app.",
    "It must never look like bare unstyled HTML.",
    ...PHONE_RULES,
    OBSERVER_RULE,
    ...sceneBlock(context),
    "",
    'Return only JSON: {"html":"<full document>","title":"...","observerText":"...","observerName":"..."}',
  ];
  return [
    { role: "system", content: system.join("\n") },
    { role: "user", content: `Render ${context.url} as a polished phone screen.` },
  ];
}

/**
 * Models wrap JSON in prose or fences often enough that a bare JSON.parse is not
 * good enough. Fall back to the outermost brace pair.
 */
export function parseStructuredResponse(content: string | null): Record<string, unknown> | null {
  if (typeof content !== "string") return null;
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Fall through to brace scanning.
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
