import type { AppManifest } from "../../platform/app-manifest";

export const azmoronManifest: AppManifest = {
  id: "azmoron",
  name: "Azmoron",
  version: "1.0.0",
  icon: "azmoron",
  category: "shopping",
  capabilities: ["storage.local", "context.read", "story.write"],
  modelUse: "heavy",
  removable: true,
  routes: [{ id: "shop", path: "/", title: "Azmoron" }, { id: "orders", path: "/orders", title: "Orders" }],
  records: [{ type: "cart", ownership: "phone-local" }, { type: "order", ownership: "phone-local" }],
  actions: [{ id: "search", tier: "ambient" }, { id: "order", tier: "story" }],
  content: { products: { fields: { products: "string[]" } } },
  notifications: null,
};

export type AzProduct = { seller: string; price: number; name: string; detail: string };
export function parseProduct(line: string): AzProduct { const [seller, price, name, ...detail] = line.split(" | "); return { seller: seller?.trim() || "Azmoron", price: Number(price) || 0, name: name?.trim() || "Mystery parcel", detail: detail.join(" | ").trim() || "No details provided." }; }
