import type { AppManifest } from "../../platform/app-manifest";

export const shopManifest: AppManifest = {
  id: "shop",
  name: "Shop",
  version: "1.0.0",
  icon: "shop",
  category: "shopping",
  capabilities: ["storage.local", "context.read", "story.write", "notify"],
  modelUse: "heavy",
  removable: true,
  routes: [{ id: "shop", path: "/", title: "Shop" }, { id: "cart", path: "/cart", title: "Cart" }, { id: "orders", path: "/orders", title: "Orders" }],
  records: [{ type: "catalog", ownership: "phone-local" }, { type: "cart", ownership: "phone-local" }, { type: "order", ownership: "phone-local" }],
  actions: [{ id: "search", tier: "ambient" }, { id: "order", tier: "story" }, { id: "update-delivery", tier: "story" }],
  content: { products: { fields: { products: "string[]" } } },
  notifications: { tier: "story", dedupeBy: "order-update" },
};

export type ShopOrderStatus = "ordered" | "shipped" | "delivered";

export interface ShopOrder extends ShopProduct {
  id: string;
  status: ShopOrderStatus;
  at: string;
  updatedAt: string;
}

export function readOrders(value: unknown): ShopOrder[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ShopOrder => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const order = entry as Partial<ShopOrder>;
    return typeof order.id === "string" && typeof order.name === "string" && typeof order.seller === "string" &&
      Number.isFinite(Number(String(order.price).replace(/[^0-9.-]/gu, ""))) && typeof order.at === "string";
  }).map((order) => ({
    ...order,
    price: Number(String(order.price).replace(/[^0-9.-]/gu, "")),
    category: String(order.category || "Featured"),
    delivery: String(order.delivery || "Standard delivery"),
    status: String(order.status).toLowerCase() === "delivered" ? "delivered" : String(order.status).toLowerCase() === "shipped" ? "shipped" : "ordered",
    updatedAt: order.updatedAt || order.at,
  }));
}

export type ShopProduct = { seller: string; price: number; name: string; category: string; delivery: string; detail: string };

export function parseProduct(line: string): ShopProduct {
  const parts = line.split(" | ").map((part) => part.trim());
  const [seller, rawPrice, name] = parts;
  // Older catalogs used four fields. Keeping them readable prevents a saved storefront from
  // disappearing after an update while the richer format adds retail departments and fulfilment.
  const legacy = parts.length < 6;
  return {
    seller: seller || "Shop",
    price: Math.max(0, Math.trunc(Number(String(rawPrice).replace(/[^0-9.-]/gu, "")) || 0)),
    name: name || "Mystery item",
    category: legacy ? "Featured" : parts[3] || "Featured",
    delivery: legacy ? "Standard delivery" : parts[4] || "Standard delivery",
    detail: (legacy ? parts.slice(3) : parts.slice(5)).join(" | ") || "No details provided.",
  };
}

export function readProducts(value: unknown): ShopProduct[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return [parseProduct(entry)];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const product = entry as Partial<ShopProduct>;
    if (!product.name || !product.seller || !Number.isFinite(Number(product.price))) return [];
    return [{
      seller: String(product.seller), price: Math.max(0, Math.trunc(Number(product.price))), name: String(product.name),
      category: String(product.category || "Featured"), delivery: String(product.delivery || "Standard delivery"),
      detail: String(product.detail || "No details provided."),
    }];
  });
}
