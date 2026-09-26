import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
await test("image deletion uses its own result during concurrent mutations", async () => {
  for (const succeeds of [false, true]) {
    const api = { _missingItemImageIds: new Set() };
    vm.runInContext(stateSource, vm.createContext({ QM: api }));
    api.state.chatId = "chat-a";
    api.deleteItemImage = () => (succeeds ? Promise.resolve({}) : Promise.reject(new Error("Delete failed")));
    await Promise.all([
      api.state.deleteItemImage("item-a"),
      api.state._mutate(succeeds ? Promise.reject(new Error("Other request failed")) : Promise.resolve({})),
    ]);
    assert.equal(api._missingItemImageIds.has("item-a"), succeeds);
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
