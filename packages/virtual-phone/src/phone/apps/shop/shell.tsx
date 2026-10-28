import React from "react";
import { Check, ChevronRight, Package, Search, ShoppingCart, Store } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { EmojiThumb } from "../../platform/emoji-thumb";
import { parseProduct, readOrders, readProducts, type ShopOrder, type ShopOrderStatus, type ShopProduct } from "./manifest";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneEmptyState } from "../../platform/empty-state";
import { formatMoney, readAccount, type BankAccount } from "../banking/manifest";

type ShopView = "shop" | "product" | "cart" | "orders" | "receipt";
const productKey = (product: ShopProduct) => `${product.seller}\u0000${product.name}\u0000${product.price}`;

export function ShopShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "shop");
  const bank = usePhoneStore(phoneId, "banking");
  const [products, setProducts] = React.useState<ShopProduct[]>([]);
  const [cart, setCart] = React.useState<ShopProduct[]>([]);
  const [orders, setOrders] = React.useState<ShopOrder[]>([]);
  const [query, setQuery] = React.useState("");
  const [department, setDepartment] = React.useState("All");
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [account, setAccount] = React.useState<BankAccount | null>(null);
  const [selected, setSelected] = React.useState<ShopProduct | null>(null);
  const [confirming, setConfirming] = React.useState<ShopProduct | null>(null);
  const [receiptId, setReceiptId] = React.useState("");
  const [view, setView] = React.useState<ShopView>("shop");
  const [orderFilter, setOrderFilter] = React.useState<"active" | "all" | "delivered">("active");
  const clock = useStoryClock();

  const refresh = React.useCallback(() => {
    setLoading(true); setNotice("");
    void phoneRequest<{ products: string[] }>(`/phones/${encodeURIComponent(phoneId)}/shop/search`, { method: "POST", body: JSON.stringify({ query }) })
      .then((response) => {
        const next = response.products.map(parseProduct).filter((product) => product.price > 0);
        setProducts(next); setDepartment("All");
        void store.set("catalog", next);
        if (!next.length) setNotice("No products found. Try another search.");
      }).catch((cause) => setNotice(cause instanceof Error ? cause.message : "Shop is unavailable."))
      .finally(() => setLoading(false));
  }, [phoneId, query, store]);

  React.useEffect(() => {
    void Promise.all([store.get("catalog"), store.get("cart"), store.get("orders")]).then(([catalogValue, cartValue, orderValue]) => {
      const catalog = readProducts(catalogValue);
      setProducts(catalog); setCart(readProducts(cartValue)); setOrders(readOrders(orderValue));
      if (!catalog.length) refresh();
    });
  }, [refresh, store]);
  React.useEffect(() => { void bank.get("account").then((value) => setAccount(readAccount(value))).catch(() => setAccount(null)); }, [bank]);
  React.useEffect(() => { if (view === "orders") void store.set("lastSeenAt", new Date().toISOString()); }, [store, view]);
  React.useEffect(() => {
    if (!confirming) return;
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape" && !busyId) setConfirming(null); };
    window.addEventListener("keydown", cancel); return () => window.removeEventListener("keydown", cancel);
  }, [confirming, busyId]);

  const saveCart = (next: ShopProduct[]) => { setCart(next); void store.set("cart", next); };
  const addToCart = (product: ShopProduct) => {
    if (cart.some((entry) => productKey(entry) === productKey(product))) { setNotice("Already in your cart."); return; }
    saveCart([...cart, product]); setNotice(`${product.name} added to cart.`);
  };
  const order = async (product: ShopProduct) => {
    setNotice(""); const id = crypto.randomUUID(); setBusyId(id);
    try {
      const response = await phoneRequest<{ order: ShopOrder; account: BankAccount }>(`/phones/${encodeURIComponent(phoneId)}/shop/orders`, { method: "POST", body: JSON.stringify({ ...product, id }) });
      setOrders((current) => [response.order, ...current.filter((entry) => entry.id !== response.order.id)]);
      setAccount(response.account); saveCart(cart.filter((entry) => productKey(entry) !== productKey(product)));
      setConfirming(null); setReceiptId(response.order.id); setView("receipt"); setNotice("Order confirmed. Your receipt is in Banking.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "The order failed."); }
    finally { setBusyId(""); }
  };
  const advance = async (entry: ShopOrder, status: ShopOrderStatus) => {
    setBusyId(entry.id); setNotice("");
    try {
      const response = await phoneRequest<{ order: ShopOrder }>(`/phones/${encodeURIComponent(phoneId)}/shop/orders/${encodeURIComponent(entry.id)}/status`, { method: "POST", body: JSON.stringify({ status }) });
      setOrders((current) => current.map((order) => order.id === entry.id ? response.order : order));
      setNotice(status === "delivered" ? "Delivery confirmed." : "Tracking updated: your parcel is on the way.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Tracking could not be updated."); }
    finally { setBusyId(""); }
  };
  const openProduct = (product: ShopProduct) => { setSelected(product); setView("product"); setNotice(""); };
  const goBack = () => {
    if (view === "receipt") setView("orders"); else if (view !== "shop") setView("shop"); else onBack();
  };
  const receipt = orders.find((entry) => entry.id === receiptId) ?? null;
  const departments = ["All", ...Array.from(new Set(products.map((product) => product.category))).slice(0, 5)];
  const visibleProducts = department === "All" ? products : products.filter((product) => product.category === department);
  const visibleOrders = orders.filter((entry) => orderFilter === "all" || (orderFilter === "active" ? entry.status !== "delivered" : entry.status === "delivered"));
  const money = (amount: number) => formatMoney(amount, account?.currency ?? "credits");
  const title = view === "orders" ? "Your orders" : view === "receipt" ? "Order details" : view === "cart" ? "Cart" : view === "product" ? selected?.seller || "Product" : "Shop";

  return <section data-phone-app="shop" aria-labelledby="shop-title" className="vp-appview vp-shop">
    <PhoneAppHeader title={title} titleId="shop-title" closeLabel="Close Shop" onBack={goBack} onClose={onClose}
      actions={view === "shop" ? [{ id: "orders", icon: "package", label: "Orders", kind: "button" }, { id: "cart", icon: "cart", label: `Cart (${cart.length})`, kind: "button" }] : []}
      onAction={(id) => setView(id === "orders" ? "orders" : "cart")} center={<span className="vp-urlbar"><Store size="0.75rem" aria-hidden="true" /><span>shop</span></span>} />
    {notice ? <p role="status" className="vp-muted-note vp-shop-notice">{notice}</p> : null}

    {view === "receipt" && receipt ? <div className="vp-stack" style={{ gap: "0.75rem" }}>
      <div className="vp-card vp-card-body"><span className="vp-section-label">Receipt</span><h3>{receipt.name}</h3><p>{receipt.detail}</p><strong>{money(receipt.price)}</strong><p className="vp-muted-note">Sold by {receipt.seller}<br />Order {receipt.id}</p></div>
      <ol className="vp-shop-timeline" aria-label="Delivery tracking">
        <li className="is-complete"><Check aria-hidden="true" /><div><strong>Order confirmed</strong><span>Paid {clock.shortDate(receipt.at)}</span></div></li>
        <li className={receipt.status !== "ordered" ? "is-complete" : ""}><Package aria-hidden="true" /><div><strong>{receipt.status === "ordered" ? "Preparing your order" : "Shipped"}</strong><span>{receipt.status === "ordered" ? receipt.delivery : `Updated ${clock.shortDate(receipt.updatedAt)}`}</span>{receipt.status === "ordered" ? <button type="button" className="vp-surface-btn" disabled={busyId === receipt.id} onClick={() => void advance(receipt, "shipped")}>Check for shipping update</button> : null}</div></li>
        <li className={receipt.status === "delivered" ? "is-complete" : ""}><Package aria-hidden="true" /><div><strong>{receipt.status === "delivered" ? "Delivered" : "Awaiting delivery"}</strong><span>{receipt.status === "delivered" ? `Delivered ${clock.shortDate(receipt.updatedAt)}` : "Tracking will update when it arrives"}</span>{receipt.status === "shipped" ? <button type="button" className="vp-accent-btn" disabled={busyId === receipt.id} onClick={() => void advance(receipt, "delivered")}>Confirm delivery</button> : null}</div></li>
      </ol>
    </div> : view === "orders" ? <div className="vp-stack">
      <div className="vp-filter-tabs" role="group" aria-label="Filter orders">{(["active", "all", "delivered"] as const).map((filter) => <button key={filter} type="button" aria-pressed={orderFilter === filter} onClick={() => setOrderFilter(filter)}>{filter === "active" ? `Active (${orders.filter((entry) => entry.status !== "delivered").length})` : filter === "delivered" ? `Delivered (${orders.filter((entry) => entry.status === "delivered").length})` : `All (${orders.length})`}</button>)}</div>
      {!visibleOrders.length ? <PhoneEmptyState icon={Package} title="No orders here" body={orders.length ? "Try another order filter." : "Your Shop purchases and delivery updates will appear here."} /> : <div className="vp-list">{visibleOrders.map((entry) => <button type="button" key={entry.id} className="vp-card vp-shop-order" onClick={() => { setReceiptId(entry.id); setView("receipt"); }}><EmojiThumb text={`${entry.name} ${entry.detail}`} fallback="📦" /><span><small>{entry.status === "delivered" ? "Delivered" : entry.status === "shipped" ? "On the way" : "Preparing"}</small><strong>{entry.name}</strong><em>{entry.seller} · {money(entry.price)}</em></span><ChevronRight aria-hidden="true" /></button>)}</div>}
    </div> : view === "cart" ? <div className="vp-stack">
      {!cart.length ? <PhoneEmptyState icon={ShoppingCart} title="Your cart is empty" body="Add fixed-price products from the Shop catalog. Bazaar listings stay separate." /> : <><div className="vp-shop-cart-summary"><span>{cart.length} {cart.length === 1 ? "item" : "items"}</span><strong>{money(cart.reduce((sum, product) => sum + product.price, 0))}</strong></div><div className="vp-list">{cart.map((product) => <article className="vp-card vp-shop-cart-row" key={productKey(product)}><EmojiThumb text={`${product.name} ${product.detail}`} fallback="📦" /><div><small>{product.seller}</small><strong>{product.name}</strong><span>{money(product.price)} · {product.delivery}</span><div><button type="button" onClick={() => saveCart(cart.filter((entry) => productKey(entry) !== productKey(product)))}>Remove</button><button type="button" className="vp-accent-btn" onClick={() => setConfirming(product)}>Buy now</button></div></div></article>)}</div></>}
    </div> : view === "product" && selected ? <div className="vp-shop-product-detail"><div className="vp-shop-product-photo"><EmojiThumb text={`${selected.name} ${selected.detail}`} fallback="📦" /></div><span className="vp-section-label">{selected.category} · {selected.seller}</span><h3>{selected.name}</h3><strong className="vp-shop-detail-price">{money(selected.price)}</strong><p>{selected.detail}</p><div className="vp-shop-delivery"><Package aria-hidden="true" /><div><strong>{selected.delivery}</strong><span>Sold and dispatched by {selected.seller}</span></div></div><div className="vp-shop-product-actions"><button type="button" className="vp-surface-btn" onClick={() => addToCart(selected)}>{cart.some((entry) => productKey(entry) === productKey(selected)) ? "In cart" : "Add to cart"}</button><button type="button" className="vp-accent-btn" onClick={() => setConfirming(selected)}>Buy now</button></div></div> : <>
      <div className="vp-shop-hero"><span className="vp-shop-mark"><Package size="1.1rem" aria-hidden="true" /></span><div><strong>Everyday goods, delivered.</strong><p>Fixed prices from stores across the world.</p></div></div>
      <form className="vp-composer" onSubmit={(event) => { event.preventDefault(); refresh(); }}><label style={{ flex: 1 }}><span className="vp-sr-only">Search Shop</span><input className="vp-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products and stores" /></label><button className="vp-icon-btn" aria-label="Search" type="submit" disabled={loading}><Search size="1rem" aria-hidden="true" /></button></form>
      {products.length ? <><div className="vp-shop-departments" role="group" aria-label="Departments">{departments.map((item) => <button key={item} type="button" aria-pressed={department === item} onClick={() => setDepartment(item)}>{item}</button>)}</div><div className="vp-shop-grid">{visibleProducts.map((product) => <button type="button" className="vp-card vp-shop-product" key={productKey(product)} onClick={() => openProduct(product)}><span className="vp-shop-product-thumb"><EmojiThumb text={`${product.name} ${product.detail}`} fallback="📦" /></span><small>{product.seller}</small><strong>{product.name}</strong><span>{money(product.price)}</span><em>{product.delivery}</em></button>)}</div></> : !loading ? <PhoneEmptyState icon={Store} title="Stock the shelves" body="Search for something to build a catalog from stores in this world." /> : <p className="vp-muted-note">Checking store shelves…</p>}
    </>}

    {confirming ? <div role="alertdialog" aria-labelledby="shop-confirm-title" aria-describedby="shop-confirm-description" className="vp-card vp-card-body vp-shop-checkout"><span className="vp-sheet-grip" aria-hidden="true" /><span className="vp-section-label">Secure checkout</span><h3 id="shop-confirm-title">Place order?</h3><p id="shop-confirm-description">{confirming.name} from {confirming.seller}</p><strong>{money(confirming.price)}</strong><p className="vp-muted-note">{confirming.delivery}{account ? ` · Balance after purchase: ${money(account.balance - confirming.price)}` : ""}</p><div className="vp-review-actions"><button autoFocus type="button" className="vp-accent-btn" disabled={Boolean(busyId) || Boolean(account && account.balance < confirming.price)} onClick={() => void order(confirming)}>Pay and place order</button><button type="button" className="vp-store-remove" disabled={Boolean(busyId)} onClick={() => setConfirming(null)}>Cancel</button></div></div> : null}
  </section>;
}
