import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
const engineRoot = process.env.MARINARA_ENGINE_ROOT!;
const version = JSON.parse(readFileSync(resolve(engineRoot, "package.json"), "utf8")).version;
test.use({ actionTimeout: 10000 });

test("installed Memory Nag exposes and validates message ranges", async ({ page, request }, info) => {
  const character = await (
    await request.post("/api/characters", { data: { data: { name: "Dottore", first_mes: "" } } })
  ).json();
  const chat = await (
    await request.post("/api/chats", {
      data: { name: "Memory range proof", mode: "roleplay", characterIds: [character.id] },
    })
  ).json();
  for (let i = 0; i < 12; i++)
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: i % 2 ? "assistant" : "user",
        characterId: i % 2 ? character.id : null,
        content: `Message ${i + 1}`,
      },
    });
  await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: true, activeAgentIds: ["memory-nag"] },
  });
  const prompts: string[] = [];
  const provider = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    prompts.push(Buffer.concat(chunks).toString());
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                memories: [
                  { text: "Dottore promised to keep the latest experiment private.", characterIds: [character.id] },
                ],
                resolvedMemoryIds: [],
              }),
            },
            finish_reason: "stop",
          },
        ],
      }),
    );
  });
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Fixture provider unavailable");
  const connection = await (
    await request.post("/api/connections", {
      data: {
        name: "Memory range fixture",
        provider: "custom",
        model: "fixture",
        apiKey: "",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
      },
    })
  ).json();
  await request.patch(`/api/memory-nag/settings/${chat.id}`, {
    headers: { "x-marinara-csrf": "1" },
    data: { scanConnectionId: connection.id, messagesPerBatch: 5 },
  });
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            state: {
              hasCompletedOnboarding: true,
              sidebarOpen: false,
              rightPanelOpen: false,
              chatHelpSeenModes: ["roleplay"],
              chibiProfessorMariEnabled: false,
            },
            version: 96,
          }),
        );
      },
      { chatId: chat.id, version },
    );
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    await page.getByRole("button", { name: /^Agents(?: \d+)? Show help$/ }).click();
    const settings = page.locator('marinara-capability-memory-nag[view="settings"]');
    await expect(settings).toBeVisible();
    await settings.getByLabel("Messages to process").selectOption("range");
    await settings.getByLabel("First message", { exact: true }).fill("8");
    await settings.getByLabel("Last message", { exact: true }).fill("99");
    await settings.getByRole("button", { name: "Create Memories", exact: true }).click();
    await expect(
      page.getByText("Choose whole message numbers from 1 to 12, with the last message at or after the first."),
    ).toBeVisible();
    const dialog = page.getByRole("dialog", { name: /Creating|Memory|Vault/i }).last();
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
    await settings.getByLabel("Last message", { exact: true }).fill("12");
    await settings.getByLabel("First message", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("memory-range-settings.png") });
    await info.attach("Installed Memory Nag range controls", {
      path: info.outputPath("memory-range-settings.png"),
      contentType: "image/png",
    });
    await settings.getByRole("button", { name: "Create Memories", exact: true }).click();
    await expect(page.getByText("Memory creation complete.", { exact: true })).toBeVisible();
    expect(prompts.length).toBe(1);
    expect(prompts[0]).toContain("Message 8");
    expect(prompts[0]).toContain("Message 12");
    expect(prompts[0]).not.toContain("Message 7");
    const vault = await (await request.get(`/api/memory-nag/vault/${chat.id}`)).json();
    const { messageIds } = await (await request.get(`/api/memory-nag/scan/${chat.id}`)).json();
    expect(vault.memories[0].sourceMessageIds).toEqual(messageIds.slice(7, 12));
    await page
      .getByRole("dialog", { name: "Creating Memories", exact: true })
      .getByRole("button", { name: "Close", exact: true })
      .first()
      .click();
    // Real route validation runs before provider resolution, and refuses foreign boundaries.
    const invalid = await request.post(`/api/memory-nag/scan/${chat.id}`, {
      headers: { "x-marinara-csrf": "1" },
      data: { startMessageId: "foreign", endMessageId: "foreign" },
    });
    expect(invalid.status()).toBe(400);
    await settings.getByLabel("Messages to process").selectOption("all");
    await expect(settings.getByLabel("First message", { exact: true })).toHaveCount(0);
  } finally {
    provider.closeAllConnections();
    await new Promise<void>((done) => provider.close(() => done()));
    await request.delete(`/api/connections/${connection.id}`);
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
