import { runRouteScenario } from "./long-term-memory-routes.regression.ts";

void runRouteScenario("backup").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
