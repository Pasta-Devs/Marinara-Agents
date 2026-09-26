import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
