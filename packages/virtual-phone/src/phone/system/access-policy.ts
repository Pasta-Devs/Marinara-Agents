const ROUTE_APPS = [
  "calls", "contacts", "goodle", "gallery", "camera", "noodler-r", "tindler", "mail",
  "bazaar", "shop", "maps", "find",
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

export function validAccessLease(
  lease: { token: string; chatId: string; expiresAt: number } | undefined,
  token: unknown,
  requestedChatId: string,
  now: number,
) {
  return Boolean(lease
    && lease.expiresAt > now
    && typeof token === "string"
    && token === lease.token
    && (!requestedChatId || requestedChatId === lease.chatId));
}
