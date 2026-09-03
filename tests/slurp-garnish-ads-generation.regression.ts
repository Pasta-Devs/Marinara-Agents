/**
 * Generation safety rails. The service pulls in Engine-only LLM modules that
 * are not mirrored into this repo, so these assert on the source rather than
 * executing it — the same approach the other Slurp route regressions take.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(
  "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-garnish-generation.service.ts",
  "utf8",
);

// Generation is host-side: garnish-ads holds the pool, Slurp talks to the model.
assert.match(service, /GarnishAdsStorage/u, "generation must push into the pool, not own it");
assert.match(service, /Never use a real company, product, or trademark/u, "generated ads must stay fictional");
assert.match(service, /NOODLER_UNTRUSTED_CONTENT_INSTRUCTION/u, "world context is untrusted input");

// The model labels its own rating, so the ceiling must be re-checked locally.
assert.match(
  service,
  /if \(!garnishRatingAllowed\(item\.contentRating, request\.contentCeiling\)\) continue;/u,
  "a mislabelled rating must not walk past the content gate",
);

// Retirement must never touch work a person wrote.
assert.match(
  service,
  /if \(ad\.origin !== "generated" \|\| ad\.retiredAt\) continue;/u,
  "only generated ads may be retired automatically",
);
assert.match(service, /existingBrands/u, "generation must be told what already exists to avoid duplicates");
assert.match(service, /Math\.min\(Math\.max\(request\.count \?\? 4, 1\), 10\)/u, "generation count must be bounded");

const routes = readFileSync("packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts", "utf8");
assert.match(routes, /app\.post\("\/noodler\/ads\/generate"/u);
assert.match(routes, /retireWeakGarnishAds/u, "the pool must shed as well as grow");

// These three shipped as free identifiers with no import, so every generate call died with a
// ReferenceError that the route reported as a bare 502. esbuild bundles undefined globals
// happily, so nothing caught it until runtime.
for (const name of ["generateGarnishAds", "retireWeakGarnishAds", "qualityScores"]) {
  assert.match(
    routes,
    new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from "[^"]+";`, "u"),
    `${name} is used by the routes and must be imported, not left as a global`,
  );
}
// The Engine's connections storage has no getMainWithKey, so calling it threw a TypeError.
assert.doesNotMatch(
  service,
  /connections\.getMainWithKey\(/u,
  "ad generation must resolve a connection the Engine actually exposes",
);
assert.match(routes, /await ads\.markRecent\(/u, "serving ads must mark them recent or rotation never happens");
assert.match(routes, /"impression"\)/u, "serving ads must record impressions or quality has no denominator");

const storage = readFileSync("packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts", "utf8");
for (const key of ["inlineAdsTone", "inlineAdsEra", "inlineAdsWorldContext", "inlineAdsContentCeiling"]) {
  assert.ok(storage.includes(key), `settings must expose ${key}`);
}

console.log("garnish-ads generation: ok");
