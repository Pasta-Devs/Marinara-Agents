// ──────────────────────────────────────────────
// Otome Forge: the Home tab. Reads the host props, applies the look, and routes between the screens on the stage.
// ──────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Heart, RotateCcw } from "lucide-react";
import { useOtomeApi } from "./api";
import { Dock } from "./components/Dock";
import { LookSwitch } from "./components/LookSwitch";
import { Stage } from "./components/Stage";
import { TopBar } from "./components/TopBar";
import { useOtomeIndex } from "./hooks/use-index";
import { useLook, type LookPreference } from "./hooks/use-look";
import { OtomePropsContext, readOtomeProps } from "./props";
import { Placeholder } from "./screens/Placeholder";
import { DOCK_SCREENS, RUN_SCREENS, type DockScreen, type ScreenId } from "./screens/screens";
import { Welcome } from "./screens/Welcome";

const DOCKED: ReadonlySet<ScreenId> = new Set<ScreenId>(["home", ...DOCK_SCREENS]);

interface ScreensProps {
  lookPreference: LookPreference;
  onLookPreference: (preference: LookPreference) => void;
}

function OtomeForgeScreens({ lookPreference, onLookPreference }: ScreensProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const index = useOtomeIndex();
  const [chosen, setChosen] = useState<ScreenId | null>(null);
  const [settingsReturn, setSettingsReturn] = useState<ScreenId>("picker");
  const screenRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  // Set by the player's own navigation or retry, so focus moves only then (never on the first mount, which would take
  // it from the Engine). The button they pressed often leaves with the old screen, so focus lands on the new screen's
  // heading (every screen starts with an <h1 tabIndex={-1}>), which also announces it; after a failed retry, on Try again.
  const navigated = useRef(false);
  const activeRun = index.data?.activeRun ?? null;
  const screen: ScreenId = chosen ?? (activeRun ? "home" : "picker");
  // A failed background refetch keeps the screen it already loaded; only a first load that failed shows the error.
  const failed = index.isError && index.data === undefined;
  const view = index.isPending ? "loading" : failed ? "error" : screen;

  useEffect(() => {
    if (!navigated.current || view === "loading") return;
    navigated.current = false;
    const target = view === "error" ? retryRef.current : screenRef.current?.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
  }, [view]);

  const go = (next: ScreenId) => {
    if (next !== screen) navigated.current = true;
    setChosen(next);
  };

  if (index.isPending) {
    return (
      <>
        <TopBar />
        <div className="of-center" role="status">
          <Heart className="of-pulse" size={30} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
          <p className="of-body">{t("ui.otomeForge.common.loading")}</p>
        </div>
      </>
    );
  }
  if (failed) {
    return (
      <>
        <TopBar />
        <div className="of-center">
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(index.error, "ui.otomeForge.common.loadFailed")}</p>
            <div className="of-actions">
              {/* aria-disabled, not disabled: a disabled button would drop the focus the player just gave it. */}
              <button
                ref={retryRef}
                type="button"
                className="of-button of-button--quiet of-glass"
                aria-disabled={index.isFetching}
                onClick={() => {
                  if (index.isFetching) return;
                  navigated.current = true;
                  void index.refetch();
                }}
              >
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                {t("ui.otomeForge.common.retry")}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const openSettings = () => {
    setSettingsReturn(screen);
    go("settings");
  };
  const selectDockScreen = (next: DockScreen) => go(next === screen ? "home" : next);

  // Where Back leads. The opening screen and the dock's screens have none; with no story yet, Home is a preview of the
  // frame and leads back to the opening screen.
  const back: Partial<Record<ScreenId, ScreenId>> = {
    settings: settingsReturn,
    setup: "picker",
    forge: "picker",
    phone: "home",
    home: activeRun ? undefined : "picker",
  };
  const backTo = back[screen];
  const content =
    screen === "picker" ? (
      <Welcome onLookAround={() => go("home")} />
    ) : screen === "settings" ? (
      <Placeholder screen="settings">
        <LookSwitch preference={lookPreference} onChange={onLookPreference} />
      </Placeholder>
    ) : (
      <Placeholder screen={screen} />
    );

  return (
    <>
      <TopBar
        // ponytail: no run data until world setup (M1) writes the run; then this shows his chip and the wallet.
        run={RUN_SCREENS.has(screen) ? { li: null, starlight: null } : null}
        onBack={backTo ? () => go(backTo) : undefined}
        onHome={() => go("home")}
        onSettings={screen === "settings" ? undefined : openSettings}
      />
      <div key={screen} ref={screenRef} className="of-screen">
        {content}
      </div>
      {DOCKED.has(screen) ? <Dock active={screen} onSelect={selectDockScreen} /> : null}
    </>
  );
}

export function OtomeForgeView({ capabilityProps }: { capabilityProps: Record<string, unknown> }) {
  const props = readOtomeProps(capabilityProps);
  const { look, preference, setPreference } = useLook();
  // The language the text is actually in (English until a locale ships), not the Engine's: the host tags its element
  // with the Engine locale, and a screen reader would read English with that language's voice. Its direction follows
  // that language too, so English under a right-to-left Engine locale keeps its punctuation where it belongs.
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  return (
    <div className="of-root" data-look={look} dir={i18n.dir(language)} lang={language} data-otome-forge-root="">
      <OtomePropsContext.Provider value={props}>
        <Stage>
          <OtomeForgeScreens lookPreference={preference} onLookPreference={setPreference} />
        </Stage>
      </OtomePropsContext.Provider>
    </div>
  );
}
