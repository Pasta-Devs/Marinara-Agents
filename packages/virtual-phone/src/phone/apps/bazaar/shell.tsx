import React from "react";
import { Bookmark, BookmarkCheck, Search, Send } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity, rememberWorldFact } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { charge, credit, InsufficientFundsError } from "../../platform/wallet";
import { formatMoney } from "../banking/manifest";
import { glyphFor, listingKey, parseListing, priceValue, type HaggleTurn, type Listing, type OwnListing } from "./manifest";

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `l-${Math.random().toString(36).slice(2)}`);

export function BazaarShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "bazaar");
  const [listings, setListings] = React.useState<Listing[] | null>(null);
  const [owned, setOwned] = React.useState<Listing[]>([]);
  const [selling, setSelling] = React.useState<OwnListing[]>([]);
  const [saved, setSaved] = React.useState<Listing[]>([]);
  const [threads, setThreads] = React.useState<Record<string, HaggleTurn[]>>({});
  const [tab, setTab] = React.useState<"browse" | "saved" | "selling" | "bought">("browse");
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sellDraft, setSellDraft] = React.useState<{ title: string; price: string; description: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [confirmBuy, setConfirmBuy] = React.useState(false);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!confirmBuy) return;
    const cancel = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setConfirmBuy(false); };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [confirmBuy, busy]);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setNotice(null);
    void phoneRequest<{ listings: string[] }>(`/phones/${encodeURIComponent(phoneId)}/bazaar/listings`, {
      method: "POST", body: JSON.stringify({}),
    })
      .then((response) => {
        const parsed = response.listings.map(parseListing);
        setListings(parsed);
        void store.set("listings", parsed).catch(() => undefined);
      })
      .catch((cause: unknown) => {
        setNotice(cause instanceof Error ? cause.message : "Bazaar could not be reached.");
        setListings((current) => current ?? []);
      })
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void Promise.all([store.get("owned"), store.get("selling"), store.get("threads"), store.get("saved"), store.get("listings")])
      .then(([cachedOwned, cachedSelling, cachedThreads, cachedSaved, cachedListings]) => {
        if (!active) return;
        if (Array.isArray(cachedOwned)) setOwned(cachedOwned as Listing[]);
        if (Array.isArray(cachedSelling)) setSelling(cachedSelling as OwnListing[]);
        if (cachedThreads && typeof cachedThreads === "object") setThreads(cachedThreads as Record<string, HaggleTurn[]>);
        if (Array.isArray(cachedSaved)) setSaved(cachedSaved as Listing[]);
        if (Array.isArray(cachedListings) && cachedListings.length) setListings(cachedListings as Listing[]);
        else refresh();
      })
      .catch(() => { if (active) refresh(); });
    return () => { active = false; };
  }, [store, refresh]);

  const open = listings?.find((listing) => listingKey(listing) === openKey) ?? null;
  const openThread = openKey ? threads[openKey] ?? [] : [];
  /** The price the seller has come down to in this thread, if they have moved at all. */
  const agreed = openThread.reduce((best, turn) => turn.from === "seller" && turn.text.startsWith("§") ? Number(turn.text.slice(1).split("|")[0]) || best : best, 0);
  const askingPrice = open ? priceValue(open.price) : 0;
  const payable = agreed || askingPrice;
  const purchased = open ? owned.some((listing) => listingKey(listing) === listingKey(open)) : false;
  const visibleListings = (listings ?? []).filter((listing) => !query.trim() || `${listing.title} ${listing.seller} ${listing.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  const persistOwned = (next: Listing[]) => { setOwned(next); void store.set("owned", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Your purchases could not be saved.")); };
  const persistSelling = (next: OwnListing[]) => { setSelling(next); void store.set("selling", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Your listings could not be saved.")); };
  const persistThreads = (next: Record<string, HaggleTurn[]>) => { setThreads(next); void store.set("threads", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The seller conversation could not be saved.")); };
  const persistSaved = (next: Listing[]) => { setSaved(next); void store.set("saved", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Saved listings could not be updated.")); };
  const isSaved = (listing: Listing) => saved.some((item) => listingKey(item) === listingKey(listing));
  const toggleSaved = (listing: Listing) => persistSaved(isSaved(listing)
    ? saved.filter((item) => listingKey(item) !== listingKey(listing))
    : [listing, ...saved]);

  /** Money leaves the same account Banking shows, or the purchase does not happen. */
  const buy = async (listing: Listing) => {
    setBusy(true);
    setNotice(null);
    try {
      const cost = payable;
      const nextOwned = [listing, ...owned];
      await store.set("owned", nextOwned);
      try {
        if (cost > 0) await charge(phoneId, cost, `Bought ${listing.title} from ${listing.seller}`, `market-buy:${listingKey(listing)}`);
      } catch (cause) {
        await store.set("owned", owned);
        throw cause;
      }
      setOwned(nextOwned);
      void recordActivity(phoneId, "made a purchase through Bazaar")
        .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The purchase action could not be recorded."));
      void rememberWorldFact(phoneId, `Bought ${listing.title} from ${listing.seller}${cost ? ` for ${cost}` : ""}.`, "Bazaar purchase")
        .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The purchase could not be shared with the phone."));
      persistSaved(saved.filter((item) => listingKey(item) !== listingKey(listing)));
      setNotice(`Deal recorded. Arrange the handoff with ${listing.seller} in this chat.`);
      setConfirmBuy(false);
      setOpenKey(null);
      setTab("bought");
    } catch (cause) {
      if (cause instanceof InsufficientFundsError) {
        setNotice(`You are short. ${listing.price} wanted, ${formatMoney(cause.account.balance, cause.account.currency)} in the account.`);
      } else {
        setNotice(cause instanceof Error ? cause.message : "The purchase could not be completed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const message = async (listing: Listing) => {
    const text = draft.trim();
    if (!text || busy) return;
    const key = listingKey(listing);
    const history = (threads[key] ?? [])
      .filter((turn) => !turn.text.startsWith("§"))
      .map((turn) => `${turn.from === "you" ? "You" : listing.seller}: ${turn.text}`)
      .join("\n");
    const withMine = { ...threads, [key]: [...(threads[key] ?? []), { from: "you" as const, text }] };
    persistThreads(withMine);
    setDraft("");
    setBusy(true);
    try {
      const response = await phoneRequest<{ reply: string; offer: number }>(`/phones/${encodeURIComponent(phoneId)}/bazaar/message`, {
        method: "POST",
        body: JSON.stringify({ seller: listing.seller, item: listing.title, price: listing.price, history, text }),
      });
      const turns: HaggleTurn[] = [];
      if (response.reply.trim()) turns.push({ from: "seller", text: response.reply.trim() });
      // A moved price is recorded as a marker turn so it survives a reload without another field.
      if (response.offer > 0 && response.offer !== askingPrice) turns.push({ from: "seller", text: `§${response.offer}|` });
      persistThreads({ ...withMine, [key]: [...(withMine[key] ?? []), ...turns] });
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "No reply.");
    } finally {
      setBusy(false);
    }
  };

  const listForSale = async () => {
    if (!sellDraft?.title.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const entry: OwnListing = {
      id: newId(),
      title: sellDraft.title.trim(),
      price: sellDraft.price.trim() || "Offers",
      description: sellDraft.description.trim(),
      offer: null,
      sold: false,
    };
    const next = [entry, ...selling];
    try {
      await store.set("selling", next);
      setSelling(next);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Your listing could not be saved.");
      setBusy(false);
      return;
    }
    void recordActivity(phoneId, "listed something for sale on Bazaar")
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The listing action could not be recorded."));
    void rememberWorldFact(phoneId, `Listed ${entry.title} for sale at ${entry.price}.`, "Bazaar listing")
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The listing could not be shared with the phone."));
    setSellDraft(null);
    setTab("selling");
    try {
      const response = await phoneRequest<{ buyer: string; amount: number; message: string }>(`/phones/${encodeURIComponent(phoneId)}/bazaar/interest`, {
        method: "POST", body: JSON.stringify({ title: entry.title, price: entry.price, description: entry.description }),
      });
      if (response.buyer.trim() && response.amount > 0) {
        persistSelling(next.map((item) => item.id === entry.id
          ? { ...item, offer: { from: response.buyer.trim(), amount: response.amount, message: response.message } }
          : item));
      }
    } catch {
      // Nobody answering is a valid outcome for a classified ad.
    } finally {
      setBusy(false);
    }
  };

  const acceptOffer = async (entry: OwnListing) => {
    if (!entry.offer) return;
    setNotice(null);
    try {
      const nextSelling = selling.map((item) => item.id === entry.id ? { ...item, sold: true } : item);
      await store.set("selling", nextSelling);
      try {
        await credit(phoneId, entry.offer.amount, `Sold ${entry.title} to ${entry.offer.from}`, `market-sell:${entry.id}`);
      } catch (cause) {
        await store.set("selling", selling);
        throw cause;
      }
      setSelling(nextSelling);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The payment could not be deposited.");
      return;
    }
    void recordActivity(phoneId, "completed a sale through Bazaar")
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The sale action could not be recorded."));
    void rememberWorldFact(phoneId, `Sold ${entry.title} to ${entry.offer.from} for ${entry.offer.amount}.`, "Bazaar sale")
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The sale could not be shared with the phone."));
    setNotice(`Sold to ${entry.offer.from}.`);
  };

  const photo = (listing: { title: string; description: string }, hero = false) => (
    <span className={`vp-market-photo${hero ? " vp-market-photo--hero" : ""}`} aria-hidden="true">
      {glyphFor({ title: listing.title, description: listing.description, price: "", seller: "" })}
    </span>
  );

  const headerTitle = sellDraft ? "New listing" : open ? open.title : tab === "saved" ? "Saved" : tab === "selling" ? "Selling" : tab === "bought" ? "Purchases" : "Bazaar";

  return (
    <section aria-labelledby="bazaar-title" className="vp-appview" data-phone-app="bazaar">
      <PhoneAppHeader
        title={headerTitle}
        titleId="bazaar-title"
        closeLabel="Close Bazaar"
        onBack={() => {
          if (sellDraft) return setSellDraft(null);
          if (open) { setConfirmBuy(false); return setOpenKey(null); }
          if (tab !== "browse") return setTab("browse");
          onBack();
        }}
        onClose={onClose}
        actions={open || sellDraft ? [] : [
          { id: "sell", icon: "add", label: "List something", kind: "button" },
          { id: "refresh-listings", icon: "refresh", label: "Refresh listings", kind: "button", disabled: loading, reason: "Refreshing" },
        ]}
        onAction={(actionId) => {
          if (actionId === "sell") setSellDraft({ title: "", price: "", description: "" });
          if (actionId === "refresh-listings") refresh();
        }}
      />
      {notice ? <p role="status" className="vp-muted-note">{notice}</p> : null}

      {!sellDraft && !open && tab === "browse" ? <div className="vp-bazaar-intro"><strong>Nearby</strong><span>Second-hand listings from people in this world</span></div> : null}
      {!sellDraft && !open && tab === "browse" ? <label className="vp-inline-search"><Search size="0.875rem" aria-hidden="true" /><span className="vp-sr-only">Search listings</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nearby listings" /></label> : null}

      {sellDraft ? (
        <form className="vp-card vp-stack" style={{ gap: "0.5rem" }} onSubmit={(event) => { event.preventDefault(); void listForSale(); }}>
          <p className="vp-muted-note">This becomes part of the story. A buyer may respond, but interest is not guaranteed.</p>
          <label><span className="vp-sr-only">What are you selling</span>
            <input value={sellDraft.title} onChange={(event) => setSellDraft({ ...sellDraft, title: event.target.value })} placeholder="What are you selling?" maxLength={120} required autoFocus className="vp-input" />
          </label>
          <label><span className="vp-sr-only">Asking price</span>
            <input value={sellDraft.price} onChange={(event) => setSellDraft({ ...sellDraft, price: event.target.value })} placeholder="Asking price" maxLength={60} className="vp-input" />
          </label>
          <label><span className="vp-sr-only">Description</span>
            <textarea value={sellDraft.description} onChange={(event) => setSellDraft({ ...sellDraft, description: event.target.value })} placeholder="Describe it. Be honest, or don't." maxLength={600} rows={4} className="vp-textarea" />
          </label>
          <button type="submit" className="vp-accent-btn" disabled={busy || !sellDraft.title.trim()}>{busy ? "Posting…" : "Post listing"}</button>
        </form>
      ) : open ? (
        <div className="vp-stack" style={{ gap: "0.625rem" }}>
          {photo(open, true)}
          <div className="vp-market-headline">
            <span className="vp-market-price vp-market-price--hero">{agreed ? formatMoney(agreed, "") .trim() : open.price}</span>
            {agreed ? <span className="vp-market-was">{open.price}</span> : null}
          </div>
          <h3 className="vp-page-heading" style={{ margin: 0 }}>{open.title}</h3>
          <p className="vp-market-seller">Listed by {open.seller}</p>
          <p className="vp-page-body" style={{ whiteSpace: "pre-wrap" }}>{open.description}</p>
          <div className="vp-review-actions">
            {purchased ? <span className="vp-market-deal-state">Deal recorded</span> : <button type="button" className="vp-accent-btn" disabled={busy} onClick={() => setConfirmBuy(true)}>
              {payable ? `Agree to buy · ${formatMoney(payable, "").trim()}` : "Agree to take it"}
            </button>}
            <button type="button" className="vp-store-remove" aria-pressed={isSaved(open)} onClick={() => toggleSaved(open)}>
              {isSaved(open) ? <BookmarkCheck size="0.9rem" aria-hidden="true" /> : <Bookmark size="0.9rem" aria-hidden="true" />} {isSaved(open) ? "Saved" : "Save"}
            </button>
          </div>

          {openThread.length ? (
            <div className="vp-bubbles" style={{ maxHeight: "12rem" }}>
              {openThread.filter((turn) => !turn.text.startsWith("§")).map((turn, index) => (
                <div key={index} className={`vp-bubble ${turn.from === "you" ? "vp-bubble--self" : "vp-bubble--other"}`}>{turn.text}</div>
              ))}
            </div>
          ) : null}
          <form className="vp-composer" onSubmit={(event) => { event.preventDefault(); void message(open); }}>
            <label style={{ flex: 1, minWidth: 0 }}><span className="vp-sr-only">Message {open.seller}</span>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${open.seller}`} maxLength={800} disabled={busy} className="vp-input" />
            </label>
            <button type="submit" aria-label="Send" disabled={busy || !draft.trim()} className="vp-icon-btn" style={{ background: "var(--vp-accent)", color: "#fff" }}><Send size="1rem" aria-hidden="true" /></button>
          </form>
        </div>
      ) : (
        <>
          <div className="vp-chip-row" role="tablist" aria-label="Bazaar sections">
            <button type="button" role="tab" aria-selected={tab === "browse"} onClick={() => setTab("browse")} className={`vp-chip${tab === "browse" ? " vp-chip--active" : ""}`}>Browse</button>
            <button type="button" role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")} className={`vp-chip${tab === "saved" ? " vp-chip--active" : ""}`}>Saved{saved.length ? ` (${saved.length})` : ""}</button>
            <button type="button" role="tab" aria-selected={tab === "selling"} onClick={() => setTab("selling")} className={`vp-chip${tab === "selling" ? " vp-chip--active" : ""}`}>Selling{selling.filter((item) => !item.sold).length ? ` (${selling.filter((item) => !item.sold).length})` : ""}</button>
            <button type="button" role="tab" aria-selected={tab === "bought"} onClick={() => setTab("bought")} className={`vp-chip${tab === "bought" ? " vp-chip--active" : ""}`}>Bought{owned.length ? ` (${owned.length})` : ""}</button>
          </div>

          {tab === "saved" ? (
            saved.length ? <div className="vp-market-list">{saved.map((listing) => (
              <button key={listingKey(listing)} type="button" onClick={() => { setListings((current) => current?.some((item) => listingKey(item) === listingKey(listing)) ? current : [listing, ...(current ?? [])]); setOpenKey(listingKey(listing)); }} className="vp-market-row">
                {photo(listing)}<span className="vp-market-body"><span className="vp-market-title">{listing.title}</span><span className="vp-market-seller">{listing.seller} · {listing.price}</span></span>
              </button>
            ))}</div> : <div className="vp-empty"><span className="vp-empty-icon"><Bookmark size="1.5rem" /></span><h3>No saved listings</h3><p>Save anything you want to compare or come back to.</p></div>
          ) : tab === "selling" ? (
            <div className="vp-stack" style={{ gap: "0.5rem" }}>
              {selling.length === 0 ? <div className="vp-empty"><h3>Nothing listed</h3><p>Use + to offer something to people in this world.</p></div> : null}
              {selling.map((entry) => (
                <div key={entry.id} className={entry.offer && !entry.sold ? "vp-review-card" : "vp-ledger-row"}>
                  <span className="vp-ledger-what">
                    <span className="vp-ledger-desc">{entry.title}</span>
                    <span className="vp-ledger-meta">{entry.sold ? "Sold" : `Listed at ${entry.price}`}</span>
                    {entry.offer && !entry.sold ? (
                      <>
                        <span className="vp-ledger-meta" style={{ whiteSpace: "normal", marginTop: "0.25rem" }}>
                          <strong>{entry.offer.from}</strong>: {entry.offer.message}
                        </span>
                        <div className="vp-review-actions" style={{ marginTop: "0.5rem" }}>
                          <button type="button" className="vp-accent-btn" onClick={() => void acceptOffer(entry)}>Accept · {formatMoney(entry.offer.amount, "").trim()}</button>
                          <button type="button" className="vp-store-remove" onClick={() => persistSelling(selling.map((item) => item.id === entry.id ? { ...item, offer: null } : item))}>Decline</button>
                        </div>
                      </>
                    ) : null}
                    {!entry.sold ? <button type="button" className="vp-text-action" onClick={() => persistSelling(selling.filter((item) => item.id !== entry.id))}>Withdraw listing</button> : null}
                  </span>
                </div>
              ))}
            </div>
          ) : tab === "bought" ? (
            <div className="vp-stack" style={{ gap: "0.5rem" }}>
              {owned.length === 0 ? <div className="vp-empty"><h3>No purchases</h3><p>Deals you complete with local sellers appear here.</p></div> : null}
              {owned.map((listing, index) => (
                <div key={`${listingKey(listing)}-${index}`} className="vp-ledger-row">
                  <span className="vp-ledger-what">
                    <span className="vp-ledger-desc">{listing.title}</span>
                    <span className="vp-ledger-meta">Bought from {listing.seller}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : !listings ? (
            <div role="status" aria-label="Loading listings" className="vp-market-grid">
              {[0, 1, 2, 3].map((index) => <span key={index} className="vp-skeleton" style={{ aspectRatio: "1 / 1", borderRadius: "1rem" }} />)}
            </div>
          ) : listings.length === 0 ? (
            <p className="vp-muted-note">Nothing for sale right now. Refresh to see what turns up.</p>
          ) : (
            <>
            <div className="vp-market-grid" aria-busy={loading}>
              {visibleListings.map((listing, index) => (
                <button key={`${listingKey(listing)}-${index}`} type="button" onClick={() => setOpenKey(listingKey(listing))} className="vp-market-tile">
                  {photo(listing)}
                  <span className="vp-market-body">
                    <span className="vp-market-price">{listing.price}</span>
                    <span className="vp-market-title">{listing.title}</span>
                    <span className="vp-market-seller">{listing.seller}</span>
                  </span>
                </button>
              ))}
            </div>
            {query.trim() && visibleListings.length === 0 ? <div className="vp-empty"><span className="vp-empty-icon"><Search size="1.5rem" /></span><h3>No listings found</h3><p>Try a broader item, seller, or description.</p></div> : null}
            </>
          )}
        </>
      )}
      {confirmBuy && open ? <div role="alertdialog" aria-labelledby="market-buy-title" aria-describedby="market-buy-description" className="vp-card vp-card-body" style={{ position: "absolute", inset: "auto 0.75rem 0.75rem", zIndex: 8, boxShadow: "0 1rem 3rem rgba(0,0,0,.45)" }}><span className="vp-sheet-grip" aria-hidden="true" /><h3 id="market-buy-title">Record this deal?</h3><p id="market-buy-description">{payable ? `${formatMoney(payable, "").trim()} will leave your Banking balance. ` : ""}Bazaar does not ship items; arrange collection or delivery with {open.seller} in the listing chat.</p><div className="vp-review-actions"><button autoFocus type="button" className="vp-accent-btn" disabled={busy} onClick={() => void buy(open)}>{busy ? "Recording…" : "Agree and record"}</button><button type="button" className="vp-store-remove" disabled={busy} onClick={() => setConfirmBuy(false)}>Not yet</button></div></div> : null}
    </section>
  );
}
