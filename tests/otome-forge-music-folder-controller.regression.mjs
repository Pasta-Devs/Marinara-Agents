// Run the production controller against an in-memory Engine audio service; no browser or provider is used.
// Run: node --test tests/otome-forge-music-folder-controller.regression.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const client = join(repo, "packages/otome-forge/src/engine/packages/client/src/features/otome-forge");
const controllerFile = join(client, "hooks/use-otome-audio.ts");
const esbuild = createRequire(join(repo, "package.json"))("esbuild");
const standIns = {
  react: `export const createContext = () => ({});
export const Fragment = null, createElement = () => null, useContext = () => null,
useEffect = () => {}, useMemo = () => {}, useRef = () => {}, useState = () => {}, useSyncExternalStore = () => {};`,
  "@tanstack/react-query": "export const useQueryClient = () => {};",
  "marinara:host": "export const host = globalThis.fixture.host;",
  "../../../lib/api-client": "export const api = globalThis.fixture.api;",
  "../../../lib/tts-service": `export const ttsUnavailableReason = null;
export const ttsService = { getActiveId: () => null };`,
  "../api": "export const useOtomeApi = () => {};",
  "../props": "export const useOtomeProps = () => {};",
  "./use-run": "export const patchRun = () => {};",
};
const built = await esbuild.build({
  stdin: {
    contents: await readFile(controllerFile, "utf8"),
    resolveDir: dirname(controllerFile),
    sourcefile: controllerFile,
    loader: "ts",
  },
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
  logLevel: "silent",
  plugins: [
    {
      name: "mock-host",
      setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path }) => {
          if (Object.hasOwn(standIns, path)) return { path, namespace: "mock-host" };
          if (path.startsWith("@forge-kit/")) return { path: join(repo, "sources/forge-kit", path.slice(11)) };
        });
        build.onLoad({ filter: /.*/, namespace: "mock-host" }, ({ path }) => ({ contents: standIns[path] }));
      },
    },
  ],
});
const source = built.outputFiles[0].text;
const stockTag = "music:dialogue:slice_of_life:calm:stock";
const stock = { [stockTag]: { path: "music/dialogue/slice_of_life/calm/stock.mp3" } };
const custom = {
  "music:custom:a": { path: "music/custom/a.mp3" },
  "music:custom:b": { path: "music/custom/b.mp3" },
};
const manifest = { assets: { ...stock, ...custom } };
const settle = () => new Promise(setImmediate);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

function fixture(readManifest = () => manifest, brief) {
  const calls = { manifest: 0, play: [], stop: 0, api: [], brief: [] };
  const player = {
    playMusic: (tag, assets) => calls.play.push({ tag, assets }),
    stopMusic: () => (calls.stop += 1),
    setMuted() {},
    setVolumes() {},
    unlock() {},
    playSfx() {},
    dispose() {},
  };
  const module = { exports: {} };
  runInNewContext(source, {
    module,
    exports: module.exports,
    AbortController,
    TextEncoder,
    console,
    fetch: () => assert.fail("The controller must not make real network requests"),
    fixture: {
      host: {
        services: {
          audio: {
            createPlayer: () => player,
            getAssetManifest: () => {
              calls.manifest += 1;
              return Promise.resolve().then(() => readManifest(calls.manifest));
            },
            selectDefaultMusic: (_cue, listed) => Object.keys(listed.assets).find((tag) => tag === stockTag) ?? null,
          },
        },
      },
      api: {
        get: async (url) => {
          calls.api.push({ method: "GET", url });
          return { configured: true, music: true, connectionId: "connection-1" };
        },
        post: async (url) => {
          calls.api.push({ method: "POST", url });
          assert.fail("No paid audio generation is expected");
        },
      },
    },
  });
  const controller = new module.exports.OtomeAudioController("r-foldertest-aaaaaa");
  controller.setDeps({
    post: (url, body, options) => {
      calls.brief.push({ url, body, options });
      return brief ? brief(options) : Promise.resolve({ prompt: "Instrumental music." });
    },
    debugMode: false,
    lis: [],
    player: { name: "", personaId: "" },
    onTracks() {},
  });
  return { controller, calls, settings: (change = {}) => ({ ...controller.audioSettings, ...change }) };
}

test("saved folder playback ignores unsaved generation and preserves retained generated tracks", async (t) => {
  const retained = {
    cue: "home",
    connectionId: "old",
    tag: "music:contexts:retained",
    path: "music/contexts/retained.mp3",
  };
  const f = fixture(() => ({ assets: { ...manifest.assets, [retained.tag]: { path: retained.path } } }));
  t.after(() => f.controller.dispose());
  const saved = f.settings({ generate: false, musicFolder: "music/custom" });
  f.controller.configure(saved);
  f.controller.setTracks([retained]);
  f.controller.setBaseCue("home");
  await settle();
  assert.match(f.calls.play.at(-1).tag, /^music:custom:/u);
  f.controller.configure(
    { ...saved, generate: true, musicFolder: "music/unsaved", audioConnectionId: "unsaved" },
    saved,
  );
  await settle();
  assert.equal(f.calls.api.length + f.calls.brief.length, 0);
  f.controller.configure({ ...saved, musicFolder: "" });
  await settle();
  assert.equal(f.calls.play.at(-1).tag, retained.tag, "folder playback never removes an existing generated track");
});

test("a late old-folder manifest never replaces the newer folder", async (t) => {
  const a = deferred();
  const b = deferred();
  const f = fixture((read) => (read === 1 ? manifest : read === 2 ? a.promise : b.promise));
  t.after(() => f.controller.dispose());
  f.controller.setBaseCue("home");
  f.controller.configure(f.settings({ musicFolder: "music/a" }));
  f.controller.configure(f.settings({ musicFolder: "music/b" }));
  b.resolve({ assets: { "music:b:only": { path: "music/b/only.mp3" } } });
  await settle();
  a.resolve({ assets: { "music:a:only": { path: "music/a/only.mp3" } } });
  await settle();
  assert.deepEqual(
    f.calls.play.map(({ tag }) => tag),
    ["music:b:only"],
  );
});

test("deleting a selected folder between cue changes falls back without generating or polling per render", async (t) => {
  let live = manifest;
  const f = fixture(() => live);
  t.after(() => f.controller.dispose());
  f.controller.configure(f.settings({ generate: false, musicFolder: "music/custom" }));
  f.controller.setBaseCue("home");
  await settle();
  assert.match(f.calls.play.at(-1).tag, /^music:custom:/u);
  const reads = f.calls.manifest;
  live = { assets: stock };
  f.controller.setBaseCue("tense");
  await settle();
  assert.equal(f.calls.play.at(-1).tag, stockTag);
  assert.equal(f.calls.manifest, reads + 1, "a changed cue refreshes the selected folder");
  assert.equal(f.controller.getSnapshot().notice.kind, "musicFolderUnavailable");
  f.controller.setBaseCue("tense");
  await settle();
  assert.equal(f.calls.manifest, reads + 1, "an unchanged cue never polls the manifest");
  live = { assets: {} };
  f.controller.setBaseCue("date");
  await settle();
  assert.equal(f.calls.stop, 1, "without a stock fallback the old track is stopped");
  assert.equal(f.calls.api.length + f.calls.brief.length, 0);
});

test("a transient manifest failure retains the last usable folder without paid requests", async (t) => {
  let offline = false;
  const f = fixture(() => {
    if (offline) throw new Error("Offline manifest read");
    return manifest;
  });
  t.after(() => f.controller.dispose());
  f.controller.configure(f.settings({ musicFolder: "music/custom" }));
  f.controller.setBaseCue("home");
  await settle();
  offline = true;
  f.controller.setBaseCue("tense");
  await settle();
  assert.match(f.calls.play.at(-1).tag, /^music:custom:/u);
  assert.equal(f.controller.getSnapshot().notice, null);
  assert.equal(f.calls.api.length + f.calls.brief.length, 0);
});

test("an unreadable first manifest is not reported as a missing music folder", async (t) => {
  const f = fixture(() => Promise.reject(new Error("Controlled manifest read failure")));
  t.after(() => f.controller.dispose());
  f.controller.configure(f.settings({ musicFolder: "music/custom" }));
  f.controller.setBaseCue("home");
  await settle();
  assert.equal(f.controller.getSnapshot().notice, null);
  assert.deepEqual(f.calls.play, []);
  assert.equal(f.calls.stop, 0);
  assert.equal(f.calls.api.length + f.calls.brief.length, 0);
});

test("switching to a folder while a music brief is pending prevents the paid generation", async (t) => {
  const brief = deferred();
  const f = fixture(undefined, () => brief.promise);
  t.after(() => f.controller.dispose());
  f.controller.configure(f.settings({ generate: true, audioConnectionId: "connection-1" }));
  f.controller.setBaseCue("home");
  await settle();
  assert.equal(f.calls.brief.length, 1);
  f.controller.configure(f.settings({ generate: false, musicFolder: "music/custom" }));
  brief.resolve({ prompt: "Instrumental music." });
  await settle();
  assert.equal(f.calls.brief[0].options.signal.aborted, true);
  assert.match(f.calls.play.at(-1).tag, /^music:custom:/u);
  assert.equal(f.calls.api.filter(({ method }) => method === "POST").length, 0);
});

test("a manifest arriving after disposal cannot start folder playback", async () => {
  const pending = deferred();
  const f = fixture(() => pending.promise);
  f.controller.configure(f.settings({ musicFolder: "music/custom" }));
  f.controller.setBaseCue("home");
  f.controller.dispose();
  pending.resolve(manifest);
  await settle();
  assert.equal(f.calls.play.length, 0);
  assert.equal(f.calls.api.length + f.calls.brief.length, 0);
});
