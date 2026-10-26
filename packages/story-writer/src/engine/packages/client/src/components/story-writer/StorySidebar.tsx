// ──────────────────────────────────────────────
// Story Writer: the settings drawer and the arrow tab that opens it
// ──────────────────────────────────────────────
// An overlay drawer on the side the author picks. Its handle stays glued to that edge and travels with the drawer.
// Closed, the panel is inert, so neither focus nor screen readers reach into it.
import { Fragment, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ChevronRight, Library, Palette, PenLine, Users, Wand2, X } from "lucide-react";
import type { ConnectionOption } from "../../hooks/use-engine-resources";
import type { StoryGenerationApi } from "../../hooks/use-story-generation";
import type { StoryDocumentApi } from "../../hooks/use-story-writer";
import type { StorySettings, StorySummary, StoryWriterPreferences } from "../../lib/story-writer/model";
import type { ResolvedColorMode } from "../../lib/story-writer/styles-shell";
import { AppearanceSection } from "./sidebar/AppearanceSection";
import { CastSection } from "./sidebar/CastSection";
import { Section } from "./sidebar/fields";
import { StoriesSection } from "./sidebar/StoriesSection";
import { StorySection } from "./sidebar/StorySection";
import { ToolsSection } from "./sidebar/ToolsSection";
import { WritingSection } from "./sidebar/WritingSection";

export type SidebarSectionId = "stories" | "story" | "cast" | "writing" | "tools" | "appearance";
type SectionId = SidebarSectionId;

export interface StorySidebarProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Opens and scrolls to a section, such as the library from the action bar; a new nonce asks again. */
  sectionRequest: { id: SidebarSectionId; nonce: number } | null;
  iconUrl: string;
  preferences: StoryWriterPreferences;
  resolvedMode: ResolvedColorMode;
  onPreferencesChange(patch: Partial<StoryWriterPreferences>): void;
  stories: StorySummary[];
  activeStoryId: string | null;
  onSelectStory(storyId: string): void;
  onCreateStory(): void;
  onDuplicateStory(): void;
  onDeleteStory(): void;
  onExport(format: "md" | "txt"): void;
  onSaveNow(): void;
  doc: StoryDocumentApi;
  generation: StoryGenerationApi;
  connections: ConnectionOption[];
  connectionsLoading: boolean;
  /** A connection is selected or available as the default. */
  hasConnection: boolean;
  onEditConnection(connectionId: string): void;
  onManageConnections(): void;
  onJumpToChapter(chapterId: string): void;
  onDeleteChapter(chapterId: string): void;
  totalWords: number;
}

export function StorySidebar(props: StorySidebarProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const [sections, setSections] = useState<Record<SectionId, boolean>>({
    stories: true,
    story: true,
    cast: false,
    writing: true,
    tools: false,
    appearance: false,
  });
  const { open, onOpenChange, doc, generation } = props;
  const settings = doc.data?.story.settings ?? null;
  const chapters = doc.data?.chapters ?? [];
  const busy = generation.status !== "idle";

  // Focus follows the drawer: into it when it opens, back to the handle when it closes from inside.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) closeRef.current?.focus({ preventScroll: true });
    if (!open && wasOpen.current && panelRef.current?.contains(document.activeElement)) {
      handleRef.current?.focus({ preventScroll: true });
    }
    wasOpen.current = open;
  }, [open]);

  const { sectionRequest } = props;
  useEffect(() => {
    if (!sectionRequest) return;
    setSections((current) => ({ ...current, [sectionRequest.id]: true }));
    const frame = requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector(`[data-section="${sectionRequest.id}"]`);
      target?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [sectionRequest]);

  const toggleSection = (id: SectionId) => setSections((current) => ({ ...current, [id]: !current[id] }));
  const updateSettings = (patch: Partial<StorySettings>, options?: { immediate?: boolean }) =>
    doc.updateSettings(patch, options);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenChange(false);
  };
  const castCount = settings
    ? settings.characterIds.length + settings.personaIds.length + settings.lorebookIds.length
    : 0;

  return (
    <>
      <div
        className="sw-scrim"
        data-open={open ? "true" : "false"}
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <div className="sw-drawer" data-side={props.preferences.sidebarSide} data-open={open ? "true" : "false"}>
        <aside
          ref={panelRef}
          id={panelId}
          className="sw-drawer-panel"
          aria-label={t("sidebar.label")}
          inert={!open}
          onKeyDown={onKeyDown}
        >
          <header className="sw-drawer-header">
            <div className="sw-drawer-brand">
              <img src={props.iconUrl} alt="" />
              <div className="sw-drawer-titles">
                <h2 className="sw-drawer-title">{t("app.name")}</h2>
                <span className="sw-save-state" data-saving={doc.saving ? "true" : "false"} aria-live="polite">
                  <span className="sw-save-dot" aria-hidden="true" />
                  {doc.saving ? t("sidebar.saving") : t("sidebar.saved")}
                </span>
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              className="sw-icon-button"
              aria-label={t("sidebar.close")}
              title={t("sidebar.close")}
              onClick={() => onOpenChange(false)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="sw-drawer-body">
            <Section
              title={t("sidebar.sections.stories")}
              icon={<Library size={18} />}
              badge={props.stories.length > 1 ? props.stories.length : undefined}
              open={sections.stories}
              onToggle={() => toggleSection("stories")}
              sectionId="stories"
            >
              <StoriesSection
                stories={props.stories}
                activeStoryId={props.activeStoryId}
                busy={busy}
                canExport={!!doc.data && chapters.length > 0}
                onSelect={props.onSelectStory}
                onCreate={props.onCreateStory}
                onDuplicate={props.onDuplicateStory}
                onDelete={props.onDeleteStory}
                onExport={props.onExport}
                saving={doc.saving}
                onSaveNow={props.onSaveNow}
              />
            </Section>
            {settings ? (
              // Keyed by story: the text fields keep drafts, and one story's draft must never land in another.
              <Fragment key={doc.data?.story.id}>
                <Section
                  title={t("sidebar.sections.story")}
                  icon={<BookOpen size={18} />}
                  open={sections.story}
                  onToggle={() => toggleSection("story")}
                >
                  <StorySection settings={settings} onChange={updateSettings} />
                </Section>
                <Section
                  title={t("sidebar.sections.cast")}
                  icon={<Users size={18} />}
                  badge={castCount > 0 ? castCount : undefined}
                  open={sections.cast}
                  onToggle={() => toggleSection("cast")}
                >
                  <CastSection settings={settings} onChange={updateSettings} />
                </Section>
                <Section
                  title={t("sidebar.sections.writing")}
                  icon={<PenLine size={18} />}
                  open={sections.writing}
                  onToggle={() => toggleSection("writing")}
                >
                  <WritingSection
                    settings={settings}
                    onChange={updateSettings}
                    connections={props.connections}
                    connectionsLoading={props.connectionsLoading}
                    onEditConnection={props.onEditConnection}
                    onManageConnections={props.onManageConnections}
                    streaming={props.preferences.streaming}
                    onStreamingChange={(streaming) => props.onPreferencesChange({ streaming })}
                    totalWords={props.totalWords}
                  />
                </Section>
                <Section
                  title={t("sidebar.sections.tools")}
                  icon={<Wand2 size={18} />}
                  badge={chapters.length > 0 ? chapters.length : undefined}
                  open={sections.tools}
                  onToggle={() => toggleSection("tools")}
                >
                  <ToolsSection
                    settings={settings}
                    onChange={updateSettings}
                    chapters={chapters}
                    generation={generation}
                    canGenerate={props.hasConnection && !busy}
                    onSaveSummary={(chapterId, summary) => void doc.saveChapter(chapterId, { summary })}
                    onDeleteChapter={props.onDeleteChapter}
                    onJump={props.onJumpToChapter}
                  />
                </Section>
              </Fragment>
            ) : null}
            <Section
              title={t("sidebar.sections.appearance")}
              icon={<Palette size={18} />}
              open={sections.appearance}
              onToggle={() => toggleSection("appearance")}
            >
              <AppearanceSection
                preferences={props.preferences}
                resolvedMode={props.resolvedMode}
                onChange={props.onPreferencesChange}
              />
            </Section>
          </div>
        </aside>
        <button
          ref={handleRef}
          type="button"
          className="sw-handle"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? t("sidebar.hide") : t("sidebar.show")}
          title={open ? t("sidebar.hide") : t("sidebar.show")}
          onClick={() => onOpenChange(!open)}
        >
          <ChevronRight size={20} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}
