import { sanitizeForPrompt } from "./turn-context";

export type PhoneShareMode = "show" | "reference";

export interface PhoneSharePresentation {
  role: "user" | "narrator";
  content: string;
}

export function normalizeVisibleProjection(value: unknown, fallbackSummary: string) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const summary = sanitizeForPrompt(typeof input.summary === "string" ? input.summary : fallbackSummary, 180) || "the phone screen";
  const lines = Array.isArray(input.lines)
    ? input.lines.filter((line): line is string => typeof line === "string")
      .map((line) => sanitizeForPrompt(line, 180)).filter(Boolean).slice(0, 40)
    : [];
  return { summary, detail: lines.join("\n").slice(0, 900) };
}

/** A phone session is always an action by the user operating the UI, never by its owner by proxy. */
export function presentPhoneSession(ownerName: string, activities: string[]): PhoneSharePresentation {
  const owner = sanitizeForPrompt(ownerName, 40) || "someone";
  const summary = activities
    .map((activity) => sanitizeForPrompt(activity, 140))
    .filter(Boolean)
    .slice(0, 12)
    .join("; ")
    .slice(0, 700);
  return {
    role: "user",
    content: `*uses ${owner}'s phone${summary ? `: ${summary}` : ""}*`,
  };
}

/** External state changes belong to narration, not to the user merely because they used the UI. */
export function presentPhoneConsequence(source: string, detail: string): PhoneSharePresentation {
  const safeSource = sanitizeForPrompt(source, 40) || "Phone update";
  const safeDetail = sanitizeForPrompt(detail, 240) || "The phone state changed.";
  return { role: "narrator", content: `[${safeSource}: ${safeDetail}]` };
}

export function presentPhoneAccess(ownerName: string): PhoneSharePresentation {
  const owner = sanitizeForPrompt(ownerName, 40) || "someone";
  return { role: "user", content: `*picks up ${owner}'s phone and starts going through it*` };
}

/** Keeps user action and authorial context distinct when a phone view enters the transcript. */
export function presentPhoneShare(input: {
  mode: PhoneShareMode;
  ownerName: string;
  summary: string;
  detail?: string;
  shownAt?: string;
  audienceNames?: string[];
}): PhoneSharePresentation {
  const owner = sanitizeForPrompt(input.ownerName, 40) || "someone";
  const summary = sanitizeForPrompt(input.summary, 180) || "the phone screen";
  const detail = (input.detail ?? "")
    .split(/\r?\n/u)
    .map((line) => sanitizeForPrompt(line, 180))
    .filter(Boolean)
    .join("\n")
    .slice(0, 900);
  const stamp = input.shownAt ? `, ${sanitizeForPrompt(input.shownAt, 20)}` : "";
  const screen = detail ? `\n\nOn screen:\n${detail}` : "";
  if (input.mode === "reference") {
    return {
      role: "narrator",
      content: `[Author reference — ${owner}'s phone${stamp}: ${summary}. This is context, not an action, and no character automatically perceives it.]${screen}`,
    };
  }
  const audience = input.audienceNames?.map((name) => sanitizeForPrompt(name, 40)).filter(Boolean) ?? [];
  const recipient = audience.length === 1 ? ` to ${audience[0]}` : audience.length > 1 ? ` to ${audience.join(", ")}` : " to everyone nearby";
  return {
    role: "user",
    content: `*shows the screen of ${owner}'s phone${recipient}${stamp} — ${summary}*${screen}`,
  };
}
