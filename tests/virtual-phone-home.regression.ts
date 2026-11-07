import assert from "node:assert/strict";
import {
  homeScopeFor,
  isHomePhone,
  PhoneIdentityService,
  type PhoneDocumentRecord,
  type PhoneDocumentStore,
} from "../packages/virtual-phone/src/phone/device/identity";
import { homePhoneRouteAllowed } from "../packages/virtual-phone/src/phone/system/access-policy";

class MemoryDocuments implements PhoneDocumentStore {
  records: PhoneDocumentRecord[] = [];

  async list(packageId: string, kind: string) {
    return structuredClone(this.records.filter((record) => record.packageId === packageId && record.kind === kind));
  }

  async create(input: Parameters<PhoneDocumentStore["create"]>[0]) {
    const record = { ...structuredClone(input), revision: 1 };
    this.records.push(record);
    return structuredClone(record);
  }

  async update(input: Parameters<PhoneDocumentStore["update"]>[0]) {
    const index = this.records.findIndex(
      (record) => record.id === input.id && record.revision === input.expectedRevision,
    );
    if (index < 0) return null;
    const current = this.records[index]!;
    const record = {
      ...current,
      ...structuredClone(input),
      kind: current.kind,
      createdAt: current.createdAt,
      revision: input.expectedRevision + 1,
    };
    this.records[index] = record;
    return structuredClone(record);
  }

  async remove(packageId: string, id: string, expectedRevision: number) {
    const index = this.records.findIndex(
      (record) => record.packageId === packageId && record.id === id && record.revision === expectedRevision,
    );
    if (index < 0) return false;
    this.records.splice(index, 1);
    return true;
  }
}

async function main() {
  let nextId = 0;
  const documents = new MemoryDocuments();
  const phones = new PhoneIdentityService(
    documents,
    () => "2026-11-08T00:00:00.000Z",
    () => `id-${++nextId}`,
  );

  // A story phone already exists for the character; the Home phone must not reuse or change it.
  const story = await phones.ensure({ ownerId: "char-a", ownerType: "character", ownerName: "Ava", chatId: "chat-1" });
  const storyBefore = structuredClone(story.document);

  const home = await phones.ensureHome({ characterId: "char-a", ownerName: "Ava" });
  assert.notEqual(home.document.identity.phoneId, story.document.identity.phoneId, "Home phone is a separate device");
  assert.ok(isHomePhone(home.document));
  assert.deepEqual(home.document.identity.chatScope, [homeScopeFor("char-a")]);
  assert.deepEqual(
    (await phones.get("character", "char-a"))?.document,
    storyBefore,
    "story lookup still finds the untouched story phone",
  );

  // Reopening resumes the same saved phone, also under concurrent opens.
  const [again, twice] = await Promise.all([
    phones.ensureHome({ characterId: "char-a", ownerName: "Ava" }),
    phones.ensureHome({ characterId: "char-a", ownerName: "Ava" }),
  ]);
  assert.equal(again.document.identity.phoneId, home.document.identity.phoneId);
  assert.equal(twice.document.identity.phoneId, home.document.identity.phoneId);
  assert.equal((await phones.list()).filter(({ document }) => isHomePhone(document)).length, 1);

  // Switching people must not share their app data, even when both phones are opened from Home.
  await phones.setAppStorageKey(home.document.identity.phoneId, "notes", "notes", ["Ava's private note"]);
  const other = await phones.ensureHome({ characterId: "char-b", ownerName: "Bo" });
  assert.notEqual(other.document.identity.phoneId, home.document.identity.phoneId);
  assert.equal(await phones.getAppStorageKey(other.document.identity.phoneId, "notes", "notes"), null);
  assert.deepEqual(await phones.getAppStorageKey(again.document.identity.phoneId, "notes", "notes"), [
    "Ava's private note",
  ]);

  // Joining a new story never picks up the Home phone, and a story can't adopt a Home scope.
  const joined = await phones.ensure({ ownerId: "char-a", ownerType: "character", ownerName: "Ava", chatId: "chat-2" });
  assert.equal(joined.document.identity.phoneId, story.document.identity.phoneId);
  assert.deepEqual(joined.document.identity.chatScope, ["chat-1", "chat-2"]);
  await assert.rejects(
    phones.ensure({ ownerId: "char-a", ownerType: "character", ownerName: "Ava", chatId: homeScopeFor("char-a") }),
    /cannot join a Home phone/,
  );
  assert.deepEqual((await phones.list()).find(({ document }) => isHomePhone(document))?.document.identity.chatScope, [
    homeScopeFor("char-a"),
  ]);

  // Phones written before Home existed still validate and still load as story phones.
  assert.equal(isHomePhone(storyBefore), false);

  // Home phones only reach phone-scoped routes, never story routes.
  assert.equal(homePhoneRouteAllowed("GET", "/phones/:phoneId/settings"), true);
  assert.equal(homePhoneRouteAllowed("POST", "/chats/:chatId/phones/:phoneId/show"), false);
  assert.equal(homePhoneRouteAllowed("POST", "/chats/:chatId/phones/:phoneId/session"), false);

  console.log("virtual-phone home regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
