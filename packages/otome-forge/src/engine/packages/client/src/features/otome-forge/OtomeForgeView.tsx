// ──────────────────────────────────────────────
// Otome Forge: the Home tab. Reads the host props, applies the look, and routes between the screens on the stage.
// ──────────────────────────────────────────────
// The active story's audio (M2b, hooks/use-otome-audio.ts) is held here for every screen, so its player and its music
// carry on from Home to the Story screen, the reader and back: the reader's own provider then adds nothing. Its music
// claims each scene's cue; the screens of a story play the home cue, and the others are silent.
// M4: Wish, the Wardrobe and the Album open an item's Character Story, Moment or first-wear beat in the reader, and the
// reader's Back returns to the screen that opened it.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, RotateCcw } from "lucide-react";
import { useOtomeApi } from "./api";
import { Dock } from "./components/Dock";
import { Stage } from "./components/Stage";
import { TopBar } from "./components/TopBar";
import { INDEX_QUERY_KEY, useOtomeIndex } from "./hooks/use-index";
import { useLook, type LookPreference } from "./hooks/use-look";
import { OtomeAudioProvider } from "./hooks/use-otome-audio";
import { fetchRunView, runQueryKey, useRun } from "./hooks/use-run";
import { accentOf } from "./lib/accent";
import { dropStaleCareNotes } from "./lib/cycle-storage";
import { localDay } from "./lib/tap-mood";
import { OtomePropsContext, readOtomeProps } from "./props";
import { BibleView } from "./screens/BibleView";
import { ClawMachine } from "./screens/dates/ClawMachine";
import { DateNight } from "./screens/dates/DateNight";
import { DatesHub, type DateActivity } from "./screens/dates/DatesHub";
import { ReadHim } from "./screens/dates/ReadHim";
import { ReadMe } from "./screens/dates/ReadMe";
import { ForgeProgress } from "./screens/ForgeProgress";
import { HomeScreen, useHomeLi } from "./screens/home/HomeScreen";
import { PhoneScreen, type PhoneOpen } from "./screens/phone/PhoneScreen";
import { Placeholder } from "./screens/Placeholder";
import { Album } from "./screens/album/Album";
import { Reader } from "./screens/reader/Reader";
import { RemindMe } from "./screens/remind/RemindMe";
import {
  DOCK_SCREENS,
  RUN_SCREENS,
  SCREEN_NAME_KEYS,
  playsHomeCue,
  type DockScreen,
  type ScreenId,
} from "./screens/screens";
import { Settings, type SettingsTab } from "./screens/settings/Settings";
import { SetupWizard } from "./screens/setup/SetupWizard";
import { StoryHome } from "./screens/story/StoryHome";
import { Wardrobe } from "./screens/wardrobe/Wardrobe";
import { WishScreen } from "./screens/wish/WishScreen";
import { WorldPicker } from "./screens/WorldPicker";
import type { OtomeIndex, RunView } from "./shared/api-types";

const DOCKED: ReadonlySet<ScreenId> = new Set<ScreenId>(["home", ...DOCK_SCREENS]);
/** The Dates activities this build opens (M5), each a screen taking ActivityScreenProps. */
const ACTIVITIES: ReadonlySet<DateActivity> = new Set<DateActivity>(["read-him", "read-me", "date-night", "claw"]);

interface ScreensProps {
  lookPreference: LookPreference;
  onLookPreference: (preference: LookPreference) => void;
}

function OtomeForgeScreens({ lookPreference, onLookPreference }: ScreensProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const queryClient = useQueryClient();
  const index = useOtomeIndex();
  const activeRun = index.data?.activeRun ?? null;
  const run = useRun(activeRun);
  const [chosen, setChosen] = useState<ScreenId | null>(null);
  const [settingsReturn, setSettingsReturn] = useState<ScreenId>("picker");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("look");
  const [bibleLi, setBibleLi] = useState<string | null>(null);
  const [chapterKey, setChapterKey] = useState<string | null>(null);
  // Where the reader's Back leads: the Story screen, or the Wish, Wardrobe or Album screen that opened an item's story.
  const [readerReturn, setReaderReturn] = useState<ScreenId>("story");
  // The thread the phone shows (Home's Reply opens one with the note it quotes; the phone keeps it as the player moves
  // between threads and spends the quote), or null for the thread list.
  const [phoneOpen, setPhoneOpen] = useState<PhoneOpen | null>(null);
  // Who Dates is about: the love interest picked there, kept while a game opens and closes.
  const [datesLi, setDatesLi] = useState<string | null>(null);
  // Date Night reads its scenes full-stage, as the reader does: the top bar steps aside while it says so.
  const [immersive, setImmersive] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  // Set by the player's own navigation or retry, so focus moves only then (never on the first mount, which would take
  // it from the Engine). The button they pressed often leaves with the old screen, so focus lands on the new screen's
  // heading (every screen starts with an <h1 tabIndex={-1}>), which also announces it; after a failed retry, on Try again.
  const navigated = useRef(false);
  const view: RunView | null = run.data ?? null;
  // The top bar's chip shows whoever Home is about (the player's pick, else the first love interest).
  const homeLi = useHomeLi(activeRun, view);
  // With no choice made, the active story opens where it is: forging, or Home once it is ready.
  const screen: ScreenId =
    chosen ?? (!activeRun || run.isError ? "picker" : view?.forge.phase === "ready" ? "home" : "forge");
  const waiting = index.isPending || (chosen === null && !!activeRun && run.isPending);
  // A failed background refetch keeps the screen it already loaded; only a first load that failed shows the error.
  const failed = index.isError && index.data === undefined;
  const shown = waiting ? "loading" : failed ? "error" : screen;

  // Once the active story has loaded, its opening screen stays put: a world that finishes forging while the player
  // watches keeps showing the forge (its cast and paint offer) until they choose to go Home.
  const phase = view?.forge.phase ?? null;
  useEffect(() => {
    if (chosen === null && activeRun && phase) setChosen(phase === "ready" ? "home" : "forge");
  }, [activeRun, chosen, phase]);

  useEffect(() => {
    if (!navigated.current || shown === "loading") return;
    navigated.current = false;
    const target = shown === "error" ? retryRef.current : screenRef.current?.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
  }, [shown, bibleLi]);

  const go = (next: ScreenId) => {
    if (next !== screen) navigated.current = true;
    setChosen(next);
  };

  const loading = (
    <div className="of-center" role="status">
      <Heart className="of-pulse" size={30} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
      <p className="of-body">{t("ui.otomeForge.common.loading")}</p>
    </div>
  );
  if (waiting) {
    return (
      <>
        <TopBar />
        {loading}
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

  /** Makes a story the active one, then opens it where it is (forging, or Home). */
  const activate = async (runKey: string) => {
    const { index: next } = await otome.post<{ index: OtomeIndex }>(`/runs/${encodeURIComponent(runKey)}/activate`);
    queryClient.setQueryData(INDEX_QUERY_KEY, next);
  };

  const openRun = async (runKey: string) => {
    setOpening(runKey);
    setOpenError(null);
    try {
      await activate(runKey);
      // Loaded again here, so a story whose last load failed opens, or says why it cannot, instead of leaving the
      // picker as it was (the active story's query would not run again by itself).
      await queryClient.fetchQuery({
        queryKey: runQueryKey(runKey),
        queryFn: () => fetchRunView(otome, runKey),
        staleTime: 0,
      });
      navigated.current = true;
      setChosen(null);
    } catch (failure) {
      setOpenError(otome.errorMessage(failure));
    } finally {
      setOpening(null);
    }
  };

  const created = async (made: RunView) => {
    queryClient.setQueryData(runQueryKey(made.runKey), made);
    try {
      await activate(made.runKey);
    } catch (failure) {
      console.warn("Otome Forge could not open the new story", failure);
      void queryClient.invalidateQueries({ queryKey: INDEX_QUERY_KEY });
    }
    go("forge");
  };

  const openSettings = (tab: SettingsTab = "look") => {
    setSettingsReturn(screen);
    setSettingsTab(tab);
    go("settings");
  };
  const selectDockScreen = (next: DockScreen) => go(next === screen ? "home" : next);
  /** Opens a chapter (or an item's story, `story-<itemId>`) in the reader, coming back to `from`. */
  const openReader = (from: ScreenId) => (key: string) => {
    navigated.current = true;
    setChapterKey(key);
    setReaderReturn(from);
    setChosen("reader");
  };
  // Begin opens the prologue in the reader (its chapter is made at once, its scene written as it opens), then Home;
  // once the prologue is read, Begin goes straight Home. A failure stays on the forge (ForgeProgress shows it).
  const begin = async () => {
    if (!activeRun || view?.prologue) return go("home");
    await otome.post(`/runs/${encodeURIComponent(activeRun)}/prologue`);
    openReader("home")("prologue");
  };
  const bibleOf = view?.lis.find((li) => li.id === bibleLi) ?? null;
  const datesOf = view?.lis.find((li) => li.id === (datesLi ?? homeLi?.id)) ?? view?.lis[0] ?? null;

  // Where Back leads. The opening screen and the dock's screens have none.
  const back: Partial<Record<ScreenId, ScreenId>> = {
    settings: settingsReturn,
    setup: "picker",
    forge: view?.forge.phase === "ready" ? "home" : "picker",
    bible: "forge",
    reader: readerReturn,
    phone: "home",
    remind: "home",
    "read-him": "dates",
    "read-me": "dates",
    "date-night": "dates",
    claw: "dates",
    home: activeRun ? undefined : "picker",
  };
  const backTo = back[screen];

  const content =
    screen === "picker" && index.data ? (
      <WorldPicker
        index={index.data}
        opening={opening}
        error={openError}
        onNew={() => go("setup")}
        onOpen={(runKey) => void openRun(runKey)}
      />
    ) : screen === "setup" ? (
      <SetupWizard onCreated={(made) => void created(made)} />
    ) : screen === "forge" && activeRun ? (
      <ForgeProgress
        runKey={activeRun}
        onBegin={begin}
        onOpenBible={(li) => {
          navigated.current = true;
          setBibleLi(li);
          setChosen("bible");
        }}
      />
    ) : screen === "bible" && activeRun && bibleOf && view ? (
      <BibleView runKey={activeRun} li={bibleOf} lis={view.lis} />
    ) : screen === "settings" ? (
      <Settings
        run={view}
        lookPreference={lookPreference}
        onLookPreference={onLookPreference}
        initialTab={settingsTab}
      />
    ) : screen === "story" && activeRun && view ? (
      <StoryHome runKey={activeRun} view={view} onOpenChapter={openReader("story")} />
    ) : screen === "reader" && activeRun && view && chapterKey ? (
      <Reader
        runKey={activeRun}
        chapterKey={chapterKey}
        view={view}
        onExit={() => go(readerReturn)}
        {...(readerReturn === "story"
          ? {}
          : { exitLabel: t("ui.otomeForge.reader.backTo", { screen: t(SCREEN_NAME_KEYS[readerReturn]) }) })}
        onHome={() => go("home")}
      />
    ) : screen === "wish" && activeRun && view ? (
      <WishScreen
        runKey={activeRun}
        view={view}
        onOpenStory={openReader("wish")}
        onOpenWardrobe={() => go("wardrobe")}
      />
    ) : screen === "wardrobe" && activeRun && view ? (
      <Wardrobe runKey={activeRun} view={view} onOpenStory={openReader("wardrobe")} />
    ) : screen === "album" && activeRun && view ? (
      <Album runKey={activeRun} view={view} onOpenStory={openReader("album")} />
    ) : screen === "home" && activeRun && view ? (
      <HomeScreen
        runKey={activeRun}
        view={view}
        onOpenPhone={(open) => {
          setPhoneOpen(open);
          go("phone");
        }}
        onOpenCast={() => go("forge")}
        onOpenStories={() => go("picker")}
        onOpenRemind={() => go("remind")}
      />
    ) : screen === "phone" && activeRun && view ? (
      <PhoneScreen runKey={activeRun} view={view} open={phoneOpen} onOpenChange={setPhoneOpen} />
    ) : screen === "remind" && activeRun && view ? (
      <RemindMe runKey={activeRun} view={view} onOpenTracker={() => openSettings("tracker")} />
    ) : screen === "dates" && activeRun && view ? (
      <DatesHub
        runKey={activeRun}
        view={view}
        li={datesOf?.id ?? null}
        onPickLi={setDatesLi}
        available={ACTIVITIES}
        onPlay={(activity, li) => {
          setDatesLi(li);
          go(activity);
        }}
      />
    ) : screen === "read-him" && activeRun && view && datesOf ? (
      <ReadHim runKey={activeRun} view={view} li={datesOf} onExit={() => go("dates")} />
    ) : screen === "read-me" && activeRun && view && datesOf ? (
      <ReadMe runKey={activeRun} view={view} li={datesOf} onExit={() => go("dates")} />
    ) : screen === "date-night" && activeRun && view && datesOf ? (
      <DateNight
        runKey={activeRun}
        view={view}
        li={datesOf}
        onExit={() => go("dates")}
        onHome={() => go("home")}
        onImmersive={setImmersive}
      />
    ) : screen === "claw" && activeRun && view && datesOf ? (
      <ClawMachine runKey={activeRun} view={view} li={datesOf} onExit={() => go("dates")} />
    ) : activeRun && run.isPending ? (
      // A screen of the story whose view is still on its way (the active story changed beneath it).
      loading
    ) : (
      <Placeholder screen={screen} onStories={() => go("picker")} />
    );

  return (
    <OtomeAudioProvider run={view} cue={playsHomeCue(screen, settingsReturn) ? "home" : null}>
      {/* The reader (and a date's scenes) are full-stage: their own header carries the way out. */}
      {screen === "reader" || (screen === "date-night" && immersive) ? null : (
        <TopBar
          run={
            RUN_SCREENS.has(screen)
              ? {
                  li: homeLi ? { name: homeLi.name, accent: accentOf(homeLi), portraitUrl: homeLi.portrait } : null,
                  starlight: view?.starlight ?? null,
                }
              : null
          }
          onBack={backTo ? () => go(backTo) : undefined}
          onHome={() => go("home")}
          onSettings={screen === "settings" ? undefined : () => openSettings()}
        />
      )}
      <div
        key={
          screen === "bible"
            ? `bible-${bibleLi}`
            : screen === "reader"
              ? `reader-${chapterKey}`
              : screen === "read-him" || screen === "read-me" || screen === "date-night" || screen === "claw"
                ? `${screen}-${datesOf?.id ?? ""}`
                : screen
        }
        ref={screenRef}
        className="of-screen"
      >
        {content}
      </div>
      {DOCKED.has(screen) ? <Dock active={screen} onSelect={selectDockScreen} /> : null}
    </OtomeAudioProvider>
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
  // A caring message from another day goes as Otome Forge opens, whichever screen it opens on (Home also drops one as
  // it sees the day change). ponytail: nothing can run while the page is closed, or at midnight on another screen, so
  // until the next open (or Home) yesterday's note stays in this browser. Upgrade path: a day timer here.
  useEffect(() => dropStaleCareNotes(localDay(props.timeZone, new Date())), [props.timeZone]);
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
