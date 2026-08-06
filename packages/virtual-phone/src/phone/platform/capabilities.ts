import type { AppCapability } from "./app-manifest";

export class AppCapabilityGrants {
  private readonly grants = new Map<string, Set<AppCapability>>();

  install(phoneId: string, appId: string, declared: AppCapability[]) {
    this.grants.set(`${phoneId}:${appId}`, new Set(declared));
  }

  revoke(phoneId: string, appId: string, capability: AppCapability) {
    this.grants.get(`${phoneId}:${appId}`)?.delete(capability);
  }

  has(phoneId: string, appId: string, capability: AppCapability) {
    return this.grants.get(`${phoneId}:${appId}`)?.has(capability) === true;
  }

  require(phoneId: string, appId: string, capability: AppCapability) {
    if (!this.has(phoneId, appId, capability)) throw new Error(`App ${appId} cannot use ${capability}`);
  }
}
