import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { slurpRoutes } from "../../routes/slurp.routes.js";

export async function activate({
  app,
  api,
}: {
  app: FastifyInstance;
  api: {
    registerPrivilegedRoutes(routes: FastifyPluginAsync, options: { prefix: string }): Promise<() => void | Promise<void>>;
  };
}) {
  const routes: FastifyPluginAsync = async (router) => {
    await slurpRoutes(Object.assign(router, { db: app.db }) as FastifyInstance);
  };
  const release = await api.registerPrivilegedRoutes(routes, { prefix: "/api/slurp" });
  return async () => release();
}

export async function selfCheck() {}
