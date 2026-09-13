/** Builtin ads hide instead of deleting, restore, and take edits as override copies. */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// The real storage reaches into Engine DB modules that only exist once bundled, so run a
// copy of garnish-ads against an in-memory app-settings stub.
async function main() {
  const root = await mkdtemp(join(tmpdir(), "garnish-storage-"));
  try {
    await cp(
      "packages/slurp2/src/engine/packages/server/src/services/garnish-ads",
      join(root, "services/garnish-ads"),
      {
        recursive: true,
      },
    );
    await mkdir(join(root, "services/storage"), { recursive: true });
    await writeFile(
      join(root, "services/storage/app-settings.storage.ts"),
      `const data = new Map<string, string>();
  export function createAppSettingsStorage(_db: unknown) {
    return { get: async (key: string) => data.get(key) ?? null, set: async (key: string, value: string) => void data.set(key, value) };
  }`,
    );
    const { createGarnishAdsStorage } = await import(
      pathToFileURL(join(root, "services/garnish-ads/garnish-ads.storage.ts")).href
    );
    const { GARNISH_BASE_ADS } = await import(
      pathToFileURL(join(root, "services/garnish-ads/garnish-ads.base.ts")).href
    );

    const pool = createGarnishAdsStorage({} as never);
    const builtinId = GARNISH_BASE_ADS[0].id;
    const find = async (id: string) => (await pool.listAll()).find((ad: { id: string }) => ad.id === id);

    // deleting a builtin hides it
    await pool.remove(builtinId);
    assert.ok((await find(builtinId))?.retiredAt, "removing a builtin must retire it");
    assert.equal(
      (await pool.listActive("slurp")).some((ad: { id: string }) => ad.id === builtinId),
      false,
    );

    // restore brings it back
    await pool.update(builtinId, { retiredAt: null });
    assert.equal((await find(builtinId))?.retiredAt, null);
    assert.ok((await pool.listActive("slurp")).some((ad: { id: string }) => ad.id === builtinId));

    // editing a builtin stores an override copy with the same id
    await pool.update(builtinId, { copy: "Edited." });
    const edited = (await pool.listAll()).filter((ad: { id: string }) => ad.id === builtinId);
    assert.equal(edited.length, 1, "an override must replace the builtin, not duplicate it");
    assert.equal(edited[0].copy, "Edited.");
    assert.equal(edited[0].origin, "builtin");

    // stored ads still delete for real, and unknown ids do not update
    await pool.add({ ...GARNISH_BASE_ADS[0], id: "user-1", origin: "user" });
    await pool.update("user-1", { brand: "Renamed" });
    assert.equal((await find("user-1"))?.brand, "Renamed");
    await pool.remove("user-1");
    assert.equal(await find("user-1"), undefined, "removing a stored ad must delete it");
    assert.equal(await pool.update("missing", { brand: "x" }), null);

    console.log("garnish-ads storage: ok");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main();
