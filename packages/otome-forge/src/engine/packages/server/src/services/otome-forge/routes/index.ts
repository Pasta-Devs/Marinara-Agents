// ──────────────────────────────────────────────
// Otome Forge: GET /index and POST /index/opened
// ──────────────────────────────────────────────
import { parseBody, type Handle, type OtomeRouter } from "../http.js";
import { INDEX_ID, INDEX_TARGET } from "../ids.js";
import { IndexOpenedBody, normalizeIndex } from "../schemas/index.js";
import type { OtomeStore } from "../store.js";

export function registerIndexRoutes(router: OtomeRouter, { store, handle }: { store: OtomeStore; handle: Handle }) {
  // A read never creates the document: a first visit that only looks leaves no trace.
  router.get(
    "/index",
    handle(async () => ({ index: (await store.readDoc(INDEX_ID, normalizeIndex)) ?? normalizeIndex(undefined) })),
  );
  router.post(
    "/index/opened",
    handle(async (request) => {
      parseBody(IndexOpenedBody, request.body);
      const at = new Date().toISOString();
      return {
        index: await store.mutateDoc(INDEX_TARGET, normalizeIndex, (index) => ({ ...index, lastOpenedAt: at })),
      };
    }),
  );
}
