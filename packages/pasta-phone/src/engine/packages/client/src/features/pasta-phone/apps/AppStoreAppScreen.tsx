import { AppScreenHeader } from "./AppScreenHeader";

const MOCK_TILES = [
  { id: "1", name: "Weatherly", tagline: "Fake forecasts, always sunny." },
  { id: "2", name: "MapQuestly", tagline: "Placeholder navigation app." },
  { id: "3", name: "Notely", tagline: "Mock notes tile, no install logic." },
  { id: "4", name: "Tuneify", tagline: "Placeholder music tile." },
];

interface AppStoreAppScreenProps {
  onBack: () => void;
}

export function AppStoreAppScreen({ onBack }: AppStoreAppScreenProps) {
  return (
    <div className="flex h-full flex-col">
      <AppScreenHeader title="App Store" onBack={onBack} />
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3">
        {MOCK_TILES.map((tile) => (
          <div
            key={tile.id}
            className="flex flex-col gap-1 rounded-xl border border-dashed border-[var(--marinara-chat-chrome-panel-border)] p-3"
          >
            <span className="text-xs font-semibold text-[var(--marinara-chat-chrome-panel-title)]">{tile.name}</span>
            <span className="text-[0.625rem] text-[var(--marinara-chat-chrome-panel-muted)]">{tile.tagline}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
