import React from "react";
import { Package, Search, ShoppingCart } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity, rememberWorldFact } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { charge, InsufficientFundsError } from "../../platform/wallet";
import { EmojiThumb } from "../../platform/emoji-thumb";
import { formatMoney } from "../banking/manifest";
import { parseProduct, type AzProduct } from "./manifest";
import { useStoryClock } from "../../platform/story-clock";
import { PhoneEmptyState } from "../../platform/empty-state";

type Order = AzProduct & { id: string; status: string; at: string };
export function AzmoronShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "azmoron");
  const [products, setProducts] = React.useState<AzProduct[]>([]);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  // Orders used to be a one-line toast saying how many there were, which is not somewhere to look
  // for the parcel that is now part of the story.
  const [view, setView] = React.useState<"shop" | "orders">("shop");
  const clock = useStoryClock();
  const refresh = React.useCallback(() => { setLoading(true); void phoneRequest<{ products: string[] }>(`/phones/${encodeURIComponent(phoneId)}/azmoron/search`, { method: "POST", body: JSON.stringify({ query }) }).then((r) => { const next = r.products.map(parseProduct); setProducts(next); void store.set("products", next); }).catch((e) => setNotice(e instanceof Error ? e.message : "Azmoron is unavailable.")).finally(() => setLoading(false)); }, [phoneId, query, store]);
  React.useEffect(() => { void Promise.all([store.get("products"), store.get("orders")]).then(([p, o]) => { if (Array.isArray(p)) setProducts(p as AzProduct[]); if (Array.isArray(o)) setOrders(o as Order[]); }); }, [store]);
  const order = async (product: AzProduct) => { setNotice(""); const id = crypto.randomUUID(); try { await charge(phoneId, product.price, `Azmoron order: ${product.name}`, `azmoron:${id}`); const next = [{ ...product, id, status: "Order placed", at: new Date().toISOString() }, ...orders]; setOrders(next); await store.set("orders", next); void recordActivity(phoneId, `ordered ${product.name} from ${product.seller} on Azmoron`).catch(() => undefined); void rememberWorldFact(phoneId, `Ordered ${product.name} from ${product.seller} for ${product.price}.`, "Azmoron order").catch(() => undefined); setNotice("Order placed. The parcel is now part of the story."); } catch (e) { setNotice(e instanceof InsufficientFundsError ? `Not enough money. ${formatMoney(e.account.balance, e.account.currency)} available.` : e instanceof Error ? e.message : "The order failed."); } };
  return <section aria-labelledby="azmoron-title" className="vp-appview"><PhoneAppHeader title={view === "orders" ? "Your orders" : "Azmoron"} titleId="azmoron-title" closeLabel="Close Azmoron" onBack={() => view === "orders" ? setView("shop") : onBack()} onClose={onClose} actions={[{ id: "orders", icon: "package", label: "Orders", kind: "button" }, { id: "refresh", icon: "refresh", label: "Search", kind: "button", disabled: loading }]} onAction={(id) => id === "orders" ? setView((current) => current === "orders" ? "shop" : "orders") : refresh()} center={<span className="vp-urlbar"><ShoppingCart size="0.75rem" aria-hidden="true" /><span>azmoron.market</span></span>} />
    {notice ? <p role="status" className="vp-muted-note">{notice}</p> : null}
    {view === "orders" ? (
      orders.length === 0 ? (
        <PhoneEmptyState icon={Package} title="No orders" body="Anything bought here arrives in the story, and stays listed on this screen." />
      ) : (
        <div className="vp-list vp-list--inset-rules">
          {orders.map((entry) => (
            <div key={entry.id} className="vp-thread-row">
              <EmojiThumb text={`${entry.name} ${entry.detail}`} fallback="📦" />
              <span className="vp-thread-body">
                <span className="vp-thread-name">{entry.name}</span>
                <span className="vp-thread-preview">{entry.status} · {entry.seller}</span>
              </span>
              <span className="vp-row-stamp">{clock.shortDate(entry.at)}</span>
            </div>
          ))}
        </div>
      )
    ) : (<>
    <form className="vp-composer" onSubmit={(e) => { e.preventDefault(); refresh(); }}><label style={{ flex: 1 }}><span className="vp-sr-only">Search Azmoron</span><input className="vp-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the world’s market" /></label><button className="vp-icon-btn" aria-label="Search" type="submit"><Search size="1rem" aria-hidden="true" /></button></form>
    <div className="vp-az-grid">{products.map((p, i) => <article className="vp-card vp-az-product" key={`${p.name}-${i}`}><EmojiThumb text={`${p.name} ${p.detail}`} fallback="📦" /><span className="vp-section-label">{p.seller}</span><h3>{p.name}</h3><p>{p.detail}</p><div className="vp-az-buy"><strong>{p.price}</strong><button type="button" className="vp-icon-btn" aria-label={`Order ${p.name}`} onClick={() => void order(p)}><Package size="0.95rem" aria-hidden="true" /></button></div></article>)}</div>
    </>)}
  </section>;
}
