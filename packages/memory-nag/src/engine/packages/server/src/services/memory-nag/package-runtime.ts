import type { CapabilityRuntimeHost } from "@marinara-engine/shared";

let runtime: CapabilityRuntimeHost | null = null;
let registration = 0;

export function configureMemoryNagRuntime(next: CapabilityRuntimeHost) {
  const token = ++registration;
  runtime = next;
  return () => {
    if (registration === token) runtime = null;
  };
}

export function getMemoryNagRuntime(): CapabilityRuntimeHost {
  if (!runtime) throw new Error("Memory Nag runtime is not configured");
  return runtime;
}
