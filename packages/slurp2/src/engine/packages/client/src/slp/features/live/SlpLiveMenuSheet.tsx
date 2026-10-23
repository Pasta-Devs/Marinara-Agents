import { useEffect, useRef } from "react";
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
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-menu-title"
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-xl bg-[var(--background)] p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id="live-menu-title" className="text-lg font-bold">
            {t("ui.slurp.live.menuTitle")}
          </h2>
          <button ref={closeButton} type="button" className="min-h-11 px-3" onClick={onClose}>
            {t("ui.slurp.live.close")}
          </button>
        </div>
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
              className="min-h-11 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {t("ui.slurp.live.buy")}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
