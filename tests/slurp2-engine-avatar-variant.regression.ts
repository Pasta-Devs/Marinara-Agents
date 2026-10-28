import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

// Engine avatars are 1-2.5 MB card PNGs that the feed shows at 44 px; Slurp serves a small copy of
// them (0.3.41). The copy must come only from a plain file in the Engine's avatar folder, be cached in
// Slurp's own media namespace (never next to the Engine's file) and stay out of backups. Needs
// MARINARA_ENGINE_ROOT (a staging Engine checkout with node_modules); run it without
// tests/tsconfig.regressions.json, like slurp2-reset-activity.
const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));

type Media = {
  resolveEngineAvatarVariant: (fileName: string, width: number | undefined) => Promise<string | null>;
  listCreatorMediaFiles: () => Promise<Array<{ absolutePath: string }>>;
};

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "slurp2-engine-avatar-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "slurp2-engine-avatar-data-"));
  Object.assign(process.env, {
    DATA_DIR: dataDir,
    LOG_LEVEL: "silent",
    MARINARA_ENV_FILE: join(dataDir, ".env"),
    MARINARA_LITE: "true",
    NODE_ENV: "test",
  });
  try {
    await mkdir(join(overlayRoot, "packages/server"), { recursive: true });
    await cp(join(engineRoot, "package.json"), join(overlayRoot, "package.json"));
    await cp(join(engineRoot, "packages/server/package.json"), join(overlayRoot, "packages/server/package.json"));
    await cp(join(engineRoot, "packages/server/src"), join(overlayRoot, "packages/server/src"), { recursive: true });
    await cp(join(engineRoot, "packages/shared"), join(overlayRoot, "packages/shared"), { recursive: true });
    await cp(join(repoRoot, "packages/slurp2/src/engine/packages"), join(overlayRoot, "packages"), {
      recursive: true,
      force: true,
    });
    // Slurp2's schema takes the host's `slurp.ts` name; the host's legacy schema stays in its barrel.
    const schemaRoot = join(overlayRoot, "packages/server/src/db/schema");
    await cp(join(engineRoot, "packages/server/src/db/schema/slurp.ts"), join(schemaRoot, "host-slurp.ts"));
    const hostSchema = await readFile(join(schemaRoot, "index.ts"), "utf8");
    await writeFile(
      join(schemaRoot, "index.ts"),
      hostSchema.replace('export * from "./slurp.js";', 'export * from "./host-slurp.js";'),
    );
    await symlink(join(engineRoot, "node_modules"), join(overlayRoot, "node_modules"), "dir");
    await symlink(
      join(engineRoot, "packages/server/node_modules"),
      join(overlayRoot, "packages/server/node_modules"),
      "dir",
    );
    const media = (await import(
      pathToFileURL(join(overlayRoot, "packages/server/src/slp/base/media/slp-media.ts")).href
    )) as Media;
    // The same loader the media code uses; sharp lives in the Engine's dependency tree, not this repo's.
    const { getSharp } = (await import(
      pathToFileURL(join(overlayRoot, "packages/server/src/utils/sharp.ts")).href
    )) as { getSharp: () => Promise<any> };
    const sharp = await getSharp();
    assert.ok(sharp, "sharp must load from the Engine checkout");

    const avatarDir = join(dataDir, "avatars");
    await mkdir(avatarDir, { recursive: true });
    await sharp({ create: { width: 1200, height: 1600, channels: 3, background: "#c04" } })
      .png()
      .toFile(join(avatarDir, "card-1.png"));
    // Files that are not avatar pictures must stay unreachable even though they exist.
    await writeFile(join(avatarDir, ".env"), "SECRET=1");
    await writeFile(join(avatarDir, "card-1.txt"), "notes");
    // A ".png" that is not a picture, and a link out of the folder, as the Engine's own route refuses.
    await writeFile(join(avatarDir, "fake.png"), "not a picture");
    await writeFile(join(dataDir, "outside.png"), await readFile(join(avatarDir, "card-1.png")));
    await symlink(join(dataDir, "outside.png"), join(avatarDir, "link.png"));
    // The Engine allows any plain name, spaces included.
    await cp(join(avatarDir, "card-1.png"), join(avatarDir, "old card (1).png"));

    const small = await media.resolveEngineAvatarVariant("card-1.png", 96);
    assert.ok(small, "a plain avatar file gets a small copy");
    assert.match(small, /\.w96\.webp$/u);
    assert.ok(
      small.includes(`${sep}slurp2-media${sep}engine-avatars${sep}`),
      "the copy lives in Slurp's own namespace",
    );
    assert.equal((await sharp(small).metadata()).width, 96);
    assert.ok(await media.resolveEngineAvatarVariant("old card (1).png", 96), "a plain name with spaces works");
    assert.deepEqual(
      (await readdir(avatarDir)).sort(),
      [".env", "card-1.png", "card-1.txt", "fake.png", "link.png", "old card (1).png"],
      "nothing is written into the Engine's avatar folder",
    );
    assert.equal(await media.resolveEngineAvatarVariant("card-1.png", 96), small, "the copy is reused");

    assert.equal(
      await media.resolveEngineAvatarVariant("card-1.png", 97),
      join(avatarDir, "card-1.png"),
      "an unlisted width serves the original, as the Engine does",
    );
    const refused = [
      "../card-1.png",
      "..",
      ".env",
      "card-1.txt",
      "missing.png",
      "a/b.png",
      "x.png%00",
      "fake.png",
      "link.png",
    ];
    for (const name of refused) {
      assert.equal(await media.resolveEngineAvatarVariant(name, 96), null, `${name} is refused`);
      assert.equal(await media.resolveEngineAvatarVariant(name, 97), null, `${name} is refused at any width`);
    }
    assert.ok(
      (await media.listCreatorMediaFiles()).every((file) => !file.absolutePath.includes("engine-avatars")),
      "backups skip the derived copies",
    );
  } finally {
    await rm(overlayRoot, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  }
  console.log("slurp2 engine avatar variant regression passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
