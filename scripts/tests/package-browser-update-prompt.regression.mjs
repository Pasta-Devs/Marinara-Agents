// The package browser runner declines the live catalog's versions of the packages it installs when they differ, so a
// branch behind staging does not open "Agent updates available" over the suite (Marinara-Agents#1820).
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { declineLiveUpdates, readLiveCatalogVersions } from "../install-package-browser-fixture.mjs";

const agentsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const live = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/catalog";
const engineRoot = await mkdtemp(join(tmpdir(), "package-browser-update-prompt-"));
const catalog = (entries) => ({
  schemaVersion: 1,
  packages: Object.entries(entries).map(([id, version]) => ({ manifest: { id, version } })),
});

// `documents` maps a URL to a catalog, an Error the fetch rejects with, or a status; anything else answers 404.
async function readFor(engineVersion, documents, env = {}) {
  await writeFile(join(engineRoot, "package.json"), JSON.stringify({ version: engineVersion }));
  const requested = [];
  const warnings = [];
  const warn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const versions = await readLiveCatalogVersions({
      engineRoot,
      env,
      fetchDocument: async (url) => {
        requested.push(url);
        const document = documents[url];
        if (document instanceof Error) throw document;
        if (typeof document === "number") return new Response("", { status: document });
        return document ? Response.json(document) : new Response("404: Not Found", { status: 404 });
      },
    });
    return { requested, versions: Object.fromEntries(versions), warnings };
  } finally {
    console.warn = warn;
  }
}

try {
  // A release Engine reads its major's staging lane and preview overlay, as resolveCapabilityCatalogUrl and
  // resolvePreviewCatalogUrl do for MARINARA_GIT_BRANCH=staging; a published entry wins over an overlay one.
  const release = await readFor("2.5.1", {
    [`${live}/v2/catalog.json`]: catalog({ "gacha-forge": "1.26.3", calls: "1.2.0" }),
    [`${live}/preview/v2/catalog.json`]: catalog({ "otome-forge": "0.0.4", calls: "9.9.9" }),
  });
  assert.deepEqual(release.requested.toSorted(), [`${live}/preview/v2/catalog.json`, `${live}/v2/catalog.json`]);
  assert.deepEqual(release.versions, { "gacha-forge": "1.26.3", calls: "1.2.0", "otome-forge": "0.0.4" });
  assert.deepEqual(release.warnings, []);

  const prerelease = await readFor("3.0.0-beta.1", {});
  assert.deepEqual(prerelease.requested.toSorted(), [`${live}/preview/v3/catalog.json`, `${live}/v3/catalog.json`]);
  // A missing overlay is the normal state, not a warning; a missing published lane warns.
  assert.equal(prerelease.warnings.length, 1);
  assert.match(prerelease.warnings[0], /\/v3\/catalog\.json/);
  assert.doesNotMatch(prerelease.warnings[0], /preview/);

  const development = await readFor("development", {});
  assert.deepEqual(development.requested.toSorted(), [`${live}/catalog.json`, `${live}/preview/catalog.json`]);

  // This checkout's own lane and overlay parse the same way.
  const checkoutDocuments = {};
  for (const path of ["v2/catalog.json", "preview/v2/catalog.json"]) {
    checkoutDocuments[`${live}/${path}`] = JSON.parse(await readFile(join(agentsRoot, "catalog", path), "utf8"));
  }
  const checkout = await readFor("2.5.1", checkoutDocuments);
  for (const document of Object.values(checkoutDocuments)) {
    for (const { manifest } of document.packages) assert.equal(checkout.versions[manifest.id], manifest.version);
  }

  // An unreadable catalog leaves the run as it was, with a warning, instead of stopping it.
  const offline = await readFor("2.5.1", {
    [`${live}/v2/catalog.json`]: new TypeError("fetch failed"),
    [`${live}/preview/v2/catalog.json`]: 503,
  });
  assert.deepEqual(offline.versions, {});
  assert.equal(offline.warnings.length, 2);

  // A caller's own catalog is left to the Engine: nothing is read or declined.
  const caller = await readFor(
    "2.5.1",
    {},
    { MARINARA_AGENT_CATALOG_URL: "https://catalog.example.test/catalog.json" },
  );
  assert.deepEqual(caller.requested, []);
  assert.deepEqual(caller.versions, {});

  // Only a package whose live version differs is declined, in the shape the Engine's readUpdateDecisions accepts.
  const installed = [
    { id: "gacha-forge", version: "1.26.2" },
    { id: "otome-forge", version: "0.0.4" },
    { id: "work-in-progress", version: "0.1.0" },
  ];
  const decisions = declineLiveUpdates(installed, new Map(Object.entries(release.versions)));
  assert.equal(decisions.schemaVersion, 1);
  assert.deepEqual(Object.keys(decisions.declined), ["gacha-forge"]);
  assert.equal(decisions.declined["gacha-forge"].version, "1.26.3");
  assert.ok(Number.isFinite(Date.parse(decisions.declined["gacha-forge"].declinedAt)));
  assert.deepEqual(declineLiveUpdates(installed, new Map()), { schemaVersion: 1, declined: {} });
} finally {
  await rm(engineRoot, { recursive: true, force: true });
}

console.log("Package browser runs decline the live catalog versions of the packages they install.");
