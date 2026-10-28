import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// A Slurp backup is untrusted input (#1476). Its pictures come back only as PNG, JPEG, WebP, GIF or
// AVIF files whose extension names the type their bytes show, and every route that sends a stored
// picture sends it as the type its bytes show, with nosniff, never as a type taken from the file name.
// Needs MARINARA_ENGINE_ROOT (an Engine checkout with node_modules); run it without
// tests/tsconfig.regressions.json, like slurp2-engine-avatar-variant.
const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));
const serverSource = join(repoRoot, "packages/slurp2/src/engine/packages/server/src");

type Reply = { header: (name: string, value: string) => Reply };
type Media = {
  restoreCreatorMediaFile: (archivePath: string, data: Buffer) => boolean;
  sendSlurpImageFile: (reply: Reply, absolutePath: string) => unknown;
};

const bytes = (head: number[] | string, size = 96) => {
  const start = typeof head === "string" ? Buffer.from(head, "latin1") : Buffer.from(head);
  return Buffer.concat([start, Buffer.alloc(Math.max(0, size - start.length), 7)]);
};
const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0]);
const gif = bytes("GIF89a");
const webp = bytes("RIFF\x40\x00\x00\x00WEBPVP8 ");
const avif = bytes("\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1miaf");
const bmp = bytes("BM");
const text = Buffer.from("plain notes, not a picture");

// Every Slurp route that sends a stored file goes through the verified sender; none calls sendFile itself.
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}
const callers = sourceFiles(serverSource).filter((path) => readFileSync(path, "utf8").includes(".sendFile("));
assert.deepEqual(
  callers.map((path) => path.slice(serverSource.length + 1)),
  ["slp/base/media/slp-media.ts"],
  "only sendSlurpImageFile may call sendFile",
);
for (const route of [
  "slp/features/feed/slp-feed-post-routes.ts",
  "slp/features/messages/slp-messages-media-routes.ts",
  "slp/features/media/slp-media-routes.ts",
  "slp/features/ads/slp-ads-routes.ts",
]) {
  assert.match(
    readFileSync(join(serverSource, route), "utf8"),
    /sendSlurpImageFile\(\s*reply\b/u,
    `${route} sends media`,
  );
}

async function main() {
  const overlayRoot = await mkdtemp(join(tmpdir(), "slurp2-restore-media-source-"));
  const dataDir = await mkdtemp(join(tmpdir(), "slurp2-restore-media-data-"));
  Object.assign(process.env, {
    DATA_DIR: dataDir,
    LOG_LEVEL: "silent",
    MARINARA_ENV_FILE: join(dataDir, ".env"),
    MARINARA_LITE: "true",
    NODE_ENV: "test",
  });
  let app: { close: () => Promise<unknown> } | null = null;
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
    const mediaDir = join(dataDir, "gallery/slurp2-media");
    const stored = (path: string) => join(mediaDir, path);

    // ── Restore: a picture whose extension names the type its bytes show ──
    const accepted: Array<[string, Buffer]> = [
      ["media/a1/post.png", png],
      ["media/a1/photo.jpg", jpeg],
      ["media/a1/photo-long.jpeg", jpeg],
      ["media/a1/LOUD.PNG", png],
      ["media/a1/loop.gif", gif],
      ["media/a1/small.webp", webp],
      ["media/a1/modern.avif", avif],
      ["media/messages/m1.png", png],
    ];
    for (const [name, data] of accepted) {
      assert.equal(media.restoreCreatorMediaFile(name, data), true, `${name} is restored`);
      assert.ok(readFileSync(stored(name.slice("media/".length))).equals(data), `${name} keeps its bytes`);
    }
    const refused: Array<[string, Buffer, string]> = [
      ["media/a1/page.html", png, "a page name, even with picture bytes"],
      ["media/a1/page.htm", png, "a page name"],
      ["media/a1/drawing.svg", png, "a vector name"],
      ["media/a1/script.js", gif, "a script name"],
      ["media/a1/style.css", jpeg, "a style sheet name"],
      ["media/a1/data.json", png, "a data name"],
      ["media/a1/no-extension", png, "no extension"],
      ["media/a1/trailing.png.", png, "an empty extension"],
      ["media/a1/swapped.png", jpeg, "a JPEG named as a PNG"],
      ["media/a1/swapped.gif", png, "a PNG named as a GIF"],
      ["media/a1/swapped.avif", webp, "a WebP named as an AVIF"],
      ["media/a1/swapped.webp", avif, "an AVIF named as a WebP"],
      ["media/a1/notes.png", text, "a text file named as a picture"],
      ["media/a1/old.bmp", bmp, "a BMP, which a backup never carries"],
      ["media/../outside.png", png, "a path out of the namespace"],
      ["data/a1/post.png", png, "a name outside media/"],
    ];
    for (const [name, data, why] of refused) {
      assert.equal(media.restoreCreatorMediaFile(name, data), false, `${name} is refused: ${why}`);
    }
    assert.deepEqual(
      readdirSync(join(mediaDir, "a1")).sort(),
      ["LOUD.PNG", "loop.gif", "modern.avif", "photo-long.jpeg", "photo.jpg", "post.png", "small.webp"],
      "nothing refused reaches the media folder",
    );
    assert.equal(existsSync(join(dataDir, "gallery/outside.png")), false);

    // ── Serving: the type comes from the bytes, never from the name ──
    // Files already on disk from an older restore were written under any name, so the sender checks too.
    await writeFile(stored("a1/older-page.html"), png);
    await writeFile(stored("a1/older-label.png"), jpeg);
    await writeFile(stored("a1/older-notes.png"), text);
    await writeFile(stored("a1/generated.bmp"), bmp);
    await writeFile(stored("a1/empty.png"), Buffer.alloc(0));

    const engineRequire = createRequire(join(engineRoot, "packages/server/package.json"));
    const fastify = (await import(pathToFileURL(engineRequire.resolve("fastify")).href)).default;
    const fastifyStatic = (await import(pathToFileURL(engineRequire.resolve("@fastify/static")).href)).default;
    const server = fastify();
    app = server;
    // The Engine registers the plugin the same way: sendFile only, no static route.
    await server.register(fastifyStatic, { serve: false });
    // Routes set their picture headers on the reply before handing it over, as the feed route does.
    server.get("/media/*", (req: { params: Record<string, string> }, reply: Reply) =>
      media.sendSlurpImageFile(
        reply
          .header("Cache-Control", "private, max-age=300")
          .header("Content-Disposition", 'inline; filename="slurp-x"'),
        stored(req.params["*"]),
      ),
    );
    // The feed route names a saved post picture after the stored file's extension.
    server.get("/named/*", (req: { params: Record<string, string> }, reply: Reply) =>
      media.sendSlurpImageFile(
        reply.header("Content-Disposition", `inline; filename="slurp-x${extname(req.params["*"]).toLowerCase()}"`),
        stored(req.params["*"]),
      ),
    );
    const get = (path: string) => server.inject({ method: "GET", url: `/media/${path}` });

    const served: Array<[string, string, Buffer]> = [
      ["a1/post.png", "image/png", png],
      ["a1/photo.jpg", "image/jpeg", jpeg],
      ["a1/photo-long.jpeg", "image/jpeg", jpeg],
      ["a1/LOUD.PNG", "image/png", png],
      ["a1/loop.gif", "image/gif", gif],
      ["a1/small.webp", "image/webp", webp],
      ["a1/modern.avif", "image/avif", avif],
      ["a1/older-page.html", "image/png", png],
      ["a1/older-label.png", "image/jpeg", jpeg],
      ["a1/generated.bmp", "image/bmp", bmp],
    ];
    for (const [path, type, data] of served) {
      const response = await get(path);
      assert.equal(response.statusCode, 200, `${path} is served`);
      assert.equal(response.headers["content-type"], type, `${path} is sent as ${type}`);
      assert.equal(response.headers["x-content-type-options"], "nosniff", `${path} is sent with nosniff`);
      assert.equal(
        response.headers["content-disposition"],
        'inline; filename="slurp-x"',
        `${path} keeps its caller's headers`,
      );
      assert.ok(response.rawPayload.equals(data), `${path} sends its bytes unchanged`);
    }
    for (const path of ["a1/older-notes.png", "a1/empty.png", "a1/missing.png"]) {
      const response = await get(path);
      assert.equal(response.statusCode, 404, `${path} is not a picture and is not sent`);
      assert.equal(response.headers["content-disposition"], undefined, `${path}: a 404 is not named as a picture`);
      assert.equal(response.headers["cache-control"], "no-store", `${path}: a 404 is not cached as a picture`);
      assert.match(String(response.headers["content-type"]), /^application\/json/u, `${path} answers in JSON`);
    }

    // ── Saved name: its extension comes from the bytes, like the type ──
    const named: Array<[string, string, string]> = [
      ["a1/post.png", "image/png", "slurp-x.png"],
      ["a1/photo-long.jpeg", "image/jpeg", "slurp-x.jpg"],
      ["a1/modern.avif", "image/avif", "slurp-x.avif"],
      ["a1/older-page.html", "image/png", "slurp-x.png"],
      ["a1/older-label.png", "image/jpeg", "slurp-x.jpg"],
      ["a1/generated.bmp", "image/bmp", "slurp-x.bmp"],
    ];
    for (const [path, type, fileName] of named) {
      const response = await server.inject({ method: "GET", url: `/named/${path}` });
      assert.equal(response.statusCode, 200, `${path} is served by name`);
      assert.equal(response.headers["content-type"], type, `${path} is sent as ${type}`);
      assert.equal(
        response.headers["content-disposition"],
        `inline; filename="${fileName}"`,
        `${path} is saved as ${fileName}`,
      );
    }
    for (const path of ["a1/older-notes.png", "a1/missing.png"]) {
      const response = await server.inject({ method: "GET", url: `/named/${path}` });
      assert.equal(response.statusCode, 404, `${path} is not sent by name`);
      assert.equal(response.headers["content-disposition"], undefined, `${path}: a 404 is not named`);
    }
  } finally {
    await app?.close();
    await rm(overlayRoot, { recursive: true, force: true });
    await rm(dataDir, { recursive: true, force: true });
  }
  console.log("slurp2 restore media regression passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
