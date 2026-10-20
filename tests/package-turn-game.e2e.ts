// Mount smoke for one installed turn game (MARINARA_PACKAGE_ID: chess, eightball, poker, rock-paper-scissors,
// tic-tac-toe or uno): its board renders in a Conversation with the Engine's React, and it locks while the Engine's
// own chat store says the character is replying in that chat. The bundled store copy the games used to carry never
// heard the Engine stream, so boards stayed playable mid-reply (Pasta-Devs/Marinara-Agents#1487).
// Run: node scripts/run-package-browser-tests.mjs tic-tac-toe tests/package-turn-game.e2e.ts
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT!;
const packageId = process.env.MARINARA_PACKAGE_ID ?? "";
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
// What each game's Setup sends, chosen so the player moves first and the board has something to lock.
const START_CONFIG: Record<string, Record<string, unknown>> = {
  chess: { humanColor: "white" },
  eightball: { raceTo: 1, humanBreaks: "you" },
  poker: {},
  "rock-paper-scissors": { roundsToWin: 1 },
  "tic-tac-toe": { humanMark: "X" },
  uno: {},
};

test.skip(!(packageId in START_CONFIG), "runs with a turn game's package id");

type HostChatStore = { setState: (patch: Record<string, unknown>) => void };
type HostWindow = { __MARINARA_HOST__?: { version: number; stores: { chat: HostChatStore } } };

test(`installed ${packageId} board renders and locks while the character replies`, async ({ page, request }, info) => {
  const { UI_PERSISTENCE } = await import(
    pathToFileURL(resolve(engineRoot, "packages/client/src/lib/ui-persistence.ts")).href
  );
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const character = await (
    await request.post("/api/characters", { data: { data: { name: "Bo", first_mes: "" } } })
  ).json();
  const chat = await (
    await request.post("/api/chats", {
      data: { name: `${packageId} board proof`, mode: "conversation", characterIds: [character.id] },
    })
  ).json();
  try {
    const enabled = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: [packageId] },
    });
    expect(enabled.ok(), await enabled.text()).toBe(true);
    // A deal can open on the character's turn (UNO's first card); deal again until the player moves first.
    let yourTurn = false;
    for (let seed = 1; seed <= 12 && !yourTurn; seed += 1) {
      const start = await request.post(`/api/turn-games/${chat.id}/start`, {
        data: {
          gameType: packageId,
          config: START_CONFIG[packageId],
          botCharacterIds: [character.id],
          humanFirst: true,
          seed,
        },
      });
      expect(start.ok(), await start.text()).toBe(true);
      const { view } = await (await request.get(`/api/turn-games/${chat.id}/state`)).json();
      yourTurn = !!view?.currentSeatId && view.currentSeatId === view.yourSeatId;
      if (!yourTurn) await request.post(`/api/turn-games/${chat.id}/resign`, { data: {} });
    }
    expect(yourTurn, "no deal gave the player the first move").toBe(true);
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript(
      ({ chatId, version, persistence }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem(
          persistence.name,
          JSON.stringify({
            version: persistence.version,
            state: {
              hasCompletedOnboarding: true,
              sidebarOpen: false,
              rightPanelOpen: false,
              chatHelpSeenModes: ["conversation"],
              chatWindowIntroDismissed: true,
              chibiProfessorMariEnabled: false,
            },
          }),
        );
      },
      { chatId: chat.id, version, persistence: UI_PERSISTENCE },
    );
    await page.goto("/");

    const board = page.locator(`marinara-capability-${packageId}:not([view="setup"])`).first();
    await expect
      .poll(() => board.evaluate((element) => element.childElementCount), { timeout: 60_000 })
      .toBeGreaterThan(0);
    const snapshot = () =>
      board.evaluate((element) => ({
        html: element.innerHTML,
        enabled: element.querySelectorAll("button:not([disabled])").length,
      }));
    const idle = await snapshot();
    expect(idle.html).not.toBe("");
    await page.screenshot({ path: info.outputPath(`${packageId}-board.png`) });

    // The Engine's chat store, the one the board reads, says the character is replying in this chat.
    const setStreaming = (streamingChatId: string | null) =>
      page.evaluate((chatId) => {
        const host = (globalThis as HostWindow).__MARINARA_HOST__;
        if (host?.version !== 1) throw new Error("The Engine did not set __MARINARA_HOST__");
        host.stores.chat.setState({ isStreaming: chatId !== null, streamingChatId: chatId });
      }, streamingChatId);
    await setStreaming(chat.id);
    await expect.poll(async () => (await snapshot()).html).not.toBe(idle.html);
    expect((await snapshot()).enabled).toBeLessThanOrEqual(idle.enabled);
    await page.screenshot({ path: info.outputPath(`${packageId}-board-locked.png`) });

    await setStreaming(null);
    await expect.poll(async () => (await snapshot()).enabled).toBe(idle.enabled);
    expect(pageErrors).toEqual([]);
  } finally {
    await page.close();
    await request.delete(`/api/turn-games/${chat.id}`).catch(() => {});
    await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => {});
    await request.delete(`/api/characters/${character.id}`).catch(() => {});
  }
});
