export type AppModelUse = "none" | "light" | "heavy";
export type AppCapability =
  | "storage.local"
  | "context.read"
  | "notify"
  | "share.screen"
  | "story.write"
  | "net.search"
  | "participants";
export type AppActionTier = "local" | "ambient" | "participant" | "story";
export type AppRecordOwnership = "phone-local" | "story-shared" | "participant-shared" | "permissioned-private";

export interface AppRoute {
  id: string;
  path: string;
  title: string;
}

export interface AppRecordDeclaration {
  type: string;
  ownership: AppRecordOwnership;
}

export interface AppActionDeclaration {
  id: string;
  tier: AppActionTier;
  immediate?: boolean;
}

export interface AppNotificationDeclaration {
  tier: AppActionTier;
  dedupeBy: string;
}

export interface AppManifest {
  id: string;
  name: string;
  version: string;
  icon: string;
  category: string;
  capabilities: AppCapability[];
  modelUse: AppModelUse;
  removable: boolean;
  routes: AppRoute[];
  records: AppRecordDeclaration[];
  actions: AppActionDeclaration[];
  content: Record<string, unknown>;
  notifications: AppNotificationDeclaration | null;
}

export type AppModuleLoader = () => Promise<unknown>;

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const capabilities = new Set<AppCapability>([
  "storage.local",
  "context.read",
  "notify",
  "share.screen",
  "story.write",
  "net.search",
  "participants",
]);
const tiers = new Set<AppActionTier>(["local", "ambient", "participant", "story"]);
const ownership = new Set<AppRecordOwnership>([
  "phone-local",
  "story-shared",
  "participant-shared",
  "permissioned-private",
]);

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

export function validateAppManifest(input: AppManifest): AppManifest {
  if (!input || typeof input !== "object") throw new Error("App manifest is required");
  if (!idPattern.test(requiredString(input.id, "App id"))) throw new Error("App id has an invalid format");
  requiredString(input.name, "App name");
  if (!versionPattern.test(requiredString(input.version, "App version"))) throw new Error("App version has an invalid format");
  requiredString(input.icon, "App icon");
  requiredString(input.category, "App category");
  if (!Array.isArray(input.capabilities) || input.capabilities.some((capability) => !capabilities.has(capability))) {
    throw new Error(`App ${input.id} declares an unsupported capability`);
  }
  if (new Set(input.capabilities).size !== input.capabilities.length) throw new Error(`App ${input.id} declares duplicate capabilities`);
  if (!new Set(["none", "light", "heavy"]).has(input.modelUse)) throw new Error(`App ${input.id} declares invalid model use`);
  if (typeof input.removable !== "boolean") throw new Error(`App ${input.id} must declare removable`);
  if (!Array.isArray(input.routes) || input.routes.length === 0) throw new Error(`App ${input.id} needs at least one route`);
  const routeIds = new Set<string>();
  for (const route of input.routes) {
    if (!idPattern.test(requiredString(route.id, "Route id")) || routeIds.has(route.id)) throw new Error(`App ${input.id} declares duplicate or invalid route id`);
    routeIds.add(route.id);
    if (!requiredString(route.path, "Route path").startsWith("/")) throw new Error(`App ${input.id} route paths must start with /`);
    requiredString(route.title, "Route title");
  }
  if (!Array.isArray(input.records) || input.records.some((record) => !requiredString(record.type, "Record type") || !ownership.has(record.ownership))) {
    throw new Error(`App ${input.id} declares invalid records`);
  }
  if (!Array.isArray(input.actions) || input.actions.some((action) => !idPattern.test(requiredString(action.id, "Action id")) || !tiers.has(action.tier))) {
    throw new Error(`App ${input.id} declares invalid actions`);
  }
  if (!input.content || typeof input.content !== "object" || Array.isArray(input.content)) throw new Error(`App ${input.id} must declare content schemas`);
  if (input.notifications !== null && (!input.notifications || !tiers.has(input.notifications.tier) || !requiredString(input.notifications.dedupeBy, "Notification dedupe key"))) {
    throw new Error(`App ${input.id} declares invalid notifications`);
  }
  return input;
}
