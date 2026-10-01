import assert from "node:assert/strict";
import { prioritizeFirstCallHaptic } from "../packages/conversation-calls/src/engine/packages/client/src/components/chat/call-haptic-playback";

const voice = { mode: "voice", content: "Speaking" };
const haptic = { mode: "command", content: '[haptic: action="vibrate"]' };
const laterHaptic = { mode: "command", content: '[haptic: action="stop"]' };
const otherCommand = { mode: "command", content: "[selfie]" };

assert.deepEqual(prioritizeFirstCallHaptic([voice, haptic]), [haptic, voice]);
assert.deepEqual(prioritizeFirstCallHaptic([otherCommand, voice, haptic, laterHaptic]), [
  otherCommand,
  haptic,
  voice,
  laterHaptic,
]);
assert.deepEqual(prioritizeFirstCallHaptic([voice, laterHaptic]), [laterHaptic, voice]);
assert.deepEqual(prioritizeFirstCallHaptic([haptic, voice]), [haptic, voice]);
assert.deepEqual(prioritizeFirstCallHaptic([voice, otherCommand]), [voice, otherCommand]);
