import { resolveBaseUrl } from "../../../services/generation/connection-base-url.js";
import { createLLMProvider } from "../../../services/llm/provider-registry.js";
import type { createConnectionsStorage } from "../../../services/storage/connections.storage.js";
import { composeSlurpPromptBlocks, type SlurpPromptBlockOverrides } from "../../base/prompting/slp-prompt-blocks.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

type ScheduleBlock = { time: string; activity: string; status: "online" | "idle" | "dnd" | "offline" };
type GeneratedSchedule = {
  days: Record<string, ScheduleBlock[]>;
  talkativeness: number;
  inactivityThresholdMinutes: number;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const STATUSES = new Set<ScheduleBlock["status"]>(["online", "idle", "dnd", "offline"]);

const DAY_KEYS = new Map(
  DAYS.flatMap((day) => [[day.toLowerCase(), day] as const, [day.slice(0, 3).toLowerCase(), day] as const]),
);

function text(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

/**
 * Models write a week in more than one shape: under `days`, under `schedule`, at the top level, or
 * as a list of day objects. Rejecting everything but the first shape made the button fail for a
 * whole week's worth of valid answers, so every shape that carries the same information is read.
 */
function findDays(parsed: Record<string, unknown>): Record<string, unknown> {
  for (const container of [parsed.days, parsed.schedule, parsed.week, parsed.weeklySchedule, parsed]) {
    if (!container || typeof container !== "object") continue;
    if (Array.isArray(container)) {
      const byDay: Record<string, unknown> = {};
      for (const entry of container) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const row = entry as Record<string, unknown>;
        const day = DAY_KEYS.get(text(row, "day", "name", "weekday").toLowerCase());
        if (day) byDay[day] = row.blocks ?? row.schedule ?? row.activities ?? row.times;
      }
      if (Object.keys(byDay).length > 0) return byDay;
      continue;
    }
    const source = container as Record<string, unknown>;
    const byDay: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      const day = DAY_KEYS.get(key.trim().toLowerCase());
      if (day) byDay[day] = value;
    }
    if (Object.keys(byDay).length > 0) return byDay;
  }
  return {};
}

function readBlocks(value: unknown): ScheduleBlock[] {
  if (!Array.isArray(value)) return [];
  const blocks: ScheduleBlock[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const block = entry as Record<string, unknown>;
    const start = text(block, "start", "from", "startTime");
    const end = text(block, "end", "to", "endTime");
    const time = text(block, "time", "range", "hours", "period") || (start && end ? `${start}-${end}` : start);
    const activity = text(block, "activity", "description", "what", "note", "doing", "task");
    if (!time || !activity) continue;
    const raw = text(block, "status", "availability", "presence").toLowerCase();
    blocks.push({
      time,
      activity,
      status: STATUSES.has(raw as ScheduleBlock["status"]) ? (raw as ScheduleBlock["status"]) : "online",
    });
  }
  return blocks;
}

/** The whole answer when it is already JSON, otherwise the object or list embedded in the prose. */
function readJson(content: string): Record<string, unknown> | null {
  const candidates = [content.trim()];
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = content.indexOf(open);
    const end = content.lastIndexOf(close);
    if (start >= 0 && end > start) candidates.push(content.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (value && typeof value === "object") return value as Record<string, unknown>;
    } catch {
      // Try the next candidate: a model answer often wraps its JSON in prose or a code fence.
    }
  }
  return null;
}

export function parseSlurpConversationSchedule(content: string): GeneratedSchedule {
  const parsed = readJson(content);
  if (!parsed) throw new Error("The schedule provider returned no JSON schedule.");
  const rawDays = findDays(parsed);
  const days: Record<string, ScheduleBlock[]> = {};
  for (const day of DAYS) {
    const blocks = readBlocks(rawDays[day]);
    if (blocks.length > 0) days[day] = blocks;
  }
  if (Object.keys(days).length === 0) throw new Error("The generated schedule has no days.");
  // A model that answers with five weekdays has still described this character's week. Repeating
  // the nearest day it did write beats throwing the whole answer away and asking again forever.
  let fallback = days[DAYS.find((day) => days[day])!];
  for (const day of DAYS) {
    if (days[day]) fallback = days[day];
    else days[day] = fallback.map((block) => ({ ...block }));
  }
  return {
    days,
    talkativeness: Math.max(0, Math.min(100, Number(parsed.talkativeness) || 50)),
    inactivityThresholdMinutes: Math.max(15, Math.min(360, Number(parsed.inactivityThresholdMinutes) || 120)),
  };
}

export async function generateSlurpConversationSchedule(
  connection: GenerationConnection,
  character: { name: string; description: string; personality: string },
  /** `simulationTuning.prompts.scheduleExtra`: the player's own additions to the prompt. */
  extra = "",
  promptBlocks?: SlurpPromptBlockOverrides,
): Promise<GeneratedSchedule> {
  // The route hands over the stored connection row; it is not a provider until built here.
  const provider = createLLMProvider(
    connection.provider,
    resolveBaseUrl(connection),
    connection.apiKey,
    connection.maxContext,
    connection.openrouterProvider,
    connection.maxTokensOverride,
    connection.claudeFastMode === "true",
    connection.treatAsLocalEndpoint === "true",
    connection.defaultParameters,
  );
  const messages = [
    {
      role: "system",
      content: composeSlurpPromptBlocks(
        "conversationSchedule",
        [
          {
            id: "task",
            kind: "editable",
            text: "Create a realistic weekly Conversation Schedule for this fictional character.",
          },
          {
            id: "scheduleRules",
            kind: "editable",
            text: [
              "Include all seven days from Monday through Sunday.",
              "Use time ranges such as 00:00-07:00 and cover the full 24 hours each day.",
              'Each block must contain time, activity, and status. Valid status values are "online", "idle", "dnd", and "offline".',
              "Also include talkativeness from 0 to 100 and inactivityThresholdMinutes from 15 to 360.",
              "Return only one JSON object. Do not use markdown or explanatory text.",
            ].join("\n"),
          },
          {
            id: "character",
            kind: "context",
            text: [
              `Character name: ${character.name}`,
              `Description: ${character.description}`,
              `Personality: ${character.personality}`,
              ...(extra.trim() ? [extra.trim()] : []),
            ].join("\n"),
          },
          { id: "output", kind: "required", text: "Return one complete JSON object." },
        ],
        promptBlocks,
      ),
    },
    { role: "user", content: "Generate the current week's schedule." },
  ] as const;
  let validationError: unknown;
  let lastContent = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await provider.chatComplete(
      attempt === 0
        ? [...messages]
        : [
            ...messages,
            {
              role: "user" as const,
              content:
                "The previous response was not a valid seven-day schedule. Return one complete JSON object with a non-empty array for every day Monday through Sunday.",
            },
          ],
      {
        model: connection.model,
        temperature: attempt === 0 ? 0.5 : 0.2,
        maxTokens: Math.min(provider.maxTokensOverrideValue ?? 8192, 8192),
        responseFormat: { type: "json_object" },
      },
    );
    lastContent = result.content ?? "";
    try {
      return parseSlurpConversationSchedule(lastContent);
    } catch (error) {
      validationError = error;
    }
  }
  // The response itself is the only useful evidence when a connection keeps answering wrongly.
  const reason = validationError instanceof Error ? validationError.message : "invalid schedule";
  throw new Error(`${reason} Response: ${lastContent.slice(0, 600) || "(empty)"}`);
}
