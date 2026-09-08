import { runRouteScenario } from "./long-term-memory-routes.regression.ts";

void runRouteScenario("notes").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
