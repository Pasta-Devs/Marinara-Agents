// `marinara:host` is not a file: the feature build resolves it to the Engine's host namespace
// (`globalThis.__MARINARA_HOST__`, scripts/esbuild-host-plugins.mjs). A package root takes the Engine's one QueryClient
// from it, so package queries share the Engine's cache (Pasta-Devs/Marinara-Agents#1487).
declare module "marinara:host" {
  import type { QueryClient } from "@tanstack/react-query";

  export const queryClient: QueryClient;
  export const host: { readonly version: 1 } & Readonly<Record<string, unknown>>;
}
