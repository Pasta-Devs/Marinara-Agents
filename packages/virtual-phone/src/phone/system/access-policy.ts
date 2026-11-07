const ROUTE_APPS = [
  "calls",
  "contacts",
  "goodle",
  "gallery",
  "camera",
  "noodler-r",
  "tindler",
  "mail",
  "bazaar",
  "shop",
  "maps",
  "find",
] as const;

/** Maps privileged routes to the installed app whose capability they exercise. */
export function requiredAppForRoute(route: string, storageAppId?: string) {
  if (storageAppId) return storageAppId;
  if (route.includes("/messaging")) return "messages";
  if (route.includes("/noodle/") || route.includes("/noodler/")) return "noodler";
  if (route.includes("/wallet/") || route.includes("/banking/")) return "banking";
  if (route.includes("/library")) return "gallery";
  return ROUTE_APPS.find((appId) => route.includes(`/${appId}`));
}

/**
 * A Home phone is used like a story phone minus the story: every app route under
 * /phones/:phoneId/ may run. Story-only routes (/chats/...) and story writes are closed
 * elsewhere: the preHandler rejects home: chat ids and the Engine persistence view
 * no-ops writes for them, so no allowlist per app is needed here.
 */
export function homePhoneRouteAllowed(_method: string, route: string) {
  // The route url carries the Engine's mount prefix, so match inside it.
  return route.includes("/phones/:phoneId/") && !route.includes("/chats/");
}

export function validAccessLease(
  lease: { token: string; chatId: string; expiresAt: number } | undefined,
  token: unknown,
  requestedChatId: string,
  now: number,
) {
  return Boolean(
    lease &&
    lease.expiresAt > now &&
    typeof token === "string" &&
    token === lease.token &&
    (!requestedChatId || requestedChatId === lease.chatId),
  );
}
