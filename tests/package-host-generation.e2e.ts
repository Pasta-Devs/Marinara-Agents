import { expect, test } from "@playwright/test";
import { createServer } from "node:http";

// Use the rebuilt, installed Slurp2 artifact and real Engine routes; only the remote provider is synthetic.
test("Creator artwork reaches the host image service and is saved in the profile", async ({ page }) => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const received: Record<string, unknown>[] = [];
  const provider = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    if (!request.url?.endsWith("/images/generations")) {
      response.writeHead(404).end();
      return;
    }
    received.push(JSON.parse(body));
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ data: [{ b64_json: png }] }));
  });
  await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Fixture provider failed to listen");
  let connectionId: string | undefined;
  let profileId: string | undefined;
  let settings: Record<string, unknown> | undefined;
  try {
    await expect.poll(async () => (await page.request.get("/api/slurp2/settings")).status()).toBe(200);
    settings = await (await page.request.get("/api/slurp2/settings")).json();
    expect(
      (await page.request.patch("/api/slurp2/settings", { data: { enableImageInterpretation: false } })).ok(),
    ).toBe(true);
    const connection = await page.request.post("/api/connections", {
      data: {
        name: "Synthetic host image provider",
        provider: "image_generation",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture-only",
        model: "fixture-image",
        imageGenerationSource: "openai",
        imageService: "openai",
        defaultForAgents: true,
      },
    });
    expect(connection.ok(), await connection.text()).toBe(true);
    connectionId = (await connection.json()).id;
    expect(
      (
        await page.request.put(`/api/connections/${connectionId}/default-parameters`, {
          data: { customParameters: { seed: 42 } },
        })
      ).ok(),
    ).toBe(true);
    const profile = await page.request.post("/api/slurp2/accounts/__professor_mari__/noodler", {
      data: {
        stageProfile: {
          displayName: "Synthetic artwork",
          handle: `host_image_${Date.now()}`,
          bio: "An imaginary landscape artist",
          stagePersonality: "Concise",
          disclosureMode: "open",
          gender: "other",
          tags: ["art", "gaming", "cosplay"],
        },
      },
    });
    expect(profile.ok(), await profile.text()).toBe(true);
    profileId = (await profile.json()).id;
    const generated = await page.request.post(`/api/slurp2/slurp/accounts/${profileId}/artwork/generate`, {
      data: { kind: "avatar" },
    });
    expect(generated.ok(), await generated.text()).toBe(true);
    expect(received).toHaveLength(1);
    expect(received[0]?.model).toBe("fixture-image");
    expect(received[0]?.seed).toBe(42);
    expect(received[0]?.prompt).toContain("Synthetic artwork");
    const result = await generated.json();
    expect(result.avatarUrl).toBeTruthy();
    const image = await page.request.get(result.avatarUrl);
    expect(image.ok()).toBe(true);
    expect(await image.body()).toEqual(Buffer.from(png, "base64"));
  } finally {
    if (profileId) await page.request.delete(`/api/slurp2/slurp/accounts/${profileId}`);
    if (connectionId) await page.request.delete(`/api/connections/${connectionId}`);
    if (settings)
      await page.request.patch("/api/slurp2/settings", {
        data: { enableImageInterpretation: settings.enableImageInterpretation },
      });
    provider.closeAllConnections();
    await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
  }
});
