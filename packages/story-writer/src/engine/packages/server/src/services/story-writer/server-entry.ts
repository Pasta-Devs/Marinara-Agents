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

export async function activate({ api }: ActivationContext) {
  const store = createStoryStore(api.runtime.persistence);
  const releaseRoutes = await api.registerPrivilegedRoutes(storyWriterRoutes(store, api.runtime.logger), {
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
