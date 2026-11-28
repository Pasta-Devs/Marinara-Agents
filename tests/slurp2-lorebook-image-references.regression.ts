import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { lorebookEntryImageSchema, MAX_LOREBOOK_ENTRY_IMAGES } from "../sources/package-shared";
import { slpImageReferencesSupported } from "../packages/slurp2/src/engine/packages/server/src/slp/base/media/slp-image-references";
import { slurp2Source } from "./slurp2-source";

const slpRoot = "../packages/slurp2/src/engine/packages/server/src/slp/";
const readSlurp = (path: string) => slurp2Source(new URL(slpRoot + path, import.meta.url));

function loadFunction(source: string, name: string, globals: Record<string, unknown>) {
  const script = source.replace(/^import[\s\S]*?;\n/gm, "").replace(/^export /gm, "");
  return runInNewContext(stripTypeScriptTypes(`${script}\n${name};`), globals);
}

const path = (number: number) =>
  `/api/lorebooks/entry-images/00000000-0000-4000-8000-${String(number).padStart(12, "0")}.png`;
const loadedPaths: string[] = [];
const readLorebookReferenceImages = loadFunction(
  readFileSync(
    new URL("../sources/engine/packages/server/src/services/generation/lorebook-image-prompt.ts", import.meta.url),
    "utf8",
  ),
  "readLorebookReferenceImages",
  {
    readLorebookImageDataUrl: async (imagePath: string) => {
      loadedPaths.push(imagePath);
      return imagePath === path(1) ? null : `data:image/png;base64,${Buffer.from(imagePath).toString("base64")}`;
    },
  },
);
const entry = (id: string, name: string, position: number, files: number[]) => ({
  id,
  name,
  position,
  content: "",
  images: JSON.stringify(files.map((number) => ({ path: path(number), caption: `Picture ${number}` }))),
});
const rows = [
  entry("unmatched", "Unmatched", 0, [7]),
  entry("outlet", "Unused outlet", 7, [6]),
  entry("coat", "Coat", 0, [1, 2, 3, 4]),
  entry("room", "Room", 1, [5]),
];
let scans = 0;
let scanError = false;
let scannedOptions: unknown;
const resolve = loadFunction(readSlurp("data/host/slp-lore-context.ts"), "resolveSlurpLoreImageReferences", {
  lorebookEntryImageSchema,
  MAX_LOREBOOK_ENTRY_IMAGES,
  lorebookEntries: { id: "id" },
  inArray: (_field: string, ids: string[]) => ids,
  logger: { warn() {} },
  slpLorebookTokenBudget: () => 123,
  readLorebookReferenceImages,
  processLorebooks: async (_db: unknown, messages: Array<{ content: string }>, chatId: unknown, options: unknown) => {
    scans++;
    assert.equal(chatId, null);
    if (scanError) throw new Error("scan failed");
    scannedOptions = JSON.parse(JSON.stringify(options));
    const text = messages.map(({ content }) => content).join(" ");
    return { activatedEntryIds: rows.filter(({ id }) => text.includes(id)).map(({ id }) => id) };
  },
});

const db = {
  select: () => ({
    from: () => ({ where: async (ids: string[]) => rows.filter(({ id }) => ids.includes(id)).reverse() }),
  }),
};

const connection = { imageService: "gemini_image" };
const textOnly = { imageService: "pollinations" };

async function main() {
  // Run the provider-bound call from each service. Its prompt is separate from the stored prompt.
  for (const [file, publicPost] of [
    ["slp-images-service.ts", false],
    ["slp-public-images-service.ts", true],
  ] as const) {
    const source = readSlurp(`features/media/${file}`);
    const start = source.indexOf("  const providerReferences = ");
    const end = source.indexOf("\n  });", start);
    assert.ok(start >= 0 && end > start);
    assert.match(source.slice(end), /prompt: providerReferences\.prompt,/u);
    assert.match(source.slice(end), /referenceImages: providerReferences\.referenceImages,/u);
    const run = runInNewContext(
      `async (input, allowReferences, referenceImages) => {
      const finalPrompt = "Stored prompt";
      const referenceSubject = input.linkedPublicAccount;
      const redactIdentity = (text) => input.hiddenName ? text.replaceAll(input.hiddenName, "[redacted]") : text;
      ${source.slice(start, end + "\n  });".length)}
      return providerReferences;
    }`,
      { resolveSlurpLoreImageReferences: resolve },
    );
    const account = { kind: publicPost ? "character" : "persona", entityId: "source" };
    const input = {
      db,
      account,
      linkedPublicAccount: account,
      settings: { enableLorebookContext: true, imageGenerationUseAvatarReferences: false },
      postContent: "outlet",
      draftPrompt: "room",
      promptOverride: { prompt: "coat" },
    };

    const before = scans;
    for (const [overrides, capable, images] of [
      [{ settings: { enableLorebookContext: false } }, true, []],
      [{}, slpImageReferencesSupported(textOnly), []],
      [{}, slpImageReferencesSupported(connection, textOnly), []],
      [{}, true, ["A", "B", "C", "D", "E", "F"]],
      ...(!publicPost ? [[{ suppressCharacterContext: true }, true, []]] : []),
    ] as const) {
      const result = await run({ ...input, ...overrides }, capable, images);
      assert.equal(result.prompt, "Stored prompt");
      assert.deepEqual(result.referenceImages, images);
    }
    assert.equal(scans, before, "disabled references must skip the scan");

    loadedPaths.length = 0;
    const result = await run(input, slpImageReferencesSupported(connection), ["A", "B", "C", "D"]);
    assert.deepEqual(loadedPaths, [path(1), path(2), path(3)]);
    assert.deepEqual(Array.from(result.referenceImages).slice(0, 4), ["A", "B", "C", "D"]);
    assert.equal(result.referenceImages.length, 6);
    assert.match(
      result.prompt,
      /^Stored prompt\n\nAttached are reference images for Coat: Picture 2; Coat: Picture 3\./u,
    );
    assert.deepEqual(scannedOptions, {
      characterIds: publicPost ? ["source"] : [],
      personaId: publicPost ? null : "source",
      tokenBudget: 123,
      generationTriggers: ["slurp"],
      previewOnly: true,
    });

    loadedPaths.length = 0;
    const retry = await run({ ...input, promptOverride: { prompt: "room" } }, true, undefined);
    assert.deepEqual(loadedPaths, [path(5)]);
    assert.equal(retry.referenceImages.length, 1);
    assert.equal(retry.prompt.split("Attached are reference images").length, 2);

    if (!publicPost) {
      const hidden = await run({ ...input, hiddenName: "Coat" }, true, undefined);
      assert.match(hidden.prompt, /Attached are reference images for \[redacted\]: Picture 2/u);
      assert.doesNotMatch(hidden.prompt, /Coat/u);
    }

    scanError = true;
    assert.equal((await run(input, true, undefined)).prompt, "Stored prompt");
    scanError = false;
  }
}

void main();
