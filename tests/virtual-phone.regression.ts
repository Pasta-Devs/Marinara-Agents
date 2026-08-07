import assert from "node:assert/strict";
import { PhoneIdentityService, type PhoneDocumentRecord, type PhoneDocumentStore } from "../packages/virtual-phone/src/phone/device/identity";
import { phoneThemeTokens } from "../packages/virtual-phone/src/phone/device/theme";
import { defaultPhoneStatus } from "../packages/virtual-phone/src/phone/device/status";
import { initialDeviceSession, unlockDevice } from "../packages/virtual-phone/src/phone/device/surfaces";
import { InstalledAppRegistry, type AppLaunchState } from "../packages/virtual-phone/src/phone/platform/app-registry";
import { validateAppManifest, type AppManifest } from "../packages/virtual-phone/src/phone/platform/app-manifest";
import { AppLifecycleManager, AppRouteStackManager } from "../packages/virtual-phone/src/phone/platform/app-lifecycle";
import { normalizeTopBarActions } from "../packages/virtual-phone/src/phone/platform/top-bar";
import { PhoneStore, type PhoneStoreBackend } from "../packages/virtual-phone/src/phone/platform/phone-store";
import { BottomNavigationState } from "../packages/virtual-phone/src/phone/platform/bottom-navigation";
import { AppCapabilityGrants } from "../packages/virtual-phone/src/phone/platform/capabilities";
import { ContextProjection } from "../packages/virtual-phone/src/phone/platform/context";
import { NotificationStore } from "../packages/virtual-phone/src/phone/platform/notifications";
import { parseBoundedContent } from "../packages/virtual-phone/src/phone/platform/content";
import { settingsManifest } from "../packages/virtual-phone/src/phone/apps/settings/manifest";
import { appStoreManifest, modelUseLabel } from "../packages/virtual-phone/src/phone/apps/app-store/manifest";
import { fallbackSearchResults, goodleManifest, parsePageSection, parseResultItem, slugify } from "../packages/virtual-phone/src/phone/apps/goodle/manifest";
import { defaultDeviceSettings } from "../packages/virtual-phone/src/phone/device/settings";
import { messagesManifest } from "../packages/virtual-phone/src/phone/apps/messages/manifest";
import { notesManifest } from "../packages/virtual-phone/src/phone/apps/notes/manifest";
import { fallbackFeed, noodlerManifest } from "../packages/virtual-phone/src/phone/apps/noodler/manifest";
import { contactsManifest } from "../packages/virtual-phone/src/phone/apps/contacts/manifest";
import { handleFor, NoodleFeedService, NoodlerPageService, parseGeneratedPost, parsePagePost } from "../packages/virtual-phone/src/phone/system/noodle";
import { noodlerRManifest } from "../packages/virtual-phone/src/phone/apps/noodler-r/manifest";
import { forumManifest } from "../packages/virtual-phone/src/phone/apps/forum/manifest";
import { cameraManifest } from "../packages/virtual-phone/src/phone/apps/camera/manifest";
import { ForumService, parseGeneratedReply, parseGeneratedThread } from "../packages/virtual-phone/src/phone/system/forum";
import { mailManifest, parseEmail } from "../packages/virtual-phone/src/phone/apps/mail/manifest";
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
  assert.deepEqual(defaultPhoneStatus(), {
    cellularSignal: 4,
    wifi: false,
    airplaneMode: false,
    batteryLevel: 80,
    charging: false,
    online: true,
  });
  const locked = initialDeviceSession("phone-persona");
  assert.equal(locked.surface, "lock");
  assert.deepEqual(unlockDevice(locked), { surface: "home", selectedPhoneId: "phone-persona" });

  const registry = new InstalledAppRegistry();
  const launchStates: AppLaunchState[] = [];
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
  registry.register({ manifest: fixtureManifest, load: async () => ({ ready: true }) });
  registry.register({ manifest: { ...fixtureManifest, id: "failing-fixture", name: "Failing fixture" }, load: async () => { throw new Error("Fixture failed"); } });
  assert.equal((await registry.launch("fixture", (state) => launchStates.push(state))).status, "active");
  const failed = await registry.launch("failing-fixture", (state) => launchStates.push(state));
  assert.deepEqual(failed, { status: "failed", appId: "failing-fixture", error: "Fixture failed" });
  assert.deepEqual(launchStates.map((state) => state.status), ["loading", "active", "loading", "failed"]);

  const lifecycle = new AppLifecycleManager();
  lifecycle.registerAvailable(fixtureManifest, async () => undefined);
  assert.equal(lifecycle.install("fixture").state, "installed");
  assert.equal((await lifecycle.activate("fixture")).state, "active");
  await lifecycle.update("fixture", { ...fixtureManifest, version: "1.1.0" }, async (from, to) => {
    assert.deepEqual([from, to], ["1.0.0", "1.1.0"]);
  });
  lifecycle.disable("fixture");
  await assert.rejects(() => lifecycle.activate("fixture"), /disabled/u);

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

  const tabs = new BottomNavigationState([
    { id: "home", route: "/", label: "Home", icon: "home" },
    { id: "saved", route: "/saved", label: "Saved", icon: "bookmark" },
  ]);
  tabs.push("/detail");
  tabs.setScroll(120);
  tabs.select("saved");
  tabs.setScroll(40);
  assert.deepEqual(tabs.snapshot(), { activeTabId: "saved", route: "/saved", scrollTop: 40 });
  tabs.select("home");
  assert.deepEqual(tabs.snapshot(), { activeTabId: "home", route: "/detail", scrollTop: 120 });
  assert.equal(tabs.select("home"), "/");

  const grants = new AppCapabilityGrants();
  grants.install("phone-persona", "fixture", ["storage.local", "notify"]);
  grants.require("phone-persona", "fixture", "notify");
  grants.revoke("phone-persona", "fixture", "notify");
  assert.throws(() => grants.require("phone-persona", "fixture", "notify"), /cannot use notify/u);

  const context = new ContextProjection();
  context.set("location", { value: "Home", source: "device", updatedAt: 1 });
  context.set("location", { value: "Cafe", source: "conversation", updatedAt: 2 });
  assert.deepEqual(context.get("location"), { value: "Cafe", source: "conversation", updatedAt: 2 });
  assert.equal(context.provenance("location").length, 2);

  const notifications = new NotificationStore();
  notifications.add({ id: "one", appId: "fixture", title: "Ready", body: "Fixture ready", createdAt: 1 });
  notifications.add({ id: "one", appId: "fixture", title: "Duplicate", body: "Ignored", createdAt: 2 });
  assert.equal(notifications.unreadCount, 1);
  notifications.acknowledge("one");
  assert.equal(notifications.unreadCount, 0);

  assert.deepEqual(
    parseBoundedContent('Result: {"title":42,"count":"3","visible":"true","items":[1,2],"unknown":"drop"}', {
      fields: { title: "string", count: "number", visible: "boolean", items: "string[]" },
      defaults: { title: "Fallback", count: 0, visible: false, items: [] },
    }),
    { title: "42", count: 3, visible: true, items: ["1", "2"] },
  );
  assert.deepEqual(parseBoundedContent("not json", { fields: { title: "string" }, defaults: { title: "Fallback" } }), { title: "Fallback" });

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
  validateAppManifest(noodlerRManifest);
  validateAppManifest(forumManifest);
  validateAppManifest(cameraManifest);
  assert.deepEqual(
    parseGeneratedThread("Ferry prices AGAIN | Dockworker Dan @dandocks | Third hike this year. Absurd."),
    { title: "Ferry prices AGAIN", author: "Dockworker Dan @dandocks", body: "Third hike this year. Absurd." },
  );
  assert.deepEqual(parseGeneratedReply("Marge @marge | Same here."), { author: "Marge @marge", text: "Same here." });
  let forumTick = 0;
  const forumService = new ForumService(
    documents,
    () => new Date(1_900_000_000_000 + ++forumTick * 1000).toISOString(),
    () => `f-${++forumTick}`,
  );
  await forumService.addThreads("chat-1", [{ title: "First thread", author: "Dan", body: "opening post" }]);
  const board = await forumService.boardFor(["chat-1"]);
  assert.equal(board.length, 1);
  assert.equal(board[0]!.posts.length, 1);
  await forumService.addReply(["chat-1"], board[0]!.id, "Alex", "a reply");
  const afterReply = await forumService.boardFor(["chat-1"]);
  assert.equal(afterReply[0]!.posts.length, 2);
  assert.equal(afterReply[0]!.posts[1]!.author, "Alex");
  await assert.rejects(() => forumService.addReply(["chat-1"], "missing-thread", "Alex", "x"), /Thread not found/u);
  await assert.rejects(() => forumService.addReply(["chat-1"], board[0]!.id, "Alex", "   "), /text is required/u);
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
  assert.equal(conditionOpacity(3, false), 1);
  assert.equal(conditionOpacity(3, true), 0);
  assert.match(patternBackground("grid", 3), /linear-gradient/u);

  console.log("Virtual Phone identity and storage regression passed.");
}

void main();
