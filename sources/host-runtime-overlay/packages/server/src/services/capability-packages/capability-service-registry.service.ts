// Host overlay for services/capability-packages/capability-service-registry.service.ts
// (Pasta-Devs/Marinara-Agents#1487). Services other packages register with api.registerService live in the
// Engine (api.runtime.services); the vendored registry was an empty copy, so a lookup always found nothing.
import { hostRuntime } from "../../lib/host-runtime.js";

export function getCapabilityService<T>(key: string): T | null {
  return hostRuntime().services?.get<T>(key) ?? null;
}
