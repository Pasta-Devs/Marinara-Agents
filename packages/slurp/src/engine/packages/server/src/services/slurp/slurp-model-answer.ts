/**
 * An empty model answer is a common provider failure: the output budget went to reasoning, a
 * filter removed the text, or the response was dropped. Left to the JSON parser it surfaces as
 * "Unexpected end of JSON input", which names neither the cause nor a fix.
 *
 * ponytail: the same guard belongs in Engine's parseGameJsonish, which every caller routes
 * through. That file is not package-owned, so Slurp guards its own call sites until an Engine
 * release carries it.
 */
export function requireModelAnswer(content: string, what: string): string {
  if (content.trim()) return content;
  throw new Error(
    `The generation model returned an empty response for ${what}. Check the Slurp generation connection: raise its max output tokens, or pick a model that answers with JSON.`,
  );
}
