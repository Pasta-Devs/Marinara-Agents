import { resolveBaseUrl } from "../generation/connection-base-url.js";
import { createLLMProvider } from "../llm/provider-registry.js";
import type { createConnectionsStorage } from "../storage/connections.storage.js";

type GenerationConnection = NonNullable<Awaited<ReturnType<ReturnType<typeof createConnectionsStorage>["getWithKey"]>>>;

type ScheduleBlock = { time: string; activity: string; status: "online" | "idle" | "dnd" | "offline" };
type GeneratedSchedule = {
  days: Record<string, ScheduleBlock[]>;
  talkativeness: number;
  inactivityThresholdMinutes: number;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const STATUSES = new Set<ScheduleBlock["status"]>(["online", "idle", "dnd", "offline"]);

function parseResponse(content: string): GeneratedSchedule {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The schedule provider returned no JSON schedule.");
  const parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>;
  const rawDays = parsed.days;
  if (!rawDays || typeof rawDays !== "object" || Array.isArray(rawDays))
    throw new Error("The generated schedule has no days.");
  const days: Record<string, ScheduleBlock[]> = {};
  for (const day of DAYS) {
    const blocks = (rawDays as Record<string, unknown>)[day];
    if (!Array.isArray(blocks) || blocks.length === 0)
      throw new Error(`The generated schedule has no blocks for ${day}.`);
    days[day] = blocks.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("The generated schedule has an invalid block.");
      const block = value as Record<string, unknown>;
      const time = typeof block.time === "string" ? block.time.trim() : "";
      const activity = typeof block.activity === "string" ? block.activity.trim() : "";
      const status = STATUSES.has(block.status as ScheduleBlock["status"])
        ? (block.status as ScheduleBlock["status"])
        : "online";
      if (!time || !activity) throw new Error("The generated schedule has an incomplete block.");
      return { time, activity, status };
    });
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
  const result = await provider.chatComplete(
    [
      {
        role: "system",
        content: [
          "Create a realistic weekly Conversation Schedule for this fictional character.",
          "Include all seven days from Monday through Sunday.",
          "Use time ranges such as 00:00-07:00 and cover the full 24 hours each day.",
          'Each block must contain time, activity, and status. Valid status values are "online", "idle", "dnd", and "offline".',
          "Also include talkativeness from 0 to 100 and inactivityThresholdMinutes from 15 to 360.",
          "Return only one JSON object. Do not use markdown or explanatory text.",
          `Character name: ${character.name}`,
          `Description: ${character.description}`,
          `Personality: ${character.personality}`,
        ].join("\n"),
      },
      { role: "user", content: "Generate the current week's schedule." },
    ],
    { model: connection.model, temperature: 0.8, maxTokens: Math.min(provider.maxTokensOverrideValue ?? 8192, 8192) },
  );
  return parseResponse(result.content ?? "");
}
