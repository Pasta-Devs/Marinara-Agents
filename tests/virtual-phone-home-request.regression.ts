import assert from "node:assert/strict";
import {
  markHomePhone,
  phoneRequest,
  recordActivity,
  rememberWorldFact,
  setActiveChatId,
} from "../packages/virtual-phone/src/phone/platform/api";

async function main() {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const requests: string[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: () => null } },
  });
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  };
  try {
    // A story can stay open while the user visits Home. Its id must stay out of Home requests.
    setActiveChatId("story-still-open");
    markHomePhone("saved-home-phone");
    for (const path of [
      "/home",
      "/home/phones",
      "/phones/saved-home-phone/settings",
      "/lorebooks?phoneId=saved-home-phone",
    ]) {
      await phoneRequest(path);
      assert.ok(!requests.at(-1)!.includes("chatId="), path);
    }
    const reads = requests.length;
    await recordActivity("saved-home-phone", "Read a note");
    await rememberWorldFact("saved-home-phone", "Private note", "notes");
    assert.equal(requests.length, reads, "Home browsing does not record story activity or facts");

    // Story requests retain their existing context; an explicitly selected chat still wins.
    await phoneRequest("/phones/story-phone/settings");
    assert.ok(requests.at(-1)!.endsWith("?chatId=story-still-open"));
    await phoneRequest("/phones/story-phone/settings?chatId=explicit-story");
    assert.ok(requests.at(-1)!.endsWith("?chatId=explicit-story"));
  } finally {
    setActiveChatId(null);
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
  console.log("Virtual Phone Home request isolation regression passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
