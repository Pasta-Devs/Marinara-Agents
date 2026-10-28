// Use the shipped Home selector and request methods with local state/DOM fixtures only.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";
import { forgeUserTimeZone } from "../packages/gacha-forge/src/browser-presentation.mjs";
import { forgeStoryRequest } from "../packages/gacha-forge/src/story-cancel-client.mjs";
import { forgeFormationStartRequest } from "../packages/gacha-forge/src/formation-combat-client.mjs";
import {
  forgeSeasonalRequest,
  adoptForgeSeasonalResponse,
} from "../packages/gacha-forge/src/seasonal-events-client.mjs";
import {
  adoptForgeChapterVersion,
  forgeChapterOriginCurrent,
  forgeChapterRequest,
} from "../packages/gacha-forge/src/chapter-regeneration-client.mjs";
import {
  forgeUnitRecommendation,
  forgeUnitStepIsCurrent,
  refreshForgeUnitStep,
  wireForgeUnitNotifications,
} from "../packages/gacha-forge/src/unit-notifications.mjs";

const source = await readFile(
  process.env.GACHA_FORGE_CLIENT ?? new URL("../packages/gacha-forge/client.js", import.meta.url),
  "utf8",
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const selectorStart = source.indexOf('vv=[{id:"level"');
const selectorEnd = source.indexOf("function mn(", selectorStart);
assert.ok(selectorStart >= 0 && selectorEnd > selectorStart, "Locate the actual Home next-step selector");
const selector = vm.createContext({});
vm.runInContext(`var ${source.slice(selectorStart, selectorEnd)};`, selector);
function nextStep(context) {
  selector.input = context;
  return JSON.parse(JSON.stringify(vm.runInContext("od(input)", selector)));
}
const completed = {
  leveled: 1,
  looseSignature: 0,
  unformed: 0,
  farmed: 1,
  ascended: 1,
  insightXp: 0,
  levelXpFirst: 200,
  done: [],
};
const level = { ...completed, leveled: 0, insightXp: 200 };
const signature = {
  ...completed,
  looseSignature: 1,
  looseSignatureName: "Arden's Blade",
};
const ascend = {
  ...completed,
  ascended: 0,
  atAscensionCap: 1,
  cappedName: "Arden",
  ascensionCap: 20,
};

function method(name, following, globals) {
  const start = source.search(new RegExp(`${name}\\([^)]*\\)\\{`, "u"));
  const offset = source.slice(start).search(new RegExp(`${following}\\([^)]*\\)\\{`, "u"));
  const end = start + offset;
  assert.ok(start >= 0 && end > start, `Locate the actual ${name} method`);
  return vm.runInNewContext(`({${source.slice(start, end)}}).${name}`, {
    forgeUserTimeZone,
    forgeStoryRequest,
    adoptForgeChapterVersion,
    forgeChapterOriginCurrent,
    forgeChapterRequest,
    forgeFormationStartRequest,
    forgeSeasonalRequest,
    adoptForgeSeasonalResponse,
    ...globals,
  });
}

test("the Home dot's three existing recommendations name their actual Units destinations", () => {
  for (const [context, id, destination, detail] of [
    [level, "level", "Stats → Level up", "200 XP held"],
    [signature, "signature", "Gear → Weapon", "Arden's Blade"],
    [ascend, "ascend", "Stats → Ascend", "Arden at Lv 20"],
  ]) {
    const step = nextStep(context);
    assert.equal(step.go, "roster");
    assert.equal(step.id, id);
    const recommendation = forgeUnitRecommendation(step);
    assert.ok(recommendation.hint.includes(destination));
    assert.equal(recommendation.detail, detail);
    assert.ok(recommendation.home.startsWith("Next-step recommendation:"));
  }
  for (const context of [completed, { ...level, done: ["level"] }, { ...completed, unformed: 1 }]) {
    assert.equal(forgeUnitRecommendation(nextStep(context)), null);
  }
  assert.equal(
    forgeUnitRecommendation(nextStep({ ...level, canLevel: false })),
    null,
    "No dot for a capped unit or insufficient Funds",
  );
  assert.equal(
    forgeUnitRecommendation(nextStep({ ...ascend, canAscend: false })),
    null,
    "No dot for an unaffordable ascension",
  );
});

test("recommendation labels insert character and weapon names literally", () => {
  for (const detail of ["$&", "$`", "$'", "$$", "{action}", "{detail}"]) {
    const step = { go: "roster", id: "signature", action: "Equip {detail}", detail };
    const recommendation = forgeUnitRecommendation(step);
    assert.equal(recommendation.title, "Next step: Equip {detail}");
    assert.equal(recommendation.home, `Next-step recommendation: Equip {detail}. ${detail}`);
  }
});

class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.textContent = "";
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  removeAttribute(name) {
    delete this.attributes[name];
  }
  append(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
  }
  prepend(child) {
    child.parent = this;
    this.children.unshift(child);
  }
  remove() {
    this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  querySelector(selector) {
    const dataKey = {
      "[data-forge-unit-next]": "forgeUnitNext",
      "[data-forge-unit-notification-style]": "forgeUnitNotificationStyle",
    }[selector];
    return this.children.find((child) =>
      dataKey
        ? Object.hasOwn(child.dataset, dataKey)
        : selector.startsWith(".")
          ? child.className === selector.slice(1)
          : child.tag === selector,
    );
  }
}

test("Units explains the dot inline, uses text nodes, and removes the hint when progression clears it", () => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: (tag) => new Element(tag) };
  try {
    const body = new Element();
    const home = new Element("button");
    const root = new Element();
    const view = {
      querySelector: (query) =>
        ({
          '.hm-screen [data-go="roster"]': home,
          '[data-screen="roster"] .roster-body': body,
        })[query],
    };
    const query = root.querySelector.bind(root);
    root.querySelector = (key) => (key === ".gf-stage > .gf-view" ? view : query(key));
    const host = { _root: root };
    wireForgeUnitNotifications(host, nextStep(signature));
    const note = body.querySelector("[data-forge-unit-next]");
    assert.equal(note.attributes.role, "note");
    assert.equal(note.querySelector("strong").textContent, "Next step: Equip signature");
    assert.ok(note.querySelector("span").textContent.includes("Arden's Blade. Open the matching character"));
    assert.ok(home.attributes.title.includes("Equip signature"));
    assert.ok(home.querySelector(".hm-dot"), "An actionable recommendation has its existing notification dot");
    wireForgeUnitNotifications(host, {
      ...nextStep(signature),
      detail: "<img src=x onerror=alert(1)>",
    });
    assert.ok(note.querySelector("span").textContent.includes("<img src=x onerror=alert(1)>"));
    assert.equal(note.children.length, 2, "Names/details never become executable markup");
    assert.equal(body.children.length, 1, "Repeated wiring does not duplicate the note");
    assert.equal(root.children.length, 1, "Repeated wiring does not duplicate its scoped stylesheet");
    wireForgeUnitNotifications(host, nextStep(completed));
    assert.equal(body.querySelector("[data-forge-unit-next]"), undefined);
    assert.equal(home.attributes.title, undefined);
    assert.equal(
      home.querySelector(".hm-dot"),
      undefined,
      "A cleared recommendation removes the dot without a full repaint",
    );
  } finally {
    globalThis.document = oldDocument;
  }
});

test("the built render and POST paths wire the maintained helper without a second notification system", async () => {
  const helper = await readFile(new URL("../packages/gacha-forge/src/unit-notifications.mjs", import.meta.url), "utf8");
  assert.ok(source.includes(helper.replace(/^export /gmu, "")), "The built client must contain the current helper");
  assert.ok(source.includes("wireForgeHome(this,bt,ao),wireForgeUnitNotifications(this,od(this._nextStepCtx)),"));
  let response = { ok: true };
  const requests = [];
  const post = method("_postJson", "_adoptFromResponse", {
    Ia: "/api/gacha-forge",
    Bm: () => "",
    Ze: async (url) => {
      requests.push(url);
      return { json: async () => response };
    },
    refreshForgeUnitStep,
  });
  const host = {
    isConnected: true,
    _run: { runId: "run-a" },
    _adoptFromResponse() {},
    _refreshStepData() {
      this.refreshes = (this.refreshes || 0) + 1;
    },
  };
  for (const path of ["/level-up", "/ascend", "/equip"]) await post.call(host, path, { runId: "run-a" });
  assert.equal(host.refreshes, 3, "Successful progression refreshes the server-owned next step");
  await post.call(host, "/unit/favorite", { runId: "run-a" });
  response = { ok: false };
  await post.call(host, "/level-up", { runId: "run-a" });
  response = { ok: true };
  await post.call(host, "/equip", { runId: "older-run" });
  host.isConnected = false;
  await post.call(host, "/ascend", { runId: "run-a" });
  assert.equal(host.refreshes, 3, "Unrelated, rejected, stale and detached actions do not refresh");
  assert.equal(requests.length, 7, "Only the original fixture POST requests were sent");
});

function refreshHarness() {
  const reads = [];
  const drawn = [];
  const refresh = method("_refreshStepData", "_refreshState", {
    Ia: "/api/gacha-forge",
    Ze: (url) => {
      const request = new URL(url, "http://fixture.invalid");
      assert.equal(request.pathname, "/api/gacha-forge/state");
      assert.equal(request.searchParams.get("timeZone"), forgeUserTimeZone());
      const read = deferred();
      reads.push(read);
      return read.promise;
    },
    forgeUnitStepIsCurrent,
    od: nextStep,
    wireForgeUnitNotifications: (_host, step) => drawn.push(forgeUnitRecommendation(step)),
  });
  const host = {
    isConnected: true,
    _run: { runId: "run-a" },
    _nextStepCtx: level,
    adopted: [],
    renders: 0,
    _adoptGlobals(value) {
      this.adopted.push(value);
      this._nextStepCtx = value.activeRun.nextStepCtx;
    },
    _adoptUnlocks() {},
    _renderBrowser() {
      this.renders += 1;
    },
  };
  host._refreshStepData = refresh.bind(host);
  const settle = async (index, context, runId = "run-a") => {
    reads[index].resolve({
      json: async () => ({ activeRun: { runId, nextStepCtx: context } }),
    });
    await tick();
  };
  return { host, reads, drawn, settle };
}

test("an action during an older Home read gets a trailing authoritative refresh, then clears the existing hint", async () => {
  const { host, reads, drawn, settle } = refreshHarness();
  host._refreshStepData();
  refreshForgeUnitStep(host, "/level-up", { runId: "run-a" }, { ok: true });
  assert.equal(reads.length, 1, "Do not race another state request against the pending one");
  await settle(0, level);
  assert.equal(reads.length, 2, "Read again after a mutation overtakes the earlier state snapshot");
  assert.ok(drawn[0].title.includes("Level up"));
  await settle(1, { ...level, leveled: 1, done: ["level"] });
  assert.equal(drawn.at(-1), null);
  assert.deepEqual(host._nextStepCtx.done, ["level"], "Completion comes from the server response, not the hint");
  assert.equal(host._stepRefreshing, false);
});

test("late state responses cannot adopt another world or a detached package", async () => {
  for (const [change, responseRunId] of [
    [(host) => (host._run = { runId: "run-b" }), "run-a"],
    [(host) => (host.isConnected = false), "run-a"],
    [() => {}, "older-run"],
  ]) {
    const { host, settle } = refreshHarness();
    host._refreshStepData();
    change(host);
    await settle(0, signature, responseRunId);
    assert.equal(host.adopted.length, 0);
    assert.equal(host._nextStepCtx, level);
  }
  for (const change of [(host) => (host._run = null), (host) => (host.isConnected = false)]) {
    const { host, reads } = refreshHarness();
    change(host);
    host._refreshStepData();
    assert.equal(reads.length, 0, "Do not begin a state read without an active, connected world");
  }
});

test("a stale request can release the queue for the current world without adopting the old world's recommendation", async () => {
  const { host, reads, settle } = refreshHarness();
  host._refreshStepData();
  host._run = { runId: "run-b" };
  refreshForgeUnitStep(host, "/equip", { runId: "run-b" }, { ok: true });
  await settle(0, signature);
  assert.equal(host.adopted.length, 0);
  assert.equal(reads.length, 2);
  await settle(1, completed, "run-b");
  assert.equal(host.adopted.length, 1);
  assert.equal(nextStep(host._nextStepCtx), null);
});
