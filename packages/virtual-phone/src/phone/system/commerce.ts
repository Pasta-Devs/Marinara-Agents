import { applyTransaction, readAccount, type BankAccount } from "../apps/banking/manifest";
import { readOrders, type ShopOrder, type ShopOrderStatus } from "../apps/shop/manifest";

export type PhoneAppStorage = Record<string, Record<string, unknown>>;

export interface OrderInput {
  id: string;
  name: string;
  seller: string;
  detail: string;
  price: number;
  category?: string;
  delivery?: string;
}

export interface PlaceOrderResult {
  storage: PhoneAppStorage;
  result: { order: ShopOrder | null; account: BankAccount | null; created: boolean; insufficient: boolean };
}

/** Pure transaction planner; PhoneIdentityService commits the returned namespaces atomically. */
export function placeShopOrder(storage: PhoneAppStorage, input: OrderInput, at: string): PlaceOrderResult {
  const account = readAccount(storage.banking?.account);
  const orders = readOrders(storage.shop?.orders);
  const existing = orders.find((order) => order.id === input.id);
  if (existing) return { storage, result: { order: existing, account, created: false, insufficient: false } };
  if (account.transactions.length === 0 && account.balance === 0) {
    return { storage, result: { order: null, account: null, created: false, insufficient: false } };
  }
  if (account.balance < input.price) {
    return { storage, result: { order: null, account, created: false, insufficient: true } };
  }
  const order: ShopOrder = {
    ...input,
    category: input.category || "Featured",
    delivery: input.delivery || "Standard delivery",
    status: "ordered", at, updatedAt: at,
  };
  const updatedAccount = applyTransaction(account, {
    id: `shop:${input.id}`,
    at,
    amount: -input.price,
    description: `Shop order: ${input.name}`,
    source: "user",
  });
  return {
    storage: {
      ...storage,
      banking: { ...(storage.banking ?? {}), account: updatedAccount },
      shop: { ...(storage.shop ?? {}), orders: [order, ...orders].slice(0, 100) },
    },
    result: { order, account: updatedAccount, created: true, insufficient: false },
  };
}

export function advanceShopOrder(storage: PhoneAppStorage, orderId: string, status: ShopOrderStatus, updatedAt: string) {
  const orders = readOrders(storage.shop?.orders);
  const current = orders.find((entry) => entry.id === orderId);
  if (!current) return { storage, result: { order: null as ShopOrder | null, changed: false } };
  if (current.status === status || current.status === "delivered") return { storage, result: { order: current, changed: false } };
  // Delivery cannot jump straight from checkout to the doorstep. Keeping the state machine strict
  // makes retries predictable and gives the story a visible "on the way" beat.
  if (current.status === "ordered" && status !== "shipped") return { storage, result: { order: current, changed: false } };
  const updated: ShopOrder = { ...current, status, updatedAt };
  return {
    storage: { ...storage, shop: { ...(storage.shop ?? {}), orders: orders.map((entry) => entry.id === updated.id ? updated : entry) } },
    result: { order: updated, changed: true },
  };
}
