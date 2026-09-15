import { runRegressionToCompletion } from "./regression-helpers.ts";

async function main() {
  const { completion: browserCompletion } = await import("./long-term-memory-browser.regression.ts");
  await browserCompletion;
  const { completion: installationCompletion } = await import("./long-term-memory-installation.regression.ts");
  await installationCompletion;
  console.log("Long-Term Memory lifecycle: browser and installation scenarios ok");
}

export const completion = runRegressionToCompletion("long-term-memory-lifecycle", main);
void completion.catch((error) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
