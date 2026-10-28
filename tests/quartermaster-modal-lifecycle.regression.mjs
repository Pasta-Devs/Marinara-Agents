import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";

const elements = [];
const timers = [];
const revoked = [];
let notifications = 0;
function element(label = "") {
  const node = {
    textContent: label,
    value: "",
    style: {},
    listeners: {},
    append() {},
    appendChild() {},
    replaceChildren() {},
    remove() {},
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    },
    click() {
      this.clicked = true;
    },
  };
  elements.push(node);
  return node;
}
const QM = {
  state: {
    chatId: "chat-a",
    _notify() {
      notifications++;
    },
  },
  button: element,
  smallInput: element,
  compressImageFile: async () => "data:image/png;base64,fixture",
  forgottenImages: [],
  forgetImage(url) {
    this.forgottenImages.push(url);
  },
  itemImageUrl: (_chatId, _ownerId, id) => `item:${id}`,
  outfitPortraitUrl: (_chatId, _ownerId, id) => `outfit:${id}`,
};
const context = vm.createContext({
  QM,
  QM_OWNER_ID: "persona",
  QM_COLOR_SUCCESS: "green",
  QM_COLOR_SUCCESS_FG: "white",
  Error,
  Blob,
  window: { localStorage: { getItem: () => null } },
  document: { createElement: element, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
  URL: { createObjectURL: () => "blob:inventory", revokeObjectURL: (url) => revoked.push(url) },
  setTimeout: (callback) => timers.push(callback),
});
for (const source of ["10-dock.js", "11-wardrobe.js", "12-image-gen.js"]) {
  vm.runInContext(await readFile(new URL(`../packages/quartermaster/src/${source}`, import.meta.url), "utf8"), context);
}
const dock = QM.dock;
dock._renderImageGenContent = () => {};
dock._imageGenKind = "item";
dock._imageGenSubjectId = "item-a";

QM.itemImagePromptPreview = async (...args) => {
  assert.deepEqual(args, ["chat-a", "persona", "item-a"]);
  return { prompt: "current prompt" };
};
await dock._submitImageGenPromptPreview();
assert.equal(dock._imageGenPrompt, "current prompt");

for (const change of ["reopen", "chat"]) {
  for (const reject of [false, true]) {
    QM.state.chatId = "chat-a";
    let settle;
    QM.itemImagePromptPreview = () =>
      new Promise((resolve, fail) => {
        settle = () => (reject ? fail(new Error("stale error")) : resolve({ prompt: "stale prompt" }));
      });
    const pending = dock._submitImageGenPromptPreview();
    if (change === "reopen") dock._closeImageGenModal();
    else QM.state.chatId = "chat-b";
    dock._imageGenViewState = "choice";
    dock._imageGenPrompt = "new session";
    dock._imageGenError = null;
    settle();
    await pending;
    assert.equal(dock._imageGenViewState, "choice", `${change}: stale preview must not replace the dialog`);
    assert.equal(dock._imageGenPrompt, "new session");
    assert.equal(dock._imageGenError, null);
  }
}

const removed = [];
for (const key of ["addItemBackdrop", "wardrobeBuilderBackdrop", "imageGenBackdrop"]) {
  dock[key] = { remove: () => removed.push(key) };
}
const token = dock._imageGenSessionToken;
dock.close();
assert.equal(removed.length, 3, "closing the dock removes all child dialogs");
assert.ok(dock._imageGenSessionToken > token, "closing the dock invalidates pending previews");

for (const change of ["none", "reopen", "chat", "reset"]) {
  for (const reject of [false, true]) {
    let settle;
    let renders = 0;
    QM.state.chatId = "chat-a";
    QM.state.confirmWardrobe = () =>
      new Promise((resolve, fail) => {
        settle = () => (reject ? fail(new Error("Confirmation failed")) : resolve({ summary: "saved" }));
      });
    dock._renderWardrobeBuilderContent = () => renders++;
    dock._wardrobeSummary = null;
    dock._wardrobeError = null;
    dock._wardrobeViewState = "preview";
    const button = element();
    const pending = dock._submitWardrobeConfirm(button);
    if (change === "reopen") dock._closeWardrobeBuilder();
    if (change === "chat") QM.state.chatId = "chat-b";
    if (change === "reset") dock._resetCachedNodes();
    settle();
    await pending;
    const current = change === "none";
    assert.equal(dock._wardrobeSummary, current && !reject ? "saved" : null, `${change}: confirmation summary`);
    assert.equal(
      dock._wardrobeError,
      current && reject ? "Confirmation failed" : null,
      `${change}: confirmation error`,
    );
    assert.equal(dock._wardrobeViewState, current && reject ? "error" : "preview");
    assert.equal(button.disabled, !(current && reject));
    assert.equal(renders, current ? 1 : 0);
  }
}

const resetRemoved = [];
for (const key of [
  "itemEditorBackdrop",
  "outfitEditorBackdrop",
  "saveOutfitBackdrop",
  "addItemBackdrop",
  "wardrobeBuilderBackdrop",
  "imageGenBackdrop",
]) {
  dock[key] = { remove: () => resetRemoved.push(key) };
}
dock._wardrobeContentContainer = element();
dock._imageGenContentContainer = element();
const wardrobeToken = dock._wardrobeSessionToken;
const imageToken = dock._imageGenSessionToken;
dock._resetCachedNodes();
assert.equal(resetRemoved.length, 6, "rebuilding the dock removes all dialogs");
assert.equal(dock._wardrobeContentContainer, null);
assert.equal(dock._imageGenContentContainer, null);
assert.ok(dock._wardrobeSessionToken > wardrobeToken);
assert.ok(dock._imageGenSessionToken > imageToken);

QM.state.exportInventory = async () => {
  throw new Error("Export unavailable");
};
dock._buildExportImportRow();
const exportButton = elements.find((node) => node.listeners.click);
await exportButton.listeners.click();
assert.equal(QM.state.error, "Export unavailable");
assert.equal(notifications, 1);
assert.equal(exportButton.disabled, false);
QM.state.exportInventory = async () => ({ personaName: "Mari", items: [] });
await exportButton.listeners.click();
assert.ok(elements.some((node) => node.clicked && node.download.endsWith(".json")));
assert.deepEqual(revoked, [], "the download URL survives the click task");
timers.forEach((callback) => callback());
assert.deepEqual(revoked, ["blob:inventory"]);

for (const outcome of ["failure", "success", "chat-change"]) {
  const start = elements.length;
  const uploads = [];
  QM.state.chatId = "chat-a";
  QM.state.error = null;
  QM.state.outfits = [{ id: "existing" }];
  QM.state.createOutfit = async () => {
    if (outcome === "failure") QM.state.error = "Save unavailable";
    else QM.state.outfits = [{ id: "new" }, { id: "existing" }];
    if (outcome === "chat-change") QM.state.chatId = "chat-b";
    return outcome === "failure"
      ? { ok: false, error: "Save unavailable" }
      : { ok: true, result: { outfits: QM.state.outfits } };
  };
  QM.state.uploadOutfitPortrait = async (id) => uploads.push(id);
  dock.body = element();
  dock._openSaveOutfitModal();
  const controls = elements.slice(start);
  controls.find((node) => node.placeholder === "Outfit name").value = "Armor";
  const upload = controls.find((node) => node.type === "file");
  upload.files = [{}];
  await upload.listeners.change();
  const save = controls.find((node) => node.textContent === "Save");
  await save.listeners.click();
  assert.deepEqual(
    uploads,
    outcome === "success" ? ["new"] : [],
    `${outcome}: never replace the previous outfit's portrait`,
  );
  assert.equal(save.disabled, false);
  dock._closeSaveOutfitModal();
}
console.log("Quartermaster modal lifecycle and export regressions passed.");

await test("image connection checks cannot overwrite a later dialog", async () => {
  for (const stale of [false, true]) {
    for (const reject of [false, true]) {
      let settle;
      QM.listImageConnections = () =>
        new Promise((resolve, fail) => {
          settle = () => (reject ? fail(new Error("Connection check failed")) : resolve([{}]));
        });
      const pending = dock._checkImageGenConnections();
      if (stale) {
        dock._closeImageGenModal();
        dock._imageGenHasConnections = "new session";
        dock._imageGenConnectionsError = false;
      }
      settle();
      await pending;
      assert.equal(dock._imageGenHasConnections, stale ? "new session" : !reject);
      assert.equal(dock._imageGenConnectionsError, !stale && reject);
    }
  }
});

const stateSource = await readFile(new URL("../packages/quartermaster/src/05-state.js", import.meta.url), "utf8");
await test("generated images use their own upload result and cannot close a later dialog", async () => {
  const stateContext = vm.createContext({ QM });
  vm.runInContext(stateSource, stateContext);
  QM._missingItemImageIds = new Set();
  for (const kind of ["item", "outfit"]) {
    for (const succeeds of [false, true]) {
      for (const change of ["none", "reopen", "chat"]) {
        QM.state.chatId = "chat-a";
        QM.state.error = null;
        dock._imageGenKind = kind;
        dock._imageGenSubjectId = "subject-a";
        dock._imageGenError = null;
        let settleUpload;
        let startedUpload;
        const uploadStarted = new Promise((resolve) => {
          startedUpload = resolve;
        });
        const uploadArgs = [];
        const upload = (...args) => {
          uploadArgs.push(args);
          startedUpload();
          return new Promise((resolve, reject) => {
            settleUpload = () => (succeeds ? resolve({}) : reject(new Error("Upload failed")));
          });
        };
        QM.generateItemImage = QM.generateOutfitPortrait = async () => ({
          imageDataUrl: "data:image/png;base64,fixture",
        });
        QM.uploadItemImage = QM.uploadOutfitPortrait = upload;
        const pending = dock._submitImageGenGenerate();
        await uploadStarted;
        // A generated item image is saved as "generated", for its label in the dock.
        if (kind === "item") assert.equal(uploadArgs[0].at(-1), "generated");
        if (change === "reopen") dock._closeImageGenModal();
        if (change === "chat") QM.state.chatId = "chat-b";
        const token = dock._imageGenSessionToken;
        if (change !== "none") dock._imageGenViewState = "choice";
        // Settle the opposite result in the same turn, before the modal's continuation.
        settleUpload();
        await QM.state._mutate(succeeds ? Promise.reject(new Error("Unrelated failure")) : Promise.resolve({}));
        await pending;
        assert.equal(
          dock._imageGenSessionToken,
          token + (succeeds && change === "none" ? 1 : 0),
          `${kind}/${succeeds}/${change}: closes only its successful upload`,
        );
        assert.equal(dock._imageGenError, !succeeds && change === "none" ? "Upload failed" : null);
        if (change !== "none") assert.equal(dock._imageGenViewState, "choice");
      }
    }
  }
});

await test("late inventory reloads cannot replace a mutation, newer reload, or another chat's error", async () => {
  for (const change of ["mutation", "reload", "chat"]) {
    for (const fails of [false, true]) {
      const api = {};
      vm.runInContext(stateSource, vm.createContext({ QM: api }));
      api.state.chatId = "chat-a";
      let settle;
      api.listItems = () =>
        new Promise((resolve, reject) => {
          settle = () =>
            fails ? reject(new Error("Old reload failed")) : resolve({ items: [{ id: "old" }], outfits: [] });
        });
      const pending = api.state._reload();
      if (change === "mutation") await api.state._mutate(Promise.resolve({ items: [{ id: "current" }], outfits: [] }));
      if (change === "reload") {
        api.listItems = async () => ({ items: [{ id: "current" }], outfits: [] });
        await api.state._reload();
      }
      if (change === "chat") {
        api.state.chatId = "chat-b";
        api.state.items = [{ id: "current" }];
      }
      api.state.error = "Current error";
      settle();
      await pending;
      assert.equal(api.state.items[0].id, "current", `${change}/${fails}: keeps current inventory`);
      assert.equal(api.state.error, "Current error", `${change}/${fails}: keeps current error`);
    }
  }
});

await test("outfit saves use their own result while another mutation changes shared state", async () => {
  for (const succeeds of [false, true]) {
    const uploads = [];
    QM.forgottenImages.length = 0;
    QM.state.chatId = "chat-a";
    QM.state.outfits = [{ id: "existing" }];
    let settle;
    QM.createOutfit = () =>
      new Promise((resolve, reject) => {
        settle = () =>
          succeeds ? resolve({ outfits: [{ id: "new" }, { id: "existing" }] }) : reject(new Error("Save failed"));
      });
    QM.uploadOutfitPortrait = async (_chatId, _ownerId, id) => {
      uploads.push(id);
      return {};
    };
    const start = elements.length;
    dock.body = element();
    dock._openSaveOutfitModal();
    const controls = elements.slice(start);
    controls.find((node) => node.placeholder === "Outfit name").value = "Armor";
    const upload = controls.find((node) => node.type === "file");
    upload.files = [{}];
    await upload.listeners.change();
    const save = controls.find((node) => node.textContent === "Save");
    const pending = save.listeners.click();
    settle();
    await QM.state._mutate(
      succeeds ? Promise.reject(new Error("Unrelated failure")) : Promise.resolve({ outfits: [{ id: "unrelated" }] }),
    );
    await pending;
    assert.deepEqual(uploads, succeeds ? ["new"] : []);
    assert.deepEqual(QM.forgottenImages, succeeds ? ["outfit:new"] : [], "drops the cached portrait after its upload");
    assert.equal(save.disabled, false);
    assert.equal(dock.saveOutfitBackdrop === null, succeeds);
    dock._closeSaveOutfitModal();
  }
});

await test("image deletion uses its own result during concurrent mutations", async () => {
  for (const succeeds of [false, true]) {
    const forgotten = [];
    const api = {
      _missingItemImageIds: new Set(["item-a"]),
      forgetImage: (url) => forgotten.push(url),
      itemImageUrl: (_chatId, _ownerId, id) => `item:${id}`,
    };
    vm.runInContext(stateSource, vm.createContext({ QM: api }));
    api.state.chatId = "chat-a";
    api.deleteItemImage = () => (succeeds ? Promise.resolve({}) : Promise.reject(new Error("Delete failed")));
    await Promise.all([
      api.state.deleteItemImage("item-a"),
      api.state._mutate(succeeds ? Promise.reject(new Error("Other request failed")) : Promise.resolve({})),
    ]);
    // Another name match may show once the file is gone, so a successful
    // delete re-checks the item instead of marking it as having no image.
    assert.equal(api._missingItemImageIds.has("item-a"), !succeeds);
    assert.deepEqual(
      forgotten,
      succeeds ? ["item:item-a"] : [],
      "drops the cached image only after a successful delete",
    );
  }
});

await test("a failed mutation cannot overwrite another chat's error", async () => {
  const api = {};
  vm.runInContext(stateSource, vm.createContext({ QM: api }));
  api.state.chatId = "chat-a";
  let fail;
  const request = new Promise((_resolve, reject) => {
    fail = reject;
  });
  const pending = api.state._mutate(request);
  api.state.chatId = "chat-b";
  api.state.error = "Current chat error";
  fail(new Error("Old chat error"));
  await pending;
  assert.equal(api.state.error, "Current chat error");
});

await test("returning to a chat does not accept a mutation from its previous visit", async () => {
  for (const fails of [false, true]) {
    const api = {};
    vm.runInContext(stateSource, vm.createContext({ QM: api }));
    const reads = [];
    api.listItems = () => new Promise((resolve) => reads.push(resolve));
    api.state.setChat("chat-a");
    let settle;
    const pending = api.state._mutate(
      new Promise((resolve, reject) => {
        settle = () => (fails ? reject(new Error("Previous visit")) : resolve({ items: [{ id: "old" }] }));
      }),
    );
    api.state.setChat("chat-b");
    api.state.setChat("chat-a");
    const currentRead = api.state._reload();
    const currentReload = api.state._reloadToken;
    settle();
    assert.equal(await pending, undefined);
    assert.equal(api.state.items, null);
    assert.equal(api.state.error, null);
    assert.equal(api.state._reloadToken, currentReload, "keeps the current visit's reload valid");
    reads.at(-1)({ items: [{ id: "current" }], outfits: [] });
    await currentRead;
    assert.equal(api.state.items[0].id, "current");
  }
});

await test("a pending-change answer applies only to the chat visit that sent it", async () => {
  const answers = {
    applied: { ok: true, status: 200, body: { items: [{ id: "old" }], pendingHiddenChanges: [] } },
    stale: { ok: false, status: 409, body: { stale: true, before: {}, current: {}, after: {} } },
    gone: { ok: false, status: 409, body: { gone: true } },
    failed: { ok: false, status: 500, body: { error: "Previous visit" } },
  };
  for (const [kind, answer] of Object.entries(answers)) {
    for (const change of ["none", "away", "return"]) {
      const api = {};
      vm.runInContext(stateSource, vm.createContext({ QM: api }));
      const reads = [];
      api.listItems = () => new Promise((resolve) => reads.push(resolve));
      api.state.setChat("chat-a");
      let settle;
      api.resolvePending = () => new Promise((resolve) => (settle = () => resolve(answer)));
      const pending = api.state.resolvePending("p1", { decision: "accept" });
      if (change !== "none") api.state.setChat("chat-b");
      if (change === "return") api.state.setChat("chat-a");
      const currentReload = api.state._reloadToken;
      const pendingBefore = api.state.pendingHiddenChanges;
      settle();
      const result = await pending;
      const label = `${kind}/${change}`;
      if (change === "none") {
        if (kind === "applied") assert.equal(api.state.items[0].id, "old", `${label}: applies its answer`);
        if (kind === "stale") assert.equal(result.stale, true, `${label}: reports stale`);
        if (kind === "gone") assert.equal(result.gone, true, `${label}: reports gone`);
        if (kind === "failed") assert.equal(api.state.error, "Previous visit", `${label}: shows its error`);
        continue;
      }
      assert.deepEqual({ ...result }, {}, `${label}: the old card gets nothing to review`);
      assert.equal(api.state.items, null, `${label}: leaves the current chat's items`);
      assert.equal(api.state.pendingHiddenChanges, pendingBefore, `${label}: leaves its pending changes`);
      assert.equal(api.state.error, null, `${label}: leaves its error`);
      assert.equal(api.state._reloadToken, currentReload, `${label}: keeps the current chat's reload valid`);
    }
  }
});

await test("closing the active chat clears the panel's old error", async () => {
  const api = { state: { chatId: null } };
  vm.runInContext(
    await readFile(new URL("../packages/quartermaster/src/15-panel.js", import.meta.url), "utf8"),
    vm.createContext({ QM: api, document: { createElement: element } }),
  );
  for (const key of ["equippedContent", "outfitsContent", "inventoryContent", "errorNode"]) api.panel[key] = element();
  api.panel.errorNode.style.display = "";
  api.panel._updateContent();
  assert.equal(api.panel.errorNode.style.display, "none");
});

await test("detached elements wait for connection before changing shared state or mounting", async () => {
  const chats = [];
  const registry = new Map();
  let mounts = 0;
  let unmounts = 0;
  const api = {
    state: { setChat: (chatId) => chats.push(chatId) },
    panel: {
      mount(container) {
        this.container = container;
        mounts++;
      },
      unmount() {
        this.container = null;
        unmounts++;
      },
    },
  };
  class HostElement {
    isConnected = false;
    getAttribute() {
      return "tracker";
    }
    addEventListener() {}
    removeEventListener() {}
  }
  vm.runInContext(
    await readFile(new URL("../packages/quartermaster/src/90-element.js", import.meta.url), "utf8"),
    vm.createContext({
      QM: api,
      HTMLElement: HostElement,
      customElements: {
        get: (name) => registry.get(name),
        define: (name, value) => registry.set(name, value),
      },
    }),
  );
  const Component = registry.get("marinara-capability-quartermaster");
  const component = new Component();
  component.capabilityProps = { chatId: "stale-chat" };
  component.attributeChangedCallback("view", null, "tracker");
  component.capabilityProps = { chatId: "chat-a" };
  assert.deepEqual(chats, []);
  assert.equal(mounts, 0);
  component.isConnected = true;
  component.connectedCallback();
  assert.deepEqual(chats, ["chat-a"]);
  assert.equal(mounts, 1);
  component.isConnected = false;
  component.disconnectedCallback();
  component.capabilityProps = { chatId: "chat-b" };
  assert.deepEqual(chats, ["chat-a"]);
  assert.equal(unmounts, 1);
});

const apiSource = await readFile(new URL("../packages/quartermaster/src/00-api.js", import.meta.url), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const ok = { ok: true, status: 200, body: {} };
function loadApi({ secret = null, storageThrows = false, respond = () => ok } = {}) {
  const calls = [];
  const created = [];
  const revoked = [];
  const timers = [];
  const storage = { secret };
  const context = vm.createContext({
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error("blocked");
        return key === "marinara_admin_secret" ? storage.secret : null;
      },
    },
    fetch: (url, init = {}) => {
      calls.push({ url, init });
      return Promise.resolve(respond(url)).then((result) => ({
        ok: result.ok,
        status: result.status,
        json: async () => result.body,
        blob: async () => ({ blob: url }),
      }));
    },
    URL: {
      createObjectURL: (blob) => {
        created.push(blob.blob);
        return `blob:${created.length}`;
      },
      revokeObjectURL: (objectUrl) => revoked.push(objectUrl),
    },
    setTimeout: (callback) => timers.push(callback),
    Event,
  });
  vm.runInContext(apiSource, context);
  const runTimers = () => timers.splice(0).forEach((callback) => callback());
  return { QM: vm.runInContext("QM", context), calls, created, revoked, storage, runTimers };
}
function imageElement() {
  const listeners = {};
  return {
    src: "",
    errors: [],
    addEventListener(name, handler) {
      (listeners[name] ??= []).push(handler);
    },
    dispatchEvent(event) {
      if (event.type === "error") this.errors.push(event.qmRetryable);
      for (const handler of listeners[event.type] ?? []) handler(event);
    },
  };
}
// Responses held until released, by URL, so tests control their order.
function heldResponses() {
  const waiting = [];
  return {
    respond: (url) => new Promise((resolve) => waiting.push({ url, resolve })),
    release(url, result = ok) {
      const index = waiting.findIndex((entry) => entry.url === url);
      waiting.splice(index, 1)[0].resolve(result);
    },
  };
}
const itemUrl = "/api/quartermaster/inventory/chat-a/persona/items/item-a/image";
const otherUrl = "/api/quartermaster/inventory/chat-a/persona/items/item-b/image";
const portraitUrl = "/api/quartermaster/inventory/chat-a/persona/outfits/outfit-a/portrait";

await test("package requests send the saved Admin Secret and the CSRF marker", async () => {
  const withSecret = loadApi({ secret: " s3cret " });
  await withSecret.QM.listItems("chat-a", "persona");
  await withSecret.QM.addItem("chat-a", "persona", { name: "Sword" });
  const [read, write] = withSecret.calls;
  assert.equal(read.init.headers["X-Admin-Secret"], "s3cret");
  assert.equal(read.init.headers["x-marinara-csrf"], undefined);
  assert.equal(read.init.headers["Content-Type"], undefined);
  assert.equal(write.init.headers["X-Admin-Secret"], "s3cret");
  assert.equal(write.init.headers["x-marinara-csrf"], "1");
  assert.equal(write.init.headers["Content-Type"], "application/json");

  for (const options of [{ secret: null }, { storageThrows: true }]) {
    const withoutSecret = loadApi(options);
    await withoutSecret.QM.listItems("chat-a", "persona");
    assert.equal(withoutSecret.calls[0].init.headers["X-Admin-Secret"], undefined);
  }
});

await test("settling a pending change answers stale and deleted items without throwing", async () => {
  const answers = [
    { ok: true, status: 200, body: { items: [] } },
    { ok: false, status: 409, body: { stale: true, current: {} } },
    { ok: false, status: 409, body: { error: "This item no longer exists", gone: true } },
    { ok: false, status: 400, body: { error: "decision must be accept or keep" } },
  ];
  const api = loadApi({ secret: "s", respond: () => answers.shift() });
  const settle = () => api.QM.resolvePending("chat-a", "persona", "p 1", { decision: "accept" });
  const plain = (value) => JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(await settle()), { ok: true, status: 200, body: { items: [] } });
  assert.deepEqual(plain(await settle()), { ok: false, status: 409, body: { stale: true, current: {} } });
  assert.equal((await settle()).body.gone, true);
  await assert.rejects(settle(), /^Error: decision must be accept or keep$/);
  const [first] = api.calls;
  assert.match(first.url, /\/pending\/p%201\/resolve$/);
  assert.equal(first.init.headers["X-Admin-Secret"], "s");
  assert.equal(first.init.headers["x-marinara-csrf"], "1");
  assert.equal(first.init.headers["Content-Type"], "application/json");
  assert.equal(first.init.body, JSON.stringify({ decision: "accept" }));
});

await test("a refused Admin Secret explains how to fix it on this device", async () => {
  const refused = () => ({ ok: false, status: 403, body: { error: "Invalid or missing X-Admin-Secret header" } });
  await assert.rejects(
    loadApi({ secret: "wrong", respond: refused }).QM.listItems("chat-a", "persona"),
    /does not match/,
  );
  await assert.rejects(loadApi({ respond: refused }).QM.listItems("chat-a", "persona"), /has no Admin Secret/);
  const missing = () => ({ ok: false, status: 404, body: { error: "Item not found" } });
  await assert.rejects(
    loadApi({ secret: "s", respond: missing }).QM.listItems("chat-a", "persona"),
    /^Error: Item not found$/,
  );
});

await test("our images load through the cache, with the Admin Secret when saved, and say whether a failure is worth retrying", async () => {
  // Without a secret too: only fetch can tell a real "no image" (404) from a
  // dropped connection, which a plain <img src> reported the same way (#1697).
  const plain = loadApi();
  const plainImg = imageElement();
  plain.QM.setImageSrc(plainImg, itemUrl);
  await flush();
  assert.equal(plain.calls.length, 1);
  assert.equal(plain.calls[0].init.headers["X-Admin-Secret"], undefined);
  assert.equal(plainImg.src, "blob:1", "no saved secret: loads through the cache too");

  const loaded = loadApi({ secret: "s3cret" });
  const loadedImg = imageElement();
  loaded.QM.setImageSrc(loadedImg, itemUrl);
  await flush();
  assert.equal(loaded.calls[0].init.headers["X-Admin-Secret"], "s3cret");
  assert.equal(loaded.calls[0].init.cache, "no-store");
  assert.equal(loadedImg.src, "blob:1");

  const engineImg = imageElement();
  loaded.QM.setImageSrc(engineImg, "/api/avatars/persona.png");
  assert.equal(engineImg.src, "/api/avatars/persona.png", "Engine URLs keep a plain src");

  const cases = [
    [() => ({ ok: false, status: 404, body: {} }), false],
    [() => ({ ok: false, status: 403, body: {} }), true],
    [() => ({ ok: false, status: 500, body: {} }), true],
    [() => Promise.reject(new Error("offline")), true],
  ];
  for (const secret of ["s3cret", null]) {
    for (const [respond, retryable] of cases) {
      const failing = loadApi({ secret, respond });
      const img = imageElement();
      failing.QM.setImageSrc(img, itemUrl);
      await flush();
      assert.equal(img.src, "");
      assert.deepEqual(img.errors, [retryable], `secret ${secret}: only a 404 is a real "no image"`);
    }
  }

  // Saving a secret after a refused load retries it, even though no secret was
  // saved when the cache started.
  let refuse = true;
  const later = loadApi({ respond: () => (refuse ? { ok: false, status: 403, body: {} } : ok) });
  const laterImg = imageElement();
  later.QM.setImageSrc(laterImg, itemUrl);
  await flush();
  assert.deepEqual(laterImg.errors, [true]);
  refuse = false;
  later.storage.secret = "s3cret";
  const retriedImg = imageElement();
  later.QM.setImageSrc(retriedImg, itemUrl);
  await flush();
  assert.equal(later.calls.length, 2, "a newly saved secret retries the refused image");
  assert.equal(retriedImg.src, "blob:1");
});

await test("images are fetched once and shared by every element and repaint", async () => {
  const held = heldResponses();
  const api = loadApi({ secret: "s3cret", respond: held.respond });
  const first = imageElement();
  const second = imageElement();
  api.QM.setImageSrc(first, itemUrl);
  api.QM.setImageSrc(second, itemUrl);
  api.QM.setImageSrc(first, itemUrl);
  assert.equal(api.calls.length, 1, "concurrent loads across elements share one fetch");
  held.release(itemUrl);
  await flush();
  assert.equal(first.src, "blob:1");
  assert.equal(second.src, "blob:1");
  const rebuilt = imageElement();
  api.QM.setImageSrc(rebuilt, itemUrl);
  await flush();
  assert.equal(rebuilt.src, "blob:1", "a rebuilt row reuses the cached image");
  assert.equal(api.calls.length, 1);

  const failing = loadApi({ secret: "s3cret", respond: () => ({ ok: false, status: 500, body: {} }) });
  failing.QM.setImageSrc(imageElement(), itemUrl);
  await flush();
  const repainted = imageElement();
  failing.QM.setImageSrc(repainted, itemUrl);
  await flush();
  assert.equal(failing.calls.length, 1, "a failure is not refetched on every repaint");
  assert.deepEqual(repainted.errors, [true]);
});

await test("only an element's latest request applies, and forgotten images are never cached", async () => {
  const held = heldResponses();
  const api = loadApi({ secret: "s3cret", respond: held.respond });
  const img = imageElement();
  api.QM.setImageSrc(img, itemUrl);
  api.QM.setImageSrc(img, otherUrl);
  held.release(otherUrl);
  await flush();
  assert.equal(img.src, "blob:1");
  held.release(itemUrl);
  await flush();
  assert.equal(img.src, "blob:1", "an old response after a replacement completes is ignored");
  assert.deepEqual(img.errors, []);

  api.QM.setImageSrc(img, itemUrl);
  await flush();
  assert.equal(img.src, "blob:2", "A -> B -> A shows A");

  const portrait = imageElement();
  api.QM.setImageSrc(portrait, portraitUrl);
  api.QM.forgetImage(portraitUrl);
  held.release(portraitUrl);
  await flush();
  assert.equal(api.created.length, 2, "a response forgotten while loading creates no object URL");
  assert.equal(portrait.src, "");
  assert.deepEqual(portrait.errors, []);
  api.QM.setImageSrc(portrait, portraitUrl);
  assert.equal(api.calls.length, 4, "the next render fetches the replacement");

  api.QM.forgetImage(itemUrl);
  assert.deepEqual(api.revoked, [], "revocation waits for elements still loading the old URL");
  api.runTimers();
  assert.deepEqual(api.revoked, ["blob:2"]);
});

await test("reopening the dock retries real failures, and a new Admin Secret retries everything", async () => {
  const api = loadApi({
    secret: "s3cret",
    respond: (url) => (url === itemUrl ? { ok: false, status: 404, body: {} } : { ok: false, status: 500, body: {} }),
  });
  api.QM.setImageSrc(imageElement(), itemUrl);
  api.QM.setImageSrc(imageElement(), otherUrl);
  await flush();
  api.QM.retryFailedImages();
  api.QM.setImageSrc(imageElement(), itemUrl);
  api.QM.setImageSrc(imageElement(), otherUrl);
  assert.deepEqual(
    api.calls.slice(2).map((call) => call.url),
    [otherUrl],
    "only the non-404 failure is retried on reopen",
  );

  api.QM._missingItemImageIds.add("item-a");
  api.storage.secret = "new-secret";
  api.QM.setImageSrc(imageElement(), itemUrl);
  assert.equal(api.QM._missingItemImageIds.size, 0, "remembered missing items get a fresh try");
  assert.equal(api.calls.at(-1).url, itemUrl);
  assert.equal(api.calls.at(-1).init.headers["X-Admin-Secret"], "new-secret");
});

const serverSource = await readFile(new URL("../packages/quartermaster/server.mjs", import.meta.url), "utf8");
const agentDefinitions = JSON.parse(
  await readFile(new URL("../packages/quartermaster/agents.json", import.meta.url), "utf8"),
);
const slotContext = vm.createContext({ QM: {} });
vm.runInContext(stateSource, slotContext);
vm.runInContext(
  await readFile(new URL("../packages/quartermaster/src/04-icons.js", import.meta.url), "utf8"),
  slotContext,
);
const slotValue = (name) => vm.runInContext(name, slotContext);
const clientSlots = [...slotValue("QM_EQUIP_SLOTS")];

await test("server, client and tracker prompt list the same slots, worn layers outer to inner", () => {
  const serverSlots = [...serverSource.match(/const EQUIP_SLOTS = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
  const promptSlots = agentDefinitions[0].defaultPromptTemplate
    .match(/Valid slots \(use these exact ids only\): ([^.]+)\./)[1]
    .split(", ");
  assert.deepEqual(clientSlots, serverSlots);
  assert.deepEqual(promptSlots, serverSlots);
  const before = (...slots) =>
    slots.slice(1).forEach((slot, index) => {
      assert.ok(serverSlots.indexOf(slots[index]) < serverSlots.indexOf(slot), `${slots[index]} before ${slot}`);
    });
  before("armor_torso", "outerwear_torso", "midlayer_torso", "clothing_torso", "underwear_top");
  before("armor_legs", "outerwear_legs", "midlayer_legs", "clothing_legs", "underwear_bottom");
  before("feet", "socks");
  assert.deepEqual(serverSlots.slice(-3), ["extra_wearable_1", "extra_wearable_2", "extra_wearable_3"]);
});

await test("every slot is on the portrait ring once, with labels, an icon, and a distinct search label", () => {
  const ringSlots = [
    ...slotValue("QM_OVERLAY_TOP_SLOTS"),
    ...slotValue("QM_OVERLAY_SLOT_PAIRS").flat(),
    ...Object.values(slotValue("QM_OVERLAY_SLOT_LAYERS")).flat(),
    ...slotValue("QM_OVERLAY_BOTTOM_SLOTS"),
    ...slotValue("QM_OVERLAY_EXTRA_SLOTS"),
  ];
  assert.deepEqual([...ringSlots].sort(), [...clientSlots].sort());
  const labels = slotValue("QM_SLOT_LABELS");
  for (const slot of clientSlots) {
    assert.ok(labels[slot], `${slot} label`);
    assert.ok(slotValue("QM_OVERLAY_SLOT_LABELS")[slot], `${slot} ring label`);
    assert.ok(slotValue("QM_OVERLAY_SLOT_LABEL_LINES")[slot]?.length, `${slot} ring label lines`);
    assert.ok(slotValue("QM_SLOT_ICON_PATHS")[slot], `${slot} drawn icon`);
  }
  // The Bag's slot search matches a label by substring, so no label may contain another.
  for (const a of clientSlots) {
    for (const b of clientSlots) {
      if (a !== b) assert.ok(!labels[a].toLowerCase().includes(labels[b].toLowerCase()), `${a} vs ${b}`);
    }
  }
});

await test("clothing layers stack as cards: outermost worn in front, arrows and spines switch it", () => {
  const saved = {
    build: dock._buildOverlaySlotBox,
    paint: dock._paint,
    items: QM.state.items,
    front: dock._clothingFront,
    move: dock._clothingFrontMove,
    selected: dock.selectedSlot,
    mode: dock.bagSearchMode,
    query: dock.bagSearchQuery,
    refs: dock.equippedSlotBoxRefs,
    createElement: context.document.createElement,
  };
  // In the real bundle 05-state.js shares the dock's scope; this context loads only the dock files.
  for (const name of ["QM_OVERLAY_SLOT_LAYERS", "QM_OVERLAY_SLOT_LABELS", "QM_OVERLAY_SLOT_LABEL_LINES"]) {
    context[name] = slotValue(name);
  }
  const node = () => ({
    style: {},
    children: [],
    listeners: {},
    animations: [],
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(child) {
      this.children.push(child);
    },
    setAttribute() {},
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    },
    animate(frames) {
      this.animations.push(frames);
    },
  });
  let paints = 0;
  dock._buildOverlaySlotBox = (slot) => Object.assign(node(), { slot });
  dock._paint = () => paints++;
  context.document.createElement = node;
  const labels = slotValue("QM_OVERLAY_SLOT_LABELS");
  const layerOf = (element) =>
    element.slot
      ? `card:${element.slot}`
      : `spine:${Object.keys(labels).find((slot) => element.title.startsWith(`${labels[slot]}:`))}`;
  const stack = (innerSlot, side) => [...dock._buildClothingLayerStack(innerSlot, side).children];
  const wear = (...slots) => {
    QM.state.items = slots.map((slot, index) => ({ id: `item-${index}`, name: slot, location: `equipped:${slot}` }));
  };
  try {
    dock._clothingFront = {};
    dock._clothingFrontMove = null;
    wear();
    assert.deepEqual(stack("clothing_legs", "right").map(layerOf), [
      "card:clothing_legs",
      "spine:midlayer_legs",
      "spine:outerwear_legs",
    ]);
    assert.deepEqual(stack("clothing_torso", "left").map(layerOf), [
      "spine:outerwear_torso",
      "spine:midlayer_torso",
      "card:clothing_torso",
    ]);

    wear("clothing_torso", "midlayer_torso");
    const torso = stack("clothing_torso", "left");
    assert.deepEqual(
      torso.map(layerOf),
      ["spine:outerwear_torso", "card:midlayer_torso", "spine:clothing_torso"],
      "the outermost worn layer is in front",
    );
    assert.match(torso[2].style.border, /--primary/, "a worn back layer keeps the equipped outline");
    assert.match(torso[0].style.border, /rgba/, "an empty back layer keeps the plain outline");
    assert.deepEqual(
      torso[1].children.map((arrow) => arrow.title),
      ["Show Outer Torso Clothing", "Show Inner Torso Clothing"],
    );

    wear();
    const [legsCard] = stack("clothing_legs", "right");
    assert.deepEqual(
      legsCard.children.map((arrow) => arrow.title),
      ["Show Mid Legs Clothing"],
      "arrows only toward existing layers",
    );
    let stopped = false;
    legsCard.children[0].listeners.click({ stopPropagation: () => (stopped = true) });
    assert.ok(stopped, "an arrow click does not select the card under it");
    assert.equal(paints, 1);
    const switched = stack("clothing_legs", "right");
    assert.deepEqual(switched.map(layerOf), ["spine:clothing_legs", "card:midlayer_legs", "spine:outerwear_legs"]);
    assert.equal(switched[1].animations.length, 1, "the new front card slides in");
    assert.equal(stack("clothing_legs", "right")[1].animations.length, 0, "only once");

    dock.selectedSlot = "midlayer_legs";
    dock.bagSearchMode = "slot";
    dock.bagSearchQuery = "Mid Clothing (Legs)";
    switched[2].listeners.click();
    assert.equal(dock._clothingFrontSlot("clothing_legs"), "outerwear_legs");
    assert.equal(dock.selectedSlot, null, "a selection in the stack is cleared");
    assert.equal(dock.bagSearchMode, "name");
    assert.equal(dock.bagSearchQuery, "");
    dock.selectedSlot = "head";
    dock._showClothingLayer("clothing_legs", "clothing_legs");
    assert.equal(dock.selectedSlot, "head", "a selection outside the stack stays");

    dock.equippedSlotBoxRefs = new Map();
    const entry = dock._buildSideEntry("clothing_torso", "left");
    const ref = dock.equippedSlotBoxRefs.get("clothing_torso");
    assert.equal(ref.element, entry, "the connector anchors to the whole stack");
    assert.deepEqual([...ref.slots], ["clothing_torso", "midlayer_torso", "outerwear_torso"]);
    dock._buildSideEntry("armor_torso", "left");
    assert.deepEqual([...dock.equippedSlotBoxRefs.get("armor_torso").slots], ["armor_torso"]);
  } finally {
    dock._buildOverlaySlotBox = saved.build;
    dock._paint = saved.paint;
    QM.state.items = saved.items;
    dock._clothingFront = saved.front;
    dock._clothingFrontMove = saved.move;
    dock.selectedSlot = saved.selected;
    dock.bagSearchMode = saved.mode;
    dock.bagSearchQuery = saved.query;
    dock.equippedSlotBoxRefs = saved.refs;
    context.document.createElement = saved.createElement;
  }
});

await test("every slot has bundled icon art that exists", async () => {
  const iconFiles = Object.fromEntries(
    [...serverSource.match(/const SLOT_ICON_FILES = \{([\s\S]*?)\};/)[1].matchAll(/(\w+): "([^"]+)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  assert.deepEqual(Object.keys(iconFiles).sort(), [...clientSlots].sort());
  const bundled = new Set(await readdir(new URL("../packages/quartermaster/icons/", import.meta.url)));
  for (const [slot, file] of Object.entries(iconFiles)) {
    assert.ok(bundled.has(`${file}.webp`), `${slot} -> icons/${file}.webp`);
  }
});

// ── server.mjs through its real entry point ─────────────────────────────────
// activate() against a stand-in Engine: in-memory documents, chats and one
// persona, with the routes, agent service and narrator feed it registers
// captured so tests drive exactly what the Engine would.
async function startServer({ proposal = { items: [], outfits: [] } } = {}) {
  const { activate } = await import(new URL("../packages/quartermaster/server.mjs", import.meta.url));
  const docs = new Map();
  const chats = new Map();
  const chatFor = (id) => {
    if (!chats.has(id)) chats.set(id, { id, personaId: "persona-1", metadata: {}, connectionId: null });
    return chats.get(id);
  };
  const handlers = new Map();
  const llmCalls = [];
  let agent;
  let narrator;
  const persistence = {
    documents: {
      async getById(_packageId, id) {
        return docs.has(id) ? structuredClone(docs.get(id)) : null;
      },
      async create(doc) {
        docs.set(doc.id, { ...structuredClone(doc), revision: 1 });
      },
      async update(doc) {
        const current = docs.get(doc.id);
        docs.set(doc.id, { ...current, ...structuredClone(doc), revision: current.revision + 1 });
      },
    },
    async getChat(id) {
      return chatFor(id);
    },
    async withChatLock(_id, fn) {
      return fn();
    },
    async updateChatMetadata({ chatId, metadata }) {
      chatFor(chatId).metadata = metadata;
    },
  };
  const api = {
    runtime: {
      persistence,
      resources: {
        async listPersonas() {
          return [{ data: { name: "Aria", appearance: "", avatarPath: null } }];
        },
        async updatePersona() {},
      },
      logger: { warn() {}, info() {}, debug() {}, error() {}, debugOverride() {} },
      isDebugAgentsEnabled: () => false,
      getAgentConfig: async () => null,
      json: { parseJsonish: (text) => JSON.parse(text) },
      languageModels: {
        resolveForRequest: async () => ({
          chatComplete: async (messages) => {
            llmCalls.push(messages);
            return { content: JSON.stringify(proposal), finishReason: "stop" };
          },
        }),
      },
    },
    registerService(_key, service) {
      agent = service;
      return () => {};
    },
    registerPromptContext(fn) {
      narrator = fn;
      return () => {};
    },
    async registerPrivilegedRoutes(register) {
      const routes = {};
      for (const method of ["get", "post", "patch", "put", "delete"]) {
        routes[method] = (path, handler) => handlers.set(`${method.toUpperCase()} ${path}`, handler);
      }
      await register(routes);
      return () => {};
    },
  };
  const dataDir = await mkdtemp(join(tmpdir(), "qm-server-"));
  await activate({ api, dataDir });

  const call = async (method, path, { params = {}, body } = {}) => {
    const reply = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      send(payload) {
        return { statusCode: this.statusCode, body: payload };
      },
      header() {
        return this;
      },
      type() {
        return this;
      },
    };
    const result = await handlers.get(`${method} ${path}`)({ params, body }, reply);
    return result && "statusCode" in result && "body" in result ? result : { statusCode: 200, body: result };
  };
  const inv = (chatId) => ({ chatId, ownerId: "persona" });
  const image = (chatId, itemId) => ({ ...inv(chatId), itemId });
  const server = {
    llmCalls,
    itemsDir: join(dataDir, "gallery", "quartermaster", "items"),
    dataDir,
    uploadImage: (chatId, itemId, bytes, source) =>
      call("POST", "/inventory/:chatId/:ownerId/items/:itemId/image", {
        params: image(chatId, itemId),
        body: { imageDataUrl: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`, source },
      }),
    image: async (chatId, itemId) => {
      const result = await call("GET", "/inventory/:chatId/:ownerId/items/:itemId/image", {
        params: image(chatId, itemId),
      });
      return result.statusCode === 200 ? result.body.toString() : result.statusCode;
    },
    imageInfo: async (chatId, itemId) =>
      (await call("GET", "/inventory/:chatId/:ownerId/items/:itemId/image/info", { params: image(chatId, itemId) }))
        .body,
    deleteImage: (chatId, itemId) =>
      call("DELETE", "/inventory/:chatId/:ownerId/items/:itemId/image", { params: image(chatId, itemId) }),
    get: async (chatId) => (await call("GET", "/inventory/:chatId/:ownerId", { params: inv(chatId) })).body,
    addItem: (chatId, body) => call("POST", "/inventory/:chatId/:ownerId/items", { params: inv(chatId), body }),
    patchItem: (chatId, itemId, body) =>
      call("PATCH", "/inventory/:chatId/:ownerId/items/:itemId", { params: { ...inv(chatId), itemId }, body }),
    deleteItem: (chatId, itemId) =>
      call("DELETE", "/inventory/:chatId/:ownerId/items/:itemId", { params: { ...inv(chatId), itemId } }),
    settings: (chatId, body) => call("PATCH", "/inventory/:chatId/:ownerId/settings", { params: inv(chatId), body }),
    saveOutfit: (chatId, body) => call("POST", "/inventory/:chatId/:ownerId/outfits", { params: inv(chatId), body }),
    patchOutfit: (chatId, outfitId, body) =>
      call("PATCH", "/inventory/:chatId/:ownerId/outfits/:outfitId", { params: { ...inv(chatId), outfitId }, body }),
    equipOutfit: (chatId, outfitId) =>
      call("POST", "/inventory/:chatId/:ownerId/outfits/:outfitId/equip", { params: { ...inv(chatId), outfitId } }),
    portraitPrompt: (chatId, outfitId) =>
      call("POST", "/inventory/:chatId/:ownerId/outfits/:outfitId/portrait/prompt-preview", {
        params: { ...inv(chatId), outfitId },
      }),
    unequipAll: (chatId) => call("POST", "/inventory/:chatId/:ownerId/unequip-all", { params: inv(chatId) }),
    resolvePending: (chatId, pendingId, body) =>
      call("POST", "/inventory/:chatId/:ownerId/pending/:pendingId/resolve", {
        params: { ...inv(chatId), pendingId },
        body,
      }),
    markSeen: (chatId, ids) =>
      call("POST", "/inventory/:chatId/:ownerId/pending/seen", { params: inv(chatId), body: { ids } }),
    revert: (chatId, itemId) =>
      call("POST", "/inventory/:chatId/:ownerId/revert-item", { params: inv(chatId), body: { itemId } }),
    generateWardrobe: (chatId) =>
      call("POST", "/inventory/:chatId/:ownerId/wardrobe/generate", {
        params: inv(chatId),
        body: { direction: "office wear", includePersonaContext: false },
      }),
    confirmWardrobe: (chatId, body) =>
      call("POST", "/inventory/:chatId/:ownerId/wardrobe/confirm", { params: inv(chatId), body }),
    exportSheet: async (chatId) =>
      (await call("GET", "/inventory/:chatId/:ownerId/export", { params: inv(chatId) })).body,
    importSheet: (chatId, body) => call("POST", "/inventory/:chatId/:ownerId/import", { params: inv(chatId), body }),
    agentContext: (chatId) => agent.prepareContext({ context: { chatId, chatMode: "roleplay" } }),
    agentTurn: (chatId, data) =>
      agent.finalizeResult({
        context: { chatId, chatMode: "roleplay" },
        result: { success: true, data: { addItem: [], updateItem: [], removeItem: [], equipOutfit: null, ...data } },
      }),
    narratorText: async (chatId) =>
      (
        await narrator({
          chatId,
          mode: "roleplay",
          chatMeta: { enableAgents: true, activeAgentIds: ["quartermaster"] },
        })
      )?.text ?? "",
    appearance: (chatId) => chatFor(chatId).metadata.macroVariables?.quartermaster_appearance_persona ?? "",
  };
  server.item = async (chatId, name) => (await server.get(chatId)).items.find((item) => item.name === name);
  server.seed = async (chatId, items) => {
    for (const item of items) await server.addItem(chatId, item);
    return Object.fromEntries((await server.get(chatId)).items.map((item) => [item.name, item]));
  };
  return server;
}

await test("hidden items stay out of what the model sees, except while worn", async () => {
  const server = await startServer();
  const items = await server.seed("chat-1", [
    { name: "Red Amulet", description: "a secret", defaultSlot: "neck" },
    { name: "Sword", description: "steel" },
    { name: "Hat", location: "equipped:head", defaultSlot: "head" },
  ]);
  await server.patchItem("chat-1", items["Red Amulet"].id, { hidden: true });
  await server.saveOutfit("chat-1", { name: "Secret Look", description: "x" });
  const [secretLook] = (await server.get("chat-1")).outfits;
  await server.patchOutfit("chat-1", secretLook.id, { hidden: true });

  let context = await server.agentContext("chat-1");
  assert.match(context, /\[1\] Sword -- steel/);
  assert.match(context, /\[2\] Hat/);
  assert.doesNotMatch(context, /Red Amulet|Secret Look/);
  assert.doesNotMatch(await server.narratorText("chat-1"), /Red Amulet/);

  // Tags skip hidden items on both sides: [2] is still the hat.
  await server.agentTurn("chat-1", { updateItem: [{ target: 2, description: "a straw hat" }] });
  assert.equal((await server.item("chat-1", "Hat")).description, "a straw hat");
  assert.equal((await server.item("chat-1", "Red Amulet")).description, "a secret");

  // Wearing a hidden item shows it; taking it off hides it again.
  await server.settings("chat-1", { appearanceFeedMode: "equippedNames" });
  await server.patchItem("chat-1", items["Red Amulet"].id, { location: "equipped:neck" });
  assert.match(await server.agentContext("chat-1"), /Red Amulet/);
  assert.match(await server.narratorText("chat-1"), /Red Amulet/);
  assert.equal(server.appearance("chat-1"), "Hat, Red Amulet");
  await server.patchItem("chat-1", items["Red Amulet"].id, { location: "bag" });
  assert.doesNotMatch(await server.agentContext("chat-1"), /Red Amulet/);

  // Hiding a worn item takes it off.
  await server.patchItem("chat-1", items.Hat.id, { hidden: true });
  const hat = await server.item("chat-1", "Hat");
  assert.equal(hat.location, "bag");
  assert.equal(hat.hidden, true);
  assert.equal(server.appearance("chat-1"), "");
});

await test("without asking, the agent's changes to hidden items follow the access mode", async () => {
  const server = await startServer();
  const tryChange = async (mode) => {
    const chat = `access-${mode}`;
    const { "Red Amulet": amulet } = await server.seed(chat, [
      { name: "Red Amulet", description: "old", defaultSlot: "neck" },
    ]);
    await server.patchItem(chat, amulet.id, { hidden: true });
    await server.settings(chat, { askBeforeHiddenChanges: false, hiddenItemAccess: mode });
    await server.agentTurn(chat, {
      addItem: [{ name: "Red Amulet", description: "new", quantity: 2, location: "equipped:neck" }],
    });
    const after = await server.item(chat, "Red Amulet");
    const outcome = (await server.get(chat)).lastTrackerChange.hiddenOutcomes.map((entry) => entry.outcome);
    return [after.description, after.quantity, after.location, after.hidden, outcome.join()];
  };
  assert.deepEqual(await tryChange("userHidden"), ["old", 1, "bag", true, "skipped"]);
  assert.deepEqual(await tryChange("userShown"), ["old", 1, "equipped:neck", false, "shown"]);
  assert.deepEqual(await tryChange("agentHidden"), ["new", 2, "equipped:neck", true, "applied"]);
  assert.deepEqual(await tryChange("agentShown"), ["new", 2, "equipped:neck", false, "appliedShown"]);

  const items = (await server.get("access-userHidden")).items;
  assert.equal(items.length, 1, "no duplicate item is created for a hidden name");

  // A lone removal attempt (only possible while it's worn) is skipped and
  // doesn't show the item, even in "userShown".
  const { Locket: locket } = await server.seed("access-removal", [{ name: "Locket", defaultSlot: "neck" }]);
  await server.patchItem("access-removal", locket.id, { hidden: true });
  await server.patchItem("access-removal", locket.id, { location: "equipped:neck" });
  await server.settings("access-removal", { askBeforeHiddenChanges: false, hiddenItemAccess: "userShown" });
  await server.agentTurn("access-removal", { removeItem: [1] });
  const kept = await server.item("access-removal", "Locket");
  assert.deepEqual([Boolean(kept), kept.hidden], [true, true]);
  assert.equal((await server.get("access-removal")).lastTrackerChange.hiddenOutcomes[0].outcome, "skipped");
});

await test("a worn hidden item can be taken off by the agent, but not otherwise changed", async () => {
  const server = await startServer();
  const { Cloak: cloak } = await server.seed("chat-2", [{ name: "Cloak", description: "grey", defaultSlot: "back" }]);
  await server.patchItem("chat-2", cloak.id, { hidden: true });
  await server.patchItem("chat-2", cloak.id, { location: "equipped:back" });
  await server.settings("chat-2", { askBeforeHiddenChanges: false, hiddenItemAccess: "userHidden" });
  await server.agentTurn("chat-2", { updateItem: [{ target: 1, description: "torn" }] });
  assert.equal((await server.item("chat-2", "Cloak")).description, "grey");
  await server.agentTurn("chat-2", { updateItem: [{ target: 1, location: "bag" }] });
  const after = await server.item("chat-2", "Cloak");
  assert.equal(after.location, "bag");
  assert.equal(after.hidden, true);
  assert.doesNotMatch(await server.agentContext("chat-2"), /Cloak/);
});

await test("an outfit equips its hidden pieces, whoever equips it, and swapping it takes them off", async () => {
  const server = await startServer();
  const items = await server.seed("chat-3", [
    { name: "Reversible Jacket (Blue Out)", defaultSlot: "outerwear_torso", location: "equipped:outerwear_torso" },
    { name: "Shirt", defaultSlot: "clothing_torso", location: "equipped:clothing_torso" },
  ]);
  await server.saveOutfit("chat-3", { name: "Blue Look" });
  await server.patchItem("chat-3", items["Reversible Jacket (Blue Out)"].id, { hidden: true });
  await server.unequipAll("chat-3");
  await server.agentTurn("chat-3", { equipOutfit: "A" });
  const jacket = await server.item("chat-3", "Reversible Jacket (Blue Out)");
  assert.equal(jacket.location, "equipped:outerwear_torso");
  assert.equal(jacket.hidden, true, "still hidden underneath, just shown while worn");
  assert.match(await server.agentContext("chat-3"), /Reversible Jacket/);
});

await test("the description lock stops the agent on every path", async () => {
  const server = await startServer();
  const { Ring: ring } = await server.seed("chat-4", [
    { name: "Ring", description: "mine", defaultSlot: "extra_wearable_1" },
  ]);
  await server.patchItem("chat-4", ring.id, { descriptionLocked: true });
  await server.agentTurn("chat-4", { updateItem: [{ target: 1, description: "changed", quantity: 3 }] });
  await server.agentTurn("chat-4", { addItem: [{ name: "Ring", description: "changed again" }] });
  const after = await server.item("chat-4", "Ring");
  assert.equal(after.description, "mine");
  assert.equal(after.quantity, 3, "other fields still change");

  await server.patchItem("chat-4", ring.id, { hidden: true });
  await server.settings("chat-4", { askBeforeHiddenChanges: false, hiddenItemAccess: "agentHidden" });
  await server.agentTurn("chat-4", { addItem: [{ name: "Ring", description: "agent mode", location: "bag" }] });
  assert.equal((await server.item("chat-4", "Ring")).description, "mine");
});

await test("asking first holds the agent's change until the user settles it", async () => {
  const server = await startServer();
  const { Amulet: amulet } = await server.seed("chat-5", [{ name: "Amulet", description: "old", defaultSlot: "neck" }]);
  await server.patchItem("chat-5", amulet.id, { hidden: true, descriptionLocked: true });
  await server.agentTurn("chat-5", { addItem: [{ name: "Amulet", description: "first", location: "bag" }] });
  await server.agentTurn("chat-5", { addItem: [{ name: "Amulet", description: "second", location: "equipped:neck" }] });
  let state = await server.get("chat-5");
  assert.equal(state.items[0].description, "old", "nothing applies while it waits");
  assert.equal(state.pendingHiddenChanges.length, 1, "a newer change replaces the older one");
  const [pending] = state.pendingHiddenChanges;
  assert.deepEqual(
    [pending.after.description, pending.after.location, pending.seen, pending.descriptionLocked],
    ["second", "equipped:neck", false, true],
  );
  assert.equal(state.lastTrackerChange.hiddenOutcomes[0].outcome, "pending");

  await server.markSeen("chat-5", [pending.id]);
  assert.equal((await server.get("chat-5")).pendingHiddenChanges[0].seen, true);

  const accepted = await server.resolvePending("chat-5", pending.id, { decision: "accept", show: false });
  assert.equal(accepted.statusCode, 200);
  state = await server.get("chat-5");
  assert.deepEqual(
    [state.items[0].description, state.items[0].location, state.items[0].hidden, state.pendingHiddenChanges.length],
    ["second", "equipped:neck", true, 0],
    "accepting applies it, even over the lock",
  );
  assert.equal((await server.revert("chat-5", amulet.id)).statusCode, 200, "an accepted change can be reverted");
  assert.equal((await server.item("chat-5", "Amulet")).description, "old");

  // The item changed after the agent's change: accepting shows all three
  // versions first, then applies only what the agent changed on top of now.
  await server.agentTurn("chat-5", { addItem: [{ name: "Amulet", description: "third", location: "bag" }] });
  let pendingId = (await server.get("chat-5")).pendingHiddenChanges[0].id;
  await server.patchItem("chat-5", amulet.id, { quantity: 4 });
  const stale = await server.resolvePending("chat-5", pendingId, { decision: "accept" });
  assert.equal(stale.statusCode, 409, "nothing applies without seeing what changed");
  assert.deepEqual(
    [stale.body.stale, stale.body.before.quantity, stale.body.current.quantity, stale.body.after.description],
    [true, 1, 4, "third"],
  );
  await server.resolvePending("chat-5", pendingId, { decision: "accept", override: true });
  state = await server.get("chat-5");
  assert.deepEqual(
    [state.items[0].description, state.items[0].quantity, state.pendingHiddenChanges.length],
    ["third", 4, 0],
    "the agent's description lands; the user's newer quantity stays",
  );

  await server.agentTurn("chat-5", { addItem: [{ name: "Amulet", description: "fifth", location: "bag" }] });
  pendingId = (await server.get("chat-5")).pendingHiddenChanges[0].id;
  await server.patchItem("chat-5", amulet.id, { description: "edited meanwhile" });
  await server.resolvePending("chat-5", pendingId, { decision: "keep", show: true });
  state = await server.get("chat-5");
  assert.deepEqual([state.items[0].description, state.items[0].hidden], ["edited meanwhile", false]);

  await server.patchItem("chat-5", amulet.id, { hidden: true });
  await server.agentTurn("chat-5", { addItem: [{ name: "Amulet", description: "fourth", location: "bag" }] });
  const deleted = await server.deleteItem("chat-5", amulet.id);
  assert.equal(deleted.body.pendingHiddenChanges.length, 0, "the dock sees the cleared change at once");
  assert.equal((await server.get("chat-5")).pendingHiddenChanges.length, 0, "deleting the item clears its change");
});

await test("Build Wardrobe asks before using hidden items, and layers what it uses", async () => {
  const proposal = {
    items: [
      { name: "Black Tights", description: "sheer black tights", quantity: 1, defaultSlot: "clothing_legs" },
      { name: "Pencil Skirt", description: "a grey pencil skirt", quantity: 1, defaultSlot: "clothing_legs" },
    ],
    outfits: [{ name: "Office", description: "smart office wear", itemNames: ["Black Tights", "Pencil Skirt"] }],
  };
  const server = await startServer({ proposal });
  const setup = async (chat, { usesHidden = false } = {}) => {
    const { "Black Tights": tights } = await server.seed(chat, [
      { name: "Black Tights", description: "my old tights", defaultSlot: "clothing_legs" },
    ]);
    await server.patchItem(chat, tights.id, { hidden: true });
    if (usesHidden) await server.settings(chat, { wardrobeUsesHidden: true });
    return tights;
  };
  const officeSlots = async (chat) => {
    const office = (await server.get(chat)).outfits.find((outfit) => outfit.name === "Office");
    return Object.fromEntries(Object.entries(office.slots).map(([slot, piece]) => [slot, piece.name]));
  };

  const tights = await setup("wardrobe-1");
  const generated = await server.generateWardrobe("wardrobe-1");
  assert.doesNotMatch(JSON.stringify(server.llmCalls.at(-1)), /my old tights/, "hidden items aren't offered");
  assert.deepEqual(
    generated.body.hiddenMatches.map((match) => [match.itemId, match.proposed?.description]),
    [[tights.id, "sheer black tights"]],
  );
  let confirmed = await server.confirmWardrobe("wardrobe-1", { proposal });
  assert.deepEqual(await officeSlots("wardrobe-1"), { clothing_legs: "Pencil Skirt" }, "no choice means skip");
  assert.deepEqual(
    confirmed.body.summary.skipped.map((entry) => entry.reason),
    ["hidden"],
  );
  assert.deepEqual(
    [
      (await server.item("wardrobe-1", "Black Tights")).description,
      (await server.item("wardrobe-1", "Black Tights")).hidden,
    ],
    ["my old tights", true],
  );

  const tights2 = await setup("wardrobe-2", { usesHidden: true });
  await server.generateWardrobe("wardrobe-2");
  assert.match(JSON.stringify(server.llmCalls.at(-1)), /my old tights/, "offered when allowed");
  await server.confirmWardrobe("wardrobe-2", {
    proposal,
    hiddenChoices: { [tights2.id]: { action: "overwrite", show: true } },
  });
  assert.deepEqual(await officeSlots("wardrobe-2"), { clothing_legs: "Black Tights", midlayer_legs: "Pencil Skirt" });
  const overwritten = await server.item("wardrobe-2", "Black Tights");
  assert.deepEqual([overwritten.description, overwritten.hidden], ["sheer black tights", false]);

  const tights3 = await setup("wardrobe-3");
  await server.confirmWardrobe("wardrobe-3", { proposal, hiddenChoices: { [tights3.id]: { action: "keep" } } });
  const kept = await server.item("wardrobe-3", "Black Tights");
  assert.deepEqual([kept.description, kept.hidden], ["my old tights", true]);
  assert.deepEqual(await officeSlots("wardrobe-3"), { clothing_legs: "Black Tights", midlayer_legs: "Pencil Skirt" });

  const layered = async (chat, items, itemNames) => {
    const result = await server.confirmWardrobe(chat, {
      proposal: {
        items: items.map(([name, defaultSlot]) => ({ name, description: "", quantity: 1, defaultSlot })),
        outfits: [{ name: "Office", description: "x", itemNames }],
      },
    });
    return { slots: await officeSlots(chat), skipped: result.body.summary.skipped.map((entry) => entry.itemName) };
  };
  let look = await layered(
    "wardrobe-4",
    [
      ["Shirt", "clothing_torso"],
      ["Waistcoat", "clothing_torso"],
      ["Blazer", "clothing_torso"],
      ["Overcoat", "clothing_torso"],
    ],
    ["Shirt", "Waistcoat", "Blazer", "Overcoat"],
  );
  assert.deepEqual(look.slots, { clothing_torso: "Shirt", midlayer_torso: "Waistcoat", outerwear_torso: "Blazer" });
  assert.deepEqual(look.skipped, ["Overcoat"], "a fourth layer has nowhere to go");
  look = await layered(
    "wardrobe-5",
    [
      ["Shirt", "clothing_torso"],
      ["Waistcoat", "midlayer_torso"],
      ["Jacket", "clothing_torso"],
    ],
    ["Shirt", "Waistcoat", "Jacket"],
  );
  assert.deepEqual(look.slots, { clothing_torso: "Shirt", midlayer_torso: "Waistcoat", outerwear_torso: "Jacket" });
  look = await layered(
    "wardrobe-6",
    [
      ["Boots", "feet"],
      ["Sandals", "feet"],
    ],
    ["Boots", "Sandals"],
  );
  assert.deepEqual([look.slots, look.skipped], [{ feet: "Boots" }, ["Sandals"]], "other slots still collide");
});

await test("feed appearance writes outfit and item names and descriptions", async () => {
  const server = await startServer();
  const items = await server.seed("feed-1", [
    { name: "Red baseball hat", description: "A weathered red velcro back baseball hat", location: "equipped:head" },
    { name: "White Shirt", location: "equipped:clothing_torso" },
    {
      name: "Black Sneakers",
      description: "A pair of sporty black sneakers with orange laces.",
      location: "equipped:feet",
    },
  ]);
  await server.saveOutfit("feed-1", { name: "Casual", description: "A relaxed weekend look" });
  const [casual] = (await server.get("feed-1")).outfits;
  const feed = async (mode) => {
    await server.settings("feed-1", { appearanceFeedMode: mode });
    return server.appearance("feed-1");
  };
  assert.equal(await feed("equippedNames"), "Red baseball hat, White Shirt, Black Sneakers");
  assert.equal(
    await feed("equippedDescriptions"),
    "A weathered red velcro back baseball hat. White Shirt. A pair of sporty black sneakers with orange laces.",
  );
  assert.equal(
    await feed("equippedNamesDescriptions"),
    "Red baseball hat, A weathered red velcro back baseball hat. White Shirt. Black Sneakers, A pair of sporty black sneakers with orange laces.",
  );
  assert.equal(await feed("outfitName"), "Casual");
  assert.equal(await feed("outfitDescription"), "A relaxed weekend look");
  assert.equal(await feed("outfitNameDescription"), "Casual, A relaxed weekend look.");
  assert.equal(await feed("off"), "");

  await server.addItem("feed-1", { name: "Watch", location: "equipped:extra_wearable_1" });
  assert.equal(await feed("outfitName"), "Casual. Also wearing Watch.", "extras worn alongside the outfit");
  await server.patchOutfit("feed-1", casual.id, { hidden: true });
  assert.equal(
    await feed("outfitName"),
    "Red baseball hat, White Shirt, Black Sneakers, Watch",
    "a hidden outfit falls back to its item equivalent",
  );
  await server.patchOutfit("feed-1", casual.id, { hidden: false });

  await server.settings("feed-1", { appearanceFeedMode: "off" });
  assert.match((await server.portraitPrompt("feed-1", casual.id)).body.prompt, /wearing A relaxed weekend look/);
  await server.settings("feed-1", { appearanceFeedMode: "equippedNamesDescriptions" });
  assert.match(
    (await server.portraitPrompt("feed-1", casual.id)).body.prompt,
    /wearing Red baseball hat, A weathered red velcro back baseball hat\. White Shirt\./,
  );
  assert.doesNotMatch(
    (await server.portraitPrompt("feed-1", casual.id)).body.prompt,
    /\.\./,
    "the template's own period isn't doubled",
  );
  assert.ok(items["White Shirt"]);
});

await test("outfits and reverts rebuild deleted items with their default slot, hidden state and lock", async () => {
  const server = await startServer();
  const { Waistcoat: waistcoat } = await server.seed("rebuild-1", [
    { name: "Waistcoat", description: "plaid", defaultSlot: "clothing_torso", location: "equipped:midlayer_torso" },
  ]);
  await server.patchItem("rebuild-1", waistcoat.id, { descriptionLocked: true });
  await server.saveOutfit("rebuild-1", { name: "Suit" });
  const [suit] = (await server.get("rebuild-1")).outfits;
  await server.deleteItem("rebuild-1", waistcoat.id);
  await server.equipOutfit("rebuild-1", suit.id);
  const rebuilt = await server.item("rebuild-1", "Waistcoat");
  assert.deepEqual(
    [rebuilt.defaultSlot, rebuilt.location, rebuilt.descriptionLocked],
    ["clothing_torso", "equipped:midlayer_torso", true],
  );

  await server.importSheet("rebuild-2", {
    items: [],
    outfits: [{ name: "Old", slots: { feet: { itemId: "gone", name: "Old Boots", description: "" } } }],
  });
  const [old] = (await server.get("rebuild-2")).outfits;
  await server.equipOutfit("rebuild-2", old.id);
  assert.equal((await server.item("rebuild-2", "Old Boots")).defaultSlot, "feet", "older outfits use the slot");

  const { Cloak: cloak } = await server.seed("rebuild-3", [{ name: "Cloak", defaultSlot: "back" }]);
  await server.patchItem("rebuild-3", cloak.id, { hidden: true });
  await server.patchItem("rebuild-3", cloak.id, { location: "equipped:back" });
  await server.settings("rebuild-3", { askBeforeHiddenChanges: false, hiddenItemAccess: "agentHidden" });
  await server.agentTurn("rebuild-3", { removeItem: [1] });
  assert.equal(await server.item("rebuild-3", "Cloak"), undefined);
  await server.revert("rebuild-3", cloak.id);
  const restored = await server.item("rebuild-3", "Cloak");
  assert.deepEqual([restored.hidden, restored.defaultSlot], [true, "back"]);
});

await test("a saved image stays with its item through a rename, and unlinking is per chat", async () => {
  const server = await startServer();
  const { Apple: apple1 } = await server.seed("chat-1", [{ name: "Apple" }]);
  const { Apple: apple2 } = await server.seed("chat-2", [{ name: "Apple" }]);

  await server.uploadImage("chat-1", apple1.id, "one", "generated");
  assert.deepEqual(await server.imageInfo("chat-1", apple1.id), {
    file: "apple.png",
    source: "generated",
    savedFile: "apple.png",
    savedMissing: false,
    deletable: true,
  });
  // Shared by name: chat 2's Apple, with nothing saved, matches it.
  assert.equal(await server.image("chat-2", apple2.id), "one");
  assert.equal((await server.imageInfo("chat-2", apple2.id)).source, "name");

  // A new image never replaces another chat's file.
  await server.uploadImage("chat-2", apple2.id, "two", "uploaded");
  assert.equal((await server.imageInfo("chat-2", apple2.id)).savedFile, "apple (1).png");
  assert.equal(await server.image("chat-1", apple1.id), "one");
  assert.equal(await server.image("chat-2", apple2.id), "two");

  // Renamed, chat 2's item keeps its saved image; unlinked, it's back to
  // matching its new name, and chat 1 keeps its own saved file.
  await server.patchItem("chat-2", apple2.id, { name: "Orange" });
  assert.equal(await server.image("chat-2", apple2.id), "two");
  assert.equal((await server.imageInfo("chat-2", apple2.id)).source, "uploaded");
  await server.patchItem("chat-2", apple2.id, { imageFile: null });
  assert.equal(await server.image("chat-2", apple2.id), 404);
  assert.equal((await server.imageInfo("chat-1", apple1.id)).savedFile, "apple.png");
  await writeFile(join(server.itemsDir, "orange.webp"), "orange");
  assert.equal(await server.image("chat-2", apple2.id), "orange");
  assert.deepEqual(
    [(await server.imageInfo("chat-2", apple2.id)).source, (await server.imageInfo("chat-2", apple2.id)).file],
    ["name", "orange.webp"],
  );

  // The client can only clear a saved image, never point it at a file.
  for (const imageFile of ["apple.png", "../../escape.png", 5]) {
    assert.equal((await server.patchItem("chat-2", apple2.id, { imageFile })).statusCode, 400);
  }
  assert.equal((await server.item("chat-2", "Orange")).imageFile, undefined);

  // A saved file that's gone falls back to the name match, and says so.
  const { Pear: pear } = await server.seed("chat-1", [{ name: "Pear" }]);
  await server.uploadImage("chat-1", pear.id, "pear", "uploaded");
  await server.patchItem("chat-1", pear.id, { name: "Orange" });
  const { unlink } = await import("node:fs/promises");
  await unlink(join(server.itemsDir, "pear.png"));
  assert.deepEqual(await server.imageInfo("chat-1", pear.id), {
    file: "orange.webp",
    source: "name",
    savedFile: "pear.png",
    savedMissing: true,
    deletable: true,
  });
});

await test("a rename keeps an older upload, but an image-pack match still follows the name", async () => {
  const server = await startServer();
  await mkdir(join(server.itemsDir, "pack"), { recursive: true });
  await writeFile(join(server.itemsDir, "oldhat.png"), "old upload");
  await writeFile(join(server.itemsDir, "pack", "packsword.png"), "sword");
  await writeFile(join(server.itemsDir, "pack", "packaxe.png"), "axe");
  const items = await server.seed("chat-1", [{ name: "Old Hat" }, { name: "Pack Sword" }]);

  await server.patchItem("chat-1", items["Old Hat"].id, { name: "Worn Hat" });
  assert.equal(await server.image("chat-1", items["Old Hat"].id), "old upload");
  assert.deepEqual(
    [(await server.item("chat-1", "Worn Hat")).imageFile, (await server.item("chat-1", "Worn Hat")).imageSource],
    ["oldhat.png", "uploaded"],
  );

  assert.equal((await server.imageInfo("chat-1", items["Pack Sword"].id)).file, "pack/packsword.png");
  await server.patchItem("chat-1", items["Pack Sword"].id, { name: "Pack Axe" });
  assert.equal(await server.image("chat-1", items["Pack Sword"].id), "axe");
  assert.equal((await server.item("chat-1", "Pack Axe")).imageFile, undefined);

  // Image-pack files are never deleted from here.
  const refused = await server.deleteImage("chat-1", items["Pack Sword"].id);
  assert.equal(refused.statusCode, 400);
  assert.equal(await readFile(join(server.itemsDir, "pack", "packaxe.png"), "utf8"), "axe");
});

await test("uploads get safe, numbered filenames, and × deletes the file it shows", async () => {
  const server = await startServer();
  await mkdir(server.itemsDir, { recursive: true });
  await writeFile(join(server.itemsDir, "Apple.jpg"), "existing");
  const names = ["../../escape", "Sword/Shield", "CON", "???", "Apple"];
  const items = await server.seed(
    "chat-1",
    names.map((name) => ({ name })),
  );
  for (const name of names) {
    const result = await server.uploadImage("chat-1", items[name].id, name, "uploaded");
    assert.equal(result.statusCode, 200, name);
  }
  const saved = Object.fromEntries(
    await Promise.all(names.map(async (name) => [name, (await server.item("chat-1", name)).imageFile])),
  );
  assert.deepEqual(saved, {
    "../../escape": "escape.png",
    "Sword/Shield": "swordshield.png",
    CON: "conitem.png",
    "???": "item.png",
    Apple: "apple (1).png",
  });
  assert.deepEqual((await readdir(join(server.dataDir, "gallery", "quartermaster"))).sort(), ["items"]);
  assert.deepEqual((await readdir(server.dataDir)).sort(), ["gallery"]);
  for (const name of names) assert.equal(await server.image("chat-1", items[name].id), name);

  // × deletes the saved file; the item then shows its name match.
  await server.deleteImage("chat-1", items.Apple.id);
  assert.equal((await readdir(server.itemsDir)).includes("apple (1).png"), false);
  assert.equal((await server.item("chat-1", "Apple")).imageFile, undefined);
  assert.equal(await server.image("chat-1", items.Apple.id), "existing");
});

await test("a saved image travels with outfit rebuilds, revert, and Export/Import", async () => {
  const server = await startServer();
  const { Hat: hat } = await server.seed("travel-1", [{ name: "Hat", defaultSlot: "head", location: "equipped:head" }]);
  await server.uploadImage("travel-1", hat.id, "hat", "generated");
  await server.saveOutfit("travel-1", { name: "Look" });
  let [look] = (await server.get("travel-1")).outfits;
  assert.equal(look.slots.head.imageFile, "hat.png");

  // Renaming keeps the outfit's copy in step; an outfit rebuilding the
  // deleted item restores its image.
  await server.patchItem("travel-1", hat.id, { name: "Cap" });
  await server.deleteItem("travel-1", hat.id);
  await server.equipOutfit("travel-1", look.id);
  const rebuilt = await server.item("travel-1", "Cap");
  assert.deepEqual([rebuilt.imageFile, rebuilt.imageSource], ["hat.png", "generated"]);
  assert.equal(await server.image("travel-1", rebuilt.id), "hat");
  await server.patchItem("travel-1", rebuilt.id, { imageFile: null });
  [look] = (await server.get("travel-1")).outfits;
  assert.equal(look.slots.head.imageFile, undefined, "unlinking clears the outfit's copy too");

  const { Lantern: lantern } = await server.seed("travel-2", [{ name: "Lantern" }]);
  await server.uploadImage("travel-2", lantern.id, "lantern", "uploaded");
  await server.patchItem("travel-2", lantern.id, { name: "Lamp" });
  await server.agentTurn("travel-2", { removeItem: [1] });
  await server.revert("travel-2", lantern.id);
  assert.equal((await server.item("travel-2", "Lamp")).imageFile, "lantern.png");

  const sheet = await server.exportSheet("travel-2");
  assert.equal(sheet.items[0].imageFile, "lantern.png");
  await server.importSheet("travel-3", sheet);
  const imported = await server.item("travel-3", "Lamp");
  assert.equal(await server.image("travel-3", imported.id), "lantern");
  await server.importSheet("travel-4", {
    items: [{ name: "Forged", imageFile: "../../../etc/passwd.png", imageSource: "generated" }],
    outfits: [{ name: "Bad", slots: { head: { name: "Forged", imageFile: "a/b.png" } } }],
  });
  assert.equal((await server.item("travel-4", "Forged")).imageFile, undefined);
  assert.equal((await server.get("travel-4")).outfits[0].slots.head.imageFile, undefined);
});

await test("export and import carry hidden items, locks and the new settings", async () => {
  const server = await startServer();
  const { Locket: locket } = await server.seed("export-1", [{ name: "Locket", description: "x", defaultSlot: "neck" }]);
  await server.patchItem("export-1", locket.id, { hidden: true, descriptionLocked: true });
  await server.saveOutfit("export-1", { name: "Plain" });
  const [plain] = (await server.get("export-1")).outfits;
  await server.patchOutfit("export-1", plain.id, { hidden: true });
  await server.settings("export-1", {
    appearanceFeedMode: "equippedNamesDescriptions",
    askBeforeHiddenChanges: false,
    hiddenItemAccess: "agentShown",
    wardrobeUsesHidden: true,
    hiddenOnlyInHiddenTab: false,
  });
  const sheet = await server.exportSheet("export-1");
  assert.equal("pendingHiddenChanges" in sheet, false);
  await server.importSheet("export-2", JSON.parse(JSON.stringify(sheet)));
  const imported = await server.get("export-2");
  assert.deepEqual(
    [imported.items[0].hidden, imported.items[0].descriptionLocked, imported.outfits[0].hidden],
    [true, true, true],
  );
  assert.deepEqual(
    [
      imported.appearanceFeedMode,
      imported.askBeforeHiddenChanges,
      imported.hiddenItemAccess,
      imported.wardrobeUsesHidden,
      imported.hiddenOnlyInHiddenTab,
    ],
    ["equippedNamesDescriptions", false, "agentShown", true, false],
  );

  await server.importSheet("export-3", { items: [{ name: "Old" }], outfits: [] });
  const fresh = await server.get("export-3");
  assert.deepEqual(
    [fresh.items[0].hidden, fresh.askBeforeHiddenChanges, fresh.hiddenItemAccess, fresh.hiddenOnlyInHiddenTab],
    [false, true, "userHidden", true],
    "older files get the defaults",
  );
});

await test("image details label the file, offer Unlink only for a saved one, and × asks before deleting", async () => {
  const node = (text = "") => ({
    textContent: text,
    style: {},
    listeners: {},
    children: [],
    className: "",
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    remove() {},
    setAttribute() {},
    addEventListener(name, handler) {
      this.listeners[name] = handler;
    },
  });
  const textOf = (n) => (n.textContent ?? "") + (n.children ?? []).map(textOf).join("");
  const buttonsIn = (n) => [...(n.label ? [n.label] : []), ...(n.children ?? []).flatMap(buttonsIn)];
  const answers = [];
  const calls = [];
  const api = {
    button(label) {
      const button = node(label);
      button.label = label;
      return button;
    },
    _missingItemImageIds: new Set(),
    setImageSrc() {},
    itemImageUrl: (_chatId, _ownerId, id) => `item:${id}`,
    state: {
      chatId: "chat-a",
      itemImageInfo: () => answers.shift(),
      unlinkItemImage: async (id) => calls.push(["unlink", id]),
      deleteItemImage: async (id) => calls.push(["delete", id]),
    },
  };
  const uiContext = vm.createContext({
    QM: api,
    QM_OWNER_ID: "persona",
    QM_COLOR_DANGER: "red",
    QM_COLOR_DANGER_FG: "white",
    QM_COLOR_SUCCESS: "green",
    QM_COLOR_SUCCESS_FG: "white",
    QM_COLOR_WARNING: "orange",
    window: { localStorage: { getItem: () => null } },
    document: {
      createElement: () => node(),
      createTextNode: (text) => ({ textContent: text }),
      querySelectorAll: () => [],
      addEventListener() {},
      removeEventListener() {},
    },
    setTimeout,
  });
  vm.runInContext(
    await readFile(new URL("../packages/quartermaster/src/10-dock.js", import.meta.url), "utf8"),
    uiContext,
  );
  const lines = (info) => JSON.parse(JSON.stringify(vm.runInContext("qmItemImageDetailLines", uiContext)(info)));
  const ui = api.dock;

  assert.deepEqual(lines({ file: "apple.png", source: "generated", savedFile: "apple.png" }), [
    { label: "Generated filename", file: "apple.png" },
  ]);
  assert.deepEqual(lines({ file: "apple (1).png", source: "uploaded", savedFile: "apple (1).png" }), [
    { label: "Uploaded filename", file: "apple (1).png" },
  ]);
  assert.deepEqual(lines({ file: "pack/orange.png", source: "name", savedFile: null }), [
    { label: "Matched by name", file: "pack/orange.png" },
  ]);
  assert.deepEqual(lines({ file: "orange.png", source: "name", savedFile: "pear.png", savedMissing: true }), [
    { label: "Saved file missing", file: "pear.png" },
    { label: "Matched by name", file: "orange.png" },
  ]);
  assert.deepEqual(lines({ file: null, source: null, savedFile: null }), []);

  // The editor line: Unlink only for a saved file; hidden with nothing to show.
  const line = node();
  answers.push(Promise.resolve({ file: "apple.png", source: "generated", savedFile: "apple.png" }));
  await ui._fillItemImageDetails(line, "item-a", { inline: true });
  assert.match(textOf(line), /Generated filename: apple\.png/);
  assert.deepEqual(buttonsIn(line), ["Unlink"]);
  assert.equal(line.style.display, "flex");
  await line.children.at(-1).listeners.click();
  assert.deepEqual(calls.splice(0), [["unlink", "item-a"]]);
  answers.push(Promise.resolve({ file: "apple.png", source: "name", savedFile: null }));
  await ui._fillItemImageDetails(line, "item-a", { inline: true });
  assert.deepEqual(buttonsIn(line), [], "a name match has nothing to unlink");
  answers.push(Promise.resolve({ file: null, source: null, savedFile: null }));
  await ui._fillItemImageDetails(line, "item-a", { inline: true });
  assert.equal(line.style.display, "none");

  // A slower, older answer never replaces a newer one.
  let settleOld;
  answers.push(new Promise((resolve) => (settleOld = resolve)));
  answers.push(Promise.resolve({ file: "new.png", source: "uploaded", savedFile: "new.png" }));
  const older = ui._fillItemImageDetails(line, "item-a", { inline: true });
  await ui._fillItemImageDetails(line, "item-a", { inline: true });
  settleOld({ file: "old.png", source: "uploaded", savedFile: "old.png" });
  await older;
  assert.match(textOf(line), /new\.png/);

  // × in the editor: Delete file (warning that it's every chat), Unlink, Cancel.
  const choice = node();
  let changed = 0;
  answers.push(Promise.resolve({ file: "apple.png", source: "generated", savedFile: "apple.png", deletable: true }));
  await ui._showItemImageRemoveChoice(choice, "item-a", () => changed++);
  assert.deepEqual(buttonsIn(choice), ["Delete file", "Unlink", "Cancel"]);
  assert.match(textOf(choice), /deletes the file\. Every item using it, in any chat, loses its image/);
  const deleteButton = choice.children[1].children[0];
  await deleteButton.listeners.click();
  assert.deepEqual(calls.splice(0), [["delete", "item-a"]]);
  assert.deepEqual([changed, choice.style.display], [1, "none"]);
  answers.push(Promise.resolve({ file: "pack/axe.png", source: "name", savedFile: null, deletable: false }));
  await ui._showItemImageRemoveChoice(choice, "item-a");
  assert.deepEqual(buttonsIn(choice), ["Cancel"]);
  assert.match(textOf(choice), /image pack/);

  // A bag card gets [i], the editor gets ×; a saved file shows its button even
  // before (or without) a loaded picture, so it can still be unlinked.
  const bag = ui._buildItemImageControl({ id: "item-a", name: "Apple", imageFile: "apple.png" }, 48);
  const bagCorner = bag.children.at(-1);
  assert.equal(bagCorner.className, "qm-overflow-wrap");
  assert.equal(bagCorner.style.display, "inline-flex");
  assert.equal(ui._buildItemImageControl({ id: "item-b", name: "Pear" }, 48).children.at(-1).style.display, "none");
  let removeAsked = 0;
  const editor = ui._buildItemImageControl({ id: "item-a", name: "Apple", imageFile: "apple.png" }, 96, {
    onRemove: () => removeAsked++,
  });
  const editorCorner = editor.children.at(-1);
  assert.equal(editorCorner.textContent, "×");
  editorCorner.listeners.click();
  assert.equal(removeAsked, 1);
});

await test("the Bag's Hidden tab holds hidden items, and other tabs only when the setting allows", () => {
  const matches = vm.runInContext("qmItemMatchesBagTab", context);
  const hiddenHat = { location: "bag", defaultSlot: "head", hidden: true };
  const hat = { location: "bag", defaultSlot: "head", hidden: false };
  const tabs = (item, hiddenOnly) =>
    ["items", "wearables", "stored", "hidden"].filter((tab) => matches(item, tab, hiddenOnly));
  assert.deepEqual(tabs(hiddenHat, true), ["hidden"]);
  assert.deepEqual(tabs(hiddenHat, false), ["wearables", "hidden"]);
  assert.deepEqual(tabs(hat, true), ["wearables"]);
});

await test("the pending popup opens for new changes, stays shut once deferred, and reviews a stale accept", async () => {
  const buttons = [];
  const node = (text = "") => {
    const el = {
      textContent: text,
      style: {},
      listeners: {},
      children: [],
      append(...nodes) {
        this.children.push(...nodes);
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
      replaceChildren(...nodes) {
        this.children = nodes;
      },
      remove() {
        this.removed = true;
      },
      setAttribute() {},
      addEventListener(name, handler) {
        this.listeners[name] = handler;
      },
    };
    return el;
  };
  const listeners = new Set();
  const seenCalls = [];
  const resolveCalls = [];
  const resolveAnswers = [];
  const api = {
    textNode: node,
    button(label) {
      const button = node(label);
      buttons.push(button);
      return button;
    },
    state: {
      chatId: "chat-a",
      hiddenItemAccess: "userHidden",
      pendingHiddenChanges: [],
      subscribe: (fn) => listeners.add(fn),
      _notify() {
        for (const fn of listeners) fn();
      },
      markPendingSeen: (ids) => seenCalls.push(ids),
      resolvePending: async (id, decision) => {
        resolveCalls.push([id, decision]);
        return resolveAnswers.shift() ?? { items: [] };
      },
    },
  };
  const body = node();
  const popupContext = vm.createContext({
    QM: api,
    QM_COLOR_WARNING: "orange",
    qmLocationLabel: (location) => location,
    qmAccessModeShows: (mode) => mode === "userShown" || mode === "agentShown",
    document: { createElement: () => node(), body, addEventListener() {}, removeEventListener() {} },
  });
  vm.runInContext(
    await readFile(new URL("../packages/quartermaster/src/13-pending.js", import.meta.url), "utf8"),
    popupContext,
  );
  const popup = api.pendingPopup;
  const fields = { name: "Amulet", description: "old", quantity: 1, location: "bag" };
  const entry = (id, seen = false) => ({
    id,
    itemId: `item-${id}`,
    seen,
    remove: false,
    before: { ...fields },
    after: { ...fields, description: "new" },
  });
  const shownIds = () => popup.list.children.length;

  api.state.pendingHiddenChanges = [entry("p1", true)];
  api.state._notify();
  assert.equal(popup.backdrop, null, "already-seen changes wait in the dock");

  api.state.pendingHiddenChanges = [entry("p1", true), entry("p2")];
  api.state._notify();
  assert.ok(popup.backdrop, "an unseen change opens the popup");
  assert.equal(shownIds(), 1);

  popup.close();
  assert.deepEqual([...seenCalls[0]], ["p2"]);
  api.state._notify();
  assert.equal(popup.backdrop, null, "a deferred change can't reopen it while marking seen is in flight");

  api.state.pendingHiddenChanges = [entry("p1", true), entry("p2", true), entry("p3")];
  api.state._notify();
  assert.equal(shownIds(), 1, "only the newer change shows");
  api.state.pendingHiddenChanges = [entry("p1", true), entry("p2", true)];
  api.state._notify();
  assert.equal(popup.backdrop, null, "settling everything it showed closes it");
  assert.equal(seenCalls.length, 1, "without marking anything");

  buttons.length = 0;
  const card = () => vm.runInContext("qmBuildPendingEntry", popupContext)(entry("p4"));
  card();
  const click = async (label) => {
    const button = buttons.findLast((candidate) => candidate.textContent === label);
    assert.ok(button, `${label} is offered`);
    await button.listeners.click();
  };
  resolveAnswers.push({
    stale: true,
    before: fields,
    current: { ...fields, quantity: 4 },
    after: { ...fields, description: "new" },
  });
  await click("Accept changes");
  card();
  await click("Apply the agent's change");
  assert.deepEqual(
    resolveCalls.map(([id, decision]) => [id, { ...decision }]),
    [
      ["p4", { decision: "accept", show: false }],
      ["p4", { decision: "accept", show: false, override: true }],
    ],
  );
  api.state.chatId = "chat-b";
  api.state.pendingHiddenChanges = [];
  api.state._notify();
  assert.equal(popup.backdrop, null);
});
