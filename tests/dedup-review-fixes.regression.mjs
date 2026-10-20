// Fixes from the review of the host de-duplication (Pasta-Devs/Marinara-Agents#1487, follow-up to #1494).
// Run: node tests/dedup-review-fixes.regression.mjs
// With MARINARA_ENGINE_ROOT set to an Engine checkout, it also checks that every Professor Mari picture Long-Term
// Memory's setup guide asks for exists in that Engine.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");
const slurp = (path) => read(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
// assert.match prints the whole file on a failure; these print the pattern and the reason only.
const has = (source, pattern, message = `missing ${pattern}`) => assert.ok(pattern.test(source), message);
const lacks = (source, pattern, message = `unexpected ${pattern}`) => assert.ok(!pattern.test(source), message);
/** The source of `name`'s body: from its declaration to the next top-level declaration. */
const fn = (source, name) => {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} is missing`);
  const next = source.slice(start + 1).search(/\n(?:export )?(?:async )?function |\nconst |\nexport const /u);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
};

// --- Slurp: automatic posts book the connection once, in the run's own mode -----------------------------------
// The host's withFallback admits the call with the run's admission mode. A connection id on the primary booked it
// as foreground work as well, so an automatic post ran while the player's chat streamed and then kept every other
// automatic job (Noodle's too) waiting for 30 s.
const integrations = slurp("base/host/slp-generation-integrations.ts");
const postProvider = fn(integrations, "createSlurpPostProvider");
const primaryStart = postProvider.indexOf("createSlurpProvider({");
const primaryEnd = postProvider.indexOf("}) ??", primaryStart);
assert.ok(primaryStart !== -1 && primaryEnd > primaryStart, "createSlurpPostProvider's primary provider was not found");
const primary = postProvider.slice(primaryStart, primaryEnd);
lacks(primary, /connectionId:/u, "the post's primary provider must not book the connection itself");
has(postProvider, /admissionMode: input\.admissionMode,/u, "the host's fallback wrapper books the run's mode");

// A beat reading beside an automatic post books nothing and runs only while background work may use the connection;
// beside a player's post it is the player's foreground work.
const beats = slurp("features/feed/slp-post-beat-service.ts");
const beatJson = fn(beats, "completeSlurpBeatJson");
has(beatJson, /if \(context\.background\) slpRequireBackgroundIdle\(connection\.id\);/u);
has(beatJson, /admissionMode: context\.background \? \{ kind: "none" \} : \{ kind: "foreground" \}/u);
const idle = fn(integrations, "slpRequireBackgroundIdle");
has(idle, /const free = tryBackgroundConnection\(connectionId, new Date\(\)\);/u);
has(idle, /error\.name = "BackgroundConnectionBusyError";\s*throw error;\s*\}\s*free\.release\(\);/u);
const generation = slurp("features/feed/slp-generation-service.ts");
assert.equal(
  generation.match(/background: input\.admissionMode\?\.kind === "background"/gu)?.length,
  2,
  "both beat contexts (the run's readings and the planner) carry the run's mode",
);
// A busy connection sent nothing, so it is not a failed reading: no 30-minute wait, no warning.
for (const file of ["data/creators/slp-canon-anchor-storage.ts", "features/feed/slp-shared-preseed-service.ts"]) {
  has(
    slurp(file),
    /\.catch\(\(error: unknown\) => \{\s*\/\/ A busy connection sent nothing: the next post tries again\.\s*if \(slpIsAdmissionFailure\(error\)\) return;\s*failedUntil\.set/u,
    `${file} treats a busy connection as a deferral`,
  );
}

// --- Slurp: model calls the player starts are booked as foreground work --------------------------------------
// createLLMProvider's 10th argument is the connection id; the host then books the call like a chat, so automatic
// work waits for it. Calls inside a run that holds the background slot must not pass it.
const bookedLast = (source, expression) =>
  new RegExp(`connection\\.defaultParameters,\\s*(?://[^\\n]*\\n\\s*)*${expression},\\s*\\),`, "u").test(source);
for (const [file, expression] of [
  ["features/assist/slp-assist-service.ts", "connection\\.id"],
  ["features/audience/slp-fan-voice-draft-service.ts", "connection\\.id"],
  ["features/messages/slp-conversation-schedule-generation.ts", "connection\\.id"],
  ["features/creators/slp-page-style-service.ts", "connection\\.id"],
  ["features/assist/slp-stir-service.ts", 'origin === "player" \\? connection\\.id : undefined'],
  ["features/creators/slp-creator-page-service.ts", "input\\.world \\? undefined : connection\\.id"],
  ["features/media/slp-appearance-service.ts", "input\\.foreground \\? connection\\.id : undefined"],
  ["base/media/slp-post-image-context.ts", "bookConnection \\? connection\\.id : undefined"],
]) {
  assert.ok(bookedLast(slurp(file), expression), `${file} books the player's call on the connection`);
}
has(
  slurp("features/creators/slp-creators-routes.ts"),
  /regenerate: parsed\.data\.action === "regenerate",\s*foreground: true,/u,
);
has(
  slurp("features/audience/slp-fan-activity-service.ts"),
  /input\.settings\.imageCaptionPrompt,\s*\/\/[^\n]*\n\s*false,\s*\),/u,
  "fan activity holds the background slot, so its captioning books nothing",
);
// A caption connection other than the run's is not covered by the run's slot: each caption waits for it.
const captioning = fn(slurp("base/media/slp-post-image-context.ts"), "slurpImageCaptioning");
has(captioning, /const yieldToForeground = !bookConnection && connection\.id !== textConnection\.id;/u);
has(captioning, /chatComplete: async [^\n]*\n\s*if \(yieldToForeground\) slpRequireBackgroundIdle\(connection\.id\);/u);
for (const file of ["features/audience/slp-fan-activity-service.ts", "features/world/slp-reaction-bank-operation.ts"]) {
  assert.ok(!bookedLast(slurp(file), "connection\\.id"), `${file} holds the background slot and books nothing more`);
}

// --- Calls: the call's volume never reaches the Engine's read-aloud -------------------------------------------
const surface = read(
  "packages/conversation-calls/src/engine/packages/client/src/components/chat/ConversationCallSurface.tsx",
);
const volume = surface.slice(surface.indexOf("const activeId = ttsService.getActiveId();"));
has(
  volume,
  /^const activeId = ttsService\.getActiveId\(\);\s*const callSpeaking =\s*activeId !== null &&\s*\(participants\.some\(\(participant\) => participant\.id === activeId\) \|\| activeId\.startsWith\(`\$\{session\.id\}:`\)\);\s*if \(!callSpeaking\) return;\s*ttsService\.setCurrentPlaybackVolume\(characterVoicePlaybackVolume, characterVoicesMuted\);/u,
  "the call's volume reaches only a clip the call is playing",
);
assert.equal(surface.match(/ttsService\.setCurrentPlaybackVolume\(/gu)?.length, 1, "no unguarded live volume change");

// --- Calls: a chat on the Local Model answers through the Engine's Local Model --------------------------------
const routes = read("packages/conversation-calls/src/engine/packages/server/src/routes/conversation-calls.routes.ts");
const turns = fn(routes, "createCallTurns");
has(
  turns,
  /if \(connId === LOCAL_SIDECAR_CONNECTION_ID\) \{[\s\S]*?provider = withConnectionAdmissionProvider\(getLocalSidecarProvider\(\), LOCAL_SIDECAR_CONNECTION_ID\);/u,
  "a Local Model chat answers through the Engine's Local Model",
);
has(turns, /logger\.warn\(\s*"\[conversation-call\] Connection %s of chat %s was not found; the call cannot answer"/u);
// The Local Model is the Engine's (sources/host-runtime-overlay), never a second llama-server in the bundle.
has(read("packages/conversation-calls/server.mjs"), /localSidecar\(\)/u);
lacks(read("packages/conversation-calls/server.mjs"), /Timed out waiting for the local sidecar server/u);

// --- Calls: a [schedule_update] goes on the character card through the Engine (#1498) -------------------------
// The chat's schedule map is a cache the Engine replaces on its next presence read, so the call's edit was lost.
const scheduleUpdate = fn(routes, "applyCallScheduleUpdate");
has(scheduleUpdate, /await hostCharacterStatusUpdate\(\)\(input\.chatId, characterId, \{/u);
has(
  scheduleUpdate,
  /logger\.warn\(error, "\[conversation-call\] Schedule update failed"\);/u,
  "an unavailable or refused update is logged, never thrown into the call's reply",
);
has(
  fn(routes, "hostCharacterStatusUpdate"),
  /requireHostMember\("Schedule updates in calls", persistence\.updateCharacterStatus\)/u,
  "a missing member reports the feature unavailable instead of using a copy",
);
has(
  routes,
  /typeof hostRuntime\(\)\.persistence\.updateCharacterStatus === "function" &&/u,
  "the call offers [schedule_update] only when the Engine has the member",
);
lacks(routes, /characterSchedules/u, "a call never writes the chat's schedule cache");
has(read("packages/conversation-calls/server.mjs"), /updateCharacterStatus/u);

// --- Noodle: popovers portal into Noodle's own element ---------------------------------------------------------
const card = read("packages/noodle/src/engine/packages/client/src/components/noodle/NoodlePostCard.tsx");
const popover = fn(card, "NoodleAnchoredPopover");
has(popover, /const portalContainer = useContext\(ModalPortalContext\);/u);
has(popover, /portalContainer \?\? document\.body,\s*\);/u);
has(popover, /"pointer-events-auto fixed /u, "the dialog layer has pointer-events: none");

// --- Long-Term Memory: the setup guide asks only for pictures the Engine ships ---------------------------------
const onboarding = read(
  "packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/Onboarding.tsx",
);
const sprites = new Set([
  ...[...onboarding.matchAll(/"\/sprites\/mari\/([^"]+)"/gu)].map((match) => match[1]),
  ...[...onboarding.matchAll(/(?:mobileSprite|desktopSprite): "([^"]+)"/gu)].map((match) => match[1]),
]);
assert.ok(sprites.size >= 7, "the guide's pictures were found");
for (const sprite of sprites) lacks(sprite, /^Mari_|\.png$/u, `${sprite} is a removed painted Mari`);
const engineRoot = process.env.MARINARA_ENGINE_ROOT;
if (engineRoot) {
  const spriteDir = join(resolve(engineRoot), "packages/client/public/sprites/mari");
  assert.ok(existsSync(spriteDir), `MARINARA_ENGINE_ROOT has no ${spriteDir}`);
  for (const sprite of sprites)
    assert.ok(existsSync(join(spriteDir, sprite)), `the Engine has no sprites/mari/${sprite}`);
} else {
  console.log("Skipped the Engine sprite check: set MARINARA_ENGINE_ROOT to an Engine checkout.");
}

console.log("De-duplication review fixes regression passed.");
