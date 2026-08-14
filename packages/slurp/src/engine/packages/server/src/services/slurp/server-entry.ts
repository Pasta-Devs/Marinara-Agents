import type { FastifyPluginAsync } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";

export async function activate({
  api,
}: {
  api: {
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void | Promise<void>>;
  };
}) {
  const release = await api.registerPrivilegedRoutes(slurpRoutes, { prefix: "/api/slurp" });
  return async () => release();
}

export async function selfCheck() {}
