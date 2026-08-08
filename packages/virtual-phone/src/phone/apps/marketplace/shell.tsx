import React from "react";
import { Send } from "lucide-react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest, recordActivity, rememberWorldFact } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { rememberPerson } from "../../platform/people";
import { charge, credit, InsufficientFundsError } from "../../platform/wallet";
import { formatMoney } from "../banking/manifest";
import { glyphFor, listingKey, parseListing, priceValue, type HaggleTurn, type Listing, type OwnListing } from "./manifest";

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `l-${Math.random().toString(36).slice(2)}`);

export function MarketplaceShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "marketplace");
  const [listings, setListings] = React.useState<Listing[] | null>(null);
  const [owned, setOwned] = React.useState<Listing[]>([]);
  const [selling, setSelling] = React.useState<OwnListing[]>([]);
  const [threads, setThreads] = React.useState<Record<string, HaggleTurn[]>>({});
  const [tab, setTab] = React.useState<"browse" | "yours">("browse");
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [sellDraft, setSellDraft] = React.useState<{ title: string; price: string; description: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setNotice(null);
    void phoneRequest<{ listings: string[] }>(`/phones/${encodeURIComponent(phoneId)}/marketplace/listings`, {
      method: "POST", body: JSON.stringify({}),
    })
      .then((response) => {
        const parsed = response.listings.map(parseListing);
        setListings(parsed);
        void store.set("listings", parsed).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The listings could not be saved."));
      })
      .catch((cause: unknown) => {
        setNotice(cause instanceof Error ? cause.message : "The marketplace could not be reached.");
        setListings((current) => current ?? []);
      })
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void Promise.all([store.get("listings"), store.get("owned"), store.get("selling"), store.get("threads")])
      .then(([cachedListings, cachedOwned, cachedSelling, cachedThreads]) => {
        if (!active) return;
        if (Array.isArray(cachedOwned)) setOwned(cachedOwned as Listing[]);
        if (Array.isArray(cachedSelling)) setSelling(cachedSelling as OwnListing[]);
        if (cachedThreads && typeof cachedThreads === "object") setThreads(cachedThreads as Record<string, HaggleTurn[]>);
        const cached = Array.isArray(cachedListings) ? cachedListings as Listing[] : [];
        if (cached.length) setListings(cached);
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

  const persistOwned = (next: Listing[]) => { setOwned(next); void store.set("owned", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Your purchases could not be saved.")); };
  const persistSelling = (next: OwnListing[]) => { setSelling(next); void store.set("selling", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "Your listings could not be saved.")); };
  const persistThreads = (next: Record<string, HaggleTurn[]>) => { setThreads(next); void store.set("threads", next).catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The seller conversation could not be saved.")); };

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
      let contactWarning = "";
      try {
        await rememberPerson(phoneId, {
          name: listing.seller,
          bio: `Sold ${listing.title} to you through Marketplace.`,
          phoneLabel: "Marketplace",
          source: "Bought from them on Marketplace",
        });
      } catch (cause) {
        contactWarning = cause instanceof Error ? cause.message : `${listing.seller} could not be added to Contacts.`;
      }
      void recordActivity(phoneId, `bought ${listing.title} from ${listing.seller}${cost ? ` for ${cost}` : ""}`)
        .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The purchase action could not be recorded."));
      void rememberWorldFact(phoneId, `Bought ${listing.title} from ${listing.seller}${cost ? ` for ${cost}` : ""}.`, "Marketplace purchase")
        .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The purchase could not be shared with the phone."));
      setNotice(contactWarning ? `Bought, but ${contactWarning}` : `Bought. ${listing.seller} is expecting you.`);
      setOpenKey(null);
      setTab("yours");
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
      const response = await phoneRequest<{ reply: string; offer: number }>(`/phones/${encodeURIComponent(phoneId)}/marketplace/message`, {
        method: "POST",
        body: JSON.stringify({ seller: listing.seller, item: listing.title, price: listing.price, history, text }),
      });
      const turns: HaggleTurn[] = [];
      if (response.reply.trim()) turns.push({ from: "seller", text: response.reply.trim() });
      // A moved price is recorded as a marker turn so it survives a reload without another field.
      if (response.offer > 0 && response.offer !== askingPrice) turns.push({ from: "seller", text: `§${response.offer}|` });
      persistThreads({ ...withMine, [key]: [...(withMine[key] ?? []), ...turns] });
      try {
        await rememberPerson(phoneId, {
          name: listing.seller,
          bio: `Selling ${listing.title} on Marketplace.`,
          phoneLabel: "Marketplace",
          source: "Messaged on Marketplace",
        });
      } catch (cause) {
        setNotice(cause instanceof Error ? cause.message : `${listing.seller} could not be added to Contacts.`);
      }
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
    void recordActivity(phoneId, `listed ${entry.title} for sale at ${entry.price}`)
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The listing action could not be recorded."));
    void rememberWorldFact(phoneId, `Listed ${entry.title} for sale at ${entry.price}.`, "Marketplace listing")
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The listing could not be shared with the phone."));
    setSellDraft(null);
    setTab("yours");
    try {
      const response = await phoneRequest<{ buyer: string; amount: number; message: string }>(`/phones/${encodeURIComponent(phoneId)}/marketplace/interest`, {
        method: "POST", body: JSON.stringify({ title: entry.title, price: entry.price, description: entry.description }),
      });
      if (response.buyer.trim() && response.amount > 0) {
        persistSelling(next.map((item) => item.id === entry.id
          ? { ...item, offer: { from: response.buyer.trim(), amount: response.amount, message: response.message } }
          : item));
        try {
          await rememberPerson(phoneId, {
            name: response.buyer,
            bio: `Interested in buying ${entry.title}.`,
            phoneLabel: "Marketplace",
            source: "Answered your Marketplace listing",
          });
        } catch (cause) {
          setNotice(cause instanceof Error ? cause.message : `${response.buyer} could not be added to Contacts.`);
        }
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
    void recordActivity(phoneId, `sold ${entry.title} to ${entry.offer.from} for ${entry.offer.amount}`)
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The sale action could not be recorded."));
    void rememberWorldFact(phoneId, `Sold ${entry.title} to ${entry.offer.from} for ${entry.offer.amount}.`, "Marketplace sale")
      .catch((cause: unknown) => setNotice(cause instanceof Error ? cause.message : "The sale could not be shared with the phone."));
    setNotice(`Sold to ${entry.offer.from}.`);
  };

  const photo = (listing: { title: string; description: string }, hero = false) => (
    <span className={`vp-market-photo${hero ? " vp-market-photo--hero" : ""}`} aria-hidden="true">
      {glyphFor({ title: listing.title, description: listing.description, price: "", seller: "" })}
    </span>
  );

  const headerTitle = sellDraft ? "List something" : open ? open.title : tab === "yours" ? "Your stuff" : "Marketplace";

  return (
    <section aria-labelledby="marketplace-title" className="vp-appview">
      <PhoneAppHeader
        title={headerTitle}
        titleId="marketplace-title"
        closeLabel="Close Marketplace"
        onBack={() => {
          if (sellDraft) return setSellDraft(null);
          if (open) return setOpenKey(null);
          if (tab === "yours") return setTab("browse");
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

      {sellDraft ? (
        <form className="vp-card vp-stack" style={{ gap: "0.5rem" }} onSubmit={(event) => { event.preventDefault(); void listForSale(); }}>
          <p className="vp-muted-note">Someone in this world will answer, or nobody will.</p>
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
            <button type="button" className="vp-accent-btn" disabled={busy} onClick={() => void buy(open)}>
              {payable ? `Buy for ${payable}` : "Take it"}
            </button>
            <button type="button" className="vp-surface-btn" onClick={() => setOpenKey(openKey)}>Ask about it</button>
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
          <div className="vp-chip-row" role="tablist" aria-label="Marketplace sections">
            <button type="button" role="tab" aria-selected={tab === "browse"} onClick={() => setTab("browse")} className={`vp-chip${tab === "browse" ? " vp-chip--active" : ""}`}>Browse</button>
            <button type="button" role="tab" aria-selected={tab === "yours"} onClick={() => setTab("yours")} className={`vp-chip${tab === "yours" ? " vp-chip--active" : ""}`}>
              Your stuff{owned.length + selling.length ? ` (${owned.length + selling.length})` : ""}
            </button>
          </div>

          {tab === "yours" ? (
            <div className="vp-stack" style={{ gap: "0.5rem" }}>
              {selling.length === 0 && owned.length === 0 ? (
                <p className="vp-muted-note">Nothing bought and nothing listed. Sell something with the + button.</p>
              ) : null}
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
                          <button type="button" className="vp-accent-btn" onClick={() => void acceptOffer(entry)}>Accept {entry.offer.amount}</button>
                          <button type="button" className="vp-store-remove" onClick={() => persistSelling(selling.filter((item) => item.id !== entry.id))}>Withdraw</button>
                        </div>
                      </>
                    ) : null}
                  </span>
                </div>
              ))}
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
            <div className="vp-market-grid" aria-busy={loading}>
              {listings.map((listing, index) => (
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
          )}
        </>
      )}
    </section>
  );
}
