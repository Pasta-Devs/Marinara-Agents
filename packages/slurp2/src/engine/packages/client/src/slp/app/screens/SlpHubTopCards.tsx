import { SlpLiveNowRow } from "../../features/live/SlpLiveNowRow";
import { SlpExtrasOfferCard } from "../../features/settings/SlpExtrasOffer";

/** The cards above the feed: who is live now, then the extras offer. */
export function SlpHubTopCards() {
  return (
    <>
      <SlpLiveNowRow />
      <SlpExtrasOfferCard />
    </>
  );
}
