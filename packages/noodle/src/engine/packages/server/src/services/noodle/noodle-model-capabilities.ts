type NoodleVisionConnection = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type NoodleModelCatalogRequest = (url: string | URL, init?: RequestInit) => Promise<Response>;

type NoodleVisionPrompt<T> = {
  messages: T;
  textOnlyMessages: T;
  promptForLog: string;
  textOnlyPromptForLog: string;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readNoodleVisionSupport(catalog: unknown, modelId: string): boolean | null {
  const data = readRecord(catalog)?.data;
  if (!Array.isArray(data)) return null;
  const model = data.map(readRecord).find((entry) => entry?.id === modelId);
  const vision = readRecord(model?.capabilities)?.vision;
  return typeof vision === "boolean" ? vision : null;
}

export function selectNoodleVisionRequest<T>(prompt: NoodleVisionPrompt<T>, visionSupport: boolean | null) {
  return visionSupport === false
    ? {
        messages: prompt.textOnlyMessages,
        promptForLog: prompt.textOnlyPromptForLog,
        attemptKind: "text_only_fallback" as const,
      }
    : {
        messages: prompt.messages,
        promptForLog: prompt.promptForLog,
        attemptKind: "initial" as const,
      };
}

export function canRetryNoodleVisionRequest(attemptKind: string, visionAttachmentCount: number): boolean {
  return attemptKind === "initial" && visionAttachmentCount > 0;
}

export async function resolveNoodleVisionSupport(
  connection: NoodleVisionConnection,
  request: NoodleModelCatalogRequest,
): Promise<boolean | null> {
  if (connection.provider !== "nanogpt" || !connection.baseUrl || !connection.model) return null;

  const url = new URL(`${connection.baseUrl.replace(/\/+$/u, "")}/models`);
  if (url.protocol !== "https:") return null;
  url.searchParams.set("detailed", "true");
  const response = await request(url, {
    headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  return readNoodleVisionSupport(await response.json(), connection.model);
}
