import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertPortableFilenameComponent,
  assertPortableRelativePath,
  packageArtifactName,
  resolveContainedPortablePath,
  resolvePortableRelativePath,
} from "../catalog-path-safety.mjs";

assert.equal(assertPortableRelativePath("agents.json"), "agents.json");
assert.equal(assertPortableRelativePath("assets/agent icon.png"), "assets/agent icon.png");
assert.equal(resolvePortableRelativePath("/tmp/package", "assets/icon.png"), join("/tmp/package", "assets/icon.png"));
assert.equal(assertPortableFilenameComponent("agent-name"), "agent-name");
assert.equal(packageArtifactName("agent-name", "1.2.3-beta.1"), "agent-name-1.2.3-beta.1.zip");

for (const unsafePath of [
  "",
  ".",
  "..",
  "./agents.json",
  "assets/./icon.png",
  "assets/../agents.json",
  "assets//icon.png",
  "assets/",
  "/absolute/agents.json",
  "C:/absolute/agents.json",
  "C:drive-relative.json",
  "assets\\icon.png",
  "agents\0.json",
  "-T",
  "assets/CON",
  "assets/com1.txt",
  "assets/file:stream",
  "assets/name.",
  "assets/name ",
]) {
  assert.throws(
    () => assertPortableRelativePath(unsafePath, "Fixture path"),
    /Fixture path must/u,
    `expected ${JSON.stringify(unsafePath)} to be rejected`,
  );
}

for (const unsafeComponent of [
  "",
  ".",
  "..",
  "../agent",
  "/agent",
  "agent/name",
  "agent\\name",
  "C:agent",
  "-agent",
  "agent name",
  "agent?name",
  "agent.",
  "CON",
  "nul.json",
  "agent:stream",
]) {
  assert.throws(
    () => assertPortableFilenameComponent(unsafeComponent, "Fixture component"),
    /Fixture component must/u,
    `expected ${JSON.stringify(unsafeComponent)} to be rejected`,
  );
}

assert.throws(() => packageArtifactName("../agent", "1.0.0"), /Package id must/u);
assert.throws(() => packageArtifactName("agent", "../../payload"), /Package agent version must/u);
assert.throws(() => packageArtifactName("agent", "latest"), /must be a semantic version/u);
assert.throws(() => packageArtifactName("agent", "1.2.3-rc..1"), /must be a semantic version/u);

let packageRoot = null;
let outsideRoot = null;
try {
  packageRoot = await mkdtemp(join(tmpdir(), "marinara-catalog-paths-"));
  outsideRoot = await mkdtemp(join(tmpdir(), "marinara-catalog-paths-outside-"));
  await writeFile(join(packageRoot, "agents.json"), "[]\n");
  await writeFile(join(outsideRoot, "manifest.json"), "{}\n");
  await symlink(join(outsideRoot, "manifest.json"), join(packageRoot, "manifest.json"));
  await symlink(outsideRoot, join(packageRoot, "locales"));

  assert.equal(
    await resolveContainedPortablePath(packageRoot, "agents.json", "Safe source"),
    join(packageRoot, "agents.json"),
  );
  await assert.rejects(
    resolveContainedPortablePath(packageRoot, "manifest.json", "Escaped manifest"),
    /Escaped manifest must stay within its root directory after resolving symlinks/u,
  );
  await assert.rejects(
    resolveContainedPortablePath(packageRoot, "locales/en.json", "Escaped locale output", {
      allowMissing: true,
    }),
    /Escaped locale output must stay within its root directory after resolving symlinks/u,
  );
} finally {
  if (packageRoot) await rm(packageRoot, { recursive: true, force: true });
  if (outsideRoot) await rm(outsideRoot, { recursive: true, force: true });
}

console.log("Catalog path safety regression passed.");
