import { runRouteScenario } from "./long-term-memory-routes.regression.ts";

void runRouteScenario("scope-identity").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
