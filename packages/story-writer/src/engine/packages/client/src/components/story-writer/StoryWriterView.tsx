// ──────────────────────────────────────────────
// Story Writer: the full-page view (stage, book, sticky note, action bar, settings drawer)
// ──────────────────────────────────────────────
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { host } from "marinara:host";
import { resolveDefaultConnectionId, useStoryConnections } from "../../hooks/use-engine-resources";
import { useStoryGeneration } from "../../hooks/use-story-generation";
import { storyWriterKeys, usePreferences, useStoryDocument, useStoryList } from "../../hooks/use-story-writer";
import { STORY_WRITER_ASSETS, storyWriterAssetUrl, type StoryWriterAsset } from "../../lib/story-writer/assets";
import { downloadTextFile, storyFileName, storyToMarkdown, storyToPlainText } from "../../lib/story-writer/export";
import { countWords, storyDisplayTitle, type StoryChapter, type StorySummary } from "../../lib/story-writer/model";
import { storyThemeVariables, type ResolvedColorMode } from "../../lib/story-writer/styles-shell";
import { generateClientId } from "../../lib/utils";
import { ActionBar, type FullscreenControl } from "./ActionBar";
import { StickyNote } from "./StickyNote";
import { StoryReader, type StoryReaderHandle } from "./StoryReader";
import { StorySidebar, type SidebarSectionId } from "./StorySidebar";

/** The Engine's mobile shell query. */
const MOBILE_QUERY = "(max-width: 767px), (max-width: 1440px) and (hover: none) and (any-pointer: coarse)";
const NO_CHAPTERS: StoryChapter[] = [];

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "default" | "destructive";
}

function member(source: unknown, key: string): unknown {
  return source && typeof source === "object" ? (source as Record<string, unknown>)[key] : undefined;
}

/** The Engine's confirm dialog when this Engine has one, else the browser's. */
async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const dialogs = member(member(host, "services"), "dialogs");
  const show = member(dialogs, "showConfirmDialog");
  if (typeof show === "function") return (await show.call(dialogs, options)) === true;
  return window.confirm(`${options.title}\n\n${options.message}`);
}

/** The Engine's live UI store state, read member by member: older Engines may lack any of it. */
function engineUiState(): Record<string, unknown> | null {
  const store = member(member(host, "stores"), "ui");
  const getState = member(store, "getState");
  if (typeof getState !== "function") return null;
  const state: unknown = getState.call(store);
  return state && typeof state === "object" ? (state as Record<string, unknown>) : null;
}

function readFullscreen(value: unknown, labels: { enter: string; exit: string }): FullscreenControl | null {
  if (!value || typeof value !== "object") return null;
  const control = value as Partial<FullscreenControl>;
  if (typeof control.setActive !== "function") return null;
  return {
    active: control.active === true,
    setActive: control.setActive,
    enterLabel: typeof control.enterLabel === "string" && control.enterLabel ? control.enterLabel : labels.enter,
    exitLabel: typeof control.exitLabel === "string" && control.exitLabel ? control.exitLabel : labels.exit,
  };
}

function readEngineTheme(): ResolvedColorMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribeEngineTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Total words, recounting only the chapters whose text changed (the streamed one, the one being edited). */
function useTotalWords(chapters: StoryChapter[]): number {
  const counts = useRef(new Map<string, { text: string; words: number }>());
  return useMemo(() => {
    const next = new Map<string, { text: string; words: number }>();
    let total = 0;
    for (const chapter of chapters) {
      const cached = counts.current.get(chapter.id);
      const words = cached && cached.text === chapter.text ? cached.words : countWords(chapter.text);
      next.set(chapter.id, { text: chapter.text, words });
      total += words;
    }
    counts.current = next;
    return total;
  }, [chapters]);
}

export function StoryWriterView({ capabilityProps }: { capabilityProps: Record<string, unknown> }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { preferences, isLoading: preferencesLoading, update: updatePreferences } = usePreferences();
  const list = useStoryList();
  const [storyId, setStoryId] = useState<string | null>(null);
  const doc = useStoryDocument(storyId);
  const { connections, isLoading: connectionsLoading } = useStoryConnections();
  const generation = useStoryGeneration({
    doc,
    streaming: preferences.streaming,
    debugMode: capabilityProps.debugMode === true,
    connections,
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sectionRequest, setSectionRequest] = useState<{ id: SidebarSectionId; nonce: number } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [ghostChapterId, setGhostChapterId] = useState(generateClientId);
  const [firstStoryFailed, setFirstStoryFailed] = useState(false);
  const readerRef = useRef<StoryReaderHandle>(null);
  const engineTheme = useSyncExternalStore(subscribeEngineTheme, readEngineTheme, (): ResolvedColorMode => "dark");
  const mobile = useMediaQuery(MOBILE_QUERY);
  const packageVersion = typeof capabilityProps.packageVersion === "string" ? capabilityProps.packageVersion : null;
  const assetUrl = useCallback((file: StoryWriterAsset) => storyWriterAssetUrl(file, packageVersion), [packageVersion]);

  // Open the remembered story, else the newest. A first visit gets a fresh untitled story to write in.
  const creatingFirst = useRef(false);
  const { stories, isLoading: storiesLoading, isError: storiesError, create: createStory } = list;
  useEffect(() => {
    if (preferencesLoading || storiesLoading || storiesError || firstStoryFailed) return;
    // The cache, not the last render: a story just created or deleted is already there.
    const current = qc.getQueryData<StorySummary[]>(storyWriterKeys.stories) ?? stories;
    if (storyId && current.some((story) => story.id === storyId)) return;
    if (current.length > 0) {
      setStoryId((current.find((story) => story.id === preferences.lastStoryId) ?? current[0]).id);
      return;
    }
    if (creatingFirst.current) return;
    creatingFirst.current = true;
    createStory()
      .then(
        (created) => setStoryId(created.story.id),
        () => setFirstStoryFailed(true),
      )
      .finally(() => {
        creatingFirst.current = false;
      });
  }, [
    preferencesLoading,
    storiesLoading,
    storiesError,
    firstStoryFailed,
    storyId,
    stories,
    preferences.lastStoryId,
    createStory,
    qc,
  ]);

  useEffect(() => {
    if (storyId && !preferencesLoading && preferences.lastStoryId !== storyId) {
      updatePreferences({ lastStoryId: storyId });
    }
  }, [storyId, preferencesLoading, preferences.lastStoryId, updatePreferences]);

  const mode: ResolvedColorMode = preferences.colorMode === "app" ? engineTheme : preferences.colorMode;
  const themeStyle = useMemo(
    () =>
      storyThemeVariables({
        theme: preferences.theme,
        mode,
        fontFamily: preferences.fontFamily,
        fontColor: preferences.fontColor,
        fontSize: preferences.fontSize,
        assetUrl,
      }) as CSSProperties,
    [preferences.theme, mode, preferences.fontFamily, preferences.fontColor, preferences.fontSize, assetUrl],
  );

  const data = doc.data;
  const settings = data?.story.settings ?? null;
  const chapters = data?.chapters ?? NO_CHAPTERS;
  const totalWords = useTotalWords(chapters);
  const lastChapter = chapters.length > 0 ? chapters[chapters.length - 1] : null;
  const hasConnection = !!resolveDefaultConnectionId(connections, settings?.connectionId ?? null);
  const generatingIndex = generation.generatingChapterId
    ? chapters.findIndex((chapter) => chapter.id === generation.generatingChapterId)
    : -1;
  const storyDetails = settings
    ? [settings.fandom, settings.genre, settings.rating, settings.tags]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" · ")
    : "";
  const fullscreen = readFullscreen(capabilityProps.browserFullscreen, {
    enter: t("actions.enterFullscreen"),
    exit: t("actions.exitFullscreen"),
  });

  const { createChapter, saveChapter, flush } = doc;
  const onStartChapter = useCallback(
    (chapterId: string, markdown: string) => {
      // createChapter reports its own errors.
      createChapter({ id: chapterId, text: markdown, status: "draft" }).catch(() => undefined);
      setGhostChapterId(generateClientId());
    },
    [createChapter],
  );
  const onChapterChange = useCallback(
    (chapterId: string, markdown: string) => void saveChapter(chapterId, { text: markdown }),
    [saveChapter],
  );

  // On phones the drawer covers the book: show the story the author just picked.
  const showStory = (id: string) => {
    setStoryId(id);
    if (mobile) setSidebarOpen(false);
  };
  const selectStory = (id: string) => {
    if (id === storyId) return;
    void flush();
    showStory(id);
  };
  const createNewStory = async () => {
    try {
      showStory((await list.create()).story.id);
    } catch {
      // Reported by the hook.
    }
  };
  const duplicateStory = async () => {
    if (!storyId) return;
    try {
      showStory((await list.duplicate(storyId)).story.id);
    } catch {
      // Reported by the hook.
    }
  };
  const deleteStory = async () => {
    if (!storyId || !settings) return;
    const confirmed = await confirmAction({
      title: t("stories.deleteTitle", { title: storyDisplayTitle(settings, t("app.untitled")) }),
      message: t("stories.deleteMessage"),
      confirmLabel: t("stories.deleteConfirm"),
      tone: "destructive",
    });
    if (!confirmed) return;
    const next = stories.find((story) => story.id !== storyId)?.id ?? null;
    try {
      await list.remove(storyId);
    } catch {
      return;
    }
    // With no story left, the effect above makes a new one.
    setStoryId(next);
  };
  const exportStory = (format: "md" | "txt") => {
    if (!data) return;
    const fallback = t("app.untitled");
    const options = { chapterLabel: (number: number) => t("reader.chapterLabel", { number }) };
    try {
      const text =
        format === "md" ? storyToMarkdown(data, fallback, options) : storyToPlainText(data, fallback, options);
      const mime = format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
      downloadTextFile(storyFileName(storyDisplayTitle(data.story.settings, fallback), format), text, mime);
    } catch {
      toast.error(t("errors.export"));
    }
  };
  const openConnection = async (connectionId: string) => {
    // Capability API 1.386 (declared by this package). On desktop the editor replaces Home, so save first.
    const open = capabilityProps.openConnection;
    if (typeof open !== "function") {
      toast.error(t("errors.openConnection"));
      return;
    }
    await flush();
    (open as (id: string) => void)(connectionId);
  };
  const saveNow = async () => {
    if (await flush()) toast.success(t("stories.savedToast"));
    else toast.warning(t("stories.saveFailed"));
  };
  const openLibrary = () => {
    setSidebarOpen(true);
    setSectionRequest((current) => ({ id: "stories", nonce: (current?.nonce ?? 0) + 1 }));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    // Ctrl/Cmd+S saves the story instead of opening the browser's "Save page" dialog.
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void saveNow();
    }
  };
  const manageConnections = () => {
    const openPanel = engineUiState()?.openRightPanel;
    if (typeof openPanel === "function") {
      (openPanel as (panel: string) => void)("connections");
      return;
    }
    toast.error(t("errors.openConnection"));
  };
  const finishChapter = async () => {
    // A draft that is done as it is: mark it finished, then the next Write starts a new chapter.
    if (!lastChapter) return;
    await saveChapter(lastChapter.id, { status: "complete" }, { immediate: true });
    void generation.write("next");
  };
  const rewriteLastChapter = async () => {
    const number = chapters.length;
    const confirmed = await confirmAction({
      title: t("actions.rewriteTitle", { number }),
      message: t("actions.rewriteMessage", { number }),
      confirmLabel: t("actions.rewriteConfirm"),
      tone: "destructive",
    });
    if (confirmed) void generation.write("rewrite");
  };
  const deleteChapter = async (chapterId: string) => {
    const number = chapters.findIndex((chapter) => chapter.id === chapterId) + 1;
    const confirmed = await confirmAction({
      title: t("tools.deleteChapterTitle", { number }),
      message: t("tools.deleteChapterMessage"),
      confirmLabel: t("tools.deleteChapter"),
      tone: "destructive",
    });
    if (confirmed) await doc.deleteChapter(chapterId);
  };
  const jumpToChapter = (chapterId: string) => {
    readerRef.current?.scrollToChapter(chapterId);
    // The drawer covers the book on phones.
    if (mobile) setSidebarOpen(false);
  };

  let slotMessage: { text: string; retry?: () => void } | null = null;
  if (!data || !settings) {
    if (storiesError) {
      slotMessage = {
        text: t("errors.loadStories"),
        retry: () => void qc.invalidateQueries({ queryKey: storyWriterKeys.stories }),
      };
    } else if (doc.isError) {
      slotMessage = { text: t("app.loadFailed"), retry: doc.reload };
    } else if (firstStoryFailed) {
      slotMessage = { text: t("errors.createStory"), retry: () => setFirstStoryFailed(false) };
    } else {
      slotMessage = { text: storyId ? t("app.loading") : t("app.creating") };
    }
  }

  return (
    <div
      className="sw-root"
      data-sw-theme={preferences.theme}
      data-sw-mode={mode}
      data-sw-sidebar={preferences.sidebarSide}
      data-sw-note={preferences.noteSide}
      data-sw-sidebar-open={sidebarOpen ? "true" : "false"}
      style={themeStyle}
      onKeyDown={onKeyDown}
    >
      <div className="sw-frame">
        <div className="sw-stage" />
        <div className="sw-reader-slot">
          {data && settings ? (
            <StoryReader
              key={data.story.id}
              ref={readerRef}
              theme={preferences.theme}
              pageAnimation={preferences.pageAnimation}
              storyTitle={storyDisplayTitle(settings, t("app.untitled"))}
              storyDetails={storyDetails}
              chapters={chapters}
              generatingChapterId={generation.generatingChapterId}
              ghostChapterId={ghostChapterId}
              editable={generation.status === "idle"}
              mariImageUrl={assetUrl(STORY_WRITER_ASSETS.mari)}
              onChapterChange={onChapterChange}
              onStartChapter={onStartChapter}
            />
          ) : slotMessage ? (
            <div className="sw-slot-message" role="status">
              {slotMessage.retry ? null : <Loader2 className="sw-spin" size={28} aria-hidden="true" />}
              <p>{slotMessage.text}</p>
              {slotMessage.retry ? (
                <button type="button" className="sw-button" onClick={slotMessage.retry}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {t("app.retry")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {data && settings ? (
          <>
            <StickyNote
              key={data.story.id}
              side={preferences.noteSide}
              text={settings.authorNote}
              clearAfterChapter={settings.clearNoteAfterChapter}
              depth={settings.authorNoteDepth}
              open={noteOpen}
              onOpenChange={setNoteOpen}
              onChange={(authorNote) => doc.updateSettings({ authorNote })}
              onDepthChange={(authorNoteDepth) => doc.updateSettings({ authorNoteDepth })}
            />
            <ActionBar
              status={generation.status}
              canWrite={generation.canWrite}
              hasConnection={hasConnection || connectionsLoading}
              chapterCount={chapters.length}
              lastChapterDraft={lastChapter?.status === "draft"}
              generatingChapterNumber={generatingIndex >= 0 ? generatingIndex + 1 : null}
              liveWords={generation.liveWords}
              totalWords={totalWords}
              targetWords={settings.targetWords}
              fullscreen={fullscreen}
              onWrite={() => void generation.write("next")}
              onContinue={() => void generation.write("continue")}
              onRewrite={() => void rewriteLastChapter()}
              onStop={generation.stop}
              onOpenLibrary={openLibrary}
              onFinishChapter={() => void finishChapter()}
            />
          </>
        ) : null}
        <StorySidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          sectionRequest={sectionRequest}
          iconUrl={assetUrl(STORY_WRITER_ASSETS.icon)}
          preferences={preferences}
          resolvedMode={mode}
          onPreferencesChange={updatePreferences}
          stories={stories}
          activeStoryId={storyId}
          onSelectStory={selectStory}
          onCreateStory={() => void createNewStory()}
          onDuplicateStory={() => void duplicateStory()}
          onDeleteStory={() => void deleteStory()}
          onExport={exportStory}
          onSaveNow={() => void saveNow()}
          doc={doc}
          generation={generation}
          connections={connections}
          connectionsLoading={connectionsLoading}
          hasConnection={hasConnection}
          onEditConnection={(connectionId) => void openConnection(connectionId)}
          onManageConnections={manageConnections}
          onJumpToChapter={jumpToChapter}
          onDeleteChapter={(chapterId) => void deleteChapter(chapterId)}
          totalWords={totalWords}
        />
      </div>
    </div>
  );
}
