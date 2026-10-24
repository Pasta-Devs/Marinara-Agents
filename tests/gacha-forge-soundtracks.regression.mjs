// Exercise collection against the shipped summon route; all storage and audio are synthetic.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as settings from "../packages/gacha-forge/src/audio-settings.mjs";
import { forgeAudioEnglish, forgeAudioFields } from "../packages/gacha-forge/src/audio-en.mjs";
import { ForgeAudioController, forgeAudioCue } from "../packages/gacha-forge/src/audio-client.mjs";

const originals = Object.fromEntries(
  [...Object.keys(settings), "forgeAudioEnglish", "forgeAudioFields", "Ze"].map((key) => [key, globalThis[key]]),
);
Object.assign(globalThis, settings, { forgeAudioEnglish, forgeAudioFields });
const runId = "soundtrack-world";
const sourceId = "music-connection";
const track = (cue) => {
  const key = settings.forgeSoundtrackContextKey(runId, sourceId, cue);
  return {
    cue,
    connectionId: sourceId,
    tag: `music:contexts:gacha-forge:${key}:fixture`,
    path: `music/contexts/gacha-forge/${key}/fixture.mp3`,
  };
};
const clone = structuredClone;
const directory = await mkdtemp(join(tmpdir(), "forge-soundtracks-"));
const random = Math.random;
try {
  const modulePath = join(directory, "server.mjs");
  await writeFile(modulePath, await readFile(new URL("../packages/gacha-forge/server.mjs", import.meta.url)));
  const { activate } = await import(pathToFileURL(modulePath).href);
  const docs = new Map();
  const routes = new Map();
  let failSessionWrite = false;
  const seed = (id, kind, data) => docs.set(id, { id, kind, data: clone(data), revision: 1 });
  const sessionId = `${runId}:session`;
  seed("index", "index", { runs: [{ runId, scenario: "The moonlit garden.", audio: { generate: true } }] });
  const char5 = `${runId}:unit:char5`,
    char4 = `${runId}:unit:char4`,
    weapon5 = `${runId}:unit:weapon5`;
  const featured5 = `${runId}:unit:featured5`;
  seed(char5, "unit", { kind: "character", name: "Arden", rarity: 5 });
  seed(featured5, "unit", { kind: "character", name: "Selene", rarity: 5 });
  seed(char4, "unit", { kind: "character", name: "Mira", rarity: 4 });
  seed(weapon5, "unit", { kind: "weapon", name: "Moonblade", rarity: 5 });
  seed(`${runId}:banner:standard`, "banner", {
    title: "Founding sky",
    charIds: [char5, char4],
    weaponIds: [weapon5],
    weaponFourIds: [],
  });
  const featured = (key) => ({
    key,
    title: `Moon garden ${key}`,
    fiveId: featured5,
    fourId: char4,
    mode: "fresh",
    endsAt: Date.now() + 86400000,
  });
  seed(`${runId}:banner:char:f1`, "banner", featured("f1"));
  seed(`${runId}:banner:wpn:f1`, "banner", { ...featured("f1"), title: "Moon armory", fiveId: weapon5 });
  const resetSession = () =>
    seed(sessionId, "session", {
      wallet: { aether: 100000 },
      account: { level: 100 },
      progress: {},
      roster: {},
      featured: { seq: 1, startedAt: Date.now(), endsAt: Date.now() + 86400000 },
    });
  resetSession();
  await activate({
    package: { id: "gacha-forge", version: "fixture" },
    api: {
      runtime: {
        persistence: {
          documents: {
            getById: async (_package, id) => clone(docs.get(id) || null),
            list: async (_package, kind) => clone([...docs.values()].filter((doc) => !kind || doc.kind === kind)),
            create: async (document) => {
              seed(document.id, document.kind, document.data);
              return clone(docs.get(document.id));
            },
            update: async (document) => {
              const before = docs.get(document.id);
              if (before?.revision !== document.expectedRevision || (document.id === sessionId && failSessionWrite))
                return null;
              const saved = { ...before, ...clone(document), revision: before.revision + 1 };
              docs.set(saved.id, saved);
              return clone(saved);
            },
          },
        },
        logger: Object.fromEntries(["info", "warn", "error", "debug"].map((key) => [key, () => {}])),
      },
      registerPrivilegedRoutes: async (register) =>
        register({ get() {}, post: (name, handler) => routes.set(name, handler) }),
    },
  });
  const call = (route, body = {}) => routes.get(route)({ body: { runId, ...body } });
  const session = () => docs.get(sessionId).data;
  const pulls = async (banner, count, rarity, valid = true) => {
    Math.random = () => (rarity === 5 ? 0 : rarity === 4 ? 0.01 : 0.99);
    failSessionWrite = !valid;
    try {
      return await call("/summon", { banner, count });
    } finally {
      failSessionWrite = false;
    }
  };

  for (const banner of ["char-standard", "wpn-standard", "char-featured", "wpn-featured"]) {
    resetSession();
    const info = await call("/summon-banner", { banner });
    assert.equal(info.ok, true);
    const descriptor = info.banner.music;
    assert.match(descriptor.cue, new RegExp(`^banner-${banner}-`));
    const asset = track(descriptor.cue);
    assert.equal((await call("/audio/library", { track: asset })).ok, true);
    assert.deepEqual((await call("/audio/library")).tracks, [], "banner music stays locked before a five-star");
    await pulls(banner, 1, 3);
    assert.deepEqual((await call("/audio/library")).tracks, []);
    await pulls(banner, 1, 4);
    assert.deepEqual((await call("/audio/library")).tracks, []);
    const before = clone(session());
    const failed = await pulls(banner, 1, 5, false);
    assert.equal(failed.error, "write-conflict");
    assert.deepEqual(session(), before, "a rejected pull persists neither reward nor wallet/pity changes");
    const result = await pulls(banner, 1, 5);
    assert.equal(result.ok, true);
    assert.equal(result.results[0].rarity, 5);
    assert.equal(session().audioBanners[descriptor.cue].unlocked, true);
    assert.equal((await call("/audio/library")).tracks[0].tag, asset.tag);
    await pulls(banner, 10, 5);
    assert.equal(
      (await call("/audio/library")).tracks.length,
      1,
      "duplicate and ten-pull awards do not duplicate songs",
    );
  }
  resetSession();
  const first = (await call("/summon-banner", { banner: "char-featured" })).banner.music;
  session().pity = { "char:featured": { count: 89, since4: 0, sinceFeatured: 0 } };
  Math.random = () => 0.75;
  const offBanner = await call("/summon", { banner: "char-featured", count: 1 });
  assert.equal(offBanner.results[0].id, char5, "a lost featured chance still pulls a standard five-star");
  assert.equal(
    session().audioBanners[first.cue].unlocked,
    true,
    "an off-banner result collects the banner actually pulled",
  );
  seed(`${runId}:banner:char:f2`, "banner", featured("f2"));
  seed(`${runId}:banner:wpn:f2`, "banner", { ...featured("f2"), fiveId: weapon5 });
  session().featured = { seq: 2, startedAt: Date.now(), endsAt: Date.now() + 86400000 };
  const second = (await call("/summon-banner", { banner: "char-featured" })).banner.music;
  assert.notEqual(first.cue, second.cue);
  assert.equal(session().audioBanners[first.cue].unlocked, true);
  assert.equal(session().audioBanners[second.cue].unlocked, false);
  docs.get("index").data.runs[0].audio.generate = false;
  await pulls("char-featured", 1, 5);
  assert.equal(
    session().audioBanners[second.cue].unlocked,
    false,
    "generation opt-out does not award a new soundtrack",
  );
  const asset = track("home");
  assert.equal((await call("/audio/library", { track: asset })).ok, true);
  for (const change of [
    { path: "https://example.invalid/song.mp3" },
    { connectionId: "other" },
    { tag: track("boss").tag },
    { cue: "__proto__" },
  ])
    assert.equal((await call("/audio/library", { track: { ...asset, ...change } })).error, "bad-request");
  assert.equal((await call("/audio/library", { runId: "other-world", track: asset })).error, "not-found");
  for (const file of ["cached.wav", "custom.theme.mp3", "My Theme.ogg"]) {
    const cached = {
      ...asset,
      tag: `${asset.tag.slice(0, -7)}${file.replace(/\.[^.]+$/u, "")}`,
      path: `${asset.path.slice(0, -11)}${file}`,
    };
    assert.equal(
      settings.recordForgeSoundtrack({}, runId, cached),
      true,
      "cached replacements use the Engine's accepted audio basename contract",
    );
    assert.equal(settings.normalizeForgeAudio({ homeMusic: cached.tag }).homeMusic, cached.tag);
  }
  for (const file of ["../outside.mp3", "nested/song.mp3", "hidden\\song.mp3", ".hidden.mp3", "song.svg"])
    assert.equal(
      settings.recordForgeSoundtrack({}, runId, { ...asset, path: `${asset.path.slice(0, -11)}${file}` }),
      false,
    );

  // The real controller reuses collected files with generation off and never composes the selected Home song.
  const events = [];
  const host = {
    _run: { runId, audio: { generate: false, homeMusic: asset.tag } },
    _root: { addEventListener() {}, removeEventListener() {} },
    _postJson: async (_route, body) => call("/audio/library", body),
  };
  const manifest = { assets: { [asset.tag]: { path: asset.path } } };
  const services = {
    audio: {
      createPlayer: () =>
        Object.fromEntries(
          ["setVolumes", "setMuted", "playMusic", "dispose"].map((method) => [
            method,
            (...args) => events.push([method, ...args]),
          ]),
        ),
      getAssetManifest: async () => manifest,
      selectDefaultMusic: () => "stock:home",
    },
  };
  const engineRequests = [];
  globalThis.Ze = (path) => {
    engineRequests.push(String(path));
    throw new Error("Selected file playback must not request generation");
  };
  for (let reload = 0; reload < 2; reload += 1) {
    const controller = new ForgeAudioController(host, services);
    await controller.cue("home");
    assert.equal(controller.currentTag, asset.tag);
    controller.configure({ ...host._run.audio, muted: true, musicVolume: 0 });
    assert(events.some(([method, value]) => method === "setMuted" && value === true));
    controller.dispose();
  }
  delete manifest.assets[asset.tag];
  const missing = new ForgeAudioController(host, services);
  await missing.cue("home");
  assert.equal(missing.currentTag, "stock:home");
  assert.equal(missing.settings.homeMusic, asset.tag, "a removed file preserves the user's saved choice");
  missing.dispose();
  let resolveOld;
  const delayed = new Promise((resolve) => {
    resolveOld = resolve;
  });
  let reads = 0;
  manifest.assets[asset.tag] = { path: asset.path };
  host._postJson = async () => (++reads === 1 ? delayed : { ok: true, tracks: [asset] });
  const reordered = new ForgeAudioController(host, services);
  const refresh = reordered.refreshLibrary();
  resolveOld({ ok: true, tracks: [] });
  await refresh;
  await reordered.cue("home");
  assert.equal(reordered.currentTag, asset.tag, "an older response cannot erase a newer library");
  let attempts = 0;
  host._postJson = async (_route, body) => {
    if (body.track && ++attempts === 1) return { ok: false, error: "write-conflict" };
    return { ok: true, tracks: [asset] };
  };
  await reordered.refreshLibrary(asset);
  assert.equal(reordered.unrecordedTracks.size, 1);
  await reordered.refreshLibrary();
  assert.equal(attempts, 2, "a later refresh retries failed registration without composing again");
  assert.equal(reordered.unrecordedTracks.size, 0);
  const accepted = [];
  host._postJson = async (_route, body) => {
    if (body.track?.tag === "invalid") return { ok: false, error: "bad-request" };
    if (body.track) accepted.push(body.track.tag);
    return { ok: true, tracks: [asset] };
  };
  reordered.unrecordedTracks.set("invalid", { ...asset, tag: "invalid" });
  await reordered.refreshLibrary(asset);
  assert.deepEqual(accepted, [asset.tag], "a permanent rejection cannot block the next valid track");
  assert.equal(reordered.unrecordedTracks.size, 0);
  reordered.dispose();
  session().audioTracks = [];
  host._run.audio.audioConnectionId = sourceId;
  host._postJson = async (_route, body) => call("/audio/library", body);
  const recovered = new ForgeAudioController(host, services);
  await recovered.libraryRequest;
  assert.equal(
    recovered.library[0].tag,
    asset.tag,
    "pre-update generated world music is recovered from the Engine manifest",
  );
  assert.equal(session().audioTracks[0].tag, asset.tag);
  recovered.dispose();
  assert.equal(
    forgeAudioCue({
      _state: () => "hud",
      _hudView: "summon",
      _summonBannerState: "ready",
      _summonBanner: { banner: { music: first } },
    }),
    first.cue,
  );
  assert(forgeAudioFields().some((field) => field.id === "audio.homeMusic" && field.settings === "visual"));
  assert.deepEqual(
    engineRequests.filter((path) => /\/api\/audio\/generate|\/audio\/prompt/u.test(path)),
    [],
    "selected-file playback and manifest recovery issue no generation or prompt requests",
  );
  console.info(
    "Soundtrack regression passed: actual summon awards/conflicts/rotations, library boundaries, reload and selected/missing playback.",
  );
} finally {
  Math.random = random;
  Object.assign(globalThis, originals);
  await rm(directory, { recursive: true, force: true });
}
