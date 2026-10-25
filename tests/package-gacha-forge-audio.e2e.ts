import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { recordForgeSoundtrack } from "../packages/gacha-forge/src/audio-settings.mjs";

const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (!engineRoot) throw new Error("Set MARINARA_ENGINE_ROOT to a compatible Engine checkout");
const appVersion = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
const portrait = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#83597d"/><circle cx="100" cy="90" r="45" fill="#eed8b2"/><path d="M35 300V190Q100 125 165 190V300Z" fill="#353d60"/></svg>')}`;
const baseRun = {
  runId: "audio-ui-proof",
  name: "Audio proof",
  scenario: "Synthetic garden audio.",
  hudStyle: "vanguard",
  connectionId: "fixture-model",
  hasStandardBanner: true,
  protagonist: { name: "Mari" },
  story: { preforge: "off", choices: true },
  progress: {},
  decor: { unit: { id: "arden", name: "Arden", portrait } },
  audio: {
    tts: false,
    generate: false,
    muted: false,
    musicVolume: 0.5,
    dialogueVolume: 1,
    sfxVolume: 0.5,
    autoplayPauseSeconds: 3,
    audioConnectionId: "",
  },
};
const scene = {
  ok: true,
  musicMood: "sad",
  places: [],
  choices: [],
  cast: [
    { name: "Arden", art: portrait, prota: false, characterId: "engine-arden" },
    { name: "Generated", art: portrait, prota: false, characterId: null },
  ],
  segments: [
    { speaker: "Arden", text: "ASSIGNED_FIRST" },
    { speaker: "Generated", text: "UNASSIGNED_SECOND" },
    { speaker: "Arden", text: "THOUGHT_THIRD", thought: true },
    { speaker: "", text: "NARRATION_FOURTH" },
    { speaker: "Arden", text: "ASSIGNED_LAST" },
  ],
};

async function openForge(
  page: Page,
  testInfo: TestInfo,
  options: {
    voice?: boolean;
    empty?: boolean;
    realGeneration?: string;
    realConnections?: boolean;
    selectedAudio?: string;
    realVideo?: boolean;
    reducedMotion?: "reduce" | "no-preference";
    selectedAnimation?: string;
    hostTheme?: "dark" | "light";
    runId?: string;
    connectionId?: string;
  } = {},
) {
  const saved: typeof baseRun & { animationConnectionId?: string } = structuredClone(baseRun);
  if (options.runId) saved.runId = options.runId;
  if (options.connectionId) saved.connectionId = options.connectionId;
  saved.audio.tts = options.voice === true;
  if (options.selectedAudio) saved.audio.audioConnectionId = options.selectedAudio;
  if (options.selectedAnimation) saved.animationConnectionId = options.selectedAnimation;
  if (options.realGeneration) {
    saved.scenario = "W".repeat(4000);
    saved.audio.generate = true;
    saved.audio.audioConnectionId = options.realGeneration;
  }
  const speech: Record<string, unknown>[] = [];
  const generated: Record<string, any>[] = [];
  const briefs: Record<string, unknown>[] = [];
  const writes: Record<string, any>[] = [];
  await page.setViewportSize(
    testInfo.project.name.includes("mobile") ? { width: 874, height: 402 } : { width: 1440, height: 900 },
  );
  await page.emulateMedia({ reducedMotion: options.reducedMotion ?? "reduce" });
  await page.addInitScript(
    ({ version, realVideo, hostTheme }) => {
      localStorage.removeItem("marinara-active-chat-id");
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            theme: hostTheme,
            hasCompletedOnboarding: true,
            sidebarOpen: false,
            rightPanelOpen: false,
            appAccentPulseMode: false,
          },
          version: 65,
        }),
      );
      // Controlled media only: the real host TTS service still fetches, queues, cancels and handles ended.
      // Native device playback/codec policy is deliberately outside this fixture.
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (realVideo && this instanceof HTMLVideoElement) {
          if ((globalThis as any).__gachaRejectVideoAutoplay)
            return Promise.reject(new DOMException("Controlled autoplay rejection", "NotAllowedError"));
          return play.call(this);
        }
        return Promise.resolve();
      };
    },
    { version: appVersion, realVideo: options.realVideo === true, hostTheme: options.hostTheme ?? "dark" },
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  if (!options.realGeneration && !options.realConnections)
    await page.route("**/api/connections", (route) =>
      route.fulfill({
        json: [
          { id: "fixture-model", name: "Text fixture", provider: "custom", model: "fixture" },
          {
            id: "music-fixture",
            name: "Audio fixture",
            provider: "audio_generation",
            audioMusic: true,
            audioSoundEffects: true,
          },
        ],
      }),
    );
  await page.route("**/api/tts/config", (route) =>
    route.fulfill({
      json: {
        enabled: false,
        connectionId: "speech-fixture",
        connectionProfiles: {
          "speech-fixture": { voiceAssignments: [{ characterId: "engine-arden", voice: "voice-arden" }] },
        },
      },
    }),
  );
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page.route("**/api/tts/speak", async (route) => {
    speech.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "audio/wav", body: wav });
  });
  if (!options.realGeneration)
    await page.route("**/api/audio/config*", (route) =>
      route.fulfill({
        json: {
          configured: true,
          connectionId: new URL(route.request().url()).searchParams.get("audioConnectionId") || "music-fixture",
          music: true,
          soundEffects: false,
          source: "custom",
        },
      }),
    );
  if (!options.realGeneration)
    await page.route("**/api/audio/generate", async (route) => {
      const body = route.request().postDataJSON();
      generated.push(body);
      await route.fulfill({
        json: {
          tag: `music:package:${body.context?.key || "sfx"}`,
          path: `music/package/${body.context?.key || "sfx"}.wav`,
          cached: false,
        },
      });
    });
  // Exercise the shipped client orchestration without invoking a paid narration provider.
  // The actual persisted-world narration route has separate maintained Node coverage.
  await page.route("**/api/gacha-forge/audio/prompt", async (route) => {
    briefs.push(route.request().postDataJSON());
    await route.fulfill({
      json: { ok: true, prompt: "Original fantasy instrumental: woodwinds, harp and soft strings." },
    });
  });
  await page.route("**/api/game-assets/manifest", (route) =>
    route.fulfill({
      json: {
        scannedAt: "fixture",
        count: 1,
        assets: {
          "music:dialogue:slice_of_life:calm:fixture": {
            tag: "music:dialogue:slice_of_life:calm:fixture",
            category: "music",
            subcategory: "dialogue",
            name: "Fixture",
            path: "music/fixture.wav",
            ext: ".wav",
          },
        },
        byCategory: {},
      },
    }),
  );
  await page.route("**/api/game-assets/file/**", (route) => route.fulfill({ contentType: "audio/wav", body: wav }));
  await page.route("**/api/gacha-forge/state*", (route) =>
    route.fulfill({
      json: options.empty
        ? { runs: [], guidesSeen: ["welcome"] }
        : {
            runs: [saved],
            activeRunId: saved.runId,
            activeRun: saved,
            guidesSeen: ["welcome", "home", "settings", "continuity", "beat", "chapter"],
          },
    }),
  );
  await page.route("**/api/gacha-forge/continuity", (route) => route.fulfill({ json: { ok: true, chapters: [] } }));
  await page.route("**/api/gacha-forge/preforge", (route) =>
    route.fulfill({ json: { ok: true, preforge: { mode: "off", locked: false, canAuto: false } } }),
  );
  await page.route("**/api/gacha-forge/beat", (route) => route.fulfill({ json: scene }));
  await page.route("**/api/gacha-forge/run/sources", async (route) => {
    const body = route.request().postDataJSON();
    writes.push(body.sources);
    Object.assign(saved, { ...body.sources, audio: { ...saved.audio, ...body.sources.audio } });
    await route.fulfill({ json: { ok: true, run: saved } });
  });
  await page.route("**/api/gacha-forge/setup/draft", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? {
              ok: true,
              draft: {
                step: 4,
                furthest: 6,
                values: { scenario: "A synthetic world.", "audio.tts": false, "audio.generate": false },
              },
            }
          : { ok: true },
    }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  const forge = page.locator("marinara-capability-gacha-forge");
  if (!options.empty) await showHome(forge);
  return { forge, saved, speech, generated, briefs, writes };
}

async function showHome(forge: Locator) {
  await expect.poll(() => forge.evaluate((node) => (node as any)._boot)).toBe("ready");
  await forge.evaluate((node) => {
    const game = node as any;
    game._clearBeat();
    game._bannerReady = true;
    game._artReady = true;
    game._planEscaped = true;
    game._hudView = "home";
    game._renderBrowser();
  });
  await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
}

async function openAnimatedBanner(forge: Locator) {
  await forge.evaluate((node) => {
    const game = node as any;
    game._guidesSeen.add("summon");
    game._guide = "";
    game._openSummon();
  });
  await expect(forge.locator('[data-screen="banner"] .show > .art.wide')).toBeVisible();
}

async function animationProof(
  page: Page,
  testInfo: TestInfo,
  options: { selected?: boolean; reduce?: boolean; hostTheme?: "dark" | "light" } = {},
) {
  const clip = readFileSync(resolve(__dirname, "fixtures/gacha-banner-loop.mp4"));
  const url = `/api/gacha-forge/banner-animation/file/${"a".repeat(64)}/${"b".repeat(64)}.mp4`;
  const state = {
    posts: [] as Record<string, any>[],
    compositions: 0,
    generationFailed: false,
    playbackFailed: false,
    browserErrors: [] as string[],
  };
  page.on("pageerror", (error) => state.browserErrors.push(error.message));
  const cached = new Set<string>();
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        { id: "fixture-model", provider: "custom", name: "Text fixture" },
        { id: "image-fixture", provider: "image_generation", name: "Image fixture" },
        { id: "music-fixture", provider: "audio_generation", name: "Audio fixture" },
        { id: "video-fixture", provider: "video_generation", name: "Video fixture" },
        { id: "quarantined", provider: "video_generation", name: "Unreviewed", profileImportReviewRequired: "true" },
        {
          id: "quarantined-boolean",
          provider: "video_generation",
          name: "Unreviewed boolean",
          profileImportReviewRequired: true,
        },
      ],
    }),
  );
  await page.route("**/api/gacha-forge/summon-banner", (route) => {
    const id = route.request().postDataJSON().banner;
    return route.fulfill({
      json: {
        ok: true,
        banner: {
          id,
          kind: "character",
          type: id.endsWith("featured") ? "featured" : "standard",
          title: "Moonlit garden",
          mode: "permanent",
          art: portrait,
          music: { cue: `banner-${id}-${id.endsWith("featured") ? "f1" : "standard"}` },
          featured: [{ id: "arden", name: "Arden", rarity: 5, kind: "character", portrait }],
          pool4: [],
          canArt: false,
        },
        banners: ["char-standard", "char-featured"].map((id) => ({
          id,
          kind: "character",
          type: id.endsWith("featured") ? "featured" : "standard",
          title: "Moonlit garden",
          art: portrait,
          live: true,
        })),
        rates: { five: 0.01, four: 0.05 },
        pity: { count: 0, soft: 75, hard: 90 },
        wallet: { aether: 1600 },
        cost: 160,
      },
    });
  });
  await page.route("**/api/gacha-forge/banner-animation", async (route) => {
    const body = route.request().postDataJSON();
    state.posts.push(body);
    if (state.generationFailed) return route.fulfill({ json: { ok: false, error: "animation-failed", retry: true } });
    if (!cached.has(body.banner)) state.compositions += 1;
    await route.fulfill({
      json: { ok: true, animation: { key: "b".repeat(64), url, poster: portrait }, cached: cached.has(body.banner) },
    });
    cached.add(body.banner);
  });
  await page.route("**/api/gacha-forge/banner-animation/file/**", (route) =>
    route.fulfill({
      contentType: "video/mp4",
      body: state.playbackFailed ? Buffer.from("invalid video") : clip,
    }),
  );
  const opened = await openForge(page, testInfo, {
    realConnections: true,
    realVideo: true,
    reducedMotion: options.reduce ? "reduce" : "no-preference",
    selectedAnimation: options.selected ? "video-fixture" : undefined,
    hostTheme: options.hostTheme,
  });
  return { ...opened, state };
}

async function decodedBannerVideo(forge: Locator) {
  // Departing screens keep decorative shadow-root clones outside the active view during transitions.
  const video = forge.locator(".gf-stage > .gf-view video[data-banner-animation]");
  await expect(video).toHaveCount(1);
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate((node: HTMLVideoElement) => ({
        width: node.videoWidth,
        height: node.videoHeight,
        decoded: node.readyState >= 2,
        paused: node.paused,
        muted: node.muted && node.defaultMuted,
        loop: node.loop,
        inline: node.playsInline,
      })),
    )
    .toEqual({ width: 160, height: 90, decoded: true, paused: false, muted: true, loop: true, inline: true });
  await expect(video).toHaveCSS("opacity", "1");
  return video;
}

async function settleBannerCapture(forge: Locator) {
  const view = forge.locator(".gf-stage > .gf-view");
  await view.evaluate(async (node) => {
    await Promise.all(
      node
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  await expect(forge.locator(".gf-stage > .gf-leave, .gf-stage > .gf-hold")).toHaveCount(0);
  await expect(view).toHaveCSS("opacity", "1");
  await expect(view).toHaveCSS("transform", "none");
}

async function seedScene(forge: Locator, theme = "aurora") {
  await forge.evaluate(
    (node, fixture) => {
      const game = node as any;
      game._clearBeat();
      game._boot = "ready";
      game._welcomeBegun = true;
      game._guidesSeen = new Set(["welcome", "home", "chapters", "chapter", "beat", "settings", "continuity"]);
      game._run.hudStyle = fixture.theme;
      game._bannerReady = true;
      game._artReady = true;
      game._artState = "idle";
      game._artBlocking = false;
      game._hudView = "chapter";
      game._planChapter = 1;
      game._chapterProgress = { normal: 0 };
      game._plan = { title: "Audio chapter", nodes: [{ index: 1, type: "story", title: "The garden", storyIndex: 0 }] };
      game._activeStoryNode = {
        chapter: 1,
        nodeIndex: 0,
        storyIndex: 0,
        title: "The garden",
        difficulty: "normal",
        replay: false,
      };
      game._beatState = "loading";
      game._beatRequested = false;
      game._renderBrowser();
    },
    { theme },
  );
  await expect(forge.locator("[data-vn]")).toBeVisible();
}

async function frameBottom(frame: Locator, artSelector: string) {
  await expect(frame).toBeVisible();
  await frame.evaluate(async (node) => {
    await Promise.all(
      node
        .closest(".gf-stage")!
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  return frame.evaluate((node, selector) => {
    const art = node.querySelector(selector)!;
    return {
      gap: node.getBoundingClientRect().bottom - art.getBoundingClientRect().bottom,
      edge: Number.parseFloat(getComputedStyle(node).getPropertyValue("--edge-w")),
      bottom: getComputedStyle(art).bottom,
      padding: getComputedStyle(node).paddingBottom,
    };
  }, artSelector);
}

test("Combat has one working mute beside its fullscreen control without overlapping the toolbar", async ({
  page,
}, testInfo) => {
  const { forge, saved } = await openForge(page, testInfo);
  for (const theme of ["aurora", "bloom"]) {
    saved.hudStyle = theme;
    await forge.evaluate((node, theme) => {
      const game = node as any;
      game._clearBeat();
      game._run.hudStyle = theme;
      game._guidesSeen.add("combat");
      game._hudView = "combat";
      game._combatPhase = "battle";
      // Pause the simulation while exercising the shipped battle toolbar and its real handlers.
      game._combat = { allies: [], enemies: [] };
      game._combatRun = null;
      game._combatNonce += 1;
      game._renderBrowser();
    }, theme);
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    const mute = forge.locator(".cbar .ctrls > .gf-mute");
    await expect(mute).toBeVisible();
    await expect(forge.locator(".gf-mute:visible")).toHaveCount(1);
    const overlap = await mute.evaluate((button) => {
      const box = button.getBoundingClientRect();
      return [...button.parentElement!.querySelectorAll("button")].some((other) => {
        if (other === button) return false;
        const sibling = other.getBoundingClientRect();
        return (
          Math.min(box.right, sibling.right) - Math.max(box.left, sibling.left) > 1 &&
          Math.min(box.bottom, sibling.bottom) - Math.max(box.top, sibling.top) > 1
        );
      });
    });
    expect(overlap, `${theme} mute does not cover another toolbar control`).toBe(false);
    await mute.click();
    await expect.poll(() => saved.audio.muted).toBe(true);
    await expect(mute).toHaveAccessibleName("Unmute audio");
    await mute.click();
    await expect.poll(() => saved.audio.muted).toBe(false);
    await forge.locator(".cbar .gf-fs-bar").click();
    await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
    await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    await page.screenshot({ path: testInfo.outputPath(`combat-single-mute-${theme}.png`) });
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    await forge.locator(".cbar .gf-fs-bar").click();
    await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
  }
});

for (const orientation of ["landscape", "portrait"]) {
  test(`Letters composer can send above a simulated ${orientation} keyboard and restores its controls`, async ({
    page,
  }, testInfo) => {
    // Browser emulation cannot open an iPhone keyboard. Exercise the real Engine viewport
    // contract with controlled visualViewport geometry, not a claim of native Safari proof.
    const iphone = testInfo.project.name === "mobile-webkit";
    if (iphone)
      await page.addInitScript(() => {
        let keyboardTop: number | null = null;
        let keyboardPan = 0;
        const viewport = new EventTarget();
        Object.defineProperties(viewport, {
          height: { get: () => keyboardTop ?? window.innerHeight },
          width: { get: () => window.innerWidth },
          offsetTop: { get: () => keyboardPan },
          pageTop: { get: () => keyboardPan },
          offsetLeft: { get: () => 0 },
          pageLeft: { get: () => 0 },
          scale: { get: () => 1 },
        });
        Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
        Object.defineProperty(window, "__forgeKeyboardTop", {
          value: (top: number | null, pan = 0) => {
            keyboardTop = top;
            keyboardPan = pan;
            viewport.dispatchEvent(new Event("resize"));
            viewport.dispatchEvent(new Event("scroll"));
          },
        });
      });
    const { forge, saved } = await openForge(page, testInfo);
    const theme = orientation === "landscape" ? "aurora" : "bloom";
    saved.hudStyle = theme;
    Object.assign(saved, { chatChannel: "Letters" });
    await page.setViewportSize({ width: 874, height: 402 });
    const unit = { id: "arden", name: "Arden", bond: 120, open: true, portrait };
    const messages = [{ id: "letter-1", who: "unit", text: "A letter before the journey." }];
    const sends: Record<string, unknown>[] = [];
    await page.route("**/api/gacha-forge/chat/list", (route) =>
      route.fulfill({ json: { ok: true, channel: "Letters", contacts: [unit] } }),
    );
    await page.route("**/api/gacha-forge/chat/open", (route) =>
      route.fulfill({
        json: { ok: true, channel: "Letters", unit, messages, cost: 1, max: 2400, photos: true, past: 1 },
      }),
    );
    await page.route("**/api/gacha-forge/chat/send", async (route) => {
      const body = route.request().postDataJSON();
      sends.push(body);
      messages.push({ id: "letter-2", who: "player", text: body.text });
      await route.fulfill({ json: { ok: true } });
    });
    await forge.evaluate((node, theme) => {
      const game = node as any;
      game._run.hudStyle = theme;
      game._run.chatChannel = "Letters";
      game._guidesSeen.add("chat");
      game._renderBrowser();
    }, theme);
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    await forge.locator(".gf-fs-bar").click();
    await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    await forge.locator("[data-chat-open]").click();
    await forge.locator('[data-chat-with="arden"]').click();
    const field = forge.locator("[data-chat-text]");
    await expect(field).toBeVisible();
    const draft = `A ${orientation} letter that survives the keyboard resizing.`;
    await field.fill(draft);
    const phone = orientation === "portrait" ? { width: 390, height: 844 } : { width: 874, height: 402 };
    const keyboardTop = orientation === "portrait" ? 300 : 190;
    if (iphone) {
      // Preserve the layout viewport, as iOS does; a portrait rotation happens with the letter open.
      await page.evaluate((top) => (window as any).__forgeKeyboardTop(top), keyboardTop);
      await page.setViewportSize(phone);
    } else {
      // Android's resizes-content path reduces the layout viewport itself.
      await page.setViewportSize({ width: phone.width, height: keyboardTop });
    }
    await expect(field).toHaveValue(draft);
    const send = forge.locator("[data-chat-send]");
    for (const control of [field, send]) {
      await expect(control).toBeVisible();
      await expect
        .poll(() =>
          control.evaluate((node, bottom) => {
            const box = node.getBoundingClientRect();
            const panel = node.closest(".hm-pk.chat")!.getBoundingClientRect();
            return box.top >= panel.top && box.bottom <= Math.min(panel.bottom, bottom) + 1;
          }, keyboardTop),
        )
        .toBe(true);
    }
    // The host intentionally hides its own bars for a focused package on a short touch
    // landscape screen (globals.css); the package must respect that keyboard policy.
    const hostHidesChrome = await page.evaluate(
      () =>
        matchMedia(
          "(orientation: landscape) and (max-height: 500px) and (min-width: 640px) and (hover: none) and (any-pointer: coarse)",
        ).matches &&
        document.documentElement.matches(
          "[data-mari-software-keyboard-open]:has([data-home-package-view] :focus-within)",
        ),
    );
    await expect(page.locator('[data-component="TopBar"]')).toBeVisible({ visible: !hostHidesChrome });
    await expect(forge.locator(".gf-bar")).toBeHidden();
    await field.fill(`${draft} Ready to send.`);
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    await page.screenshot({ path: testInfo.outputPath(`letters-${orientation}-simulated-keyboard.png`) });
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    // A real pointer tap, without force or Enter, catches layout changes when the textarea blurs.
    await send.click();
    await expect
      .poll(() => sends.at(-1))
      .toMatchObject({
        runId: baseRun.runId,
        unitId: "arden",
        text: `${draft} Ready to send.`,
      });
    await expect(forge.locator(".ch-msg.mine")).toContainText(`${draft} Ready to send.`);
    if (iphone && orientation === "landscape") {
      await page.evaluate(() => (window as any).__forgeKeyboardTop(190, 28));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    if (iphone) await page.evaluate(() => (window as any).__forgeKeyboardTop(null));
    await page.setViewportSize({ width: 874, height: 402 });
    await field.blur();
    await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
    await expect(forge.locator(".gf-bar")).toBeVisible();
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    await expect(forge.locator(".ch-list")).toBeVisible();
    await expect(forge.locator("[data-chat-photo]")).toBeVisible();
    await expect(forge.locator("[data-chat-past]")).toBeVisible();
    await expect(forge.locator(".ch-who .nm")).toHaveText("Arden");
    await expect(field).toHaveValue("");
    if (orientation === "landscape") {
      await field.press("?");
      await expect(field).toHaveValue("?");
      await field.blur();
      await forge.locator("button[data-chat-close]").click();
      let threshold = 100000;
      const thresholdWrites: number[] = [];
      await page.route("**/api/gacha-forge/warn-threshold", async (route) => {
        threshold = route.request().postDataJSON().warnTokens;
        thresholdWrites.push(threshold);
        Object.assign(saved, { warnTokens: threshold });
        await route.fulfill({ json: { ok: true, warnTokens: threshold } });
      });
      await page.route("**/api/gacha-forge/continuity", (route) =>
        route.fulfill({ json: { ok: true, chapters: [], warnTokens: threshold } }),
      );
      await page.route("**/api/gacha-forge/story-memory/status", (route) =>
        route.fulfill({ json: { ok: true, memory: { phase: "ready", retryable: false } } }),
      );
      await forge.evaluate((node) => {
        const game = node as any;
        game._run.contextTokens = game._contextTokens = 120000;
        game._run.warnTokens = game._warnTokens = 100000;
        game._openSettings("continuity");
      });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await forge.locator(".gf-stage > .gf-view .st-pane").evaluate((panel) => {
        panel.scrollTop = panel.scrollHeight;
      });
      await forge.locator('.gf-stage > .gf-view [data-view="advanced"]').click();
      await forge.locator('.gf-stage > .gf-view [data-view="continuity"]').click();
      let rotation = 0;
      // Synthetic camera insets use the Engine's explicit testable safe-area variables.
      // This exercises layout and retained viewport state, not physical iOS compositing.
      for (const viewport of [
        { width: 874, height: 402 },
        { width: 390, height: 844 },
        { width: 874, height: 402 },
      ]) {
        await page.evaluate((landscape) => {
          document.documentElement.style.setProperty("--mari-safe-area-inset-left", landscape ? "63px" : "0px");
          document.documentElement.style.setProperty("--mari-safe-area-inset-right", "0px");
        }, viewport.width > viewport.height);
        await page.setViewportSize(viewport);
        const control = forge.locator(".gf-stage > .gf-view [data-warn-custom]");
        await expect(control).toBeVisible();
        const geometry = await control.evaluate((input) => {
          const box = input.getBoundingClientRect();
          const panel = input.closest(".st-pane")!;
          const plate = input.closest(".st-plate")!;
          const visible = panel.getBoundingClientRect();
          return {
            input: { x: box.x, y: box.y, width: box.width, height: box.height },
            panel: {
              x: visible.x,
              y: visible.y,
              width: visible.width,
              height: visible.height,
              scrollTop: panel.scrollTop,
            },
            visibility: [input, plate, panel].map((node) => ({
              display: getComputedStyle(node).display,
              visibility: getComputedStyle(node).visibility,
              opacity: getComputedStyle(node).opacity,
            })),
            keyboard: document.documentElement.hasAttribute("data-mari-software-keyboard-open"),
            safeLeft: getComputedStyle(document.documentElement).getPropertyValue("--mari-safe-area-inset-left"),
          };
        });
        const label = `context-after-keyboard-${viewport.width}x${viewport.height}-${rotation++}`;
        writeFileSync(testInfo.outputPath(`${label}.json`), JSON.stringify(geometry, null, 2));
        await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
        if (viewport.width > viewport.height) {
          expect(geometry.input.y).toBeGreaterThanOrEqual(geometry.panel.y - 1);
          expect(geometry.input.y + geometry.input.height).toBeLessThanOrEqual(
            geometry.panel.y + geometry.panel.height + 1,
          );
        }
      }
      const custom = forge.locator(".gf-stage > .gf-view [data-warn-custom]");
      await custom.fill("65");
      await custom.press("Tab");
      await expect.poll(() => thresholdWrites).toEqual([65000]);
      await forge.locator('.gf-stage > .gf-view [data-view="advanced"]').click();
      await forge.locator('.gf-stage > .gf-view [data-view="continuity"]').click();
      await expect(custom).toHaveValue("65");
    }
  });
}

test("A first typed character message gets one SDK reply and archived history remains in the same window", async ({
  page,
}, testInfo) => {
  const { createChatRuntime, chatRunId, chatUnitId, chatConnectionId } = await import(
    pathToFileURL(resolve(__dirname, "fixtures/gacha-forge-chat-runtime.mjs")).href
  );
  const runtime = await createChatRuntime({ archived: 40 });
  try {
    await page.route("**/api/gacha-forge/chat/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace("/api/gacha-forge", "");
      const response = await runtime.post(path, route.request().postDataJSON());
      await route.fulfill({ status: response.status, json: response.body });
    });
    const { forge } = await openForge(page, testInfo, { runId: chatRunId, connectionId: chatConnectionId });
    await forge.evaluate((node, channel) => {
      const game = node as any;
      game._run.chatChannel = channel;
      game._guidesSeen.add("chat");
      game._renderBrowser();
    }, runtime.opened.body.channel);
    await forge.locator("[data-chat-open]").click();
    await forge.locator(`[data-chat-with="${chatUnitId}"]`).click();
    const field = forge.locator("[data-chat-text]");
    const message = "Will you remember this?";
    await field.pressSequentially(message);
    await expect(field).toHaveValue(message);
    const vigorBefore = runtime.session().wallet.vigor;
    await forge.locator("[data-chat-send]").click();
    const log = forge.locator("[data-chat-log]");
    await expect(log).toContainText("I heard your first message.");
    await expect(forge.locator(".ch-msg.mine").filter({ hasText: message })).toHaveCount(1);
    const visibleRows = await forge.locator(".ch-msg").allTextContents();
    const playerPosition = visibleRows.findIndex((text) => text.includes(message));
    expect(playerPosition).toBeGreaterThanOrEqual(0);
    expect(playerPosition).toBeLessThan(visibleRows.findIndex((text) => text.includes("I heard your first message.")));
    await page.screenshot({ path: testInfo.outputPath("chat-first-reply-ordered.png") });
    await expect(field).toHaveValue("");
    expect(runtime.calls.filter((call) => call.kind === "reply")).toHaveLength(1);
    expect(runtime.resolved.every((request) => request.connectionId === chatConnectionId)).toBe(true);
    expect(runtime.session().wallet.vigor).toBe(vigorBefore - runtime.opened.body.cost);
    runtime.transport.stage = "memory";
    const remember = forge.getByRole("button", { name: "Close and remember", exact: true });
    await remember.click();
    await expect(remember).toBeDisabled();
    await expect(log).toContainText(message);
    await expect(log).toContainText("I heard your first message.");
    await forge.locator("button[data-chat-close]").click();
    await forge.locator("[data-chat-open]").click();
    await forge.locator(`[data-chat-with="${chatUnitId}"]`).click();
    await expect(log).toContainText(message);
    await expect(remember).toBeDisabled();
    await forge.locator("[data-chat-earlier]").click();
    await expect(log).toContainText("ARCHIVE_RAW_0");
    expect(await log.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    await log.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(log.getByText("ARCHIVE_RAW_0", { exact: true })).toBeInViewport();
    await expect(forge.locator(".ch-msg.mine").filter({ hasText: message })).toHaveCount(1);
    expect(runtime.calls.filter((call) => call.kind === "reply")).toHaveLength(1);
    expect(runtime.chatDoc().data.messages.filter((row) => row.who === "player" && row.text === message)).toHaveLength(
      1,
    );
    await page.screenshot({ path: testInfo.outputPath("chat-first-reply-and-scrollable-history.png") });
  } finally {
    await runtime.close();
  }
});

test("Real story navigation selects distinct home, story and bond music after each scene is ready", async ({
  page,
}, testInfo) => {
  const { forge, generated, briefs } = await openForge(page, testInfo);
  const plan = { title: "Audio chapter", nodes: [{ type: "story", title: "The garden", storyIndex: 0 }] };
  const waiting: Array<() => Promise<void>> = [];
  await page.route("**/api/gacha-forge/chapters", (route) =>
    route.fulfill({
      json: {
        ok: true,
        chapters: [{ chapter: 1, title: plan.title, normal: 0 }],
        nextChapter: 2,
        nextUnlocked: false,
        bonds: [{ id: "arden", name: "Arden", part: 1, state: "open", beats: 0 }],
      },
    }),
  );
  for (const path of ["chapter-plan", "bond-chapter/plan"])
    await page.route(`**/api/gacha-forge/${path}`, (route) =>
      route.fulfill({ json: { ok: true, plan, progress: {}, beats: 0, name: "Arden" } }),
    );
  for (const path of ["story/start", "bond-chapter/start"])
    await page.route(`**/api/gacha-forge/${path}`, (route) => route.fulfill({ json: { ok: true } }));
  for (const path of ["beat", "bond-chapter/beat"])
    await page.route(`**/api/gacha-forge/${path}`, (route) => {
      waiting.push(() => route.fulfill({ json: scene }));
    });
  await page.route("**/api/gacha-forge/locations", (route) => route.fulfill({ json: { ok: true, places: [] } }));
  await page.route("**/api/gacha-forge/preforge/start", (route) =>
    route.fulfill({ json: { ok: true, allowed: false, preforge: { mode: "off", locked: false } } }),
  );
  await forge.getByRole("button", { name: "Game settings", exact: true }).click();
  await forge.locator('[role="tab"][data-view="sources"]').click();
  await forge.getByRole("checkbox", { name: "Generate music and sound effects", exact: true }).click();
  await expect.poll(() => generated.filter((request) => request.kind === "music").length).toBe(1);
  await forge.locator("[data-settings-back]").click();
  const homeTag = `music:package:${generated[0].context.key}`;
  await expect.poll(() => forge.evaluate((node) => (node as any)._forgeAudio.currentTag)).toBe(homeTag);

  const openChapters = async () => {
    await forge.evaluate((node) => {
      const game = node as any;
      game._clearBeat();
      game._guidesSeen.add("chapters");
      game._hudView = "chapters";
      game._renderBrowser();
    });
    await expect(forge.locator('[data-open-chapter="1"]')).toBeVisible();
  };
  for (const [index, selector, cue] of [
    [0, '[data-open-chapter="1"]', "sad"],
    [1, "[data-open-bond]", "bond"],
  ] as const) {
    await openChapters();
    await forge.locator(selector).click();
    await forge.locator("[data-play]").click();
    await expect.poll(() => waiting.length).toBe(index + 1);
    expect(await forge.evaluate((node) => (node as any)._state())).toBe("beat");
    expect(await forge.evaluate((node) => (node as any)._beatState)).toBe("loading");
    expect(briefs.map((request) => request.cue)).toEqual(index === 0 ? ["home"] : ["home", "sad"]);
    await waiting[index]();
    await expect(forge.locator("[data-vn]")).toBeVisible();
    await expect.poll(() => generated.filter((request) => request.kind === "music").length).toBe(index + 2);
    expect(briefs.at(-1)).toMatchObject({ runId: baseRun.runId, cue });
    await expect
      .poll(() => forge.evaluate((node) => (node as any)._forgeAudio.currentTag))
      .toBe(`music:package:${generated.at(-1)!.context.key}`);
    await showHome(forge);
    await expect.poll(() => forge.evaluate((node) => (node as any)._forgeAudio.currentTag)).toBe(homeTag);
  }
  expect(
    new Set(generated.filter((request) => request.kind === "music").map((request) => request.context.key)).size,
  ).toBe(3);
  expect(briefs.map((request) => request.cue)).toEqual(["home", "sad", "bond"]);
  await page.screenshot({ path: testInfo.outputPath("audio-distinct-story-cues.png") });
});

test("Animations source persists and banner video decodes, loops and reuses its cache", async ({ page }, testInfo) => {
  const { forge, saved, state } = await animationProof(page, testInfo);
  await expect(forge.locator(".hm-plate video")).toHaveCount(0);
  expect(state.posts).toHaveLength(0);
  await forge.getByRole("button", { name: "Game settings", exact: true }).click();
  await forge.locator('[role="tab"][data-view="sources"]').click();
  const source = forge.locator('[data-input="animationConnectionId"]');
  await expect(source).toBeEnabled();
  await expect(source).toHaveAccessibleName("Animations");
  expect(await source.locator("option").allTextContents()).toEqual(["Off, use still banners", "Video fixture"]);
  await source.selectOption("video-fixture");
  await expect.poll(() => saved.animationConnectionId).toBe("video-fixture");
  await source.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("animations-source.png") });
  await forge.locator("[data-settings-back]").click();
  await openAnimatedBanner(forge);
  const video = await decodedBannerVideo(forge);
  await expect(forge.locator('[data-screen="banner"] .art.wide')).toHaveCSS("background-image", /url\(/);
  await forge.locator("[data-animation-pause]").click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  await forge.locator("[data-summon-back]").click();
  await openAnimatedBanner(forge);
  await expect(forge.getByRole("button", { name: "Play animation", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      forge
        .locator(".gf-stage > .gf-view video[data-banner-animation]")
        .evaluate((node: HTMLVideoElement) => node.paused),
    )
    .toBe(true);
  await forge.locator("[data-animation-pause]").click();
  await decodedBannerVideo(forge);
  await page.screenshot({ path: testInfo.outputPath("animated-banner.png") });
  await forge.evaluate((node) => {
    const game = node as any;
    game._renderBrowser();
    game._renderBrowser();
  });
  await decodedBannerVideo(forge);
  await forge.locator("[data-summon-back]").click();
  await expect(forge.locator(".hm-plate video")).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
  await openAnimatedBanner(forge);
  await decodedBannerVideo(forge);
  expect(state.posts).toHaveLength(1);
  await page.reload();
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  await showHome(forge);
  await openAnimatedBanner(forge);
  await decodedBannerVideo(forge);
  expect(state.posts).toHaveLength(2);
  expect(state.compositions).toBe(1);
  expect(state.posts.every((body) => body.banner === "char-standard" && !Object.hasOwn(body, "unitId"))).toBe(true);
  await forge.locator("[data-animation-pause]").click();
  await forge.locator('[data-banner="char-featured"]').click();
  await decodedBannerVideo(forge);
  await expect(forge.getByRole("button", { name: "Pause animation", exact: true })).toBeVisible();
  expect(state.compositions).toBe(2);
  expect(state.browserErrors).toEqual([]);
});

test("Reduced motion and a disabled Animations source keep still banners and portraits", async ({ page }, testInfo) => {
  const { forge, saved, state } = await animationProof(page, testInfo, { selected: true, reduce: true });
  await openAnimatedBanner(forge);
  await forge.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(forge.locator("video[data-banner-animation]")).toHaveCount(0);
  expect(state.posts).toHaveLength(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await decodedBannerVideo(forge);
  expect(state.posts).toHaveLength(1);
  await forge.locator("[data-summon-back]").click();
  await expect(forge.locator(".hm-plate video")).toHaveCount(0);
  await forge.getByRole("button", { name: "Game settings", exact: true }).click();
  await forge.locator('[role="tab"][data-view="sources"]').click();
  await forge.locator('[data-input="animationConnectionId"]').selectOption("");
  await expect.poll(() => saved.animationConnectionId).toBe("");
  await forge.locator("[data-settings-back]").click();
  await openAnimatedBanner(forge);
  await forge.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(forge.locator("video[data-banner-animation]")).toHaveCount(0);
  expect(state.posts).toHaveLength(1);
  await expect(forge.locator('[data-screen="banner"] .art.wide')).toHaveCSS("background-image", /url\(/);
  await page.screenshot({ path: testInfo.outputPath("still-banner-source-off.png") });
  expect(state.browserErrors).toEqual([]);
});

test("Banner generation and actual video decode failures retain the still artwork", async ({ page }, testInfo) => {
  const { forge, state } = await animationProof(page, testInfo, { selected: true });
  state.generationFailed = true;
  await openAnimatedBanner(forge);
  await expect(forge.locator("[data-banner-animation-status]")).toContainText("illustration is still shown");
  await expect(forge.locator("video[data-banner-animation]")).toHaveCount(0);
  state.generationFailed = false;
  state.playbackFailed = true;
  await forge.locator("[data-animation-retry]").click();
  await expect(forge.locator("[data-banner-animation-status]")).toContainText("could not play");
  await expect(forge.locator("video[data-banner-animation]")).toHaveCount(0);
  await expect(forge.locator('[data-screen="banner"] .art.wide')).toHaveCSS("background-image", /url\(/);
  expect(state.posts).toHaveLength(2);
  expect(state.posts[1].retry).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("banner-animation-still-fallback.png") });
  state.playbackFailed = false;
  await page.reload();
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  await showHome(forge);
  await page.evaluate(() => {
    (globalThis as any).__gachaRejectVideoAutoplay = true;
  });
  await openAnimatedBanner(forge);
  await expect(forge.locator("[data-banner-animation-status]")).toContainText("could not play");
  await expect(forge.getByRole("button", { name: "Play animation", exact: true })).toBeVisible();
  await page.evaluate(() => {
    (globalThis as any).__gachaRejectVideoAutoplay = false;
  });
  await forge.getByRole("button", { name: "Play animation", exact: true }).click();
  await decodedBannerVideo(forge);
  expect(state.posts).toHaveLength(3);
  expect(state.compositions).toBe(1);
  expect(state.browserErrors).toEqual([]);
});

for (const theme of ["aurora", "bloom"]) {
  test(`Failed banner playback offers explicit replacement and recovers in ${theme}`, async ({ page }, testInfo) => {
    const hostTheme = theme === "bloom" ? "light" : "dark";
    const { forge, state } = await animationProof(page, testInfo, { selected: true, hostTheme });
    await expect(page.locator("html")).toHaveAttribute("data-theme", hostTheme);
    await forge.evaluate((node, theme) => {
      const game = node as any;
      game._run.hudStyle = theme;
      game._renderBrowser();
    }, theme);
    state.playbackFailed = true;
    await openAnimatedBanner(forge);
    const status = forge.locator("[data-banner-animation-status]");
    const retry = forge.locator("[data-animation-retry]");
    await expect(status).toContainText("could not play");
    await expect(status).toContainText("provider credits");
    await expect(retry).toBeVisible();
    await expect(forge.locator("video[data-banner-animation]")).toHaveCount(0);
    const still = forge.locator('[data-screen="banner"] .show > .art.wide');
    await expect(still).toBeVisible();
    expect(await still.evaluate((node: HTMLElement) => node.style.backgroundImage)).toContain(portrait);
    await settleBannerCapture(forge);
    await page.screenshot({ path: testInfo.outputPath(`banner-playback-recovery-${theme}.png`) });
    expect(state.posts).toHaveLength(1);
    state.generationFailed = true;
    await retry.click();
    await expect(retry).toBeEnabled();
    await expect(status).toContainText("animation unavailable");
    await expect(still).toBeVisible();
    expect(state.posts).toHaveLength(2);
    expect(state.posts[1].retry).toBe(true);
    state.generationFailed = false;
    state.playbackFailed = false;
    await retry.click();
    await decodedBannerVideo(forge);
    await expect(retry).toHaveCount(0);
    await expect(status).toHaveCount(0);
    expect(state.posts).toHaveLength(3);
    expect(state.posts[2].retry).toBe(true);
    expect(state.browserErrors).toEqual([]);
    // Distinctive geometric artwork makes a neutral head/torso overlay visually obvious.
    // These are synthetic fixtures, not a claim about provider-generated image quality.
    await page.route("**/api/gacha-forge/beat", (route) =>
      route.fulfill({
        json: {
          ...scene,
          cast: scene.cast.map((character, index) => ({
            ...character,
            art: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${index ? "#164b69" : "#5c2869"}"/><path d="M100 15 185 145 100 280 15 145Z" fill="${index ? "#3fe0d4" : "#ef8fd8"}"/><path d="m100 65 52 80-52 80-52-80Z" fill="#15243c"/><text x="100" y="154" text-anchor="middle" font-size="32" fill="white">${index ? "B" : "A"}</text></svg>`)}`,
          })),
        },
      }),
    );
    await seedScene(forge, theme);
    await expect(forge.locator("[data-text]")).toHaveText("ASSIGNED_FIRST");
    await forge.locator("[data-text]").click();
    await expect(forge.locator("[data-text]")).toHaveText("UNASSIGNED_SECOND");
    const plate = forge.locator('[data-plate="right"][data-open="true"]');
    await expect(plate).toBeVisible();
    await expect
      .poll(() =>
        plate
          .locator("[data-img]")
          .evaluateAll(
            (images) =>
              images.length === 2 &&
              images.every(
                (image) => (image as HTMLImageElement).naturalWidth > 0 && !(image as HTMLImageElement).hidden,
              ),
          ),
      )
      .toBe(true);
    expect(
      await plate
        .locator("[data-figure]")
        .evaluateAll(
          (figures) =>
            figures.length === 2 &&
            figures.every((figure) => figure.hasAttribute("hidden") && getComputedStyle(figure).display === "none"),
        ),
    ).toBe(true);
    await settleBannerCapture(forge);
    await page.screenshot({ path: testInfo.outputPath(`story-portrait-no-overlay-${theme}.png`) });
  });

  test(`Animation retry shows setup guidance, pending state and recovery in ${theme}`, async ({ page }, testInfo) => {
    const { forge, state } = await animationProof(page, testInfo, { selected: true });
    await forge.evaluate((node, theme) => {
      const game = node as any;
      game._run.hudStyle = theme;
      game._renderBrowser();
    }, theme);
    let releaseRetry: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    await page.route("**/api/gacha-forge/banner-animation", async (route) => {
      const body = route.request().postDataJSON();
      state.posts.push(body);
      if (state.posts.length === 2) await waiting;
      if (state.posts.length < 3)
        return route.fulfill({
          json: {
            ok: false,
            error: "animation-failed",
            reason: "seedance-reference-setup",
            retry: true,
            detail: "SECRET_PROVIDER_DETAIL",
          },
        });
      return route.fulfill({
        json: {
          ok: true,
          animation: {
            key: "b".repeat(64),
            url: `/api/gacha-forge/banner-animation/file/${"a".repeat(64)}/${"b".repeat(64)}.mp4`,
            poster: portrait,
          },
        },
      });
    });
    await openAnimatedBanner(forge);
    const status = forge.locator("[data-banner-animation-status]"),
      retry = forge.locator("[data-animation-retry]");
    await expect(status).toContainText('enable "Upload Seedance reference frames temporarily", then retry');
    await expect(status).not.toContainText("SECRET_PROVIDER_DETAIL");
    await settleBannerCapture(forge);
    const bounds = await status.evaluate((node) => {
      const message = node.getBoundingClientRect(),
        banner = node.closest(".show")!.getBoundingClientRect(),
        title = node.closest(".show")!.querySelector(".bname")!.getBoundingClientRect();
      return {
        message: { left: message.left, right: message.right, top: message.top },
        banner: { left: banner.left, right: banner.right },
        titleBottom: title.bottom,
      };
    });
    expect(bounds.message.left).toBeGreaterThanOrEqual(bounds.banner.left);
    expect(bounds.message.right).toBeLessThanOrEqual(bounds.banner.right);
    expect(bounds.message.top).toBeGreaterThanOrEqual(bounds.titleBottom);
    await page.screenshot({ path: testInfo.outputPath(`animation-setup-${theme}.png`) });
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveText("Retrying animation…");
    await expect(retry).toHaveAttribute("aria-busy", "true");
    await expect(status).toHaveText("Animating banner…");
    await expect.poll(() => state.posts.length).toBe(2);
    expect(state.posts[1].retry).toBe(true);
    await retry.evaluate((node: HTMLButtonElement) => node.click());
    expect(state.posts).toHaveLength(2);
    await settleBannerCapture(forge);
    await page.screenshot({ path: testInfo.outputPath(`animation-retry-pending-${theme}.png`) });
    releaseRetry();
    await expect(retry).toBeEnabled();
    await expect(retry).toHaveText("Retry animation");
    await expect(status).toContainText("Seedance needs a public HTTPS banner image");
    expect(state.posts).toHaveLength(2);
    await retry.click();
    await decodedBannerVideo(forge);
    await expect(retry).toHaveCount(0);
    await expect(status).toHaveCount(0);
    expect(state.posts).toHaveLength(3);
    expect(state.posts[2].retry).toBe(true);
    expect(state.browserErrors).toEqual([]);
  });
}

test("A deferred response cannot attach a previous same-art banner rotation", async ({ page }, testInfo) => {
  const { forge, state } = await animationProof(page, testInfo, { selected: true });
  await openAnimatedBanner(forge);
  await decodedBannerVideo(forge);
  const releases: (() => void)[] = [];
  await page.route("**/api/gacha-forge/banner-animation", async (route) => {
    const index = releases.length;
    await new Promise<void>((resolve) => releases.push(resolve));
    const key = (index === 0 ? "b" : "c").repeat(64);
    await route.fulfill({
      json: {
        ok: true,
        animation: {
          key,
          url: `/api/gacha-forge/banner-animation/file/${"a".repeat(64)}/${key}.mp4`,
          poster: portrait,
        },
      },
    });
  });
  await forge.locator('[data-banner="char-featured"]').click();
  await expect.poll(() => releases.length).toBe(1);
  // Model the new canonical rotation arriving before the next view render. The old art/id/title remain identical.
  await forge.evaluate((node) => {
    (node as any)._summonBanner.banner.music.cue = "banner-char-featured-f2";
  });
  const oldResponse = page.waitForResponse((response) => response.url().endsWith("/api/gacha-forge/banner-animation"));
  releases[0]();
  await oldResponse;
  await forge.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(forge.locator("video[data-banner-animation]")).toHaveCount(0);
  await forge.evaluate((node) => {
    const game = node as any;
    game._summonBannerState = "loading";
    game._renderBrowser();
    game._summonBannerState = "ready";
    game._renderBrowser();
  });
  await expect.poll(() => releases.length).toBe(2);
  releases[1]();
  const video = await decodedBannerVideo(forge);
  await expect(video).toHaveAttribute("src", new RegExp(`${"c".repeat(64)}\\.mp4$`));
  expect(state.browserErrors).toEqual([]);
});

test("Home menu music selects collected songs with generation off and survives reload", async ({ page }, testInfo) => {
  const tag = "music:contexts:gacha-forge:world-fixture-banner-char-featured-f1:fixture";
  const song = {
    cue: "banner-char-featured-f1",
    connectionId: "music-fixture",
    tag,
    path: "music/fixture.wav",
    title: "Moonlit garden",
  };
  await page.route("**/api/gacha-forge/audio/library", (route) =>
    route.fulfill({ json: { ok: true, tracks: [song] } }),
  );
  const { forge, saved, generated, state } = await animationProof(page, testInfo, { reduce: true });
  await page.route("**/api/game-assets/manifest", (route) =>
    route.fulfill({ json: { assets: { [tag]: { ...song, category: "music" } }, byCategory: {}, count: 1 } }),
  );
  // Recreate only the package player so it reads the new deterministic manifest.
  await forge.evaluate((node) => {
    const game = node as any;
    game._forgeAudio.dispose();
    game._forgeAudio = null;
    game._renderBrowser();
  });
  for (const theme of ["aurora", "bloom"]) {
    await forge.evaluate((node, theme) => {
      const game = node as any;
      game._run.hudStyle = theme;
      game._renderBrowser();
    }, theme);
    await forge.getByRole("button", { name: "Game settings", exact: true }).click();
    await forge.locator('[role="tab"][data-view="visual"]').click();
    const select = forge.locator('[data-input="audio.homeMusic"]');
    await expect(select).toBeEnabled();
    await expect(select).toContainText("Moonlit garden");
    await expect(select.locator("option")).toHaveCount(2);
    await select.selectOption(tag);
    await expect.poll(() => (saved.audio as any).homeMusic).toBe(tag);
    await expect.poll(() => forge.evaluate((node) => (node as any)._forgeAudio.currentTag)).toBe(tag);
    expect(saved.audio.generate).toBe(false);
    expect(generated).toHaveLength(0);
    await select.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`home-music-${theme}.png`) });
    await forge.locator("[data-settings-back]").click();
  }
  await forge.evaluate((node) => {
    const game = node as any;
    game._forgeMusicNavigationProof = [];
    const player = game._forgeAudio.player;
    const play = player.playMusic.bind(player);
    player.playMusic = (...args: any[]) => {
      game._forgeMusicNavigationProof.push(args[0]);
      return play(...args);
    };
  });
  await openAnimatedBanner(forge);
  await expect.poll(() => forge.evaluate((node) => (node as any)._forgeAudio.currentTag)).toBe(tag);
  await forge.locator("[data-summon-back]").click();
  await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
  expect(await forge.evaluate((node) => (node as any)._forgeMusicNavigationProof)).toEqual([]);
  expect(state.posts).toHaveLength(0);
  await page.reload();
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  await showHome(forge);
  await expect.poll(() => forge.evaluate((node) => (node as any)._forgeAudio.currentTag)).toBe(tag);
  await forge.getByRole("button", { name: "Game settings", exact: true }).click();
  await forge.locator('[role="tab"][data-view="visual"]').click();
  await expect(forge.locator('[data-input="audio.homeMusic"]')).toHaveValue(tag);
  expect(generated).toHaveLength(0);
});

test("Audio settings persist, mute is compact and portrait frames retain a bottom stroke", async ({
  page,
}, testInfo) => {
  const { forge, saved, generated, briefs } = await openForge(page, testInfo);
  expect(generated).toHaveLength(0);
  const settings = forge.getByRole("button", { name: "Game settings", exact: true });
  await settings.click();
  await forge.locator('[role="tab"][data-view="visual"]').click();
  for (const [field, value] of [
    ["musicVolume", "0.17"],
    ["dialogueVolume", "0"],
    ["sfxVolume", "0.31"],
    ["autoplayPauseSeconds", "4.5"],
  ]) {
    const input = forge.locator(`[data-input="audio.${field}"]`);
    await input.fill(value);
    await input.dispatchEvent("input");
    await input.dispatchEvent("change");
    await expect.poll(() => Number((saved.audio as any)[field])).toBe(Number(value));
  }
  await forge.locator('[role="tab"][data-view="sources"]').click();
  await expect(forge.getByRole("checkbox", { name: "Read character dialogue", exact: true })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await forge.getByRole("checkbox", { name: "Generate music and sound effects", exact: true }).click();
  await expect.poll(() => saved.audio.generate).toBe(true);
  await expect.poll(() => generated.filter((request) => request.kind === "music").length).toBe(1);
  expect(briefs).toHaveLength(1);
  expect(briefs[0]).toMatchObject({ runId: baseRun.runId, cue: "home" });
  expect(generated[0].prompt).toBe("Original fantasy instrumental: woodwinds, harp and soft strings.");
  await expect(forge.locator('[data-input="audio.audioConnectionId"]')).toContainText("Audio fixture");
  await page.screenshot({ path: testInfo.outputPath("audio-sources.png") });
  await forge.locator("[data-settings-back]").click();
  await forge.getByRole("button", { name: "Mute all audio", exact: true }).click();
  await expect(forge.getByRole("button", { name: "Unmute audio", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await forge.getByRole("button", { name: "Unmute audio", exact: true }).click();
  await expect(forge.getByRole("button", { name: "Mute all audio", exact: true })).toBeEnabled();
  expect(generated.filter((request) => request.kind === "music")).toHaveLength(1);
  await page.reload();
  await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
  await showHome(forge);
  await expect.poll(() => forge.evaluate((node) => (node as any)._run?.audio.musicVolume)).toBe(0.17);
  for (const theme of ["aurora", "bloom", "signal", "ember", "vanguard"]) {
    await forge.evaluate((node, theme) => {
      const game = node as any;
      game._clearBeat();
      game._run.hudStyle = theme;
      game._hudView = "home";
      game._renderBrowser();
    }, theme);
    const home = await frameBottom(forge.locator(".hm-plate"), ".hm-art");
    expect(home.gap, `${theme} home ${JSON.stringify(home)}`).toBeGreaterThanOrEqual(home.edge - 0.1);
    if (theme === "bloom") await page.screenshot({ path: testInfo.outputPath("audio-home-light.png") });
    await seedScene(forge, theme);
    const story = await frameBottom(forge.locator('.vn-plate[data-side="right"]'), ".vn-art");
    expect(story.gap, `${theme} story ${JSON.stringify(story)}`).toBeGreaterThanOrEqual(story.edge - 0.1);
    const mute = forge.locator(".vn-top > .gf-mute-chapter");
    const box = await mute.boundingBox();
    expect(box?.width).toBe(44);
    expect(box?.height).toBe(44);
    if (theme === "aurora") await page.screenshot({ path: testInfo.outputPath("audio-chapter.png") });
  }
  await showHome(forge);
  await forge.evaluate((node) => {
    const game = node as any;
    game._run.textScale = 1.75;
    game._settingsRev += 1;
    game._renderBrowser();
  });
  await settings.click();
  await forge.locator('[role="tab"][data-view="visual"]').click();
  for (const name of ["musicVolume", "dialogueVolume", "sfxVolume", "autoplayPauseSeconds"]) {
    const range = forge.locator(`[data-input="audio.${name}"]`);
    await range.scrollIntoViewIfNeeded();
    await expect(range).toBeVisible();
    expect(
      await range.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const stage = node.closest(".gf-stage")!.getBoundingClientRect();
        return box.left >= stage.left && box.right <= stage.right;
      }),
      `${name} stays horizontally inside the stage at 175% text`,
    ).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("audio-mix-large-text.png") });
  await forge.evaluate((node) => {
    const game = node as any;
    game._clearBeat();
    game._run = null;
    game._activeRunId = null;
    game._creatingNew = false;
    game._boot = "ready";
    game._setupDraftAsked = false;
    game._renderKey = null;
    game._renderBrowser();
  });
  await expect(forge.getByRole("checkbox", { name: "Read character dialogue", exact: true })).toBeVisible();
  await expect(forge.getByRole("checkbox", { name: "Generate music and sound effects", exact: true })).toBeVisible();
  await expect(forge.locator(".gf-mute")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("audio-world-setup.png") });
});

test("Provider rejection reasons fit the game stage in dark and light themes", async ({ page }, testInfo) => {
  const { forge, saved } = await openForge(page, testInfo);
  await page.route("**/api/audio/generate", (route) =>
    route.fulfill({
      status: 502,
      json: {
        error: "Audio generation failed",
        detail: "ElevenLabs audio request returned HTTP 400",
        providerStatus: 400,
        reason:
          "Your prompt appears to have violated our Terms of Service. Please try again with a different prompt. " +
          "Use an original musical description. ".repeat(7),
        private: "must not be displayed",
      },
    }),
  );
  for (const [theme, cue] of [
    ["aurora", "home"],
    ["bloom", "boss"],
  ]) {
    saved.hudStyle = theme;
    saved.audio.generate = true;
    await forge.evaluate(
      async (node, { theme, cue }) => {
        const game = node as any;
        game._run.hudStyle = theme;
        game._run.audio = { ...game._run.audio, generate: true };
        game._renderKey = null;
        game._renderBrowser();
        game._forgeAudio.configure(game._run.audio);
        await game._forgeAudio.generate("music", cue);
      },
      { theme, cue },
    );
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
    const notice = forge.locator("[data-forge-audio-status]");
    await expect(notice).toContainText("HTTP 400");
    await expect(notice).toContainText("Terms of Service");
    await expect(notice).not.toContainText("must not be displayed");
    const bounds = await notice.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const stage = node.closest(".gf-stage")!.getBoundingClientRect();
      return {
        left: box.left - stage.left,
        right: stage.right - box.right,
        top: box.top - stage.top,
        bottom: stage.bottom - box.bottom,
        overflowX: node.scrollWidth - node.clientWidth,
      };
    });
    for (const side of ["left", "right", "top", "bottom"] as const) expect(bounds[side]).toBeGreaterThanOrEqual(-1);
    expect(bounds.overflowX).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`audio-provider-error-${theme}.png`) });
    await expect(forge.locator(".gf-arena")).toHaveAttribute("data-style", theme);
  }

  const short = await forge.evaluate((node) => {
    const game = node as any;
    game._forgeAudio.notice("audio.voiceFailed");
    const notice = game._root.querySelector("[data-forge-audio-status]") as HTMLElement;
    const stage = notice.closest(".gf-stage")!;
    const target = document.createElement("button");
    target.style.cssText = `position:absolute;z-index:7;left:${notice.offsetLeft}px;top:${notice.offsetTop}px;width:${notice.offsetWidth}px;height:${notice.offsetHeight}px;opacity:0`;
    target.addEventListener("click", (event) => {
      event.stopPropagation();
      (node as HTMLElement).dataset.noticeTaps = "1";
    });
    stage.append(target);
    const box = notice.getBoundingClientRect();
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      overflow: notice.scrollHeight - notice.clientHeight,
    };
  });
  expect(short.overflow).toBeLessThanOrEqual(0);
  await page.mouse.click(short.x, short.y);
  await expect.poll(() => forge.evaluate((node) => (node as HTMLElement).dataset.noticeTaps)).toBe("1");

  const hidden = await forge.evaluate((node) => {
    const game = node as any;
    const stage = game._root.querySelector(".gf-stage") as HTMLElement;
    stage.style.display = "none";
    game._forgeAudio.notice("audio.generationReason", 400, "A longer provider explanation. ".repeat(9));
    const notice = game._root.querySelector("[data-forge-audio-status]") as HTMLElement;
    notice.style.maxHeight = "3rem";
    return { client: notice.clientHeight, scroll: notice.scrollHeight };
  });
  expect(hidden).toEqual({ client: 0, scroll: 0 });
  await forge.evaluate((node) => {
    ((node as any)._root.querySelector(".gf-stage") as HTMLElement).style.removeProperty("display");
  });
  const status = forge.locator("[data-forge-audio-status]");
  await expect(status).toHaveAttribute("tabindex", "0");
  await expect(status).toHaveCSS("pointer-events", "auto");
  await status.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => status.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await status.evaluate((node) => {
    const notice = node as HTMLElement;
    notice.style.maxHeight = "1000px";
    notice.style.fontSize = "12px";
  });
  await expect(status).toHaveAttribute("tabindex", "-1");
  await expect(status).toHaveCSS("pointer-events", "none");
  await status.evaluate((node) => {
    const notice = node as HTMLElement;
    notice.style.maxHeight = "3rem";
    notice.style.fontSize = "24px";
  });
  await expect(status).toHaveAttribute("tabindex", "0");
  await expect(status).toHaveCSS("pointer-events", "auto");

  await forge.locator("[data-forge-audio-status]").evaluate((node) => {
    (node as HTMLElement).style.maxHeight = "3rem";
    // Settle the fixture's size transition before freezing time for dismissal checks.
    for (const animation of node.getAnimations()) animation.finish();
  });
  await page.clock.install();
  const long = await forge.evaluate((node) => {
    const game = node as any;
    const notice = game._root.querySelector("[data-forge-audio-status]") as HTMLElement;
    game._forgeAudio.notice("audio.generationReason", 400, "A longer provider explanation. ".repeat(9));
    const box = notice.getBoundingClientRect();
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      overflow: notice.scrollHeight - notice.clientHeight,
    };
  });
  expect(long.overflow).toBeGreaterThan(0);
  await forge.locator("[data-forge-audio-status]").focus();
  await expect(forge.locator("[data-forge-audio-status]")).toBeFocused();
  await page.mouse.move(long.x, long.y);
  if (testInfo.project.name === "mobile-webkit") await page.keyboard.press("PageDown");
  else await page.mouse.wheel(0, 80);
  await expect
    .poll(() => forge.locator("[data-forge-audio-status]").evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
  await page.clock.fastForward(6001);
  await expect(forge.locator("[data-forge-audio-status]")).toBeFocused();
  await forge.locator("[data-forge-audio-status]").evaluate((node) => (node as HTMLElement).blur());
  await page.clock.fastForward(6001);
  await expect(forge.locator("[data-forge-audio-status]")).toHaveCount(0);

  await forge.evaluate((node) => {
    const game = node as any;
    game._forgeAudio.notice("audio.generationReason", 400, "A longer provider explanation. ".repeat(9));
    const notice = game._root.querySelector("[data-forge-audio-status]") as HTMLElement;
    notice.style.maxHeight = "3rem";
  });
  await expect(status).toHaveAttribute("tabindex", "0");
  await status.focus();
  await forge.evaluate((node) => {
    const game = node as any;
    game._root.querySelector("[data-forge-audio-status]").style.removeProperty("max-height");
    game._forgeAudio.notice("audio.voiceFailed");
  });
  await expect(status).toHaveAttribute("tabindex", "-1");
  await expect(status).toBeFocused();
  await page.clock.fastForward(6001);
  await expect(status).toHaveCount(0);
  const disposed = await forge.evaluate((node) => {
    const game = node as any;
    game._forgeAudio.notice("audio.voiceFailed");
    const notice = game._root.querySelector("[data-forge-audio-status]") as HTMLElement;
    game._forgeAudio.dispose();
    return { connected: notice.isConnected, focus: notice.onfocus, blur: notice.onblur };
  });
  expect(disposed).toEqual({ connected: false, focus: null, blur: null });
  await page.clock.fastForward(6001);
  await expect(status).toHaveCount(0);
});

test("Readiness recovers in the current world and single-channel selections keep the other channel on stock", async ({
  page,
}, testInfo) => {
  const { forge, generated } = await openForge(page, testInfo);
  let configured = false;
  const probes: string[] = [];
  await page.route("**/api/audio/config*", (route) => {
    const id = new URL(route.request().url()).searchParams.get("audioConnectionId") || "music-fixture";
    probes.push(id);
    return route.fulfill({
      json: {
        configured,
        connectionId: configured ? id : null,
        music: id !== "sfx-only",
        soundEffects: id === "sfx-only",
      },
    });
  });
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        { id: "fixture-model", name: "Text fixture", provider: "custom", model: "fixture" },
        {
          id: "music-only",
          name: "Score",
          provider: "audio_generation",
          audioMusic: "true",
          audioSoundEffects: "false",
        },
        {
          id: "sfx-only",
          name: "Effects",
          provider: "audio_generation",
          audioMusic: "false",
          audioSoundEffects: "true",
        },
      ],
    }),
  );
  const settings = forge.getByRole("button", { name: "Game settings", exact: true });
  await settings.click();
  await forge.locator('[role="tab"][data-view="sources"]').click();
  const generation = forge.getByRole("checkbox", { name: "Generate music and sound effects", exact: true });
  await generation.click();
  await expect.poll(() => probes.length).toBe(1);
  await forge.evaluate(async (node) => {
    const audio = (node as any)._forgeAudio;
    await audio.cue("home");
    await audio.effect("click");
  });
  expect(probes).toHaveLength(1);
  expect(generated).toHaveLength(0);
  configured = true;
  await generation.click();
  await generation.click();
  await expect.poll(() => generated.filter((request) => request.kind === "music").length).toBe(1);
  expect(probes).toHaveLength(2);
  const select = forge.locator('[data-input="audio.audioConnectionId"]');
  await expect(select.locator('option[value="music-only"]')).toHaveText("Score (Music only)");
  await expect(select.locator('option[value="sfx-only"]')).toHaveText("Effects (Sound effects only)");
  for (const [id, supported, unsupported] of [
    ["music-only", "music", "sfx"],
    ["sfx-only", "sfx", "music"],
  ]) {
    await select.selectOption(id);
    await expect.poll(() => probes.includes(id)).toBe(true);
    await forge.evaluate(async (node) => {
      const audio = (node as any)._forgeAudio;
      await audio.cue("home");
      await audio.effect("click");
      await audio.generate("music", "boss");
      await audio.generate("sfx", "hit");
    });
    await expect.poll(() => generated.filter((request) => request.audioConnectionId === id).length).toBe(2);
    expect(
      generated.filter((request) => request.audioConnectionId === id).every((request) => request.kind === supported),
    ).toBe(true);
    expect(generated.some((request) => request.audioConnectionId === id && request.kind === unsupported)).toBe(false);
    await expect(forge.locator("[data-forge-audio-status]")).toHaveCount(0);
  }
  configured = false;
  await select.selectOption("");
  const played = await forge.evaluate(async (node) => {
    const audio = (node as any)._forgeAudio;
    const tags: string[] = [];
    const player = audio.player;
    // The host player is frozen; observe calls through a delegating test wrapper.
    audio.player = {
      ...player,
      playSfx: (tag: string, ...args: unknown[]) => {
        tags.push(tag);
        return player.playSfx(tag, ...args);
      },
    };
    try {
      await audio.effect("click");
      return tags;
    } finally {
      audio.player = player;
    }
  });
  expect(played).toEqual(["sfx:ui:click"]);
  await expect(forge.locator("[data-forge-audio-status]")).toHaveCount(0);
  await select.selectOption("sfx-only");
  await page.screenshot({ path: testInfo.outputPath("audio-single-channel-readiness.png") });
});

test("Audio selectors accept real stored flags and preserve unavailable choices through setup saves", async ({
  page,
}, testInfo) => {
  const ids: string[] = [];
  try {
    for (const data of [
      { name: "Text selection fixture", provider: "custom", model: "fixture" },
      {
        name: "Stored audio fixture",
        provider: "audio_generation",
        audioGenerationSource: "custom",
        model: "fixture",
        audioMusic: true,
        audioSoundEffects: true,
      },
    ]) {
      const response = await page.request.post("/api/connections", { data });
      expect(response.ok(), await response.text()).toBe(true);
      ids.push((await response.json()).id);
    }
    const storedRows = await (await page.request.get("/api/connections")).json();
    const stored = storedRows.find((row: any) => row.id === ids[1]);
    expect(stored.audioMusic).toBe("true");
    expect(stored.profileImportReviewRequired).toBe("false");
    // This first list is the actual, unintercepted Engine HTTP response.
    const { forge, saved, writes, generated } = await openForge(page, testInfo, {
      realConnections: true,
      selectedAudio: ids[1],
    });
    await forge.getByRole("button", { name: "Game settings", exact: true }).click();
    await forge.locator('[role="tab"][data-view="sources"]').click();
    const picker = forge.locator('[data-input="audio.audioConnectionId"]');
    await expect(picker.locator(`option[value="${ids[1]}"]`)).toHaveText("Stored audio fixture");
    await expect(picker).toHaveValue(ids[1]);
    await forge.getByRole("checkbox", { name: "Read character dialogue", exact: true }).click();
    await expect.poll(() => saved.audio.audioConnectionId).toBe(ids[1]);

    const drafts: any[] = [];
    const presets: any[] = [];
    const creations: any[] = [];
    await page.route("**/api/characters/personas/list", (route) =>
      route.fulfill({ json: [{ id: "fixture-persona", name: "Mari" }] }),
    );
    await page.route("**/api/characters/personas/active", (route) =>
      route.fulfill({ json: { id: "fixture-persona", name: "Mari" } }),
    );
    await page.route("**/api/gacha-forge/setup/draft", (route) => {
      if (route.request().method() === "POST") drafts.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    });
    await page.route("**/api/gacha-forge/setup/presets", (route) => route.fulfill({ json: { ok: true, presets: [] } }));
    await page.route("**/api/gacha-forge/setup/preset/save", (route) => {
      presets.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true, presets: [] } });
    });
    await page.route("**/api/gacha-forge/run", (route) => {
      creations.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: false, error: "Captured without generating a world." } });
    });
    // Quarantine is a response fixture over the real stored row; no user profile is modified.
    let quarantined = false;
    await page.route("**/api/connections", async (route) => {
      const response = await route.fetch();
      const rows = await response.json();
      await route.fulfill({
        response,
        json: rows.map((row: any) =>
          quarantined && row.id === ids[1] ? { ...row, profileImportReviewRequired: "true" } : row,
        ),
      });
    });
    for (const selected of ["missing-audio-fixture", ids[1]]) {
      quarantined = selected === ids[1];
      await forge.evaluate((node, id) => {
        const game = node as any;
        game._run.audio = { ...game._run.audio, generate: true, audioConnectionId: id };
        game._settingsRev += 1;
        game._renderKey = null;
        game._openSettings("sources");
      }, selected);
      await expect(picker).toHaveValue(selected);
      await expect(picker.locator(`option[value="${selected}"]`)).toBeDisabled();
      await forge.getByRole("checkbox", { name: "Read character dialogue", exact: true }).click();
      await expect.poll(() => writes.at(-1)?.audio.audioConnectionId).toBe(selected);
      await forge.evaluate(
        (node, fixture) => {
          const game = node as any;
          game._clearBeat();
          game._run = null;
          game._activeRunId = null;
          game._boot = "ready";
          // Match Worlds → New: /state still advertises the existing saved world.
          game._creatingNew = true;
          game._setupDraftAsked = true;
          game._setupDraftSettled = true;
          game._setupDraft = {
            step: 4,
            furthest: 7,
            personaId: "fixture-persona",
            values: {
              scenario: "A synthetic world.",
              connectionId: fixture.textId,
              "audio.generate": true,
              "audio.audioConnectionId": fixture.selected,
            },
          };
          game._renderKey = null;
          game._renderBrowser();
        },
        { textId: ids[0], selected },
      );
      await forge.evaluate((node) => (node as any)._refreshState());
      await expect.poll(() => forge.evaluate((node) => (node as any)._refreshing)).toBe(false);
      await expect(forge.locator("[data-next]")).toBeVisible();
      await expect(picker).toHaveValue(selected);
      await expect(picker.locator(`option[value="${selected}"]`)).toBeDisabled();
      // A real eligible row also remains available in the setup list.
      await expect(forge.locator(".gf-mute")).toHaveCount(0);
      if (!quarantined) await expect(picker.locator(`option[value="${ids[1]}"]`)).toHaveText("Stored audio fixture");
      await forge.locator("[data-next]").click();
      await expect.poll(() => drafts.at(-1)?.snapshot.values["audio.audioConnectionId"]).toBe(selected);
      await forge.locator("button[data-presets]").click();
      await forge.locator("[data-preset-name]").fill("Selection proof");
      await forge.locator("[data-preset-save]").click();
      await expect.poll(() => presets.at(-1)?.snapshot.values["audio.audioConnectionId"]).toBe(selected);
      await forge.locator("[data-preset-close]").click();
      await forge.locator('[data-goto="7"]').click();
      await forge.locator("[data-forge]").click();
      await forge.locator("[data-forge-ask-yes]").click();
      await forge.locator("[data-forge-ask-later]").click();
      await expect.poll(() => creations.at(-1)?.audio.audioConnectionId).toBe(selected);
      await expect.poll(() => generated.every((request) => !!request.audioConnectionId)).toBe(true);
      // Restore the edited-world fixture before testing the second unavailable state.
      await page.reload();
      await page.getByRole("tab", { name: "Open Gacha Forge" }).click();
      await showHome(forge);
    }
    await testInfo.attach("connection-selection-proof.json", {
      body: JSON.stringify({ stored, drafts, presets, creations, generated }, null, 2),
      contentType: "application/json",
    });
  } finally {
    await page
      .getByRole("tab", { name: "Home", exact: true })
      .click()
      .catch(() => {});
    for (const id of ids) await page.request.delete(`/api/connections/${id}`).catch(() => {});
  }
});

test("Shipped audio requests pass the real Engine route and reuse a local provider's cached MP3", async ({
  page,
}, testInfo) => {
  const providerCalls: { path: string; body: Record<string, any> }[] = [];
  const provider = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    providerCalls.push({ path: request.url!, body: JSON.parse(body) });
    response.setHeader("content-type", "audio/mpeg");
    response.end(Buffer.from([0xff, 0xfb, 0x90, 0, 1]));
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Missing local provider port");
  let connectionId = "";
  const outbound: { request: Record<string, any>; status: number; result: Record<string, any> }[] = [];
  const responses: Promise<void>[] = [];
  page.on("response", (response) => {
    if (response.url().endsWith("/api/audio/generate"))
      responses.push(
        response.json().then((result) => {
          outbound.push({ request: response.request().postDataJSON(), status: response.status(), result });
        }),
      );
  });
  try {
    const created = await page.request.post("/api/connections", {
      data: {
        name: "Local Gacha MP3 fixture",
        provider: "audio_generation",
        audioGenerationSource: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "local-mp3",
        audioMusic: true,
        audioSoundEffects: true,
        audioMusicEndpoint: "music",
        audioSoundEffectsEndpoint: "sfx",
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    connectionId = (await created.json()).id;
    expect(connectionId).toBeTruthy();
    const rejected = await page.request.post("/api/audio/generate", {
      data: {
        kind: "sfx",
        prompt: "old package shape",
        audioConnectionId: connectionId,
        context: { scope: "gacha-forge", key: "negative-control" },
      },
    });
    expect(rejected.status(), "the actual route rejects the old sound-effects request shape").toBe(400);
    const { forge } = await openForge(page, testInfo, { realGeneration: connectionId });
    await expect.poll(() => providerCalls.filter((call) => call.path === "/v1/music").length).toBe(1);
    await forge.getByRole("button", { name: "Game settings", exact: true }).click();
    await expect.poll(() => providerCalls.filter((call) => call.path === "/v1/sfx").length).toBe(1);
    await expect.poll(() => outbound.length).toBe(2);
    expect(outbound.every((response) => response.status === 200)).toBe(true);
    expect(outbound.find((response) => response.request.kind === "sfx")!.request).not.toHaveProperty("context");
    for (const { path, body } of providerCalls)
      expect(body.prompt.length).toBeLessThanOrEqual(path.endsWith("music") ? 1000 : 500);
    const music = outbound.find((response) => response.request.kind === "music")!;
    expect(recordForgeSoundtrack({}, baseRun.runId, { ...music.result, connectionId, cue: "home" })).toBe(true);
    const replay = await page.request.post("/api/audio/generate", { data: music.request });
    expect(replay.status(), await replay.text()).toBe(200);
    expect((await replay.json()).cached).toBe(true);
    expect(providerCalls).toHaveLength(2);
    expect(music.result.path).toMatch(/^music\/contexts\/gacha-forge\/world-/);
    await Promise.all(responses);
    await testInfo.attach("real-route-audio-proof.json", {
      body: JSON.stringify({ outbound, providerCalls }, null, 2),
      contentType: "application/json",
    });
  } finally {
    await page
      .getByRole("tab", { name: "Home", exact: true })
      .click()
      .catch(() => {});
    if (connectionId) await page.request.delete(`/api/connections/${connectionId}`);
    await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  }
});

test("Autoplay waits three seconds after revealed text and voice end, and Skip cancels speech", async ({
  page,
}, testInfo) => {
  const now = new Date();
  await page.clock.install({ time: now });
  const { forge, speech } = await openForge(page, testInfo, { voice: true });
  // Pause in the future: install starts a running clock, so its initial instant may already be past.
  await page.clock.pauseAt(new Date(now.getTime() + 60_000));
  await seedScene(forge);
  await expect.poll(() => speech.length).toBe(1);
  expect(speech[0].voice).toBe("voice-arden");
  expect(speech[0].audioConnectionId).toBe("speech-fixture");
  const state = () => page.evaluate(() => (globalThis as any).__MARINARA_HOST__.services.tts.ttsService.getState());
  await expect.poll(state).toBe("playing");
  await forge.locator("[data-auto]").click();
  await page.clock.runFor(3100);
  await expect(forge.locator("[data-text]")).toHaveText("ASSIGNED_FIRST");
  await page.evaluate(() => {
    const playback = (globalThis as any).__MARINARA_HOST__.services.tts.ttsService.getPlayback();
    (globalThis as any).__gachaOldPlayback = playback.element;
    playback.element.dispatchEvent(new Event("ended"));
  });
  await expect.poll(state).toBe("idle");
  await page.clock.runFor(2999);
  await expect(forge.locator("[data-text]")).toHaveText("ASSIGNED_FIRST");
  await page.clock.runFor(1);
  await expect(forge.locator("[data-count]")).toHaveText("02 / 05");
  await forge.locator("[data-auto]").click();
  await page.clock.runFor(1000);
  expect(speech).toHaveLength(1);
  await forge.locator("[data-box]").click();
  await page.clock.runFor(1000);
  await expect(forge.locator("[data-text]")).toHaveText("THOUGHT_THIRD");
  expect(speech).toHaveLength(1);
  await forge.locator("[data-box]").click();
  await page.clock.runFor(1000);
  await expect(forge.locator("[data-text]")).toHaveText("NARRATION_FOURTH");
  expect(speech).toHaveLength(1);
  await forge.locator("[data-box]").click();
  await expect.poll(() => speech.length).toBe(2);
  await expect.poll(state).toBe("playing");
  await forge.locator("[data-skip]").click();
  await expect.poll(state).toBe("idle");
  await page.clock.runFor(10000);
  expect(speech).toHaveLength(2);
  await forge.locator("[data-exit]").click();
  await page.evaluate(() => (globalThis as any).__gachaOldPlayback.dispatchEvent(new Event("ended")));
  await expect(forge.locator("[data-vn]")).toHaveCount(0);

  await page.route("**/api/gacha-forge/beat", (route) =>
    route.fulfill({
      json: {
        ...scene,
        segments: [
          { speaker: "", text: "BEFORE_CHOICE" },
          { speaker: "", text: "CHOOSE_A_PATH" },
          { speaker: "", text: "AFTER_CHOICE" },
        ],
        choices: [
          {
            id: "pause-choice",
            kind: "small",
            at: 1,
            options: [
              { id: "a", text: "I follow the path." },
              { id: "b", text: "I wait here." },
            ],
          },
        ],
      },
    }),
  );
  await seedScene(forge);
  await forge.locator("[data-auto]").click();
  await page.clock.runFor(4000);
  await expect(forge.locator("[data-forge-choices]")).toBeVisible();
  await expect(forge.locator("[data-auto]")).toBeDisabled();
  await page.clock.runFor(30_000);
  await expect(forge.locator("[data-forge-choices]")).toBeVisible();
  await expect(forge.locator("[data-count]")).toHaveText("02 / 03");
  await expect(forge.locator("[data-skip]")).toBeDisabled();
  expect(speech).toHaveLength(2);
});

test("Story Cancel exits delayed chapter generation without losing progress", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { forge, saved } = await openForge(page, testInfo);
  const progress = { "1": { normal: 3, hard: 1, veryhard: 0 } };
  saved.progress = progress;
  const cancelled: Record<string, unknown>[] = [];
  let releasePlan!: () => void,
    releaseCancel!: () => void,
    finishedPlan!: () => void,
    requests = 0;
  const heldPlan = new Promise<void>((resolve) => (releasePlan = resolve));
  const heldCancel = new Promise<void>((resolve) => (releaseCancel = resolve));
  const planFinished = new Promise<void>((resolve) => (finishedPlan = resolve));
  await page.route("**/api/gacha-forge/story/cancel", async (route) => {
    cancelled.push(route.request().postDataJSON());
    await heldCancel;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/gacha-forge/chapter-plan", async (route) => {
    const first = ++requests === 1;
    if (first) await heldPlan;
    try {
      await route.fulfill({
        json: {
          ok: true,
          plan: { title: "Recovered chapter", nodes: [{ index: 1, type: "story", title: "Garden", storyIndex: 0 }] },
          progress: { "2": { normal: 0, hard: 0, veryhard: 0 } },
        },
      });
    } finally {
      if (first) finishedPlan();
    }
  });
  await page.route("**/api/gacha-forge/preforge/start", (route) =>
    route.fulfill({ json: { ok: true, allowed: false, preforge: { mode: "off" } } }),
  );
  const start = () =>
    forge.evaluate((node, keptProgress) => {
      const game = node as any;
      game._clearBeat();
      game._run.progress = keptProgress;
      game._run.prologuePending = false;
      game._prologue = false;
      game._storyUnwritten = false;
      game._plan = null;
      game._openChapter(2);
    }, progress);
  try {
    await start();
    await expect.poll(() => requests).toBe(1);
    const cancel = forge.locator(".gf-stage > .gf-view [data-forge-story-cancel]");
    await expect(cancel).toBeVisible();
    await forge.screenshot({ path: testInfo.outputPath("chapter-loading-cancel.png") });
    await cancel.click();
    await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
    await expect.poll(() => cancelled.length).toBe(1);
    expect(cancelled[0]).toEqual({ runId: saved.runId, chapter: 2, timeZone: expect.any(String) });
    expect(
      await forge.evaluate((node) => ({ view: (node as any)._hudView, progress: (node as any)._run.progress })),
    ).toEqual({
      view: "home",
      progress,
    });
    releasePlan();
    releaseCancel();
    await planFinished;
    await expect(cancel).toHaveCount(0);
    expect(await forge.evaluate((node) => (node as any)._state())).toBe("hud");
    expect(requests).toBe(1);
    await start();
    await expect.poll(() => requests).toBe(2);
    await expect.poll(() => forge.evaluate((node) => (node as any)._plan?.title)).toBe("Recovered chapter");
    expect(await forge.evaluate((node) => (node as any)._run.progress)).toEqual(progress);
    expect(errors).toEqual([]);
  } finally {
    releasePlan();
    releaseCancel();
  }
});

test("Story Cancel exits delayed and stale beat loading and permits a fresh story", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { forge, saved } = await openForge(page, testInfo);
  const progress = { "1": { normal: 3 } };
  saved.progress = progress;
  let releaseBeat!: () => void,
    finishedBeat!: () => void,
    requests = 0;
  const heldBeat = new Promise<void>((resolve) => (releaseBeat = resolve));
  const beatFinished = new Promise<void>((resolve) => (finishedBeat = resolve));
  const cancellations: Record<string, unknown>[] = [];
  await page.route("**/api/gacha-forge/story/cancel", (route) => {
    cancellations.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/gacha-forge/beat", async (route) => {
    const first = ++requests === 1;
    if (first) await heldBeat;
    try {
      await route.fulfill({ json: scene });
    } finally {
      if (first) finishedBeat();
    }
  });
  const start = () =>
    forge.evaluate((node, keptProgress) => {
      const game = node as any;
      game._clearBeat();
      game._run.progress = keptProgress;
      game._prologue = false;
      game._hudView = "chapter";
      game._planChapter = 1;
      game._plan = { title: "Saved chapter", nodes: [{ index: 1, type: "story", title: "Garden", storyIndex: 0 }] };
      game._activeStoryNode = {
        chapter: 1,
        nodeIndex: 0,
        storyIndex: 0,
        title: "Garden",
        difficulty: "normal",
        replay: false,
      };
      game._beatState = "loading";
      game._beatRequested = false;
      game._renderBrowser();
    }, progress);
  try {
    await start();
    await expect.poll(() => requests).toBe(1);
    const cancel = forge.locator(".gf-stage > .gf-view [data-forge-story-cancel]");
    await expect(cancel).toBeVisible();
    await forge.screenshot({ path: testInfo.outputPath("beat-loading-cancel.png") });
    await cancel.click();
    await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
    await expect.poll(() => cancellations.length).toBe(1);
    expect(
      await forge.evaluate((node) => ({ plan: (node as any)._plan.title, progress: (node as any)._run.progress })),
    ).toEqual({
      plan: "Saved chapter",
      progress,
    });
    releaseBeat();
    await beatFinished;
    await expect(forge.locator("[data-vn]")).toHaveCount(0);
    expect(await forge.evaluate((node) => (node as any)._state())).toBe("hud");
    await start();
    await expect.poll(() => requests).toBe(2);
    await expect(forge.locator("[data-vn]")).toBeVisible();
    expect(await forge.evaluate((node) => (node as any)._run.progress)).toEqual(progress);
    await forge.evaluate((node) => {
      const game = node as any;
      game._clearBeat();
      game._beatState = "loading";
      game._beatRequested = true;
      game._renderBrowser();
    });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(forge.getByRole("button", { name: "Game settings", exact: true })).toBeVisible();
    expect(requests).toBe(2);
    expect(errors).toEqual([]);
  } finally {
    releaseBeat();
  }
});
