import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildStoreDocument } from "../catalog-store.mjs";

const root = await mkdtemp(join(tmpdir(), "agents-store-"));
const touch = async (path) => {
  await mkdir(join(root, path, ".."), { recursive: true });
  await writeFile(join(root, path), "");
};
const entries = (...ids) => ids.map((id) => ({ manifest: { id } }));

try {
  await mkdir(join(root, "store"), { recursive: true });
  await writeFile(
    join(root, "store/store.json"),
    JSON.stringify({
      schemaVersion: 1,
      packages: {
        chess: { section: "games", tagline: " Play chess. ", featured: 2 },
        noodle: { section: "apps", tagline: "A social feed." },
      },
      kits: [{ id: "starter", name: "Starter", tagline: "Two to try.", packages: ["chess", "noodle"] }],
    }),
  );
  for (const id of ["chess", "noodle"]) {
    await touch(`store/banners/${id}.webp`);
    await touch(`store/banners/${id}-1200.webp`);
  }
  await touch("store/icons/chess.webp");
  await touch("store/icons/noodle.webp");
  await touch("store/previews/noodle-1.webp");
  await touch("store/previews/noodle-3.webp"); // after a gap: not published

  const store = await buildStoreDocument(root, "catalog/v3", entries("noodle", "chess"));
  assert.deepEqual(Object.keys(store.packages), ["chess", "noodle"]);
  assert.deepEqual(store.packages.chess, {
    section: "games",
    tagline: "Play chess.",
    featured: 2,
    iconPath: "../../store/icons/chess.webp",
    bannerPath: "../../store/banners/chess.webp",
    bannerSmallPath: "../../store/banners/chess-1200.webp",
  });
  // Apps get a store logo like every other package; previews stop at the first gap.
  assert.equal(store.packages.noodle.iconPath, "../../store/icons/noodle.webp");
  assert.deepEqual(store.kits, [
    { id: "starter", name: "Starter", tagline: "Two to try.", packages: ["chess", "noodle"] },
  ]);
  // A kit lists only the packages the lane publishes.
  assert.deepEqual((await buildStoreDocument(root, "catalog", entries("chess"))).kits[0].packages, ["chess"]);
  // The Engine reads kits from the published lane only.
  assert.equal((await buildStoreDocument(root, "catalog/preview/v2", entries("chess"))).kits, undefined);
  assert.deepEqual(store.packages.noodle.previews, ["../../store/previews/noodle-1.webp"]);
  assert.equal(
    (await buildStoreDocument(root, "catalog", entries("chess"))).packages.chess.bannerPath,
    "../store/banners/chess.webp",
  );

  await assert.rejects(buildStoreDocument(root, "catalog", entries("poker")), /no entry for poker/);
  assert.deepEqual(
    Object.keys((await buildStoreDocument(root, "catalog", entries("poker", "chess"), { lenient: true })).packages),
    ["chess"],
  );
  await rm(join(root, "store/icons/chess.webp"));
  await assert.rejects(buildStoreDocument(root, "catalog", entries("chess")), /store\/icons\/chess\.webp is missing/);
  await rm(join(root, "store/banners/noodle-1200.webp"));
  await assert.rejects(buildStoreDocument(root, "catalog", entries("noodle")), /noodle-1200\.webp is missing/);

  await writeFile(
    join(root, "store/store.json"),
    JSON.stringify({ packages: { chess: { section: "toys", tagline: "x" } } }),
  );
  await assert.rejects(buildStoreDocument(root, "catalog", entries("chess")), /unknown section "toys"/);
  console.log("catalog store: OK");
} finally {
  await rm(root, { recursive: true, force: true });
}
