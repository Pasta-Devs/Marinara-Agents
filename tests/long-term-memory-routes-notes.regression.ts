async function main() {
  process.env.MARINARA_LTM_ROUTE_SCENARIO = "notes";
  const { completion } = await import("./long-term-memory-routes.regression.ts");
  await completion;
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
