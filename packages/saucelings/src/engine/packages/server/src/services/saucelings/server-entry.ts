import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { FastifyPluginAsync } from "fastify";
import { noteChatReply } from "./hunt.js";
import { configureSaucelingsRuntime } from "./package-runtime.js";
import { saucelingsRoutes } from "./routes.js";
import { readSaucelingWorld } from "./store.js";

type ActivationContext = {
  api: {
    runtime: CapabilityRuntimeHost;
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
    /** Needs the "prompt-context" permission; an older Engine without it simply never hunts. */
    registerPromptContext?(contributor: (request: { targetCharacterIds?: string[] }) => null): () => void;
  };
};

let ready = false;

export async function activate({ api }: ActivationContext) {
  const releases: Array<() => void> = [configureSaucelingsRuntime(api.runtime)];
  const unwind = () => {
    while (releases.length > 0) releases.pop()!();
  };
  try {
    // ponytail: no background timer in phase 1; the ceiling is that nothing is computed while
    // nobody looks, which the user cannot observe. Upgrade path is Noodle's unref'd setTimeout
    // loop if pushed updates are ever wanted.
    releases.push(await api.registerPrivilegedRoutes(saucelingsRoutes, { prefix: "/api/saucelings" }));
    // Egg hunting rolls on each chat reply; it adds nothing to the prompt (see hunt.ts).
    if (api.registerPromptContext) releases.push(api.registerPromptContext(noteChatReply));
    ready = true;
    return () => {
      ready = false;
      unwind();
    };
  } catch (error) {
    unwind();
    throw error;
  }
}

export async function selfCheck() {
  if (!ready) throw new Error("Saucelings did not initialize");
  await readSaucelingWorld();
}
