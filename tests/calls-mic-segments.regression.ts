import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CALL_MIC_CONFIRM_FRAMES,
  CALL_MIC_MAX_SEGMENT_MS,
  CALL_MIC_MIN_PEAK_RMS,
  CALL_MIC_MIN_SEGMENT_MS,
  CALL_MIC_MIN_VOICED_MS,
  CALL_MIC_RMS_CONTINUE,
  CALL_MIC_RMS_START,
  CALL_MIC_SILENCE_MS,
  CALL_MIC_VAD_INTERVAL_MS,
  createCallMicSegmenter,
} from "../packages/conversation-calls/src/engine/packages/client/src/lib/call-mic-segmenter.ts";
import {
  readCallUpload,
  type CallUploadPart,
} from "../packages/conversation-calls/src/engine/packages/server/src/services/conversation/call-upload.ts";

const LOUD = 0.05;
const QUIET = 0.004;
/** Speech is not evenly loud: some checks land between words, below the level that keeps a clip open. */
const TALKING = [0.05, 0.031, 0.008, 0.06, 0.011, 0.04];
const checks = (ms: number) => Math.round(ms / CALL_MIC_VAD_INTERVAL_MS);
const hold = (rms: number, ms: number) => Array<number>(checks(ms)).fill(rms);
const talk = (ms: number) => Array.from({ length: checks(ms) }, (_, index) => TALKING[index % TALKING.length]!);

type Clip = { start: number; end: number | null };

/** Feeds loudness checks to the segmenter the way the call surface does and returns the clips it records. */
function record(readings: number[], everyMs = CALL_MIC_VAD_INTERVAL_MS) {
  const segmenter = createCallMicSegmenter();
  const clips: Clip[] = [];
  let open: Clip | null = null;
  let now = 1_000_000;
  let lastSpeechAt = 0;
  for (const rms of readings) {
    now += everyMs;
    const { step } = segmenter.check(rms, now, open?.start ?? null);
    if (step === "start" || step === "speech" || step === "split") lastSpeechAt = now;
    if ((step === "end" || step === "split") && open) {
      open.end = now;
      open = null;
    }
    if (step === "start" || step === "split") {
      open = { start: now, end: null };
      clips.push(open);
    }
  }
  return { clips, lastSpeechAt };
}

async function main() {
  // The values Calls shipped with (Marinara-Engine 73efb4e28); they have never changed.
  assert.deepEqual(
    {
      CALL_MIC_VAD_INTERVAL_MS,
      CALL_MIC_MIN_SEGMENT_MS,
      CALL_MIC_SILENCE_MS,
      CALL_MIC_MAX_SEGMENT_MS,
      CALL_MIC_RMS_START,
      CALL_MIC_RMS_CONTINUE,
      CALL_MIC_CONFIRM_FRAMES,
      CALL_MIC_MIN_VOICED_MS,
      CALL_MIC_MIN_PEAK_RMS,
    },
    {
      CALL_MIC_VAD_INTERVAL_MS: 120,
      CALL_MIC_MIN_SEGMENT_MS: 420,
      CALL_MIC_SILENCE_MS: 3_000,
      CALL_MIC_MAX_SEGMENT_MS: 60_000,
      CALL_MIC_RMS_START: 0.022,
      CALL_MIC_RMS_CONTINUE: 0.013,
      CALL_MIC_CONFIRM_FRAMES: 2,
      CALL_MIC_MIN_VOICED_MS: 180,
      CALL_MIC_MIN_PEAK_RMS: 0.022,
    },
  );

  // Speech with 1 and 2 second pauses is one clip, which ends 3 seconds after the last speech.
  {
    const { clips, lastSpeechAt } = record([
      ...hold(QUIET, 600),
      ...talk(2_400),
      ...hold(QUIET, 1_000),
      ...talk(1_800),
      ...hold(QUIET, 2_000),
      ...talk(1_200),
      ...hold(QUIET, 5_000),
    ]);
    assert.equal(clips.length, 1, "pauses shorter than 3 seconds keep one clip");
    assert.equal(clips[0]!.end, lastSpeechAt + CALL_MIC_SILENCE_MS, "3 seconds of quiet end the clip");
  }

  // The boundary: 24 quiet checks (2.88 s) keep the clip, 25 (3 s) end it and the next speech opens another.
  assert.equal(record([LOUD, LOUD, ...hold(QUIET, 2_880), LOUD, LOUD, ...hold(QUIET, 3_000)]).clips.length, 1);
  {
    const { clips } = record([LOUD, LOUD, ...hold(QUIET, 3_000), LOUD, LOUD, ...hold(QUIET, 3_000)]);
    assert.equal(clips.length, 2);
    assert.ok(clips.every((clip) => clip.end !== null));
  }

  // Quiet speech must reach the start level to open a clip, then the lower level keeps it open.
  assert.equal(record(hold(0.015, 5_000)).clips.length, 0);
  {
    const { clips } = record([LOUD, ...hold(0.015, 10_000), ...hold(QUIET, 3_000)]);
    assert.equal(clips.length, 1);
    assert.ok(clips[0]!.end !== null && clips[0]!.end - clips[0]!.start > 12_000);
  }

  // A hidden or covered tab runs the checks about once a second. Quiet moments between words used to
  // end the clip after three quiet checks in a row; now only quiet the mic measured counts.
  {
    const sparse = Array.from({ length: 40 }, (_, index) => (index % 4 === 0 ? LOUD : QUIET));
    const { clips } = record([...sparse, LOUD], 1_000);
    assert.equal(clips.length, 1, "slow checks do not cut a sentence");
    assert.equal(clips[0]!.end, null);
    const after = record([LOUD, LOUD, ...Array<number>(20).fill(QUIET)], 1_000);
    assert.equal(after.clips.length, 1);
    assert.ok(after.clips[0]!.end !== null, "a real pause still ends the clip");
  }
  {
    // One late check (a busy tab) that happens to read quiet does not end the clip either.
    const segmenter = createCallMicSegmenter();
    assert.equal(segmenter.check(LOUD, 0, null).step, "start");
    assert.equal(segmenter.check(LOUD, 120, 0).step, "speech");
    assert.equal(segmenter.check(QUIET, 3_620, 0).step, "wait");
    assert.equal(segmenter.check(LOUD, 3_740, 0).step, "speech");
  }

  // A clip that reaches the maximum length is split during speech and ended in quiet.
  {
    const { clips } = record([...hold(LOUD, CALL_MIC_MAX_SEGMENT_MS + 1_200), ...hold(QUIET, 3_000)]);
    assert.equal(clips.length, 2);
    assert.equal(clips[0]!.end, clips[1]!.start);
    assert.notEqual(record([...hold(LOUD, CALL_MIC_MAX_SEGMENT_MS - 240), ...hold(QUIET, 600)]).clips[0]!.end, null);
  }

  // The speaking indicator shows from the second loud check.
  {
    const segmenter = createCallMicSegmenter();
    assert.equal(segmenter.check(LOUD, 0, null).speechConfirmed, false);
    assert.equal(segmenter.check(LOUD, 120, 0).speechConfirmed, true);
  }

  // Uploads: @fastify/multipart yields parts in the order they were sent, and a field sent after the file
  // may not have arrived yet when the file has been read. This stand-in yields the same way. The Calls
  // client sends its fields after the file, so reading them as soon as the file is read (what req.file()
  // did) missed them, and Local Whisper speech failed as provider-native audio.
  function multipart(
    parts: Array<{ field: string; value: unknown } | { file: string }>,
  ): AsyncIterable<CallUploadPart & { fields: Record<string, { value: unknown }> }> {
    const body: Record<string, { value: unknown }> = {};
    return (async function* () {
      for (const part of parts) {
        if ("field" in part) {
          body[part.field] = { value: part.value };
          yield { type: "field" as const, fieldname: part.field, value: part.value, fields: body };
        } else {
          yield {
            type: "file" as const,
            filename: part.file,
            mimetype: "audio/wav",
            fields: body,
            file: { resume: () => undefined },
            toBuffer: async () => Buffer.from(part.file),
          };
        }
      }
    })();
  }
  const fileFirst = [
    { file: "call-audio.wav" },
    { field: "kind", value: "audio" },
    { field: "nativePreferred", value: "false" },
    { field: "transcriptionMode", value: "local_whisper" },
  ];
  {
    let fieldsSeenWithFile: Record<string, { value: unknown }> | undefined;
    for await (const part of multipart(fileFirst)) {
      if (part.type !== "file") continue;
      await part.toBuffer();
      fieldsSeenWithFile = { ...part.fields };
      break;
    }
    assert.equal(fieldsSeenWithFile?.transcriptionMode, undefined, "the stand-in reproduces the race");
  }
  for (const order of [fileFirst, [...fileFirst.slice(1), fileFirst[0]!]]) {
    const upload = await readCallUpload(multipart(order));
    assert.equal(upload?.buffer.toString(), "call-audio.wav");
    assert.equal(upload?.filename, "call-audio.wav");
    assert.equal(upload?.mimetype, "audio/wav");
    assert.equal(upload?.fields.transcriptionMode?.value, "local_whisper", "fields are read in any order");
    assert.equal(upload?.fields.kind?.value, "audio");
    assert.equal(upload?.fields.nativePreferred?.value, "false");
  }
  {
    const upload = await readCallUpload(
      multipart([{ file: "first" }, { file: "second" }, { field: "data", value: { json: true } }]),
    );
    assert.equal(upload?.buffer.toString(), "first", "only the first file is used");
    assert.equal(upload?.fields.data, undefined, "only text fields are kept");
  }
  assert.equal(await readCallUpload(multipart([{ field: "kind", value: "audio" }])), null);

  // The media route reads every part before using a field, and the built package ships that.
  const routes = await readFile(
    new URL(
      "../packages/conversation-calls/src/engine/packages/server/src/routes/conversation-calls.routes.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const mediaRoute = routes.slice(routes.indexOf('app.post<{ Params: { id: string } }>("/:id/media"'));
  assert.match(
    mediaRoute,
    /^[\s\S]{0,1200}readCallUpload\(\s*req\.parts\(\{ limits: \{ fileSize: MAX_AUDIO_UPLOAD_BYTES, files: 1, fields: 16 \} \}\)/u,
  );
  assert.doesNotMatch(mediaRoute.slice(0, mediaRoute.indexOf("app.post", 10)), /req\.file\(/u);
  const server = await readFile(new URL("../packages/conversation-calls/server.mjs", import.meta.url), "utf8");
  assert.ok(
    /\.parts\(\{limits:\{fileSize:\w+,files:1,fields:16\}\}\)/u.test(server),
    "the built server.mjs reads every part",
  );

  const client = await readFile(new URL("../packages/conversation-calls/client.js", import.meta.url), "utf8");
  assert.ok(/Math\.min\(Math\.max\(0,\w+-\w+\),240\)/u.test(client), "the built client.js counts only measured quiet");

  process.stdout.write("Calls mic segments regression passed.\n");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
