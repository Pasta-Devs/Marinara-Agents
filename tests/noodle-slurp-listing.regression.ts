import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("packages/slurp/manifest.json", "utf8")) as {
  id: string;
  name: string;
  description: string;
  engine?: { min?: string };
  contributions?: {
    homeBrowserTab?: {
      label?: string;
      ariaLabel?: string;
      iconPaths?: string[];
    };
  };
};
const agents = JSON.parse(readFileSync("packages/slurp/agents.json", "utf8")) as Array<{
  id: string;
  name: string;
  description: string;
}>;
const catalog = JSON.parse(readFileSync("catalog/catalog.json", "utf8")) as {
  packages: Array<{
    iconUrl: string;
    manifest: { id: string; description: string };
  }>;
};

assert.equal(manifest.id, "slurp");
assert.equal(manifest.name, "Slurp");
assert.equal(manifest.engine?.min, "2.4.3");
assert.match(manifest.description, /standalone successor to NoodleR/i);
assert.match(manifest.description, /Creator profile/i);
assert.deepEqual(manifest.contributions?.homeBrowserTab, {
  label: "Slurp",
  ariaLabel: "Open Slurp",
  iconPaths: ["slurp-logo.png"],
});

const agent = agents.find((entry) => entry.id === "slurp");
assert.ok(agent, "Slurp must be present in its package Agents list");
assert.match(agent.description, /standalone successor to NoodleR/i);

const catalogEntry = catalog.packages.find((entry) => entry.manifest.id === "slurp");
assert.ok(catalogEntry, "Slurp must be present in the downloadable catalog");
assert.equal(catalogEntry.manifest.description, manifest.description);
assert.match(catalogEntry.iconUrl, /artwork\/agent-covers\/slurp\.png$/);

console.log("Slurp listing and artwork regressions passed.");
