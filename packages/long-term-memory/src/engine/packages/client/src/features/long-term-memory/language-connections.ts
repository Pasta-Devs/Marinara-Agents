import { requestHost } from "./api";

export type LanguageConnection = {
  id: string;
  name: string;
  provider: string;
  model: string;
  // The host list sends its text columns as-is: "true" / "false".
  defaultForAgents?: boolean | string;
  profileImportReviewRequired?: boolean | string;
};

// "<name> · <model>" (name only without a model), so a native select's option text carries the model.
export function connectionLabel(connection: LanguageConnection) {
  const name = connection.name || connection.provider;
  return connection.model ? `${name} · ${connection.model}` : name;
}

/** The host's connection list, read the same way wherever a connection is named. */
export const languageConnectionsQueryOptions = {
  queryKey: ["long-term-memory", "language-connections"] as const,
  queryFn: () => requestHost<LanguageConnection[]>("/api/connections"),
};
