import type { createConnectionsStorage } from "../storage/connections.storage.js";

type ConnectionsStorage = ReturnType<typeof createConnectionsStorage>;
type ResolvedConnection = NonNullable<Awaited<ReturnType<ConnectionsStorage["getWithKey"]>>>;

/** Only a language connection can answer a chat completion. */
function isLanguageConnection(connection: { provider: string }): boolean {
  return connection.provider !== "image_generation" && connection.provider !== "video_generation";
}

/**
 * The one place Slurp decides which language connection a text generation runs on.
 *
 * Order: the caller's explicit choice, then the Engine's "Default for Agents" connection, then
 * the plain default connection. Callers pass their own preference — usually the request's
 * `connectionId` or the Slurp `generationConnectionId` setting — as `preferredId`.
 *
 * The last step is the point. `getDefaultForAgents()` only answers for a connection carrying the
 * agent flag, and Slurp ships `generationConnectionId: null`, so an install with working
 * connections but no agent flag resolved to nothing: posts, comments, creator replies, direct
 * messages, stage-profile drafts, audience activity, and ads all quietly reported "connection not
 * found" while the app looked configured. The Engine's own capability language model resolves the
 * same way.
 */
export async function resolveSlurpTextConnection(
  connections: ConnectionsStorage,
  preferredId?: string | null,
): Promise<ResolvedConnection | null> {
  if (preferredId) return connections.getWithKey(preferredId);
  const agentDefault = await connections.getDefaultForAgents();
  if (agentDefault) return agentDefault;
  // `getDefault()` is not category-filtered, unlike `getDefaultForAgents()`, so check the provider
  // before handing it to a completion.
  const plainDefault = await connections.getDefault();
  if (!plainDefault || !isLanguageConnection(plainDefault)) return null;
  return connections.getWithKey(plainDefault.id);
}
