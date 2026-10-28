// Types for the forge-kit modules the client imports as `@forge-kit/<module>.mjs` (the server's own are in
// S/forge-kit.d.ts; the client's strict typecheck reads only client files). Only the surface the client uses.

declare module "@forge-kit/story-expressions.mjs" {
  /**
   * The plate's character for one line: with the line's face (one of `names`) painted, a copy whose `art` is that
   * face and whose `neutral` is the plain portrait; otherwise `character` unchanged.
   */
  export function forgeStoryExpressionArt<C extends { art?: string; expressions?: Record<string, unknown> }>(
    character: C,
    segment: { expression?: string } | null | undefined,
    names?: readonly string[],
  ): C & { neutral?: string };
}
