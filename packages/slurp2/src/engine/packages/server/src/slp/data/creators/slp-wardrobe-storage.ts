import {
  readSlpWardrobeLooks,
  SLP_WARDROBE_LOOK_LIMIT,
  type SlpWardrobeLook,
  type SlpWardrobeLookInput,
} from "../../../../../shared/src/slp/slp-wardrobe.js";
import { newId, now } from "../../../utils/id-generator.js";
import type { SlurpStorageContext } from "../host/slp-storage-context.js";

export const slurpWardrobeKey = (creatorAccountId: string) => `slurp2.creator.${creatorAccountId}.wardrobe`;

export function createWardrobeStorage(context: SlurpStorageContext) {
  const { settingsStore } = context;
  const write = async (creatorAccountId: string, looks: readonly SlpWardrobeLook[]) => {
    if (looks.length === 0) await settingsStore.remove(slurpWardrobeKey(creatorAccountId));
    else await settingsStore.set(slurpWardrobeKey(creatorAccountId), JSON.stringify(looks));
    return [...looks];
  };
  return {
    async listWardrobeLooks(creatorAccountId: string): Promise<SlpWardrobeLook[]> {
      return readSlpWardrobeLooks(await settingsStore.get(slurpWardrobeKey(creatorAccountId)));
    },
    async createWardrobeLooks(
      creatorAccountId: string,
      inputs: readonly SlpWardrobeLookInput[],
      source: SlpWardrobeLook["source"],
    ): Promise<SlpWardrobeLook[]> {
      const current = await this.listWardrobeLooks(creatorAccountId);
      if (current.length + inputs.length > SLP_WARDROBE_LOOK_LIMIT) throw new Error("Wardrobe limit reached.");
      const at = now();
      const created = inputs.map((input) => ({ ...input, id: newId(), source, createdAt: at, updatedAt: at }));
      await write(creatorAccountId, [...current, ...created]);
      return created;
    },
    async updateWardrobeLook(
      creatorAccountId: string,
      lookId: string,
      input: SlpWardrobeLookInput,
    ): Promise<SlpWardrobeLook | null> {
      const current = await this.listWardrobeLooks(creatorAccountId);
      const index = current.findIndex((look) => look.id === lookId);
      if (index < 0) return null;
      const updated = { ...current[index]!, ...input, updatedAt: now() };
      current[index] = updated;
      await write(creatorAccountId, current);
      return updated;
    },
    async deleteWardrobeLook(creatorAccountId: string, lookId: string): Promise<boolean> {
      const current = await this.listWardrobeLooks(creatorAccountId);
      const next = current.filter((look) => look.id !== lookId);
      if (next.length === current.length) return false;
      await write(creatorAccountId, next);
      return true;
    },
    async clearWardrobe(creatorAccountId: string): Promise<void> {
      await settingsStore.remove(slurpWardrobeKey(creatorAccountId));
    },
  };
}
