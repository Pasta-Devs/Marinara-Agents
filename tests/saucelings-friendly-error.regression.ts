import assert from "node:assert/strict";
import { friendlyError } from "../packages/saucelings/src/engine/packages/client/src/features/saucelings/api.ts";

const t = (key: string) => key;
const failed = (message: string, status?: number) =>
  status === undefined ? new Error(message) : Object.assign(new Error(message), { status });
const named = (name: string, message: string) => Object.assign(new Error(message), { name });

// What the player can't read gets a sentence, and the original stays behind Details.
const mapped: Array<[unknown, string]> = [
  [new TypeError("Failed to fetch"), "saucelings.error.network"],
  [new TypeError("NetworkError when attempting to fetch resource."), "saucelings.error.network"],
  [new TypeError("Load failed"), "saucelings.error.network"],
  [named("AbortError", "The operation was aborted."), "saucelings.error.timeout"],
  [named("TimeoutError", "The operation timed out."), "saucelings.error.timeout"],
  [failed("The writing connection didn't answer.", 502), "saucelings.error.writing"],
  [failed("Bad Gateway", 502), "saucelings.error.writing"],
  [failed("Internal Server Error", 500), "saucelings.error.engine"],
  [failed("", 503), "saucelings.error.engine"],
  [failed("Not Found", 404), "saucelings.error.restart"],
];
for (const [err, key] of mapped) {
  const shown = friendlyError(err, t);
  assert.equal(shown.message, key, String(err));
  assert.equal(shown.details, (err as Error).message || null);
}

// A sentence the server already wrote is shown as it is, with nothing behind Details.
const kept = [
  failed("Sauceling not found in the Menagerie.", 404),
  failed("The nook changed while you were away. Try again.", 409),
  failed("The image service is out of credits.", 500),
  new TypeError("Cannot read properties of undefined (reading 'name')"),
  new Error("Portraits are turned off in Saucelings settings."),
];
for (const err of kept) assert.deepEqual(friendlyError(err, t), { message: err.message, details: null });

// Something that isn't an Error still says the request failed.
assert.deepEqual(friendlyError("boom", t), { message: "saucelings.error.request", details: null });
assert.deepEqual(friendlyError(null, t), { message: "saucelings.error.request", details: null });

console.log("saucelings friendly-error regression passed");
