import { SlpSheet } from "../../modules/chrome/SlpSheet";
import type { SlpLiveMenuItem } from "./slp-live-contract";

export function SlpLiveMenuSheet({
  items,
  pending,
  onBuy,
  onClose,
  t,
}: {
  items: SlpLiveMenuItem[];
  pending: boolean;
  onBuy: (item: SlpLiveMenuItem) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  return (
    <SlpSheet open onClose={onClose} closeDisabled={pending} title={t("ui.slurp.live.menuTitle")}>
      <div className="px-2 pb-2">
        {items.map((item) => (
          <div key={item.id} className="flex min-h-14 items-center gap-2 border-t border-[var(--border)] py-2">
            <span className="min-w-0 flex-1 text-sm font-medium">
              {item.label}
              {item.picture ? " 📷" : ""}
            </span>
            <span className="text-sm">{item.price}</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => onBuy(item)}
              className="min-h-11 rounded-lg bg-[var(--noodle-accent)] px-4 text-sm font-semibold text-[var(--noodle-accent-foreground)] disabled:opacity-50"
            >
              {t("ui.slurp.live.buy")}
            </button>
          </div>
        ))}
      </div>
    </SlpSheet>
  );
}
