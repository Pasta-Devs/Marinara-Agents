/**
 * The stored card reading (canon anchors) on a real Engine database: the real anchor store with a
 * stand-in for the one model call, the real card resolver, and the real brief resolver that posts,
 * Stories and DMs call. Proves what `slurp2-character-essentials.regression.ts` cannot: when the model is asked,
 * what survives a card change, and what a failed store does.
 *
 * Needs an Engine checkout (`MARINARA_ENGINE_ROOT`), like `slurp-phase1-durability.regression.ts`.
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const ANCHORS_KEY = "slurp2.canon-anchors";
const LATE_FACT = "She cannot speak and answers in sign language or in writing.";
const ESSENTIAL = "cannot speak; signs or writes";

type Anchors = Record<string, unknown> & { places: string[]; habits: string[]; essentials?: string[] };
type State = { anchors: Anchors | null; edited: boolean; current: boolean; read: boolean };

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "marinara-slurp-anchors-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "marinara-slurp-anchors-data-"));
  Object.assign(process.env, {
    AUTO_CREATE_DEFAULT_CONNECTION: "false",
    DATA_DIR: dataDir,
    LOG_DISABLE_REQUEST_LOGGING: "true",
    LOG_LEVEL: "silent",
    MARINARA_ENV_FILE: join(dataDir, ".env"),
    MARINARA_LITE: "true",
    NODE_ENV: "test",
  });
  const load = <T>(path: string) =>
    import(pathToFileURL(join(overlayRoot, "packages/server/src", path)).href) as Promise<T>;
  let db: any = null;
  try {
    // The Engine server with Slurp2's sources over it, as the durability regression builds it.
    await mkdir(join(overlayRoot, "packages/server"), { recursive: true });
    await cp(join(engineRoot, "package.json"), join(overlayRoot, "package.json"));
    await cp(join(engineRoot, "packages/server/package.json"), join(overlayRoot, "packages/server/package.json"));
    for (const part of ["server", "shared"]) {
      for (const from of [engineRoot, join(repoRoot, "packages/slurp2/src/engine")])
        await cp(join(from, `packages/${part}/src`), join(overlayRoot, `packages/${part}/src`), {
          recursive: true,
          force: true,
        });
    }
    const schemaRoot = join(overlayRoot, "packages/server/src/db/schema");
    await cp(join(engineRoot, "packages/server/src/db/schema/slurp.ts"), join(schemaRoot, "host-slurp.ts"));
    const hostSchema = await readFile(join(schemaRoot, "index.ts"), "utf8");
    await writeFile(
      join(schemaRoot, "index.ts"),
      hostSchema.replace('export * from "./slurp.js";', 'export * from "./host-slurp.js";'),
    );
    await symlink(join(engineRoot, "node_modules"), join(overlayRoot, "node_modules"), "dir");
    for (const part of ["server", "shared"])
      await symlink(
        join(engineRoot, "packages/server/node_modules"),
        join(overlayRoot, `packages/${part}/node_modules`),
        "dir",
      );

    const { createFileNativeDB } = await load<{ createFileNativeDB: () => Promise<any> }>("db/file-backed-store.ts");
    const slurpSchema = await load<Record<string, unknown>>("db/schema/slurp.ts");
    const { characters } = await load<{ characters: any }>("db/schema/index.ts");
    const { eq } = await load<{ eq: (column: unknown, value: unknown) => unknown }>("db/file-query.ts");
    const service = await load<{
      slurpCanonAnchorsFor: (
        db: any,
        id: string,
        text: string,
        at: Date,
        read: () => Promise<Anchors | null>,
      ) => Promise<Anchors | null>;
      readSlurpCanonAnchorState: (db: any, id: string, text: string) => Promise<State>;
      saveSlurpCanonAnchors: (db: any, id: string, anchors: Anchors | null) => Promise<void>;
      clearSlurpCanonAnchors: (db: any, id: string) => Promise<void>;
    }>("slp/data/creators/slp-canon-anchor-storage.ts");
    const { normalizeSlurpCanonAnchors } = await load<{ normalizeSlurpCanonAnchors: (raw: unknown) => Anchors | null }>(
      "slp/modules/feed/slp-post-brief.ts",
    );
    const { resolveCreatorCharacterCanon } = await load<{
      resolveCreatorCharacterCanon: (db: any, source: any, mode: string, scale?: number) => Promise<string>;
    }>("slp/data/creators/slp-source-resolve.ts");
    const { SLP_CANON_READING_SCALE } = await load<{ SLP_CANON_READING_SCALE: number }>(
      "slp/base/prompting/slp-prompt-safety.ts",
    );
    const { resolveSlurpCreatorFlavour } = await load<{
      resolveSlurpCreatorFlavour: (db: any, input: any) => Promise<string>;
    }>("slp/data/creators/slp-flavour-source.ts");
    const { createAppSettingsStorage } = await load<{
      createAppSettingsStorage: (db: any) => {
        get: (key: string) => Promise<string | null>;
        set: (key: string, value: string) => Promise<void>;
      };
    }>("services/storage/app-settings.storage.ts");

    db = await createFileNativeDB();
    await db._fileStore.registerTables(Object.values(slurpSchema));
    const settings = createAppSettingsStorage(db);
    const blob = async () => JSON.parse((await settings.get(ANCHORS_KEY)) ?? "{}") as Record<string, any>;

    // The stand-in for the model call: answers each reading and records the card text it was given.
    const asked: string[] = [];
    let answer: () => Promise<Record<string, unknown>> = async () => ({});
    const reading = (patch: Record<string, unknown>) => async () => ({
      people: [{ name: "Tess", relation: "roommate" }],
      places: ["the pier", "the studio"],
      work: [],
      objects: [],
      habits: ["humming", "cold swims"],
      runningJokes: [],
      palette: {},
      heat: { min: 0, max: 1 },
      routine: [],
      essentials: [ESSENTIAL],
      ...patch,
    });

    // A card whose one hard fact stands past what a post prompt carries of the description.
    const padding = "She walks the pier every morning before the studio opens. ".repeat(40);
    const card = (tail: string) =>
      JSON.stringify({ name: "Odile", description: `${padding}${tail}`, personality: "Dry, patient." });
    const timestamp = new Date().toISOString();
    await db
      .insert(characters)
      .values({ id: "odile", data: card(LATE_FACT), comment: "", createdAt: timestamp, updatedAt: timestamp });
    const source = { kind: "character", entityId: "odile" };
    const context = async () => ({
      canonText: await resolveCreatorCharacterCanon(db, source, "open"),
      readingText: await resolveCreatorCharacterCanon(db, source, "open", SLP_CANON_READING_SCALE),
    });
    // What a post does: ask for the anchors of the card as it is now.
    const post = async (id = "creator") => {
      const { readingText } = await context();
      return service.slurpCanonAnchorsFor(db, id, readingText, at, async () => {
        asked.push(readingText);
        return normalizeSlurpCanonAnchors(await answer());
      });
    };
    const at = new Date("2026-10-12T10:00:00Z");
    const state = async (id = "creator") => service.readSlurpCanonAnchorState(db, id, (await context()).readingText);
    const settle = async (calls: number) => {
      for (let tries = 0; tries < 200 && asked.length < calls; tries += 1) await new Promise((r) => setTimeout(r, 10));
      // The answer is stored after the model returns: one empty change queues behind that write.
      await new Promise((r) => setTimeout(r, 30));
      await service.readSlurpCanonAnchorState(db, "creator", "");
    };

    // --- One reading per card, on the wide text; later posts ask nothing.
    const first = await context();
    assert.ok(!first.canonText.includes(LATE_FACT), "the post's own canon cuts the late fact");
    answer = reading({});
    assert.equal(await post(), null, "the first post does not wait, and a card never read has no anchors");
    await settle(1);
    assert.ok(asked[0]!.includes(LATE_FACT), "the reading is given the late part of the card");
    assert.deepEqual((await state()).anchors?.essentials, [ESSENTIAL]);
    for (let count = 0; count < 5; count += 1) assert.deepEqual((await post())?.essentials, [ESSENTIAL]);
    assert.equal(asked.length, 1, "no reading per post");

    // --- The real resolver every prompt uses: the essential is in the post, Story and DM brief at every step.
    const account = { id: "creator", displayName: "Odile", settings: {} };
    for (const use of ["post", "story", "dm", "comment"]) {
      for (let sequence = 0; sequence < 8; sequence += 1) {
        const brief = await resolveSlurpCreatorFlavour(db, {
          account,
          source,
          disclosureMode: "open",
          use,
          sequence,
          ownLines: [],
        });
        assert.ok(brief.includes(ESSENTIAL), `${use} #${sequence}: the brief lost what is always true`);
      }
    }
    assert.equal(asked.length, 1, "briefs never start a reading");

    // --- The player corrects the reading: adds a place, removes a habit, rewrites the essential.
    await service.saveSlurpCanonAnchors(db, "creator", {
      ...(await state()).anchors!,
      places: ["the pier", "the studio", "the lighthouse"],
      habits: ["humming"],
      essentials: ["cannot speak; signs, writes, never voice notes"],
    });
    assert.deepEqual(
      { ...(await state()), anchors: undefined },
      { anchors: undefined, edited: true, current: true, read: true },
    );

    // --- A change in the late part of the card only: the post's canon is the same, the reading is stale.
    const before = (await context()).canonText;
    await db
      .update(characters)
      .set({ data: card(`${LATE_FACT} She moved her studio to the old boathouse.`) })
      .where(eq(characters.id, "odile"));
    const changed = await context();
    assert.equal(changed.canonText, before, "this card change is past the post's cut");
    assert.equal((await state()).current, false, "a change past the post's cut still makes the reading stale");
    // The card dropped the studio and the cold swims and gained the boathouse and a new habit.
    answer = reading({
      places: ["the pier", "the boathouse"],
      habits: ["humming", "night walks"],
      essentials: [ESSENTIAL, "left-handed"],
    });
    assert.deepEqual(
      (await post())?.places,
      ["the pier", "the studio", "the lighthouse"],
      "a stale entry still feeds the planner while the card is read again",
    );
    await settle(2);
    const merged = await state();
    assert.equal(asked.length, 2);
    assert.deepEqual({ edited: merged.edited, current: merged.current }, { edited: true, current: true });
    assert.deepEqual(
      merged.anchors!.places,
      ["the lighthouse", "the pier", "the boathouse"],
      "the edit stays, the card's own places follow the card",
    );
    assert.deepEqual(
      merged.anchors!.habits,
      ["humming", "night walks"],
      "a removed habit stays out, a new one arrives, a dropped one leaves",
    );
    assert.deepEqual(merged.anchors!.essentials, ["cannot speak; signs, writes, never voice notes", "left-handed"]);
    for (let count = 0; count < 3; count += 1) await post();
    assert.equal(asked.length, 2, "one reading per card change");

    // --- Entries from before this version: one the player edited, one they did not. Reading-version
    // change (their keys match no card): the edit is kept as it is and gains essentials; the
    // unedited one is replaced; a third Creator's entry is not touched by either.
    const legacyEdit = {
      people: [],
      places: ["my own place"],
      work: [],
      objects: [],
      habits: ["late-night cleanup"],
      runningJokes: [],
      palette: {},
      heat: { min: 2, max: 3 },
    };
    const legacyRead = { ...legacyEdit, places: ["an old reading"] };
    await settings.set(
      ANCHORS_KEY,
      JSON.stringify({
        ...(await blob()),
        edited: { key: "v2-hash", anchors: legacyEdit, edited: true },
        unedited: { key: "v2-hash", anchors: legacyRead },
        bystander: { key: "v2-hash", anchors: legacyRead, edited: true },
      }),
    );
    // Before any reading, the old entries still feed the brief and the editor.
    assert.deepEqual((await state("edited")).anchors, legacyEdit);
    answer = reading({});
    await post("edited");
    await settle(3);
    await post("unedited");
    await settle(4);
    const stored = await blob();
    assert.deepEqual(
      stored.edited.anchors,
      { ...legacyEdit, essentials: [ESSENTIAL] },
      "a legacy edit keeps every value",
    );
    assert.equal(stored.edited.edited, true);
    assert.deepEqual(
      stored.unedited.anchors.places,
      ["the pier", "the studio"],
      "an unedited legacy entry follows the card",
    );
    assert.deepEqual(stored.bystander, { key: "v2-hash", anchors: legacyRead, edited: true });
    // The editor saving a legacy edit back (it sends an empty essentials list) is not "none, ever".
    await service.saveSlurpCanonAnchors(db, "bystander", { ...legacyRead, essentials: [] } as Anchors);
    assert.equal("essentials" in (await blob()).bystander.anchors, false);
    assert.equal((await blob()).bystander.key, "v2-hash", "saving keeps the entry stale, so the card is still read");

    // --- A store that cannot be read is not written: nobody's entry is lost, and the save reports it.
    const snapshot = await settings.get(ANCHORS_KEY);
    const select = db.select;
    db.select = () => {
      throw new Error("storage is down");
    };
    await assert.rejects(service.saveSlurpCanonAnchors(db, "creator", null), /storage is down/u);
    db.select = select;
    assert.equal(await settings.get(ANCHORS_KEY), snapshot);
    // And the queue is not stuck behind the failure.
    await service.saveSlurpCanonAnchors(db, "creator", merged.anchors);
    assert.deepEqual((await state()).anchors, merged.anchors);

    // --- An edit saved while a reading is in flight: neither overwrites the other.
    await db
      .update(characters)
      .set({ data: card(`${LATE_FACT} She sold the boathouse.`) })
      .where(eq(characters.id, "odile"));
    let release: (value: Record<string, unknown>) => void = () => undefined;
    answer = () => new Promise<Record<string, unknown>>((done) => (release = done));
    await post();
    for (let tries = 0; tries < 200 && asked.length < 5; tries += 1) await new Promise((r) => setTimeout(r, 10));
    await service.saveSlurpCanonAnchors(db, "creator", {
      ...merged.anchors!,
      places: [...merged.anchors!.places, "the ferry"],
    });
    release(
      await reading({
        places: ["the pier"],
        habits: ["humming", "night walks"],
        essentials: [ESSENTIAL, "left-handed"],
      })(),
    );
    await settle(5);
    const raced = await state();
    assert.deepEqual(
      raced.anchors!.places,
      ["the lighthouse", "the ferry", "the pier"],
      "both edits and the new reading are there",
    );
    assert.equal(raced.current, true);

    // --- A failed reading changes nothing and is not retried on the next post.
    await db
      .update(characters)
      .set({ data: card(`${LATE_FACT} She bought a kiln.`) })
      .where(eq(characters.id, "odile"));
    answer = async () => {
      throw new Error("model is down");
    };
    await post();
    await settle(6);
    for (let count = 0; count < 3; count += 1)
      assert.deepEqual(await post(), raced.anchors, "a model that cannot read the card takes no anchors away");
    assert.equal(asked.length, 6, "a failed reading waits before it is tried again");
    assert.deepEqual((await state()).anchors, raced.anchors);
    // The stale entry still feeds the brief meanwhile.
    assert.ok(
      (
        await resolveSlurpCreatorFlavour(db, {
          account,
          source,
          disclosureMode: "open",
          use: "dm",
          sequence: 1,
          ownLines: [],
        })
      ).includes("left-handed"),
    );

    // --- Anchors the player typed for a Creator never read are in use at once, reading or not.
    await service.saveSlurpCanonAnchors(db, "typed", { ...legacyEdit, places: ["typed by hand"] } as Anchors);
    assert.deepEqual((await post("typed"))?.places, ["typed by hand"]);
    await settle(7);

    // --- "Read card again" forgets everything, the edits included.
    await service.clearSlurpCanonAnchors(db, "creator");
    assert.equal((await state()).read, false);

    console.log("slurp2 anchor edits regression passed");
  } finally {
    if (db) await db._fileStore.close().catch(() => undefined);
    await Promise.all([
      rm(overlayRoot, { recursive: true, force: true }),
      rm(dataDir, { recursive: true, force: true }),
    ]);
  }
}

void main();
