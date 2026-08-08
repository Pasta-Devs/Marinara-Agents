import React from "react";
import { PhoneAppHeader } from "../../platform/app-header";
import { phoneRequest } from "../../platform/api";
import { usePhoneStore } from "../../platform/use-phone-store";
import { glyphFor, parseListing, type Listing } from "./manifest";

export function MarketplaceShell({ phoneId, onBack, onClose }: { phoneId: string; onBack: () => void; onClose: () => void }) {
  const store = usePhoneStore(phoneId, "marketplace");
  const [listings, setListings] = React.useState<Listing[] | null>(null);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    setLoading(true);
    setError(null);
    void phoneRequest<{ listings: string[] }>(`/phones/${encodeURIComponent(phoneId)}/marketplace/listings`, {
      method: "POST", body: JSON.stringify({}),
    })
      .then((response) => {
        const parsed = response.listings.map(parseListing);
        setListings(parsed);
        void store.set("listings", parsed).catch(() => undefined);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "The marketplace could not be reached.");
        setListings((current) => current ?? []);
      })
      .finally(() => setLoading(false));
  }, [phoneId, store]);

  React.useEffect(() => {
    let active = true;
    void store.get("listings").then((value) => {
      if (!active) return;
      const cached = Array.isArray(value) ? value.filter((item): item is Listing => !!item && typeof (item as Listing).title === "string") : [];
      if (cached.length) setListings(cached);
      else refresh();
    }).catch(() => { if (active) refresh(); });
    return () => { active = false; };
  }, [store, refresh]);

  const open = openIndex !== null && listings ? listings[openIndex] ?? null : null;

  /**
   * The image slot renders whether or not an image exists. Step 11.3 fills it; until then the
   * caption and source carry the listing on their own, which is a finished page rather than a
   * placeholder.
   */
  const photo = (listing: Listing, large = false) => (
    <span className="vp-market-photo" style={large ? { fontSize: "3rem", minHeight: "8rem" } : undefined} aria-hidden="true">
      {glyphFor(listing)}
    </span>
  );

  return (
    <section aria-labelledby="marketplace-title" className="vp-appview">
      <PhoneAppHeader
        title={open ? open.title : "Marketplace"}
        titleId="marketplace-title"
        closeLabel="Close Marketplace"
        onBack={() => open ? setOpenIndex(null) : onBack()}
        onClose={onClose}
        actions={open ? [] : [{ id: "refresh-listings", icon: "refresh", label: "Refresh listings", kind: "button", disabled: loading, reason: "Refreshing" }]}
        onAction={(actionId) => { if (actionId === "refresh-listings") refresh(); }}
      />
      {error ? <p role="alert" className="vp-muted-note">{error}</p> : null}
      {open ? (
        <div className="vp-stack" style={{ gap: "0.625rem" }}>
          {photo(open, true)}
          <h3 className="vp-page-heading">{open.title}</h3>
          <p className="vp-thread-name">{open.price}</p>
          <p className="vp-muted-note">Listed by {open.seller}</p>
          <div className="vp-page-body"><p style={{ whiteSpace: "pre-wrap" }}>{open.description}</p></div>
        </div>
      ) : !listings ? (
        <div role="status" aria-label="Loading listings" className="vp-stack" style={{ gap: "0.5rem" }}>
          {[0, 1, 2].map((index) => <span key={index} className="vp-skeleton vp-skeleton--block" />)}
        </div>
      ) : listings.length === 0 ? (
        <p className="vp-muted-note">Nothing for sale right now. Refresh to see what turns up.</p>
      ) : (
        <div className="vp-stack" style={{ gap: "0.5rem" }} aria-busy={loading}>
          {listings.map((listing, index) => (
            <button key={`${listing.title}-${index}`} type="button" onClick={() => setOpenIndex(index)} className="vp-card vp-card-row">
              {photo(listing)}
              <span className="vp-card-body">
                <h3>{listing.title}</h3>
                <p>{listing.price} · {listing.seller}</p>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
