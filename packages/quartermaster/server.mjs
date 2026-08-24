// Quartermaster — capability package server entrypoint (scaffold).
// Proves the package can register a privileged route and read/write its own
// package-owned storage (persistence.documents) before any real inventory
// logic is built. Hand-authored directly (no build step needed yet — it only
// uses the public activate(context) contract), the way agents.json is
// hand-maintained rather than generated.

const PACKAGE_ID = "quartermaster";

export async function activate(context) {
  const { api } = context;
  const { documents } = api.runtime.persistence;

  const existing = await documents.getById(PACKAGE_ID, "scaffold-check");
  if (!existing) {
    const now = new Date().toISOString();
    await documents.create({
      id: "scaffold-check",
      packageId: PACKAGE_ID,
      kind: "scaffold",
      name: "Scaffold check",
      description: "Written once on first activation to prove package-owned storage works.",
      data: { activatedAt: now },
      createdAt: now,
      updatedAt: now,
    });
  }

  const releaseRoutes = await api.registerPrivilegedRoutes(
    async (routes) => {
      routes.get("/ping", async () => {
        const doc = await documents.getById(PACKAGE_ID, "scaffold-check");
        return { ok: true, packageId: PACKAGE_ID, scaffoldCheck: doc ? doc.data : null };
      });
    },
    { prefix: `/api/${PACKAGE_ID}` },
  );

  return () => {
    releaseRoutes();
  };
}
