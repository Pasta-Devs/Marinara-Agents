import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { SlpCreatorConnectionCounts } from "../../features/audience/slp-audience-contract";
import {
  filterAndSortSlurpCreators,
  SLURP_DISCOVERY_TAGS,
  type SlurpDiscoverSort,
} from "../../features/discovery/slp-discovery";
import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types";
import { useSlurpSettings } from "../../features/settings/slp-settings-contract";
import { parsePrice, type SlurpViewerCreator } from "./SlpHomeHelpers";

/**
 * The Discover filter bar's own state and everything derived from it.
 *
 * Six filters, the list they produce and the reset that clears them all sat inline in the Hub and
 * were the only reason half its state existed. Nothing outside the bar reads them, so they live
 * together here.
 */
export function useSlurpHubDiscoveryFilters({
  discoveredCreators,
  connectionCounts,
  search,
  searchTerm,
  onSearchChange,
}: {
  discoveredCreators: SlurpViewerCreator[];
  connectionCounts: SlpCreatorConnectionCounts | undefined;
  search: string;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}) {
  const [notSubscribed, setNotSubscribed] = useState(false);
  const [genders, setGenders] = useState<Set<SlurpDiscoveryGender>>(() => new Set());
  const [tags, setTags] = useState<Set<string>>(() => new Set());
  const [minimumPrice, setMinimumPrice] = useState("");
  const [maximumPrice, setMaximumPrice] = useState("");
  const [sort, setSort] = useState<SlurpDiscoverSort>("recommended");

  const filtered = useMemo(
    () =>
      filterAndSortSlurpCreators(
        discoveredCreators,
        {
          search,
          notSubscribed,
          genders,
          tags,
          minimumPrice: parsePrice(minimumPrice),
          maximumPrice: parsePrice(maximumPrice),
          sort,
        },
        connectionCounts,
      ),
    [connectionCounts, genders, maximumPrice, minimumPrice, notSubscribed, sort, tags, discoveredCreators, search],
  );
  const active = Boolean(searchTerm || notSubscribed || genders.size || tags.size || minimumPrice || maximumPrice);
  const discoveryTagSettings = useSlurpSettings().data?.discoveryTags;
  const customTags = useMemo(() => {
    const curated = new Set<string>(discoveryTagSettings?.map((entry) => entry.tag) ?? SLURP_DISCOVERY_TAGS);
    return [...new Set(discoveredCreators.flatMap((creator) => creator.profile.tags ?? []))]
      .filter((tag) => !curated.has(tag))
      .sort((left, right) => left.localeCompare(right));
  }, [discoveredCreators, discoveryTagSettings]);
  const toggle = <T>(setter: Dispatch<SetStateAction<Set<T>>>, value: T) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const clear = () => {
    onSearchChange("");
    setNotSubscribed(false);
    setGenders(new Set());
    setTags(new Set());
    setMinimumPrice("");
    setMaximumPrice("");
  };

  return {
    notSubscribed,
    setNotSubscribed,
    genders,
    setGenders,
    tags,
    setTags,
    minimumPrice,
    setMinimumPrice,
    maximumPrice,
    setMaximumPrice,
    sort,
    setSort,
    filtered,
    active,
    customTags,
    toggle,
    clear,
  };
}
