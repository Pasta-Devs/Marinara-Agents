// ──────────────────────────────────────────────
// Otome Forge: the Album. CGs (newest first: story CGs once seen, Memories' CGs once painted, pair portraits), chat
// stickers (#2044: the protagonist's five and each love interest's unlocked ones, cut out), Photo Shoot photos (#2087:
// newest first, square, each one viewed, saved or deleted), Memories (each one's
// Character Story or Moment to read, and Snapshots), the Love Timeline, favourite lines, the soundtrack (the moods,
// then each begun chapter's theme), and the Tells journal. Only what is unlocked is listed; every image saves to the
// device through the Engine. Everything reads without images or audio: a Memory without art shows a quiet card in their
// colour.
// ──────────────────────────────────────────────
// Route (S/routes/album.ts): GET /runs/:run/album → AlbumView. An unopened Memory is opened here as anywhere else.
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookHeart,
  BookOpen,
  CalendarHeart,
  Camera,
  Eye,
  Heart,
  Images,
  Music,
  Paintbrush,
  Quote,
  RotateCcw,
  Sticker as StickerIcon,
  type LucideIcon,
} from "lucide-react";
import { useOtomeApi } from "../../api";
import { Dialog } from "../../components/Dialog";
import { CostHint } from "../../components/CostHint";
import {
  albumQueryKey,
  imagesOn,
  invalidateCollection,
  paintWaits,
  useItemActions,
  type ItemActions,
} from "../../hooks/use-items";
import { useMusicCue } from "../../hooks/use-otome-audio";
import { runPath } from "../../hooks/use-reader";
import { accentOf } from "../../lib/accent";
import { albumMemories, isUnplayedMemory, type MemoryRarityFilter } from "../../lib/album-memories";
import type { RunView } from "../../shared/api-types";
import { PLAYER_STICKER_OWNER } from "../../shared/stickers";
import type { AlbumImage, AlbumMemory, AlbumSticker, AlbumView } from "../../shared/wardrobe";
import { useStickers } from "../phone/StickerPicker";
import { TabList } from "../wish/BannerTabs";
import { RARITY_NAMES } from "../wish/SealedLetter";
import { ItemArt, ItemDetail, PaintReviewDialog, RarityStars, itemPerson, useKindLabel } from "../wish/TenPullGrid";
import { CgViewer, useFormatAt } from "./CgViewer";
import { Favorites } from "./Favorites";
import { Soundtrack } from "./Soundtrack";
import { Tells } from "./Tells";
import { Timeline } from "./Timeline";

const POLL_MS = 3_000;

const ALBUM_TABS = ["cgs", "stickers", "photos", "memories", "timeline", "favorites", "soundtrack", "tells"] as const;
type AlbumTab = (typeof ALBUM_TABS)[number];

const TAB_META: Record<AlbumTab, { labelKey: string; Icon: LucideIcon }> = {
  cgs: { labelKey: "ui.otomeForge.album.tabCgs", Icon: Images },
  stickers: { labelKey: "ui.otomeForge.album.tabStickers", Icon: StickerIcon },
  photos: { labelKey: "ui.otomeForge.album.tabPhotos", Icon: Camera },
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

const MEMORY_FILTERS = ["all", 3, 4, 5] as const;
const RARITY_LABEL_KEYS = {
  3: "ui.otomeForge.wish.rarity3",
  4: "ui.otomeForge.wish.rarity4",
  5: "ui.otomeForge.wish.rarity5",
};

export function useAlbum(runKey: string) {
  const otome = useOtomeApi();
  return useQuery({
    queryKey: albumQueryKey(runKey),
    queryFn: () => otome.get<AlbumView>(`${runPath(runKey)}/album`),
    // The reader changes what the Album lists (read state, story CGs) while it is away, as it does Home's.
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.memories.some((memory) => memory.art?.state === "pending") ||
      query.state.data?.stickers?.some((sticker) => sticker.art?.state === "pending")
        ? POLL_MS
        : false,
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
  const queryClient = useQueryClient();
  const album = useAlbum(runKey);
  const actions = useItemActions(runKey);
  const [tab, setTab] = useState<AlbumTab>("cgs");
  const [viewing, setViewing] = useState<number | null>(null);
  const [viewingSticker, setViewingSticker] = useState<number | null>(null);
  // A photo is held by its key: the list can change under the viewer (a photo taken elsewhere lands first), and Delete
  // must take the one shown.
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // A deleted photo's tile goes with it: once the viewer has closed (and handed focus back), focus moves to the panel.
  const focusPanel = useRef(false);
  useEffect(() => {
    if (viewingPhoto !== null || !focusPanel.current) return;
    focusPanel.current = false;
    panelRef.current?.focus({ preventScroll: true });
  }, [viewingPhoto]);
  const stickers = useStickerImages(view, album.data?.stickers ?? []);
  const [memory, setMemory] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  // The soundtrack's chosen row plays while the Album is open; none lets the story's own music go on. A chapter's theme
  // is held as the reader holds it, with its saved track, so it is never made again (Home's mood stands in only while
  // its file is gone and nothing else plays).
  const song = album.data?.soundtrack.find((entry) => entry.cue === playing);
  useMusicCue(
    !song
      ? undefined
      : "chapter" in song
        ? { chapterKey: song.chapter.key, mood: "home", track: song.track }
        : song.cue,
  );

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
  // Stubs and servers older than #2087 send no photos.
  const photos = data.photos ?? [];
  const photoIndex = viewingPhoto === null ? -1 : photos.findIndex((image) => image.key === viewingPhoto);
  const shownMemory = data.memories.find((item) => item.id === memory) ?? null;
  /** Deletes the photo shown, closes the viewer and leaves focus on the Photos panel (its tile is gone). */
  const deletePhoto = async (image: AlbumImage) => {
    await otome.post(`${runPath(runKey)}/photos/${encodeURIComponent(image.key.replace(/^photo:/u, ""))}/delete`, {});
    focusPanel.current = true;
    setViewingPhoto(null);
    // Home tapes the newest photo into the note: it reads again too.
    await invalidateCollection(queryClient, runKey);
  };
  const panel =
    tab === "cgs" ? (
      <CgGrid
        view={view}
        images={data.cgs}
        emptyKey="ui.otomeForge.album.cgsEmpty"
        noImagesKey="ui.otomeForge.album.cgsNoImages"
        onView={setViewing}
      />
    ) : tab === "stickers" ? (
      <StickerGrid runKey={runKey} view={view} stickers={stickers} actions={actions} onView={setViewingSticker} />
    ) : tab === "photos" ? (
      <CgGrid
        view={view}
        images={photos}
        emptyKey="ui.otomeForge.album.photosEmpty"
        noImagesKey="ui.otomeForge.album.photosNoImages"
        square
        onView={(index) => setViewingPhoto(photos[index]?.key ?? null)}
      />
    ) : tab === "memories" ? (
      <Memories view={view} memories={data.memories} onShow={setMemory} />
    ) : tab === "timeline" ? (
      <Timeline view={view} entries={data.timeline} memories={data.memories} onShow={setMemory} />
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
        ref={panelRef}
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
      {viewingSticker !== null && stickers.images[viewingSticker] ? (
        <CgViewer
          view={view}
          images={stickers.images}
          index={viewingSticker}
          onIndex={setViewingSticker}
          onClose={() => setViewingSticker(null)}
        />
      ) : null}
      {photoIndex >= 0 ? (
        <CgViewer
          view={view}
          images={photos}
          index={photoIndex}
          onIndex={(index) => setViewingPhoto(photos[index]?.key ?? null)}
          onClose={() => setViewingPhoto(null)}
          onDelete={deletePhoto}
        />
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

interface CgGridProps {
  view: RunView;
  images: readonly AlbumImage[];
  /** What the empty grid says, with images on and without. */
  emptyKey: string;
  noImagesKey: string;
  /** Square tiles (Photo Shoot photos). */
  square?: boolean;
  onView: (index: number) => void;
}

/** The CGs, or the Photos: a tile per image, newest first, each opening the viewer. */
function CgGrid({ view, images, emptyKey, noImagesKey, square = false, onView }: CgGridProps) {
  const { t } = useTranslation();
  const formatAt = useFormatAt();
  if (!images.length) {
    const Icon = square ? Camera : Images;
    return (
      <p className="of-empty of-glass">
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        {imagesOn(view) ? t(emptyKey) : t(noImagesKey)}
      </p>
    );
  }
  return (
    <ul className={square ? "of-album-cgs of-album-cgs--photo" : "of-album-cgs"}>
      {images.map((image, index) => {
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

/** The Album's stickers with their titles ("Ines · Laughing"), and the painted ones as viewer images. */
function useStickerImages(view: RunView, stickers: readonly AlbumSticker[]) {
  const { t } = useTranslation();
  const labels = useStickers(view);
  const tiles = stickers.map((sticker) => {
    const mine = sticker.owner === PLAYER_STICKER_OWNER;
    const who = mine ? view.player.name : (view.lis.find((li) => li.id === sticker.owner)?.name ?? "");
    const label = sticker.label || labels.byId.get(sticker.id)?.label || sticker.emotion;
    const title = who ? t("ui.otomeForge.album.stickerTitle", { name: who, sticker: label }) : label;
    return { sticker, title, Icon: labels.byId.get(sticker.id)?.Icon ?? StickerIcon };
  });
  const images: AlbumImage[] = tiles.flatMap(({ sticker, title }) =>
    sticker.url
      ? [
          {
            key: `sticker:${sticker.id}`,
            url: sticker.url,
            at: "",
            source: "sticker" as const,
            title,
            name: sticker.name,
            ...(sticker.owner === PLAYER_STICKER_OWNER ? {} : { li: sticker.owner }),
          },
        ]
      : [],
  );
  return { tiles, images };
}

/** The protagonist's stickers, then each love interest's: painted ones open the viewer, waiting ones offer Paint. */
function StickerGrid({
  runKey,
  view,
  stickers,
  actions,
  onView,
}: {
  runKey: string;
  view: RunView;
  stickers: ReturnType<typeof useStickerImages>;
  actions: ItemActions;
  onView: (index: number) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const owners = [
    { owner: PLAYER_STICKER_OWNER, title: t("ui.otomeForge.album.stickersYours") },
    ...view.lis.map((li) => ({ owner: li.id, title: li.name })),
  ];
  const images = new Map(stickers.images.map((image, index) => [image.key, index]));
  return (
    <div className="of-album-stickers">
      <p className="of-hint">
        {imagesOn(view) ? t("ui.otomeForge.album.stickersHint") : t("ui.otomeForge.album.stickersNoImages")}
      </p>
      {owners.map(({ owner, title }) => {
        const tiles = stickers.tiles.filter((tile) => tile.sticker.owner === owner);
        if (!tiles.length) return null;
        return (
          <section key={owner} aria-labelledby={`${id}-${owner}`}>
            <h2 id={`${id}-${owner}`} className="of-album-stickers-title">
              {title}
            </h2>
            <ul className="of-album-cgs of-album-cgs--sticker">
              {tiles.map(({ sticker, title: tileTitle, Icon }) => {
                const index = images.get(`sticker:${sticker.id}`);
                const target = {
                  id: `sticker:${sticker.id}`,
                  subject: tileTitle,
                  paintPath: `${runPath(runKey)}/art/sticker`,
                  promptPath: `${runPath(runKey)}/art/sticker/prompt`,
                  body: { sticker: sticker.id },
                };
                const busy = actions.busy.has(target.id);
                const error = actions.errors[target.id];
                const titleId = `${id}-${sticker.id}`;
                return (
                  <li key={sticker.id}>
                    {index !== undefined ? (
                      <button
                        type="button"
                        className="of-album-cg of-album-sticker"
                        aria-label={t("ui.otomeForge.album.viewCg", { title: tileTitle })}
                        onClick={() => onView(index)}
                      >
                        <img src={sticker.url} alt="" loading="lazy" decoding="async" />
                        <span className="of-album-cg-caption" aria-hidden="true">
                          <span className="of-album-cg-title">{tileTitle}</span>
                        </span>
                      </button>
                    ) : (
                      <div className="of-album-cg of-album-sticker of-album-sticker--quiet">
                        <Icon size={28} strokeWidth={1.7} aria-hidden="true" />
                        <span id={titleId} className="of-album-cg-title">
                          {tileTitle}
                        </span>
                        {sticker.art?.state === "pending" ? (
                          <span className="of-hint" role="status">
                            {t("ui.otomeForge.wish.painting")}
                          </span>
                        ) : paintWaits(sticker.art) ? (
                          <>
                            <button
                              type="button"
                              className="of-button of-button--quiet of-button--small of-glass"
                              aria-describedby={titleId}
                              aria-disabled={busy}
                              onClick={() => {
                                if (!busy) void actions.paint(target);
                              }}
                            >
                              {sticker.art?.state === "waiting-consent" ? (
                                <Paintbrush size={14} strokeWidth={2} aria-hidden="true" />
                              ) : (
                                <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                              )}
                              {sticker.art?.state === "waiting-consent"
                                ? t("ui.otomeForge.wish.paint")
                                : t("ui.otomeForge.wish.paintRetry")}
                            </button>
                            <CostHint images={1} />
                          </>
                        ) : null}
                        {error ? (
                          <span className="of-error" role="alert">
                            {error}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
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
  const group = useId();
  const [rarity, setRarity] = useState<MemoryRarityFilter>("all");
  const shown = albumMemories(memories, rarity);
  return (
    <>
      <fieldset className="of-segmented of-memory-filters of-glass">
        <legend className="of-visually-hidden">{t("ui.otomeForge.album.rarityFilterLabel")}</legend>
        {MEMORY_FILTERS.map((value) => (
          <label key={value} className="of-segment" data-checked={rarity === value}>
            <input
              type="radio"
              className="of-visually-hidden"
              name={group}
              value={value}
              checked={rarity === value}
              aria-label={value === "all" ? t("ui.otomeForge.album.rarityAll") : t(RARITY_LABEL_KEYS[value])}
              onChange={() => setRarity(value)}
            />
            <span aria-hidden="true">
              {value === "all"
                ? t("ui.otomeForge.album.rarityAll")
                : t("ui.otomeForge.album.rarityOption", { rarity: value })}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="of-hint">{t("ui.otomeForge.album.unplayedFirst")}</p>
      {!shown.length ? (
        <p className="of-empty of-glass">
          <BookHeart size={20} strokeWidth={1.8} aria-hidden="true" />
          {t(memories.length ? "ui.otomeForge.album.rarityEmpty" : "ui.otomeForge.album.memoriesEmpty")}
        </p>
      ) : (
        <ul className="of-keepsakes">
          {shown.map((item) => {
            const li = itemPerson(item, view);
            const state = item.read
              ? t(READ_KEYS[item.read])
              : isUnplayedMemory(item)
                ? t("ui.otomeForge.album.unopened")
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
      )}
    </>
  );
}
