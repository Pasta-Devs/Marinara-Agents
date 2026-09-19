import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const engineRoot = process.env.MARINARA_ENGINE_ROOT!;
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;

test("installed Calls package stays responsive when browser blocks voice playback", async ({
  page,
  request,
  isMobile,
}, info) => {
  const { UI_PERSISTENCE } = await import(
    pathToFileURL(resolve(engineRoot, "packages/client/src/lib/ui-persistence.ts")).href
  );
  const character = await (
    await request.post("/api/characters", { data: { data: { name: "Alice", first_mes: "" } } })
  ).json();
  const chat = await (
    await request.post("/api/chats", {
      data: { name: "Calls playback proof", mode: "conversation", characterIds: [character.id] },
    })
  ).json();
  const now = new Date().toISOString();
  const session = {
    id: "playback-proof",
    chatId: chat.id,
    status: "active",
    mode: "audio",
    initiator: "user",
    initiatorCharacterId: null,
    startedAt: now,
    endedAt: null,
    summary: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };
  const userMessage = {
    id: "user-turn",
    callId: session.id,
    chatId: chat.id,
    role: "user",
    characterId: null,
    participantKind: "user",
    kind: "text",
    content: "Hello",
    extra: {},
    createdAt: now,
  };
  const assistantMessage = {
    ...userMessage,
    id: "voice-turn",
    role: "assistant",
    characterId: character.id,
    participantKind: "character",
    kind: "speech",
    content: "The experiment can begin.",
  };
  let ended = false;
  let sent = false;
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { conversationCallsEnabled: true } });
    await page.route("**/api/conversation-calls/chat/*/status", (route) =>
      route.fulfill({ json: { activeCall: ended ? null : session, ringingCall: null } }),
    );
    await page.route(`**/api/conversation-calls/${session.id}/messages`, (route) => {
      if (route.request().method() === "POST") {
        sent = true;
        return route.fulfill({
          json: {
            session,
            userMessage,
            assistantMessages: [assistantMessage],
            turns: [
              {
                id: "voice-turn",
                speakerName: "Alice",
                characterId: character.id,
                mode: "voice",
                content: assistantMessage.content,
              },
            ],
          },
        });
      }
      return route.fulfill({ json: sent ? [userMessage, assistantMessage] : [] });
    });
    await page.route(`**/api/conversation-calls/${session.id}/end`, (route) => {
      ended = true;
      return route.fulfill({ json: { ...session, status: "ended", endedAt: now } });
    });
    await page.route("**/api/tts/config", (route) =>
      route.fulfill({
        json: {
          enabled: true,
          source: "openai",
          voice: "alloy",
          voiceMode: "single",
          voiceAssignments: [],
          progressivePlayback: false,
          callAudioEnabled: false,
        },
      }),
    );
    await page.route("**/api/tts/speak", (route) =>
      route.fulfill({ contentType: "audio/wav", body: Buffer.from("RIFF playback fixture") }),
    );
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
              chibiProfessorMariEnabled: false,
            },
          }),
        );
        const proof = { plays: 0, ticks: 0 };
        Object.assign(window, { __callProof: proof });
        setInterval(() => {
          proof.ticks++;
        }, 20);
        HTMLMediaElement.prototype.play = function () {
          if (!this.src.startsWith("blob:")) return Promise.resolve();
          proof.plays++;
          return Promise.reject(new DOMException("User gesture required", "NotAllowedError"));
        };
      },
      { chatId: chat.id, version, persistence: UI_PERSISTENCE },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Open call", exact: true }).filter({ visible: true }).click();
    if (isMobile) await page.getByRole("button", { name: "Open call chat", exact: true }).click();
    const input = page.getByPlaceholder("Message in call").filter({ visible: true });
    await expect(input).toBeVisible();
    await input.fill("Hello");
    await input.press("Enter");
    const readProof = () =>
      page.evaluate(() => (window as unknown as { __callProof: { plays: number; ticks: number } }).__callProof);
    await expect.poll(async () => (await readProof()).plays).toBeGreaterThan(0);
    const before = await readProof();
    await expect.poll(async () => (await readProof()).ticks).toBeGreaterThan(before.ticks + 10);
    expect((await readProof()).plays).toBe(before.plays);
    await page.screenshot({ path: info.outputPath("calls-blocked-playback-responsive.png") });
    if (isMobile) await page.getByRole("button", { name: "Close call chat", exact: true }).click();
    await page.getByRole("button", { name: "End call", exact: true }).click();
    await expect.poll(() => ended).toBe(true);
    await expect(input).toHaveCount(0);
  } finally {
    await page.close();
    await request.delete(`/api/chats/${chat.id}?force=true`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
