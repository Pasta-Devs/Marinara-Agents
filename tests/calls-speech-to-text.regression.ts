import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transcribeCallAudio } from "../packages/conversation-calls/src/engine/packages/server/src/services/conversation/call-transcription.ts";
import {
  CALL_SPEECH_QUEUE_LIMIT,
  createCallSpeechQueue,
} from "../packages/conversation-calls/src/engine/packages/client/src/lib/call-speech-queue.ts";

const wav = Buffer.from("RIFF call clip");
function whisper(answer = " from whisper ") {
  const calls: Buffer[] = [];
  return {
    calls,
    run: async (audio: Buffer) => {
      calls.push(audio);
      return answer;
    },
  };
}

async function main() {
  // No speech host (older Engine), or a host without transcribe: Local Whisper as before.
  for (const speech of [undefined, null, {}]) {
    const local = whisper();
    assert.deepEqual(await transcribeCallAudio(wav, { speech, localWhisper: local.run }), {
      transcript: "from whisper",
      speechServer: false,
    });
    assert.deepEqual(local.calls, [wav]);
  }

  // The server is turned off: the host answers null and Local Whisper transcribes.
  {
    const local = whisper();
    const result = await transcribeCallAudio(wav, {
      speech: { transcribe: async () => null },
      localWhisper: local.run,
    });
    assert.deepEqual(result, { transcript: "from whisper", speechServer: false });
    assert.equal(local.calls.length, 1);
  }

  // The server is on: it gets the WAV with its name, type and the request's signal, and Local Whisper stays idle.
  {
    const local = whisper();
    const signal = new AbortController().signal;
    const sent: unknown[][] = [];
    const result = await transcribeCallAudio(wav, {
      speech: {
        transcribe: async (...args) => {
          sent.push(args);
          return "  hola, ¿qué tal?  ";
        },
      },
      signal,
      localWhisper: local.run,
    });
    assert.deepEqual(result, { transcript: "hola, ¿qué tal?", speechServer: true });
    assert.deepEqual(sent, [[wav, { filename: "call-audio.wav", mimeType: "audio/wav", signal }]]);
    assert.equal(local.calls.length, 0);
  }

  // An empty answer from the server is its answer: the route's blank-transcript checks handle it.
  {
    const local = whisper();
    const result = await transcribeCallAudio(wav, { speech: { transcribe: async () => " " }, localWhisper: local.run });
    assert.deepEqual(result, { transcript: "", speechServer: true });
    assert.equal(local.calls.length, 0);
  }

  // The server fails: the error is reported and Local Whisper transcribes.
  {
    const local = whisper();
    const failure = new Error("Could not reach the speech-to-text server.");
    const reported: unknown[] = [];
    const result = await transcribeCallAudio(wav, {
      speech: {
        transcribe: async () => {
          throw failure;
        },
      },
      localWhisper: local.run,
      onSpeechServerError: (error) => reported.push(error),
    });
    assert.deepEqual(result, { transcript: "from whisper", speechServer: false });
    assert.deepEqual(reported, [failure]);
  }

  // Both fail: the server's reason is shown, not a missing Local Whisper download.
  {
    const failure = new Error("The speech-to-text server answered 401: bad key");
    await assert.rejects(
      transcribeCallAudio(wav, {
        speech: {
          transcribe: async () => {
            throw failure;
          },
        },
        localWhisper: async () => {
          throw new Error("Download Local Whisper from Connections before using it for call transcription.");
        },
      }),
      failure,
    );
  }

  // Without a server, a Local Whisper failure still surfaces as before.
  await assert.rejects(
    transcribeCallAudio(wav, {
      localWhisper: async () => {
        throw new Error("Download Local Whisper from Connections before using it for call transcription.");
      },
    }),
    /Download Local Whisper/u,
  );

  // The browser went away: no Local Whisper run for a request nobody waits for.
  {
    const local = whisper();
    const controller = new AbortController();
    const reported: unknown[] = [];
    await assert.rejects(
      transcribeCallAudio(wav, {
        speech: {
          transcribe: async (_audio, options) => {
            controller.abort();
            throw options?.signal?.reason;
          },
        },
        signal: controller.signal,
        localWhisper: local.run,
        onSpeechServerError: (error) => reported.push(error),
      }),
      { name: "AbortError" },
    );
    assert.equal(local.calls.length, 0);
    assert.deepEqual(reported, []);
  }

  // The browser went away while the server answered "off": Local Whisper does not start either.
  {
    const local = whisper();
    const controller = new AbortController();
    await assert.rejects(
      transcribeCallAudio(wav, {
        speech: {
          transcribe: async () => {
            controller.abort();
            return null;
          },
        },
        signal: controller.signal,
        localWhisper: local.run,
      }),
      { name: "AbortError" },
    );
    assert.equal(local.calls.length, 0);
  }

  // Speech recorded while an earlier clip is transcribed is kept, up to the limit. The old gate held one.
  {
    assert.ok(CALL_SPEECH_QUEUE_LIMIT > 1, "a clip recorded during transcription waits instead of being dropped");
    const queue = createCallSpeechQueue();
    const held = Array.from({ length: CALL_SPEECH_QUEUE_LIMIT }, () => queue.hold());
    assert.ok(held.every(Boolean), "every clip up to the limit gets a place");
    assert.equal(queue.hold(), null, "past the limit, a new clip is dropped");

    const [first, ...waiting] = held as Array<() => void>;
    first();
    first();
    const next = queue.hold();
    assert.ok(next, "a transcribed clip frees its place");
    assert.equal(queue.hold(), null, "releasing the same clip twice frees one place");

    // Hang-up clears the queue, and clips from before it cannot free places afterwards.
    queue.clear();
    const afterHangUp = Array.from({ length: CALL_SPEECH_QUEUE_LIMIT }, () => queue.hold());
    assert.ok(afterHangUp.every(Boolean), "hang-up empties the queue");
    for (const release of [...waiting, next]) release();
    assert.equal(queue.hold(), null, "releases from before the hang-up do not free new places");
  }

  // The built package hands the Engine runtime to the call routes and ships both paths.
  const server = await readFile(new URL("../packages/conversation-calls/server.mjs", import.meta.url), "utf8");
  assert.match(server, /prefix:"\/api\/conversation-calls",runtime:\w+\.runtime/u);
  assert.match(server, /call-audio\.wav/u);

  // Hanging up while a slow server transcribes: the route checks the call again before saving or answering.
  const routes = await readFile(
    new URL(
      "../packages/conversation-calls/src/engine/packages/server/src/routes/conversation-calls.routes.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    routes,
    /await transcribeCallAudio\([\s\S]*?\(await calls\.getSession\(session\.id\)\)\?\.status !== "active"[\s\S]*?calls\.createMessage\(/u,
    "an ended call gets no message and no reply after a slow transcription",
  );
  assert.match(server, /\(await \w+\.getSession\(\w+\.id\)\)\?\.status!=="active"\)return \w+\.status\(400\)/u);

  process.stdout.write("Calls speech-to-text regression passed.\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
