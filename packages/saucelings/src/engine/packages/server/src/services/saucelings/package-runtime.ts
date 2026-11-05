import type { CapabilityRuntimeHost } from "@marinara-engine/shared";

let runtime: CapabilityRuntimeHost | null = null;
let registration = 0;

export function configureSaucelingsRuntime(next: CapabilityRuntimeHost) {
  const token = ++registration;
  runtime = next;
  return () => {
    if (registration === token) runtime = null;
  };
}

export function getSaucelingsRuntime(): CapabilityRuntimeHost {
  if (!runtime) throw new Error("Saucelings runtime is not configured");
  return runtime;
}
