import assert from "node:assert/strict";
import { playWhenAvailable } from "../sources/engine/packages/client/src/lib/tts-service.ts";

const listeners = new Map<string, Set<(event: unknown) => void>>();
const windowStub = {
  addEventListener(name: string, callback: (event: unknown) => void) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name)!.add(callback);
  },
  removeEventListener(name: string, callback: (event: unknown) => void) {
    listeners.get(name)?.delete(callback);
  },
};
const documentStub = { ...windowStub, visibilityState: "visible", hasFocus: () => true };
Object.assign(globalThis, { window: windowStub, document: documentStub });
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const gesture = (isTrusted = true) => {
  for (const callback of [...(listeners.get("pointerup") ?? [])]) {
    callback({ type: "pointerup", pointerType: "touch", isTrusted });
  }
};
const policyError = new DOMException("Playback requires a gesture", "NotAllowedError");
async function main() {
  try {
    let plays = 0;
    const done = playWhenAvailable({
      play() {
        plays += 1;
        return plays < 3 ? Promise.reject(policyError) : Promise.resolve();
      },
    });
    await tick();
    assert.equal(plays, 1, "blocked playback must yield to the event loop and wait for a gesture");
    gesture(false);
    await tick();
    assert.equal(plays, 1, "synthetic gestures do not trigger retries");
    gesture();
    await tick();
    assert.equal(plays, 2);
    gesture();
    await done;
    assert.equal(plays, 3);

    const controller = new AbortController();
    const aborted = playWhenAvailable({ play: () => Promise.reject(policyError) }, controller.signal).catch(
      (error: unknown) => error,
    );
    await tick();
    controller.abort();
    assert.equal(((await aborted) as Error).name, "AbortError");
    assert.equal(
      [...listeners.values()].reduce((count, callbacks) => count + callbacks.size, 0),
      0,
    );

    const decodeError = new DOMException("Invalid audio", "NotSupportedError");
    let decodeAttempts = 0;
    await assert.rejects(
      playWhenAvailable({
        play: () => {
          decodeAttempts += 1;
          documentStub.visibilityState = "hidden";
          return Promise.reject(decodeError);
        },
      }),
      (error) => error === decodeError,
    );
    assert.equal(decodeAttempts, 1, "non-policy failures surface even if the tab becomes hidden");
    documentStub.visibilityState = "visible";

    let cappedAttempts = 0;
    const exhausted = playWhenAvailable({
      play: () => {
        cappedAttempts += 1;
        return Promise.reject(policyError);
      },
    }).catch((error: unknown) => error);
    for (let i = 0; i < 25; i += 1) {
      await tick();
      gesture();
    }
    assert.equal(await exhausted, policyError);
    assert.equal(cappedAttempts, 20);
    assert.equal(
      [...listeners.values()].reduce((count, callbacks) => count + callbacks.size, 0),
      0,
    );
    console.info("Calls playback yields, waits for real gestures, cancels and bounds retries.");
  } finally {
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
