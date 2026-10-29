// Real Engine/provider boundary: the loopback endpoint rejects JSON mode, then returns validated premise JSON.
import { expect, test } from "@playwright/test";
import { createServer } from "node:http";

test("Otome Hearth real custom endpoint recovers from a rejected JSON hint", async ({ request, baseURL }, testInfo) => {
  const sent: Array<Record<string, unknown>> = [];
  const premise = "In a city of clockwork canals, an apprentice witnesses a murder at the masked ball.";
  const upstream = createServer(async (incoming, response) => {
    response.setHeader("content-type", "application/json");
    if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
      response.writeHead(404).end(JSON.stringify({ error: { message: "Unknown fixture route" } }));
      return;
    }
    let raw = "";
    for await (const chunk of incoming) raw += chunk;
    const body = JSON.parse(raw) as Record<string, unknown>;
    sent.push(body);
    if (body.response_format !== undefined) {
      response
        .writeHead(400)
        .end(JSON.stringify({ error: { message: "'response_format.type' must be 'json_schema' or 'text'" } }));
      return;
    }
    response.end(
      JSON.stringify({
        id: "otome-json-fixture",
        object: "chat.completion",
        model: body.model,
        choices: [
          { index: 0, message: { role: "assistant", content: JSON.stringify({ premise }) }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    );
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("Fixture endpoint did not open a TCP port");
  const headers = { "x-marinara-csrf": "1", origin: new URL(baseURL!).origin };
  let connectionId: string | undefined;
  try {
    const created = await request.post("/api/connections", {
      headers,
      data: {
        name: `Otome JSON compatibility fixture ${Date.now()}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "local-fixture-only",
        model: "gemma4-gutenberg-31b-i1",
        maxContext: 128_000,
        maxTokensOverride: null,
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    connectionId = ((await created.json()) as { id: string }).id;
    const result = await request.post("/api/otome-forge/premise/suggest", {
      headers,
      data: { language: "English", connectionId },
    });
    await testInfo.attach("upstream-requests", {
      body: JSON.stringify(sent, null, 2),
      contentType: "application/json",
    });
    expect(result.ok(), await result.text()).toBe(true);
    expect(await result.json()).toEqual({ premise });
    expect(sent).toHaveLength(2);
    expect(sent[0].response_format).toEqual({ type: "json_object" });
    const withoutHint = { ...sent[0] };
    delete withoutHint.response_format;
    expect(sent[1]).toEqual(withoutHint);
    expect(Number(sent[1].max_tokens ?? sent[1].max_completion_tokens)).toBeGreaterThanOrEqual(8192);
  } finally {
    try {
      if (connectionId) {
        const removed = await request.delete(`/api/connections/${connectionId}`, { headers });
        expect(removed.ok(), await removed.text()).toBe(true);
      }
    } finally {
      upstream.closeAllConnections();
      await new Promise<void>((resolve, reject) => upstream.close((error) => (error ? reject(error) : resolve())));
    }
  }
});
