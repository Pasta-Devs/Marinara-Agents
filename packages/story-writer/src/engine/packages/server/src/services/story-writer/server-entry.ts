import { forgeEngineLocalHeaders } from "@forge-kit/engine-local-auth.mjs";
import { createIllustrationImages } from "./illustrations.js";
import { storyWriterRoutes, type StoryWriterLogger, type StoryWriterRouter } from "./routes.js";
import { createStoryStore, type StoryPersistence, type StoryStore } from "./story-store.js";

// Structural: the server bundle may not import Engine storage, db or logger modules, only use api.runtime.
type ActivationContext = {
  api: {
    runtime: { persistence: StoryPersistence; logger: StoryWriterLogger };
    registerPrivilegedRoutes(
      routes: (router: StoryWriterRouter) => Promise<void>,
      options: { prefix: string },
    ): Promise<() => void | Promise<void>>;
  };
};

let activeStore: StoryStore | null = null;

/** fetch to this device's Engine, with the Android app's local secret it needs (#2357). */
const engineFetch: typeof fetch = (url, init) =>
  fetch(url, {
    ...init,
    headers: forgeEngineLocalHeaders(String(url), init?.headers as Record<string, string> | undefined),
  });

export async function activate({ api }: ActivationContext) {
  const store = createStoryStore(api.runtime.persistence);
  const images = createIllustrationImages({ fetch: engineFetch });
  const releaseRoutes = await api.registerPrivilegedRoutes(storyWriterRoutes(store, api.runtime.logger, images), {
    prefix: "/api/story-writer",
  });
  activeStore = store;
  return async () => {
    if (activeStore === store) activeStore = null;
    await releaseRoutes();
  };
}

export async function selfCheck() {
  if (!activeStore) throw new Error("Story Writer routes did not activate");
  // Reads the preferences document, so a missing storage permission fails here instead of on the first request.
  await activeStore.getPreferences();
}
