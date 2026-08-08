import assert from "node:assert/strict";
import { PhoneIdentityService, type PhoneDocumentRecord, type PhoneDocumentStore } from "../packages/virtual-phone/src/phone/device/identity";
import { phoneThemeTokens } from "../packages/virtual-phone/src/phone/device/theme";
import { initialDeviceSession, unlockDevice } from "../packages/virtual-phone/src/phone/device/surfaces";
import { InstalledAppRegistry } from "../packages/virtual-phone/src/phone/platform/app-registry";
import { validateAppManifest, type AppManifest } from "../packages/virtual-phone/src/phone/platform/app-manifest";
import { AppRouteStackManager } from "../packages/virtual-phone/src/phone/platform/app-lifecycle";
import { normalizeTopBarActions } from "../packages/virtual-phone/src/phone/platform/top-bar";
import { PhoneStore, type PhoneStoreBackend } from "../packages/virtual-phone/src/phone/platform/phone-store";
import { ContextProjection } from "../packages/virtual-phone/src/phone/platform/context";
import { parseBoundedContent } from "../packages/virtual-phone/src/phone/platform/content";
import { settingsManifest } from "../packages/virtual-phone/src/phone/apps/settings/manifest";
import { appStoreManifest, modelUseLabel } from "../packages/virtual-phone/src/phone/apps/app-store/manifest";
import { fallbackSearchResults, goodleManifest, looksLikeUrl, normalizeUrl, parseLinkedText, parsePageSection, parseResultItem, slugify } from "../packages/virtual-phone/src/phone/apps/goodle/manifest";
import { defaultDeviceSettings, normalizeDeviceSettings } from "../packages/virtual-phone/src/phone/device/settings";
import { messagesManifest } from "../packages/virtual-phone/src/phone/apps/messages/manifest";
import { notesManifest } from "../packages/virtual-phone/src/phone/apps/notes/manifest";
import { fallbackFeed, noodlerManifest } from "../packages/virtual-phone/src/phone/apps/noodler/manifest";
import { contactsManifest } from "../packages/virtual-phone/src/phone/apps/contacts/manifest";
import { handleFor, NoodleFeedService, NoodlerPageService, parseGeneratedPost, parsePagePost } from "../packages/virtual-phone/src/phone/system/noodle";
import { noodlerRManifest } from "../packages/virtual-phone/src/phone/apps/noodler-r/manifest";
import { cameraManifest } from "../packages/virtual-phone/src/phone/apps/camera/manifest";
import { applyTransaction, bankingManifest, emptyAccount, parseProposal, readAccount } from "../packages/virtual-phone/src/phone/apps/banking/manifest";
import { glyphFor, marketplaceManifest, parseListing } from "../packages/virtual-phone/src/phone/apps/marketplace/manifest";
import { draftMail, mailFromLine, mailManifest, mergeMail, parseEmail, readStoredMail } from "../packages/virtual-phone/src/phone/apps/mail/manifest";
import { extractImageUrls, galleryManifest } from "../packages/virtual-phone/src/phone/apps/gallery/manifest";
import { parseProfile, tindlerManifest } from "../packages/virtual-phone/src/phone/apps/tindler/manifest";
import { PhoneMessagingService, unreadCount, unreadMessages } from "../packages/virtual-phone/src/phone/system/messaging";
import { conditionOpacity, patternBackground } from "../packages/virtual-phone/src/phone/device/effects";

class MemoryDocuments implements PhoneDocumentStore {
  records: PhoneDocumentRecord[] = [];

  async list(packageId: string, kind: string) {
    return structuredClone(this.records.filter((record) => record.packageId === packageId && record.kind === kind));
  }

  async create(input: Parameters<PhoneDocumentStore["create"]>[0]) {
    if (this.records.some((record) => record.id === input.id)) throw new Error(`Document ${input.id} already exists`);
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
  const documents = new MemoryDocuments();
  const ids = ["phone-persona", "phone-character", "contact-manual"];
  const clock = ["2026-08-06T10:00:00.000Z", "2026-08-06T10:01:00.000Z", "2026-08-06T10:02:00.000Z"];
  const createService = () => new PhoneIdentityService(documents, () => clock.shift()!, () => ids.shift()!);

  const firstRuntime = createService();
  const minted = await firstRuntime.ensure({
    ownerId: "persona-1",
    ownerType: "persona",
    ownerName: "Alex",
    chatId: "chat-1",
  });
  assert.equal(minted.document.identity.phoneId, "phone-persona");
  assert.deepEqual(minted.document.identity.chatScope, ["chat-1"]);
  assert.deepEqual(minted.document.namespaces, { phone: { settings: defaultDeviceSettings() } });
  assert.equal(minted.document.provisioning.enabled, true);
  assert.equal(minted.document.provisioning.baselineTheme, "dark");

  const reloadedRuntime = createService();
  const fromSecondChat = await reloadedRuntime.ensure({
    ownerId: "persona-1",
    ownerType: "persona",
    ownerName: "Alex Updated",
    chatId: "chat-2",
  });
  assert.equal(fromSecondChat.document.identity.phoneId, minted.document.identity.phoneId);
  assert.equal(fromSecondChat.document.identity.ownerName, "Alex Updated");
  assert.deepEqual(fromSecondChat.document.identity.chatScope, ["chat-1", "chat-2"]);
  assert.equal(documents.records.length, 1);

  const legacyRecord = documents.records[0]!;
  legacyRecord.packageId = "virtual-phone-2";
  const migrationRuntime = createService();
  await migrationRuntime.migrateLegacyDocuments();
  const migrated = await migrationRuntime.get("persona", "persona-1");
  assert.equal(migrated?.document.identity.phoneId, "phone-persona");
  assert.equal(documents.records.some((record) => record.packageId === "virtual-phone-2"), false);
  await migrationRuntime.migrateLegacyDocuments();
  assert.equal(documents.records.length, 1);

  const concurrentRuntime = createService();
  const [firstCharacter, secondCharacter] = await Promise.all([
    concurrentRuntime.ensure({ ownerId: "character-1", ownerType: "character", ownerName: "Mira", chatId: "chat-1" }),
    concurrentRuntime.ensure({ ownerId: "character-1", ownerType: "character", ownerName: "Mira", chatId: "chat-1" }),
  ]);
  assert.equal(firstCharacter.document.identity.phoneId, secondCharacter.document.identity.phoneId);
  assert.equal(documents.records.length, 2);

  const disabled = await concurrentRuntime.ensure({
    ownerId: "character-1",
    ownerType: "character",
    ownerName: "Mira",
    chatId: "chat-2",
    enabled: false,
    baselineTheme: "dark",
  });
  assert.equal(disabled.document.identity.phoneId, firstCharacter.document.identity.phoneId);
  assert.equal(disabled.document.provisioning.enabled, false);
  assert.equal(disabled.document.provisioning.baselineTheme, "dark");
  const reenabled = await concurrentRuntime.ensure({
    ownerId: "character-1",
    ownerType: "character",
    ownerName: "Mira",
    chatId: "chat-2",
    enabled: true,
  });
  assert.equal(reenabled.document.identity.phoneId, disabled.document.identity.phoneId);
  assert.equal(reenabled.document.provisioning.enabled, true);
  assert.equal(reenabled.document.provisioning.baselineTheme, "dark");
  const manualContact = await concurrentRuntime.createContact({
    chatId: "chat-1",
    name: "Lady Farquaad",
    bio: "A person outside the active cast.",
  });
  assert.equal(manualContact.document.name, "Lady Farquaad");
  assert.equal(manualContact.document.phoneLabel, "");
  assert.deepEqual((await concurrentRuntime.listContacts("chat-1")).map(({ document }) => document.name), ["Lady Farquaad"]);
  assert.deepEqual(await concurrentRuntime.listContacts("chat-2"), []);
  await concurrentRuntime.removeContact(manualContact.document.contactId, "chat-1");
  assert.deepEqual(await concurrentRuntime.listContacts("chat-1"), []);
  assert.equal(settingsManifest.removable, false);
  assert.equal(settingsManifest.modelUse, "none");
  assert.equal(appStoreManifest.removable, false);
  assert.equal(modelUseLabel("none"), "Works without a model");
  assert.equal(modelUseLabel("light"), "Uses the model lightly");
  assert.equal(modelUseLabel("heavy"), "Model-heavy");
  assert.equal(goodleManifest.removable, true);
  assert.equal(goodleManifest.modelUse, "heavy");
  assert.deepEqual(fallbackSearchResults(" cafes "), { title: "Results for cafes", summary: "No generated results are available right now.", items: [] });
  assert.deepEqual(
    parseResultItem("Harbor Gazette | gazette.web/harbor | Nightly ferry schedule changes"),
    { title: "Harbor Gazette", url: "gazette.web/harbor", snippet: "Nightly ferry schedule changes" },
  );
  assert.deepEqual(parseResultItem("Just A Title"), { title: "Just A Title", url: "goodle.web/just-a-title", snippet: "" });
  assert.equal(slugify("Ferry Times & Fares!"), "ferry-times-fares");
  assert.deepEqual(parsePageSection("Deals :: Two-for-one noodles :: today only"), { heading: "Deals", body: "Two-for-one noodles :: today only" });
  assert.deepEqual(parsePageSection("Just a paragraph"), { heading: "", body: "Just a paragraph" });
  const customized = await concurrentRuntime.updateSettings(firstCharacter.document.identity.phoneId, {
    deviceName: "Mira's phone",
    wallpaper: "midnight",
    pattern: "waves",
    patternIntensity: 3,
    reduceDeviceEffects: true,
  });
  const reset = await concurrentRuntime.resetSettings(customized.document.identity.phoneId);
  assert.equal(reset.document.identity.phoneId, customized.document.identity.phoneId);
  assert.deepEqual(reset.document.namespaces.phone.settings, defaultDeviceSettings("dark"));
  const appInstall = await concurrentRuntime.updateSettings(reset.document.identity.phoneId, { installedApps: ["goodle"] });
  assert.deepEqual(
    (appInstall.document.namespaces.phone.settings as { installedApps: string[] }).installedApps,
    ["settings", "app-store", "goodle"],
  );
  assert.notEqual(phoneThemeTokens("light")["--vp-bg"], phoneThemeTokens("dark")["--vp-bg"]);
  assert.equal(phoneThemeTokens("dark")["--vp-radius"], "28px");
  // Status-bar state now lives in device settings so the story can drive it.
  assert.equal(defaultDeviceSettings("dark").batteryLevel, 80);
  assert.equal(defaultDeviceSettings("dark").cellularSignal, 4);
  assert.equal(normalizeDeviceSettings({ batteryLevel: 250, cellularSignal: 9 }).batteryLevel, 100);
  assert.equal(normalizeDeviceSettings({ batteryLevel: -5, cellularSignal: 9 }).batteryLevel, 0);
  assert.equal(normalizeDeviceSettings({ cellularSignal: 9 }).cellularSignal, 4);
  assert.equal(normalizeDeviceSettings({ cellularSignal: 1 }).cellularSignal, 1);
  const locked = initialDeviceSession("phone-persona");
  assert.equal(locked.surface, "lock");
  assert.deepEqual(unlockDevice(locked), { surface: "home", selectedPhoneId: "phone-persona" });

  const registry = new InstalledAppRegistry();
  const fixtureManifest: AppManifest = {
    id: "fixture",
    name: "Fixture",
    version: "1.0.0",
    icon: "fixture",
    category: "system",
    capabilities: ["storage.local"],
    modelUse: "none",
    removable: true,
    routes: [{ id: "home", path: "/", title: "Fixture" }],
    records: [{ type: "fixture", ownership: "phone-local" }],
    actions: [{ id: "refresh", tier: "local" }],
    content: { home: {} },
    notifications: null,
  };
  validateAppManifest(fixtureManifest);
  const fixtureEntry = {
    manifest: fixtureManifest,
    component: null as never,
    props: (context: { phone: { phoneId: string } }) => ({ phoneId: context.phone.phoneId }),
  };
  registry.register(fixtureEntry);
  registry.register({ ...fixtureEntry, manifest: { ...fixtureManifest, id: "second-fixture", name: "Second fixture" } });
  assert.throws(() => registry.register(fixtureEntry), /already registered/);
  assert.deepEqual(registry.list().map((app) => app.manifest.id), ["fixture", "second-fixture"]);
  assert.equal(registry.get("fixture")?.manifest.name, "Fixture");
  assert.equal(registry.get("missing"), undefined);
  // The shell renders `props(context)`; an app that stopped receiving its phoneId would render empty.
  assert.deepEqual(registry.get("fixture")?.props({ phone: { phoneId: "phone-1" } } as never), { phoneId: "phone-1" });

  const routes = new AppRouteStackManager();
  routes.open("fixture", "/");
  routes.push("fixture", "/detail");
  assert.equal(routes.back("fixture"), "/");
  assert.equal(routes.back("fixture"), "home");

  assert.deepEqual(
    normalizeTopBarActions([
      { id: "one", icon: "back", label: "Back", kind: "button" },
      { id: "one", icon: "duplicate", label: "Duplicate", kind: "button" },
      { id: "two", icon: "menu", label: "Menu", kind: "menu" },
      { id: "three", icon: "more", label: "More", kind: "button" },
      { id: "four", icon: "extra", label: "Extra", kind: "button" },
    ]).map((action) => action.id),
    ["one", "three", "two"],
  );

  const values = new Map<string, unknown>();
  const backend: PhoneStoreBackend = {
    get: async (_phoneId, _appId, key) => values.get(key),
    set: async (_phoneId, _appId, key, value) => { values.set(key, structuredClone(value)); },
    list: async (_phoneId, _appId, prefix) => [...values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key, value: structuredClone(value) })),
    remove: async (_phoneId, _appId, key) => { values.delete(key); },
  };
  const store = new PhoneStore(backend, "phone-persona", "fixture");
  await store.set("draft", { text: "hello" });
  assert.deepEqual(await store.get("draft"), { text: "hello" });
  assert.deepEqual(await store.list("dr"), [{ key: "draft", value: { text: "hello" } }]);
  await store.remove("draft");
  assert.equal(await store.get("draft"), undefined);

  const context = new ContextProjection();
  context.set("location", { value: "Home", source: "device", updatedAt: 1 });
  context.set("location", { value: "Cafe", source: "conversation", updatedAt: 2 });
  assert.deepEqual(context.get("location"), { value: "Cafe", source: "conversation", updatedAt: 2 });
  assert.equal(context.provenance("location").length, 2);

  assert.deepEqual(
    parseBoundedContent('Result: {"title":42,"count":"3","visible":"true","items":[1,2],"unknown":"drop"}', {
      fields: { title: "string", count: "number", visible: "boolean", items: "string[]" },
      defaults: { title: "Fallback", count: 0, visible: false, items: [] },
    }),
    { title: "42", count: 3, visible: true, items: ["1", "2"] },
  );
  assert.deepEqual(parseBoundedContent("not json", { fields: { title: "string" }, defaults: { title: "Fallback" } }), { title: "Fallback" });

  // Per-schema limits: an unmigrated schema keeps the old 300-char cap, a declared one overrides it,
  // and perField overrides both. Losing this silently makes every generated page a paragraph again.
  const long = "x".repeat(3000);
  assert.equal((parseBoundedContent(`{"body":"${long}"}`, { fields: { body: "string" }, defaults: { body: "" } }) as { body: string }).body.length, 300);
  assert.equal((parseBoundedContent(`{"body":"${long}"}`, { fields: { body: "string" }, defaults: { body: "" }, limits: { maxString: 1200 } }) as { body: string }).body.length, 1200);
  assert.deepEqual(
    parseBoundedContent(`{"site":"${long}","sections":["${long}","${long}","${long}"]}`, {
      fields: { site: "string", sections: "string[]" },
      defaults: { site: "", sections: [] },
      limits: { maxString: 1200, maxItems: 2, perField: { site: 80 } },
    }),
    { site: "x".repeat(80), sections: ["x".repeat(1200), "x".repeat(1200)] },
  );

  const personaPhoneId = minted.document.identity.phoneId;
  await reloadedRuntime.setAppStorageKey(personaPhoneId, "goodle", "recents", ["cafes", "parks"]);
  assert.deepEqual(await reloadedRuntime.getAppStorageKey(personaPhoneId, "goodle", "recents"), ["cafes", "parks"]);
  assert.deepEqual(await reloadedRuntime.listAppStorage(personaPhoneId, "goodle"), [{ key: "recents", value: ["cafes", "parks"] }]);
  assert.deepEqual(await reloadedRuntime.listAppStorage(personaPhoneId, "settings"), []);
  await assert.rejects(() => reloadedRuntime.setAppStorageKey(personaPhoneId, "goodle", "", 1), /Invalid phone storage key/u);
  await assert.rejects(() => reloadedRuntime.setAppStorageKey(personaPhoneId, "goodle", "big", "x".repeat(257 * 1024)), /exceeds 256KB/u);
  await assert.rejects(() => reloadedRuntime.setAppStorageKey("missing-phone", "goodle", "key", 1), /Phone not found/u);
  await reloadedRuntime.removeAppStorageKey(personaPhoneId, "goodle", "recents");
  assert.equal(await reloadedRuntime.getAppStorageKey(personaPhoneId, "goodle", "recents"), null);

  // Refresh must append, not replace: read state, sent mail and older mail survive the round trip.
  const heldMail = [
    { ...mailFromLine("Bank | Statement | ready", "Me", "2026-08-08T09:00:00.000Z"), read: true },
    mailFromLine("Gym | Renewal | soon", "Me", "2026-08-08T09:01:00.000Z"),
    draftMail({ from: "Me", to: "aunt@post.web", subject: "Hello", body: "hi" }),
  ];
  const afterRefresh = mergeMail(heldMail, [
    mailFromLine("Aunt | Hello | how are you", "Me", "2026-08-08T10:00:00.000Z"),
    mailFromLine("Bank | Statement | ready", "Me", "2026-08-08T10:00:00.000Z"),
  ]);
  assert.deepEqual(afterRefresh.map((mail) => mail.subject), ["Hello", "Statement", "Renewal", "Hello"]);
  assert.equal(afterRefresh.filter((mail) => mail.folder === "sent").length, 1);
  assert.equal(afterRefresh.find((mail) => mail.from === "Bank")?.read, true);
  // A mailbox written by an earlier build must survive the update rather than vanish.
  const migratedMail = readStoredMail([{ text: "Bank | Statement | ready", read: true }, { text: "Gym | Renewal | soon" }], "Me");
  assert.deepEqual(migratedMail.map((mail) => [mail.from, mail.subject, mail.read, mail.folder]), [
    ["Bank", "Statement", true, "inbox"],
    ["Gym", "Renewal", false, "inbox"],
  ]);
  assert.deepEqual(readStoredMail("nonsense", "Me"), []);

  validateAppManifest(messagesManifest);
  assert.equal(messagesManifest.removable, true);
  assert.deepEqual(messagesManifest.records, [{ type: "message-thread", ownership: "participant-shared" }]);
  validateAppManifest(notesManifest);
  assert.equal(notesManifest.modelUse, "none");
  assert.deepEqual(notesManifest.records, [{ type: "note", ownership: "phone-local" }]);
  validateAppManifest(noodlerManifest);
  assert.equal(noodlerManifest.modelUse, "heavy");
  assert.deepEqual(fallbackFeed(), { posts: [] });
  validateAppManifest(contactsManifest);
  assert.equal(contactsManifest.modelUse, "none");
  validateAppManifest(mailManifest);
  validateAppManifest(galleryManifest);
  validateAppManifest(tindlerManifest);
  assert.deepEqual(
    extractImageUrls("Look! ![a swamp](/api/files/swamp.png) and https://cdn.duloc.gov/castle.jpg plus /api/files/swamp.png again"),
    ["/api/files/swamp.png", "https://cdn.duloc.gov/castle.jpg"],
  );
  assert.deepEqual(extractImageUrls("no images here"), []);
  assert.deepEqual(
    parseProfile("Fiona D, 28 | Nights are better | Ogre-positive. Loves sunsets and swordplay."),
    { name: "Fiona D", age: "28", tagline: "Nights are better", bio: "Ogre-positive. Loves sunsets and swordplay." },
  );
  assert.deepEqual(parseProfile("Mystery"), { name: "Mystery", age: "", tagline: "", bio: "" });
  assert.deepEqual(
    parseEmail("Duloc Parks Dept | Overdue swamp permit | Your permit expired on the 3rd."),
    { from: "Duloc Parks Dept", subject: "Overdue swamp permit", body: "Your permit expired on the 3rd." },
  );
  assert.deepEqual(parseEmail("weird"), { from: "weird", subject: "(no subject)", body: "(empty message)" });
  assert.deepEqual(defaultDeviceSettings().installedApps, ["settings", "app-store", "goodle", "messages", "notes", "contacts", "gallery", "camera"]);
  assert.equal(defaultDeviceSettings().lightConnectionId, "");
  assert.equal(defaultDeviceSettings().wallpaperTint, "");
  assert.equal(defaultDeviceSettings().caseColor, "");
  assert.equal(defaultDeviceSettings().screenEffect, "none");
  assert.equal(defaultDeviceSettings().screenEffectIntensity, 2);
  const cased = await concurrentRuntime.updateSettings(firstCharacter.document.identity.phoneId, { caseColor: "#FF00AA", screenEffect: "cracks", screenEffectIntensity: 3 });
  const casedStored = cased.document.namespaces.phone.settings as { caseColor: string; screenEffect: string; screenEffectIntensity: number };
  assert.equal(casedStored.caseColor, "#ff00aa");
  assert.equal(casedStored.screenEffect, "cracks");
  assert.equal(casedStored.screenEffectIntensity, 3);
  const badCase = await concurrentRuntime.updateSettings(firstCharacter.document.identity.phoneId, { caseColor: "red", screenEffect: "explode" });
  const badStored = badCase.document.namespaces.phone.settings as { caseColor: string; screenEffect: string };
  assert.equal(badStored.caseColor, "");
  assert.equal(badStored.screenEffect, "none");
  const tinted = await concurrentRuntime.updateSettings(firstCharacter.document.identity.phoneId, { wallpaperTint: "#FFAA00" });
  assert.equal((tinted.document.namespaces.phone.settings as { wallpaperTint: string }).wallpaperTint, "#ffaa00");
  const badTint = await concurrentRuntime.updateSettings(firstCharacter.document.identity.phoneId, { wallpaperTint: "url(javascript:x)" });
  assert.equal((badTint.document.namespaces.phone.settings as { wallpaperTint: string }).wallpaperTint, "");
  assert.equal(defaultDeviceSettings().generationInstructions, "");
  const genSettings = await concurrentRuntime.updateSettings(firstCharacter.document.identity.phoneId, {
    lightConnectionId: "conn-small",
    heavyConnectionId: "conn-big",
    generationInstructions: "Keep it noir.",
  });
  const genStored = genSettings.document.namespaces.phone.settings as { lightConnectionId: string; heavyConnectionId: string; generationInstructions: string };
  assert.equal(genStored.lightConnectionId, "conn-small");
  assert.equal(genStored.heavyConnectionId, "conn-big");
  assert.equal(genStored.generationInstructions, "Keep it noir.");
  let tick = 0;
  const messageIds = ["msg-1", "msg-2", "msg-3"];
  const messaging = new PhoneMessagingService(
    documents,
    () => new Date(1_700_000_000_000 + ++tick * 1000).toISOString(),
    () => messageIds.shift()!,
  );
  const sent = await messaging.send("phone-persona", "phone-character", "  Hey Mira!  ");
  assert.deepEqual(sent.document.participants, ["phone-character", "phone-persona"]);
  assert.equal(sent.document.messages[0]!.text, "Hey Mira!");
  assert.equal(unreadCount(sent.document, "phone-persona"), 0);
  assert.equal(unreadCount(sent.document, "phone-character"), 1);
  const replied = await messaging.send("phone-character", "phone-persona", "Hey Alex");
  assert.equal(replied.record.id, sent.record.id);
  assert.equal(replied.document.messages.length, 2);
  assert.equal(unreadCount(replied.document, "phone-persona"), 1);
  assert.equal(unreadCount(replied.document, "phone-character"), 0);
  assert.deepEqual(unreadMessages(replied.document, "phone-persona").map((message) => message.text), ["Hey Alex"]);
  const read = await messaging.markRead(replied.record.id, "phone-persona");
  assert.equal(unreadCount(read.document, "phone-persona"), 0);
  assert.equal((await messaging.threadsFor("phone-persona")).length, 1);
  assert.deepEqual(await messaging.threadsFor("phone-unknown"), []);
  await assert.rejects(() => messaging.send("phone-persona", "phone-persona", "self"), /two different phones/u);
  await assert.rejects(() => messaging.send("phone-persona", "phone-character", "   "), /text is required/u);
  await assert.rejects(() => messaging.send("phone-persona", "phone-character", "x".repeat(2001)), /limited to 2000/u);
  await assert.rejects(() => messaging.markRead("thread:missing", "phone-persona"), /Thread not found/u);

  assert.equal(handleFor("Evil Stepsister #3"), "@evilstepsister3");
  assert.deepEqual(
    parseGeneratedPost("Marge Swampley @margeswamp — best onions in town — trust me"),
    { author: "Marge Swampley", handle: "@margeswamp", text: "best onions in town — trust me" },
  );
  let noodleTick = 0;
  const noodleIds = ["np-1", "np-2", "np-3"];
  const noodleService = new NoodleFeedService(
    documents,
    () => new Date(1_800_000_000_000 + ++noodleTick * 1000).toISOString(),
    () => noodleIds.shift() ?? `np-${Math.random()}`,
  );
  await noodleService.addPosts("chat-1", [{ author: "Mira", handle: "@mira", text: "hello swamp" }]);
  await noodleService.addPosts("chat-2", [{ author: "Bob", handle: "@bob", text: "other chat" }, { author: "", handle: "", text: "  " }]);
  assert.equal((await noodleService.feedFor(["chat-1"])).length, 1);
  const mergedFeed = await noodleService.feedFor(["chat-1", "chat-2"]);
  assert.deepEqual(mergedFeed.map((post) => post.text), ["other chat", "hello swamp"]);
  assert.deepEqual(await noodleService.feedFor(["chat-none"]), []);
  // Interactions are real and deduplicated: pressing like twice takes it back rather than counting
  // twice, and the seeded baseline keeps a fresh feed from reading as dead the way Forum did.
  const likeFeed = await noodleService.addPosts("chat-likes", [{ author: "Nim", handle: "@nim", text: "first" }]);
  const likedPostId = likeFeed[0]!.id;
  assert.equal(likeFeed[0]!.likedBy?.length, 0);
  assert.ok((likeFeed[0]!.seed?.likes ?? 0) > 0);
  await noodleService.interact("chat-likes", likedPostId, "phone-persona", "like");
  await noodleService.interact("chat-likes", likedPostId, "phone-character", "like");
  await noodleService.interact("chat-likes", likedPostId, "phone-persona", "like");
  const afterLikes = (await noodleService.feedFor(["chat-likes"])).find((post) => post.id === likedPostId);
  assert.deepEqual(afterLikes?.likedBy, ["phone-character"]);
  await noodleService.addPosts("chat-likes", [{ author: "You", handle: "@you", text: "replying", parentPostId: likedPostId }]);
  assert.equal((await noodleService.feedFor(["chat-likes"])).filter((post) => post.parentPostId === likedPostId).length, 1);

  validateAppManifest(noodlerRManifest);
  validateAppManifest(cameraManifest);
  validateAppManifest(bankingManifest);
  validateAppManifest(marketplaceManifest);
  // Banking moves money: a balance that drifts from its own history cannot be audited, which is
  // the whole reason the transaction log exists.
  const account = applyTransaction(applyTransaction(emptyAccount("credits"), {
    id: "t1", at: "2026-08-08T10:00:00.000Z", amount: 250, description: "Wages", source: "story",
  }), {
    id: "t2", at: "2026-08-08T11:00:00.000Z", amount: -40, description: "Taxi", source: "user",
  });
  assert.equal(account.balance, 210);
  assert.equal(account.balance, account.transactions.reduce((total, entry) => total + entry.amount, 0));
  assert.deepEqual(account.transactions.map((entry) => entry.id), ["t2", "t1"]);
  assert.deepEqual(parseProposal("+120 :: sold the bike"), { amount: 120, description: "sold the bike" });
  assert.deepEqual(parseProposal("-40 :: taxi across town"), { amount: -40, description: "taxi across town" });
  assert.equal(parseProposal("nonsense"), null);
  assert.equal(parseProposal("0 :: nothing"), null);
  assert.equal(readAccount(undefined).balance, 0);
  assert.equal(readAccount({ balance: "x", transactions: null }).currency, "credits");
  // A listing keeps title, price and seller with no image; only the picture is missing.
  assert.deepEqual(parseListing("Nel | 40 marks | Rusted bicycle | Rides fine downhill."), {
    seller: "Nel", price: "40 marks", title: "Rusted bicycle", description: "Rides fine downhill.",
  });
  assert.equal(parseListing("").title, "Unnamed item");
  assert.equal(glyphFor(parseListing("Nel | 40 | Rusted bicycle | downhill")), "\u25a4");
  assert.equal(glyphFor(parseListing("Nel | 40 | Odd trinket | unclear")), "\u25a2");
  assert.deepEqual(parsePagePost("Morning swamp yoga pics | locked"), { text: "Morning swamp yoga pics", locked: true });
  assert.deepEqual(parsePagePost("Hello everyone | free"), { text: "Hello everyone", locked: false });
  assert.deepEqual(parsePagePost("No marker at all"), { text: "No marker at all", locked: false });
  const pages = new NoodlerPageService(documents, () => "2027-01-01T00:00:00.000Z", () => "pg-1");
  const savedPage = await pages.savePage({ chatId: "chat-1", creatorPhoneId: "phone-character", creatorName: "Mira", tagline: "hi", price: "5 coins", posts: [{ text: "free one", locked: false }, { text: "teaser", locked: true }] });
  assert.equal(savedPage.document.posts.length, 2);
  const reloadedPage = await pages.pageFor("chat-1", "phone-character");
  assert.equal(reloadedPage?.document.tagline, "hi");
  const replacedPage = await pages.savePage({ chatId: "chat-1", creatorPhoneId: "phone-character", creatorName: "Mira", tagline: "new", price: "", posts: [] });
  assert.equal(replacedPage.document.tagline, "new");
  assert.equal(await pages.pageFor("chat-2", "phone-character"), null);

  const configured = await reloadedRuntime.updateSettings(minted.document.identity.phoneId, {
    deviceName: "Alex's Phone",
    pattern: "waves",
    patternIntensity: 2,
    reduceDeviceEffects: true,
  });
  assert.equal(configured.document.identity.deviceName, "Alex's Phone");
  assert.deepEqual(configured.document.namespaces.phone.settings, {
    ...defaultDeviceSettings(),
    deviceName: "Alex's Phone",
    pattern: "waves",
    patternIntensity: 2,
    reduceDeviceEffects: true,
  });
  // Step 7.5 — phone config binds to the persona/character, not to a chat. Phones are keyed by
  // owner, so a second chat appends to chatScope and leaves the configuration alone. Configuring a
  // phone is real work; redoing it every roleplay is exactly the repeated-work problem LTM solved.
  await reloadedRuntime.updateSettings("phone-persona", {
    installedApps: ["settings", "app-store", "goodle"],
    lorebookIds: ["book-1"],
    generationInstructions: "Everything here is waterlogged.",
  });
  const thirdChat = await createService().ensure({
    ownerId: "persona-1",
    ownerType: "persona",
    ownerName: "Alex Updated",
    chatId: "chat-3",
  });
  const carried = thirdChat.document.namespaces.phone.settings as {
    installedApps: string[];
    lorebookIds: string[];
    generationInstructions: string;
  };
  assert.deepEqual(carried.installedApps, ["settings", "app-store", "goodle"]);
  assert.deepEqual(carried.lorebookIds, ["book-1"]);
  assert.equal(carried.generationInstructions, "Everything here is waterlogged.");
  assert.deepEqual(thirdChat.document.identity.chatScope, ["chat-1", "chat-2", "chat-3"]);

  assert.equal(conditionOpacity(3, false), 1);
  assert.equal(conditionOpacity(3, true), 0);
  assert.match(patternBackground("grid", 3), /linear-gradient/u);

  console.log("Virtual Phone identity and storage regression passed.");
}

void main();
