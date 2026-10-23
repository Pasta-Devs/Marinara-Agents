import type { SlurpLiveMenuItem } from "./slp-live.js";

export function slurpLiveMenuItems(level: number, topics: readonly string[], ppvPrice = 25): SlurpLiveMenuItem[] {
  // TODO(claude): item wording
  const labels = [
    "Request 1",
    "Request 2",
    "Request 3",
    "Request 4",
    "Request 5",
    "Request 6",
    "Request 7",
    "Request 8",
  ];
  return labels.slice(0, Math.min(8, 5 + Math.max(0, Math.floor(level)))).map((label, index) => ({
    id: `item-${index + 1}`,
    label: topics[index % topics.length] ? `${label}: ${topics[index % topics.length]}` : label,
    price: Math.max(1, Math.round(ppvPrice * (0.5 + index * 0.25))),
    picture: index % 3 === 2,
  }));
}
