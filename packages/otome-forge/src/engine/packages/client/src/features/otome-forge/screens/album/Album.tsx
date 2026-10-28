// ──────────────────────────────────────────────
// Otome Forge: the Album. CGs (story CGs once seen, Memories' CGs once painted, pair portraits), Memories (each one's
// Character Story or Moment to read, and Snapshots), the Love Timeline, favourite lines, the soundtrack, and the Tells
// journal. Only what is unlocked is listed; every image saves to the device through the Engine. Everything reads
// without images or audio: a Memory without art shows a quiet card in their colour.
// ──────────────────────────────────────────────
// Route (S/routes/album.ts): GET /runs/:run/album → AlbumView. An unopened Memory is opened here as anywhere else.
import { useId, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BookHeart,
  BookOpen,
  CalendarHeart,
  Eye,
  Heart,
  Images,
  Music,
  Quote,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import { albumQueryKey, imagesOn, needsOpen, useItemActions } from "../../hooks/use-items";
import { useMusicCue } from "../../hooks/use-otome-audio";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import type { RunView } from "../../shared/api-types";
import type { MusicMood } from "../../shared/faces";
import type { AlbumMemory, AlbumView } from "../../shared/wardrobe";
import { TabList } from "../wish/BannerTabs";
import { RARITY_NAMES } from "../wish/SealedLetter";
import { ItemArt, ItemDetail, PaintReviewDialog, RarityStars, itemPerson, useKindLabel } from "../wish/TenPullGrid";
import { CgViewer, useFormatAt } from "./CgViewer";
import { Favorites } from "./Favorites";
import { Soundtrack } from "./Soundtrack";
import { Tells } from "./Tells";
import { Timeline } from "./Timeline";

const POLL_MS = 3_000;

const ALBUM_TABS = ["cgs", "memories", "timeline", "favorites", "soundtrack", "tells"] as const;
type AlbumTab = (typeof ALBUM_TABS)[number];

const TAB_META: Record<AlbumTab, { labelKey: string; Icon: LucideIcon }> = {
  cgs: { labelKey: "ui.otomeForge.album.tabCgs", Icon: Images },
  memories: { labelKey: "ui.otomeForge.album.tabMemories", Icon: BookHeart },
  timeline: { labelKey: "ui.otomeForge.album.tabTimeline", Icon: CalendarHeart },
  favorites: { labelKey: "ui.otomeForge.album.tabFavorites", Icon: Quote },
  soundtrack: { labelKey: "ui.otomeForge.album.tabSoundtrack", Icon: Music },
  tells: { labelKey: "ui.otomeForge.album.tabTells", Icon: Eye },
};

const READ_KEYS: Record<NonNullable<AlbumMemory["read"]>, string> = {
  unread: "ui.otomeForge.album.unread",
  "in-progress": "ui.otomeForge.album.reading",
  done: "ui.otomeForge.album.read",
};

export function useAlbum(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: albumQueryKey(runKey),
    queryFn: () => otome.get<AlbumView>(`${runPath(runKey)}/album`),
    // The reader changes what the Album lists (read state, story CGs) while it is away, as it does Home's.
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.memories.some((memory) => memory.art?.state === "pending") ? POLL_MS : false,
  });
}

interface AlbumProps {
  runKey: string;
  view: RunView;
  /** Opens a Memory's Character Story or a Moment in the reader. */
  onOpenStory: (key: string) => void;
}

export function Album({ runKey, view, onOpenStory }: AlbumProps) {
  const { t } = useTranslation();
  const otome = useOtomeApi();
  const id = useId();
  const album = useAlbum(runKey);
  const actions = useItemActions(runKey);
  const [tab, setTab] = useState<AlbumTab>("cgs");
  const [viewing, setViewing] = useState<number | null>(null);
  const [memory, setMemory] = useState<string | null>(null);
  const [playing, setPlaying] = useState<MusicMood | null>(null);
  // The soundtrack's chosen mood plays while the Album is open; none lets the story's own music go on.
  useMusicCue(playing ?? undefined);

  const head = (
    <div className="of-page-head of-page-head--tight">
      <h1 className="of-title" tabIndex={-1}>
        {t("ui.otomeForge.common.screenAlbum")}
      </h1>
      <p className="of-hand">{t("ui.otomeForge.album.note")}</p>
    </div>
  );

  if (!album.data) {
    return (
      <div className="of-page of-album">
        {head}
        {album.isError ? (
          <div className="of-panel of-panel--center of-card of-glass" role="alert">
            <p className="of-error">{otome.errorMessage(album.error)}</p>
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => void album.refetch()}>
              <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
              {t("ui.otomeForge.common.retry")}
            </button>
          </div>
        ) : (
          <div className="of-center" role="status">
            <Heart className="of-pulse" size={26} strokeWidth={1.6} fill="currentColor" aria-hidden="true" />
            <p className="of-body">{t("ui.otomeForge.album.loading")}</p>
          </div>
        )}
      </div>
    );
  }

  const data = album.data;
  const shownMemory = data.memories.find((item) => item.id === memory) ?? null;
  const panel =
    tab === "cgs" ? (
      <CgGrid view={view} album={data} onView={setViewing} />
    ) : tab === "memories" ? (
      <Memories view={view} memories={data.memories} onShow={setMemory} />
    ) : tab === "timeline" ? (
      <Timeline view={view} entries={data.timeline} />
    ) : tab === "favorites" ? (
      <Favorites view={view} favorites={data.favorites} />
    ) : tab === "soundtrack" ? (
      <Soundtrack entries={data.soundtrack} playing={playing} onPlay={setPlaying} />
    ) : (
      <Tells view={view} tells={data.tells} />
    );

  return (
    <div className="of-page of-album">
      {head}
      <TabList
        id={id}
        tabs={ALBUM_TABS}
        tab={tab}
        onChange={setTab}
        label={t("ui.otomeForge.album.tabsLabel")}
        labelOf={(name) => t(TAB_META[name].labelKey)}
        iconOf={(name) => TAB_META[name].Icon}
        className="of-album-tabs"
      />
      <div
        key={tab}
        id={`${id}-${tab}-panel`}
        className="of-tab-panel"
        role="tabpanel"
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
      >
        {panel}
      </div>
      {viewing !== null && data.cgs[viewing] ? (
        <CgViewer view={view} images={data.cgs} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      ) : null}
      {/* The prompt review takes the place of the Memory's page while it shows (one dialog over the stage at a time). */}
      {shownMemory && !actions.review ? (
        <Dialog
          wide
          title={t("ui.otomeForge.album.memoryTitle")}
          onClose={() => setMemory(null)}
          actions={
            <button type="button" className="of-button of-button--quiet of-glass" onClick={() => setMemory(null)}>
              {t("ui.otomeForge.wardrobe.close")}
            </button>
          }
        >
          <ItemDetail view={view} item={shownMemory} actions={actions} onOpenStory={onOpenStory} />
        </Dialog>
      ) : null}
      <PaintReviewDialog actions={actions} />
    </div>
  );
}

function CgGrid({ view, album, onView }: { view: RunView; album: AlbumView; onView: (index: number) => void }) {
  const { t } = useTranslation();
  const formatAt = useFormatAt();
  if (!album.cgs.length) {
    return (
      <p className="of-empty of-glass">
        <Images size={20} strokeWidth={1.8} aria-hidden="true" />
        {imagesOn(view) ? t("ui.otomeForge.album.cgsEmpty") : t("ui.otomeForge.album.cgsNoImages")}
      </p>
    );
  }
  return (
    <ul className="of-album-cgs">
      {album.cgs.map((image, index) => {
        const li = view.lis.find((item) => item.id === image.li) ?? null;
        const title =
          image.title || (li ? t("ui.otomeForge.album.cgWith", { name: li.name }) : t("ui.otomeForge.album.cg"));
        return (
          <li key={image.key}>
            <button
              type="button"
              className="of-album-cg"
              aria-label={t("ui.otomeForge.album.viewCg", { title })}
              onClick={() => onView(index)}
            >
              <img src={image.url} alt="" loading="lazy" decoding="async" />
              <span className="of-album-cg-caption" aria-hidden="true">
                <span className="of-album-cg-title">{title}</span>
                <span className="of-album-cg-date">{formatAt(image.at)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Memories({
  view,
  memories,
  onShow,
}: {
  view: RunView;
  memories: AlbumMemory[];
  onShow: (id: string) => void;
}) {
  const { t } = useTranslation();
  const kindLabel = useKindLabel();
  if (!memories.length) {
    return (
      <p className="of-empty of-glass">
        <BookHeart size={20} strokeWidth={1.8} aria-hidden="true" />
        {t("ui.otomeForge.album.memoriesEmpty")}
      </p>
    );
  }
  const images = imagesOn(view);
  return (
    <ul className="of-keepsakes">
      {memories.map((item) => {
        const li = itemPerson(item, view);
        const state = needsOpen(item, images)
          ? t("ui.otomeForge.album.unopened")
          : item.read
            ? t(READ_KEYS[item.read])
            : null;
        return (
          <li key={item.id}>
            <button
              type="button"
              className="of-keepsake of-glass"
              data-rarity={RARITY_NAMES[item.rarity]}
              style={li ? ({ "--of-li-accent": accentOf(li) } as CSSProperties) : undefined}
              onClick={() => onShow(item.id)}
            >
              <ItemArt item={item} view={view} />
              <span className="of-keepsake-text">
                <span className="of-keepsake-kind">
                  <RarityStars rarity={item.rarity} />
                  {kindLabel(item, view)}
                </span>
                <span className="of-keepsake-title">{item.title}</span>
                {li ? <span className="of-keepsake-who">{li.name}</span> : null}
                {item.kind === "snapshot3" && item.text ? (
                  <span className="of-keepsake-snapshot">{item.text}</span>
                ) : null}
              </span>
              {state ? (
                <span className="of-keepsake-state">
                  {item.read === "done" ? null : <BookOpen size={12} strokeWidth={2} aria-hidden="true" />}
                  {state}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
