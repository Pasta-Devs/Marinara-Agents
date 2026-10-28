import { Check, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { useSlurpSettings } from "../settings/slp-settings-contract";
import {
  groupSlurpDiscoveryTags,
  SLURP_DISCOVER_PRICE_BANDS,
  type SlurpDiscoverPriceBand,
  type SlurpDiscoverSort,
} from "./slp-discovery";
import type { SlurpDiscoveryGender } from "../../base/state/slp-state-types";
import { cn } from "../../../lib/utils";
import { SlpButton, SlpChip } from "../../modules/chrome/SlpButton";
import { SlpRadioRow, SlpSheet } from "../../modules/chrome/SlpSheet";
import { SLP_TYPE } from "../../base/chrome/SlpChrome";
import { SlurpCoinAmount } from "../../modules/coin/SlpCoin";

const priceBandOf = (minimum: string, maximum: string): SlurpDiscoverPriceBand | null =>
  SLURP_DISCOVER_PRICE_BANDS.find(
    (band) => String(band.minimum ?? "") === minimum.trim() && String(band.maximum ?? "") === maximum.trim(),
  )?.id ?? null;

/** Sentence case for tags that have no translation (a Creator's own tags arrive as typed). */
const sentenceCase = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1);

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-[var(--noodle-divider)] py-3 first:border-t-0 first:pt-0">
      <h3 className={cn(SLP_TYPE.meta, "px-1 font-semibold text-[var(--slurp-muted)]")}>{title}</h3>
      {children}
    </section>
  );
}

/**
 * Discover's filters: one scrollable chip row (Filters · All · New · Popular · the common tags) and a
 * glass sheet with the rest (subscription, gender, price, sort, every tag). Selected = tint + ring.
 */
export function SlurpDiscoverToolbar({
  notSubscribed,
  onNotSubscribedChange,
  genders,
  onGenderToggle,
  minimumPrice,
  maximumPrice,
  onMinimumPriceChange,
  onMaximumPriceChange,
  tags,
  rowTags,
  customTags,
  onTagToggle,
  onTagsClear,
  sort,
  onSortChange,
  sheetFilterCount,
  filteredCount,
  onClear,
}: {
  notSubscribed: boolean;
  onNotSubscribedChange: (value: boolean) => void;
  genders: ReadonlySet<SlurpDiscoveryGender>;
  onGenderToggle: (value: SlurpDiscoveryGender) => void;
  minimumPrice: string;
  maximumPrice: string;
  onMinimumPriceChange: (value: string) => void;
  onMaximumPriceChange: (value: string) => void;
  tags: ReadonlySet<string>;
  /** Tags that get a chip in the row. */
  rowTags: readonly string[];
  customTags: readonly string[];
  onTagToggle: (value: string) => void;
  onTagsClear: () => void;
  sort: SlurpDiscoverSort;
  onSortChange: (value: SlurpDiscoverSort) => void;
  /** Filters set in the sheet that the row does not show (the number on the Filters chip). */
  sheetFilterCount: number;
  filteredCount: number;
  onClear: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const tagGroups = groupSlurpDiscoveryTags(useSlurpSettings().data?.discoveryTags);
  const tagLabel = (tag: string) => sentenceCase(localizeUi(`ui.slurp.tags.${tag}`, { defaultValue: tag }));
  const priceBand = priceBandOf(minimumPrice, maximumPrice);
  const setPriceBand = (id: SlurpDiscoverPriceBand | null) => {
    const band = SLURP_DISCOVER_PRICE_BANDS.find((entry) => entry.id === id);
    onMinimumPriceChange(band?.minimum == null ? "" : String(band.minimum));
    onMaximumPriceChange(band?.maximum == null ? "" : String(band.maximum));
  };
  // New and Popular are the two sorts worth a chip; tapping the selected one goes back to All.
  const quickSort = (value: "newest" | "liked") => onSortChange(sort === value ? "recommended" : value);
  const filtersLabel = localizeUi("ui.slurp.discover.filters", { defaultValue: "Filters" });

  return (
    <>
      <div
        role="toolbar"
        aria-label={filtersLabel}
        className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [&>*]:snap-start"
      >
        <SlpChip
          selected={sheetFilterCount > 0}
          aria-pressed={undefined}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen(true)}
          aria-label={sheetFilterCount > 0 ? `${filtersLabel}, ${sheetFilterCount}` : filtersLabel}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {filtersLabel}
          {sheetFilterCount > 0 && (
            <span
              aria-hidden="true"
              className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--noodle-accent)] px-1 text-[11px] font-extrabold text-[var(--slurp-on-accent)]"
            >
              {sheetFilterCount}
            </span>
          )}
        </SlpChip>
        <span aria-hidden="true" className="my-2.5 w-px bg-[var(--noodle-divider)]" />
        <SlpChip
          selected={tags.size === 0 && sort === "recommended"}
          onClick={() => {
            onTagsClear();
            onSortChange("recommended");
          }}
        >
          {localizeUi("ui.slurp.discover.chip.all", { defaultValue: "All" })}
        </SlpChip>
        <SlpChip selected={sort === "newest"} onClick={() => quickSort("newest")}>
          {localizeUi("ui.slurp.discover.chip.new", { defaultValue: "New" })}
        </SlpChip>
        <SlpChip selected={sort === "liked"} onClick={() => quickSort("liked")}>
          {localizeUi("ui.slurp.discover.chip.popular", { defaultValue: "Popular" })}
        </SlpChip>
        {rowTags.map((tag) => (
          <SlpChip key={tag} selected={tags.has(tag)} onClick={() => onTagToggle(tag)}>
            {tagLabel(tag)}
          </SlpChip>
        ))}
      </div>

      <SlpSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={filtersLabel}>
        <div className="px-1 pb-2 pt-2">
          <SheetSection title={localizeUi("ui.slurp.discover.show", { defaultValue: "Show" })}>
            <div className="flex flex-wrap gap-2">
              <SlpChip selected={notSubscribed} onClick={() => onNotSubscribedChange(!notSubscribed)}>
                {notSubscribed && <Check size={14} aria-hidden="true" />}
                {localizeUi("ui.slurp.discover.notSubscribed", { defaultValue: "Not subscribed" })}
              </SlpChip>
            </div>
          </SheetSection>
          <SheetSection title={localizeUi("ui.slurp.discover.genderLabel", { defaultValue: "Gender" })}>
            <div className="flex flex-wrap gap-2">
              {(["female", "male", "other"] as const).map((gender) => (
                <SlpChip key={gender} selected={genders.has(gender)} onClick={() => onGenderToggle(gender)}>
                  {localizeUi(`ui.slurp.discover.gender.${gender}`, { defaultValue: gender })}
                </SlpChip>
              ))}
            </div>
          </SheetSection>
          <SheetSection title={localizeUi("ui.slurp.discover.priceWeek", { defaultValue: "Price per week" })}>
            <div className="flex flex-wrap gap-2">
              <SlpChip
                selected={priceBand === null && !minimumPrice && !maximumPrice}
                onClick={() => setPriceBand(null)}
              >
                {localizeUi("ui.slurp.discover.priceAny", { defaultValue: "Any" })}
              </SlpChip>
              {SLURP_DISCOVER_PRICE_BANDS.map((band) => (
                <SlpChip key={band.id} selected={priceBand === band.id} onClick={() => setPriceBand(band.id)}>
                  {/* One span, so the chip's flex gap does not split the words from the amount. */}
                  <span>
                    {band.minimum === null ? (
                      <>
                        {localizeUi("ui.slurp.discover.priceUpTo", { defaultValue: "Up to" })}{" "}
                        <SlurpCoinAmount amount={band.maximum} />
                      </>
                    ) : band.maximum === null ? (
                      <>
                        <SlurpCoinAmount amount={band.minimum} />{" "}
                        {localizeUi("ui.slurp.discover.priceAndUp", { defaultValue: "and up" })}
                      </>
                    ) : (
                      <>
                        {band.minimum}–<SlurpCoinAmount amount={band.maximum} />
                      </>
                    )}
                  </span>
                </SlpChip>
              ))}
            </div>
          </SheetSection>
          <SheetSection title={localizeUi("ui.slurp.discover.sortBy", { defaultValue: "Sort by" })}>
            <div role="radiogroup" aria-label={localizeUi("ui.slurp.discover.sortBy", { defaultValue: "Sort by" })}>
              {(["recommended", "newest", "liked", "subscribed"] as const).map((value) => (
                <SlpRadioRow
                  key={value}
                  name="slurp-discover-sort"
                  checked={sort === value}
                  onChange={() => onSortChange(value)}
                >
                  {localizeUi(`ui.slurp.discover.sort.${value}`, { defaultValue: value })}
                </SlpRadioRow>
              ))}
            </div>
          </SheetSection>
          {[...tagGroups, ...(customTags.length > 0 ? [{ id: "custom", tags: [...customTags] }] : [])].map((group) => (
            <SheetSection
              key={group.id}
              title={localizeUi(`ui.slurp.discover.tagGroup.${group.id}`, { defaultValue: sentenceCase(group.id) })}
            >
              <div className="flex flex-wrap gap-2">
                {group.tags.map((tag) => (
                  <SlpChip key={tag} selected={tags.has(tag)} onClick={() => onTagToggle(tag)}>
                    {tagLabel(tag)}
                  </SlpChip>
                ))}
              </div>
            </SheetSection>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--noodle-divider)] px-1 pt-3">
          <SlpButton variant="tertiary" onClick={onClear}>
            {localizeUi("ui.slurp.discover.clearFilters", { defaultValue: "Clear filters" })}
          </SlpButton>
          <SlpButton variant="secondary" onClick={() => setSheetOpen(false)}>
            {localizeUi("ui.slurp.discover.showCount", {
              count: filteredCount,
              defaultValue: `Show ${filteredCount} creators`,
            })}
          </SlpButton>
        </div>
      </SlpSheet>
    </>
  );
}
