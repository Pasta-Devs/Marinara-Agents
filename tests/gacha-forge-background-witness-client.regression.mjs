import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(
  new URL("../packages/gacha-forge/src/background-unlocks-client.mjs", import.meta.url),
  "utf8",
);
function fixture() {
  const listeners = new Set(),
    images = [],
    observers = [],
    calls = [];
  let hidden = false,
    rect = { left: 0, top: 0, right: 500, bottom: 250, width: 500, height: 250 };
  const target = {
    isConnected: true,
    parentElement: null,
    getRootNode: () => ({}),
    getBoundingClientRect: () => rect,
    append() {},
  };
  const document = {
    get hidden() {
      return hidden;
    },
    addEventListener(type, callback) {
      assert.equal(type, "visibilitychange");
      listeners.add(callback);
    },
    removeEventListener(_, callback) {
      listeners.delete(callback);
    },
    createElement: () => ({ style: {}, setAttribute() {}, remove() {} }),
  };
  class Image {
    constructor() {
      images.push(this);
    }
  }
  class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target) {
      this.target = target;
    }
    disconnect() {
      this.target = null;
    }
    fire(visible = true) {
      this.callback([
        {
          target: this.target,
          isIntersecting: visible,
          intersectionRect: { width: visible ? 500 : 0, height: visible ? 250 : 0 },
        },
      ]);
    }
  }
  const scope = {
    document,
    Image,
    IntersectionObserver,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    innerWidth: 800,
    innerHeight: 400,
    setTimeout: () => 1,
    clearTimeout() {},
  };
  vm.runInNewContext(
    source.replace(/^export /gmu, "") + "\nglobalThis.api={witnessForgeBackground,disposeForgeBackgroundWitness};",
    scope,
  );
  const host = {
    isConnected: true,
    _run: { runId: "run" },
    _activeStoryNode: { chapter: 1, storyIndex: 0 },
    _root: { querySelector: () => target },
    _postJson: async (path, body) => {
      calls.push({ path, body });
      return { ok: true, unlocked: 1 };
    },
  };
  const fire = async () => {
    for (const callback of listeners) callback();
    await Promise.resolve();
    await Promise.resolve();
  };
  const start = (url = "/art/current.png", index = 0) =>
    scope.api.witnessForgeBackground(host, { segment: { place: "Garden" }, index, url });
  return {
    scope,
    host,
    start,
    images,
    observers,
    calls,
    listeners,
    fire,
    hidden: (value) => {
      hidden = value;
    },
    rect: (value) => {
      rect = value;
    },
  };
}
{
  const f = fixture();
  f.hidden(true);
  f.start();
  f.observers[0].fire();
  f.images[0].onload();
  await f.fire();
  assert.equal(f.calls.length, 0, "A background-tab image load is not an experience");
  f.hidden(false);
  await f.fire();
  assert.equal(f.calls.length, 1, "Returning visible retries the already loaded current image");
  await f.fire();
  assert.equal(f.calls.length, 1, "Visibility events cannot duplicate an earned image");
  f.scope.api.disposeForgeBackgroundWitness(f.host);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.observers[0].target, null);
  assert.equal(f.images[0].onload, null);
}
{
  const f = fixture();
  f.rect({ left: 900, top: 0, right: 1400, bottom: 250, width: 500, height: 250 });
  f.start();
  f.observers[0].fire();
  f.images[0].onload();
  await f.fire();
  assert.equal(f.calls.length, 0, "An offscreen host cannot witness its preloaded image");
  f.rect({ left: 0, top: 0, right: 500, bottom: 250, width: 500, height: 250 });
  f.observers[0].fire();
  await f.fire();
  assert.equal(f.calls.length, 1);
  f.scope.api.disposeForgeBackgroundWitness(f.host);
}
{
  const f = fixture();
  f.start("/art/late.png");
  const late = f.images[0].onload;
  f.start("/art/actual.png", 1);
  f.observers[0].fire();
  late();
  f.images[1].onload();
  await f.fire();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].body.url, "/art/actual.png");
  f.scope.api.disposeForgeBackgroundWitness(f.host);
  await f.fire();
  assert.equal(f.calls.length, 1);
}
{
  const f = fixture();
  f.host._activeStoryNode.replay = true;
  f.host._choicePlayback = { mainIndex: () => 3, artworkChoice: () => ({ choiceId: "choice", optionId: "alternate" }) };
  f.start("/art/replay.png", 5);
  f.observers[0].fire();
  f.images[0].onload();
  await f.fire();
  assert.equal(f.calls[0].body.at, 3);
  assert.equal(f.calls[0].body.replay, true);
  assert.equal(f.calls[0].body.optionId, "alternate");
  f.scope.api.disposeForgeBackgroundWitness(f.host);
}
process.stdout.write("PASS four actual-source background witness visibility, lifecycle and replay contracts.\n");
