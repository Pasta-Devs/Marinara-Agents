import { readFile } from "node:fs/promises";

const [inputPath] = process.argv.slice(2);
if (!inputPath) {
  throw new Error("Usage: node scripts/evaluate-noodle-generation.mjs <samples.json>");
}

const parsed = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(parsed)) throw new Error("The sample file must contain a JSON array.");

const negativeWords = new Set([
  "alone",
  "anxious",
  "depressed",
  "empty",
  "hate",
  "hopeless",
  "lonely",
  "miserable",
  "sad",
  "tired",
  "worthless",
]);
const SAMPLE_KINDS = new Set(["post", "reply", "noodler"]);
const normalized = parsed.map((sample, index) => {
  if (!sample || typeof sample !== "object") throw new Error(`Sample ${index} must be an object.`);
  if (typeof sample.content !== "string")
    throw new Error(`Sample ${index} must have a string "content" field.`);
  const content = sample.content.trim();
  if (!content) throw new Error(`Sample ${index} has empty content.`);
  if (sample.kind !== undefined && !SAMPLE_KINDS.has(sample.kind))
    throw new Error(`Sample ${index} has an unsupported kind "${sample.kind}".`);
  const author = String(sample.author ?? sample.handle ?? "unknown");
  const kind = sample.kind ?? "post";
  const words = content.toLocaleLowerCase().match(/[a-z]+/gu) ?? [];
  return {
    author,
    content,
    kind,
    length: content.length,
    negative: words.some((word) => negativeWords.has(word)),
  };
});

const overTarget = normalized.filter((sample) =>
  sample.kind === "reply" ? sample.length > 240 : sample.kind === "noodler" ? sample.length > 500 : sample.length > 280,
);
const negative = normalized.filter((sample) => sample.negative);
const duplicateTexts = normalized.filter(
  (sample, index, values) => values.findIndex((item) => item.content === sample.content) !== index,
);
const authorCount = new Set(normalized.map((sample) => sample.author)).size;
const report = {
  samples: normalized.length,
  authors: authorCount,
  averageCharacters: normalized.length
    ? Math.round(normalized.reduce((sum, sample) => sum + sample.length, 0) / normalized.length)
    : 0,
  overTarget: overTarget.length,
  negativeMood: negative.length,
  duplicateTexts: duplicateTexts.length,
  pass:
    normalized.length > 0 &&
    overTarget.length / normalized.length <= 0.15 &&
    negative.length / normalized.length <= 0.35 &&
    duplicateTexts.length === 0 &&
    authorCount >= Math.min(2, normalized.length),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
