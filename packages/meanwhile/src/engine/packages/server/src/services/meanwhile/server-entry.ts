import type { CapabilityRuntimeHost } from "@marinara-engine/shared";
import type { FastifyPluginAsync } from "fastify";
import { meanwhileRoutes } from "./routes.js";
import { startMeanwhileScheduler } from "./scheduler.js";
import { configureMeanwhileRuntime, readMeanwhile } from "./store.js";

type ActivationContext = {
  api: {
    runtime: CapabilityRuntimeHost;
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void>;
  };
};

let ready = false;

export async function activate({ api }: ActivationContext): Promise<() => void> {
  const releases: Array<() => void> = [configureMeanwhileRuntime(api.runtime)];
  const unwind = () => {
    while (releases.length > 0) releases.pop()!();
  };
  try {
    releases.push(await api.registerPrivilegedRoutes(meanwhileRoutes, { prefix: "/api/meanwhile" }));
    releases.push(startMeanwhileScheduler());
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
  if (!ready) throw new Error("Meanwhile did not initialize");
  await readMeanwhile();
}
