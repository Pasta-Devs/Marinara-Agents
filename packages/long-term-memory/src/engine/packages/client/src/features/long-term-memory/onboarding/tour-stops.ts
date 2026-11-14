import type { LongTermMemoryDestination } from "../types";
import type { LtmOnboardingSprite } from "./assets";

export type LtmTourStopSpec = {
  id: string;
  sprite: LtmOnboardingSprite;
  /** The 64x96 strip of the same picture for the bubble docked on a phone. */
  phoneSprite: LtmOnboardingSprite;
  titleKey: string;
  textKey: string;
  /** The tab the stop opens before it points; null keeps the current tab. */
  destination: LongTermMemoryDestination | null;
  /** Selectors of the control the spotlight rings, tried in order; empty centres the bubble with no spotlight. */
  targets: string[];
  /** A control the stop presses once its tab is open, unless it is already pressed (the Vault's Graph view). */
  press?: string;
  /** The control pressed again when the tour leaves the stop, so the page is left as it was found. */
  restore?: string;
};

const tab = (destination: LongTermMemoryDestination) =>
  `[data-ltm-control="navigation"][data-ltm-destination="${destination}"]`;

// The nine stops of Mari's tour, in order. A stop whose control is not on screen keeps its bubble and
// drops the spotlight. An empty Vault draws a made-up example graph for the Linked memories stop.
export const LTM_TOUR_STOPS: readonly LtmTourStopSpec[] = [
  {
    id: "welcome",
    sprite: "welcome-bell",
    phoneSprite: "welcome-bell-small",
    titleKey: "ui.longTermMemory.tour.welcomeTitle",
    textKey: "ui.longTermMemory.tour.welcomeText",
    destination: null,
    targets: [],
  },
  {
    id: "vault",
    sprite: "vault-browse",
    phoneSprite: "vault-browse-small",
    titleKey: "ui.longTermMemory.tour.vaultTitle",
    textKey: "ui.longTermMemory.tour.vaultText",
    destination: "vault",
    targets: ['[data-ltm-surface="vault"]', tab("vault")],
  },
  {
    id: "sources",
    sprite: "sources-crate",
    phoneSprite: "sources-crate-small",
    titleKey: "ui.longTermMemory.tour.sourcesTitle",
    textKey: "ui.longTermMemory.tour.sourcesText",
    destination: "sources",
    targets: [tab("sources")],
  },
  {
    id: "review",
    sprite: "review-stamp",
    phoneSprite: "review-stamp-small",
    titleKey: "ui.longTermMemory.tour.reviewTitle",
    textKey: "ui.longTermMemory.tour.reviewText",
    destination: "review",
    targets: [tab("review")],
  },
  {
    id: "linked",
    // The stop opens the Graph itself and rings it; leaving the stop puts the Vault back on List.
    sprite: "graph-model",
    phoneSprite: "graph-model-small",
    titleKey: "ui.longTermMemory.tour.linkedTitle",
    textKey: "ui.longTermMemory.tour.linkedText",
    destination: "vault",
    press: "[data-ltm-vault-view-graph]",
    restore: "[data-ltm-vault-view-list]",
    targets: ["[data-ltm-graph]"],
  },
  {
    // The header chip shows while Mari reads; the tour shows it as a still preview when she is idle.
    id: "reading",
    sprite: "reading-tape",
    phoneSprite: "reading-tape-small",
    titleKey: "ui.longTermMemory.tour.readingTitle",
    textKey: "ui.longTermMemory.tour.readingText",
    destination: null,
    targets: ["[data-ltm-reading-chip]"],
  },
  {
    // The chat is outside this page, so the bubble itself shows the chat's Long-Term Memory card.
    id: "inchat",
    sprite: "inchat-bubble",
    phoneSprite: "inchat-bubble-small",
    titleKey: "ui.longTermMemory.tour.inchatTitle",
    textKey: "ui.longTermMemory.tour.inchatText",
    destination: null,
    targets: [],
  },
  {
    id: "activity",
    sprite: "activity-log",
    phoneSprite: "activity-log-small",
    titleKey: "ui.longTermMemory.tour.activityTitle",
    textKey: "ui.longTermMemory.tour.activityText",
    destination: "activity",
    targets: [tab("activity")],
  },
  {
    id: "settings",
    sprite: "settings-dials",
    phoneSprite: "settings-dials-small",
    titleKey: "ui.longTermMemory.tour.settingsTitle",
    textKey: "ui.longTermMemory.tour.settingsText",
    destination: "settings",
    targets: [tab("settings")],
  },
];
