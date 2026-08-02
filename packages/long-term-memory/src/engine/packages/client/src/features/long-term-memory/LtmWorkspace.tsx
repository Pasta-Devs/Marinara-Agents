import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type LtmWorkspacePane = "navigator" | "workbench" | "inspector";

const compactBreakpointRem = 48;
const wideBreakpointRem = 64;

type WorkspaceSlot = {
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

type LtmWorkspaceBaseProps = {
  activeMobilePane: LtmWorkspacePane;
  onMobilePaneChange: (pane: LtmWorkspacePane) => void;
  switcherLabel: string;
  workbench: WorkspaceSlot;
  className?: string;
};

type LtmWorkspaceProps = LtmWorkspaceBaseProps &
  (
    | { navigator?: WorkspaceSlot; inspector?: never }
    | { navigator: WorkspaceSlot; inspector?: WorkspaceSlot }
  );

export function LtmWorkspace({
  activeMobilePane,
  onMobilePaneChange,
  switcherLabel,
  navigator,
  workbench,
  inspector,
  className = "",
}: LtmWorkspaceProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [rootFontSize, setRootFontSize] = useState(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
  );
  const widthRem = width / rootFontSize;
  const panes = [
    ...(navigator ? (["navigator"] as const) : []),
    "workbench" as const,
    ...(inspector ? (["inspector"] as const) : []),
  ];
  const slots = { navigator, workbench, inspector };
  const tabPanes = widthRem < compactBreakpointRem
    ? panes
    : inspector && widthRem < wideBreakpointRem
      ? panes.filter((pane) => pane !== "navigator")
      : [];
  const availablePanes = tabPanes.filter((pane) => !slots[pane]?.disabled);
  const nextAvailablePane = availablePanes.includes(activeMobilePane)
    ? undefined
    : availablePanes[0];
  const effectiveActivePane = nextAvailablePane ?? activeMobilePane;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setWidth(container.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(container);
    const rootObserver = new MutationObserver(() =>
      setRootFontSize(
        Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      ),
    );
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => {
      observer.disconnect();
      rootObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (tabPanes.length && nextAvailablePane)
      onMobilePaneChange(nextAvailablePane);
  }, [nextAvailablePane, onMobilePaneChange, tabPanes.length]);

  const handleTabKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    pane: LtmWorkspacePane,
  ) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
      return;
    event.preventDefault();
    const index = availablePanes.indexOf(pane);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? availablePanes.length - 1
          : (index +
              (event.key === "ArrowRight" ? 1 : -1) +
              availablePanes.length) %
            availablePanes.length;
    const next = availablePanes[nextIndex];
    if (!next) return;
    onMobilePaneChange(next);
    requestAnimationFrame(() =>
      workspaceRef.current
        ?.querySelector<HTMLElement>(`[data-ltm-workspace-pane-tab="${next}"]`)
        ?.focus({ preventScroll: true }),
    );
  };

  return (
    <div
      ref={containerRef}
      data-ltm-workspace-container
      className={`min-h-0 min-w-0 ${className}`}
      style={{ containerName: "ltm-workspace", containerType: "inline-size" }}
    >
      <style>{`
        [data-ltm-workspace] {
          display: grid;
          gap: 1rem;
        }
        [data-ltm-workspace] [data-ltm-workspace-pane] {
          display: none;
          min-width: 0;
          min-height: 0;
        }
        [data-ltm-workspace] [data-ltm-workspace-pane][data-active="true"] {
          display: block;
        }
        [data-ltm-workspace] [data-ltm-control="icon-button"].mari-editor-action--primary {
          height: 2.75rem;
          min-height: 2.75rem;
          width: 2.75rem;
          min-width: 2.75rem;
        }
        @container ltm-workspace (min-width: ${compactBreakpointRem}rem) {
          [data-ltm-workspace] [data-ltm-workspace-pane] {
            min-height: 0;
            overflow: visible;
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="false"][data-ltm-workspace-navigator="true"] {
            grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr);
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="false"] [data-ltm-workspace-pane] {
            display: block !important;
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="false"] [data-ltm-workspace-switcher] {
            display: none;
          }
        }
        @container ltm-workspace (min-width: ${compactBreakpointRem}rem) and (max-width: ${wideBreakpointRem - 0.01}rem) {
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] {
            grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr);
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] [data-ltm-workspace-switcher] {
            grid-column: 2;
            grid-row: 1;
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] [data-ltm-workspace-pane="navigator"] {
            display: block !important;
            grid-column: 1;
            grid-row: 1 / 3;
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] [data-ltm-workspace-pane]:not([data-ltm-workspace-pane="navigator"])[data-active="true"] {
            display: block !important;
            grid-column: 2;
            grid-row: 2;
          }
        }
        @container ltm-workspace (min-width: ${wideBreakpointRem}rem) {
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] {
            grid-template-columns: minmax(17rem, 20rem) minmax(0, 1fr) minmax(16rem, 22rem);
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] [data-ltm-workspace-pane] {
            display: block !important;
          }
          [data-ltm-workspace][data-ltm-workspace-inspector="true"] [data-ltm-workspace-switcher] {
            display: none;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-ltm-workspace] *,
          [data-ltm-workspace] *::before,
          [data-ltm-workspace] *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
      <div
        ref={workspaceRef}
        data-ltm-workspace
        data-ltm-workspace-inspector={inspector ? "true" : "false"}
        data-ltm-workspace-navigator={navigator ? "true" : "false"}
      >
        {availablePanes.length ? (
          <div
            data-ltm-workspace-switcher
            className="mari-editor-tab-rail flex gap-1 rounded-lg border p-1"
            role="tablist"
            aria-label={switcherLabel}
          >
            {availablePanes.map((pane) => {
              const slot = slots[pane];
              if (!slot) return null;
              const paneId = `${id}-${pane}`;
              const tabId = `${paneId}-tab`;
              return (
                <button
                  key={pane}
                  id={tabId}
                  type="button"
                  role="tab"
                  tabIndex={effectiveActivePane === pane ? 0 : -1}
                  disabled={slot.disabled}
                  aria-selected={effectiveActivePane === pane}
                  aria-controls={paneId}
                  data-ltm-workspace-pane-tab={pane}
                  data-active={effectiveActivePane === pane}
                  className="mari-editor-tab min-h-11 min-w-0 flex-1 rounded-md px-2 text-xs font-semibold"
                  onClick={() => onMobilePaneChange(pane)}
                  onKeyDown={(event) => handleTabKey(event, pane)}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {panes.map((pane) => {
          const slot = slots[pane];
          if (!slot) return null;
          const paneId = `${id}-${pane}`;
          const tabbed = availablePanes.includes(pane);
          return (
            <section
              key={pane}
              id={paneId}
              role={tabbed ? "tabpanel" : undefined}
              aria-labelledby={tabbed ? `${paneId}-tab` : undefined}
              tabIndex={pane === "workbench" ? -1 : undefined}
              data-ltm-workspace-pane={pane}
              data-active={effectiveActivePane === pane}
              className={effectiveActivePane === pane ? "block" : "hidden"}
            >
              {slot.content}
            </section>
          );
        })}
      </div>
    </div>
  );
}
