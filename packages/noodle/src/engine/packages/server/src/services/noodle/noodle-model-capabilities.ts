type NoodleVisionConnection = {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type NoodleModelCatalogRequest = (url: string | URL, init?: RequestInit) => Promise<Response>;

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

export async function resolveNoodleVisionSupport(
  connection: NoodleVisionConnection,
  request: NoodleModelCatalogRequest,
): Promise<boolean | null> {
  if (connection.provider !== "nanogpt" || !connection.baseUrl || !connection.model) return null;

  const url = new URL(`${connection.baseUrl.replace(/\/+$/u, "")}/models`);
  url.searchParams.set("detailed", "true");
  const response = await request(url, {
    headers: connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  return readNoodleVisionSupport(await response.json(), connection.model);
}
