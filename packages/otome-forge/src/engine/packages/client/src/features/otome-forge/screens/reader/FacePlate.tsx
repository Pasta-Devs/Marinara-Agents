// ──────────────────────────────────────────────
// Otome Forge: the love interest on stage. His face changes line by line: with his five faces painted (M2b, a ready
// set only, while expressions are on) the two image layers crossfade, every face decoded ahead the moment he comes on
// stage; a face not painted shows his portrait with the face as a labelled chip; without art he is his initials on his
// accent colour with the face as an aura and the chip, so the change never rests on colour or a picture alone.
// ──────────────────────────────────────────────
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Heart, HeartCrack, Paintbrush, RotateCcw, Snowflake, Sparkles, type LucideIcon } from "lucide-react";
import { forgeStoryExpressionArt } from "@forge-kit/story-expressions.mjs";
import { CostHint } from "../../components/CostHint";
import { accentOf, initialsOf } from "../../lib/accent";
import type { PaintState, RunLiView } from "../../shared/api-types";
import { FACES, type Face } from "../../shared/faces";

export const FACE_LABEL_KEYS: Record<Face, string> = {
  tender: "ui.otomeForge.reader.faceTender",
  flustered: "ui.otomeForge.reader.faceFlustered",
  cold: "ui.otomeForge.reader.faceCold",
  hurt: "ui.otomeForge.reader.faceHurt",
  angry: "ui.otomeForge.reader.faceAngry",
};

const FACE_ICONS: Record<Face, LucideIcon> = {
  tender: Heart,
  flustered: Sparkles,
  cold: Snowflake,
  hurt: HeartCrack,
  angry: Flame,
};

/** Face images already asked for in this page, so each one is fetched once. */
const preloaded = new Set<string>();

/** Decodes every ready face of the love interest on stage (or on Home), so a face change never waits on the network. */
export function usePreloadedFaces(expressions: RunLiView["expressions"]) {
  useEffect(() => {
    for (const url of Object.values(expressions ?? {})) {
      if (typeof url !== "string" || !url || preloaded.has(url)) continue;
      preloaded.add(url);
      const image = new Image();
      image.decoding = "async";
      image.src = url;
    }
  }, [expressions]);
}

interface FacePlateProps {
  li: RunLiView | null;
  face: Face | "";
  /** The current line is his. */
  speaking: boolean;
}

export function FacePlate({ li, face, speaking }: FacePlateProps) {
  const { t } = useTranslation();
  const expressions = li?.expressions;
  usePreloadedFaces(expressions);
  if (!li) return null;
  // The look he wears is his stage art: his faces are painted on it, so a plain line shows the same outfit.
  const shown = forgeStoryExpressionArt(
    { art: li.worn?.url ?? li.portrait ?? "", expressions: expressions ?? {} },
    { expression: face },
    FACES,
  );
  const painted = shown.neutral !== undefined;
  const faceLabel = face ? t(FACE_LABEL_KEYS[face]) : "";
  const label = face ? t("ui.otomeForge.reader.faceOf", { name: li.name, face: faceLabel }) : li.name;
  const FaceIcon = face ? FACE_ICONS[face] : null;
  return (
    <figure
      className="of-face"
      data-face={face || "plain"}
      data-speaking={speaking}
      data-art={shown.art ? "portrait" : "initials"}
      style={{ "--of-li-accent": accentOf(li) } as CSSProperties}
      role="img"
      aria-label={label}
    >
      {shown.art ? (
        <FaceLayers url={shown.art} />
      ) : (
        <div className="of-face-medallion" aria-hidden="true">
          <span className="of-face-aura" />
          <span className="of-face-ring" />
          <span className="of-face-initials">{initialsOf(li.name)}</span>
        </div>
      )}
      {FaceIcon && !painted ? (
        <figcaption className="of-face-chip" aria-hidden="true">
          <FaceIcon size={13} strokeWidth={2.2} />
          {faceLabel}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Two image layers: a new face decodes in the hidden one, then the two crossfade (instantly under reduced motion). */
function FaceLayers({ url }: { url: string }) {
  const [layers, setLayers] = useState<{ a: string; b: string; front: "a" | "b" }>({ a: url, b: "", front: "a" });
  useEffect(() => {
    if (url === layers[layers.front]) return;
    let live = true;
    const image = new Image();
    image.src = url;
    image
      .decode()
      .catch(() => undefined)
      .finally(() => {
        if (!live) return;
        setLayers((current) => {
          const back = current.front === "a" ? "b" : "a";
          return { ...current, [back]: url, front: back };
        });
      });
    return () => {
      live = false;
    };
    // Runs when the face changes; the layers it reads are the ones on screen then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
  return (
    <div className="of-face-art" aria-hidden="true">
      {(["a", "b"] as const).map((layer) =>
        layers[layer] ? (
          <img key={layer} className="of-face-img" src={layers[layer]} alt="" data-front={layers.front === layer} />
        ) : null,
      )}
    </div>
  );
}

const QUIET_STATUS_KEYS: Partial<Record<PaintState, string>> = {
  pending: "ui.otomeForge.reader.cgPainting",
  failed: "ui.otomeForge.reader.cgFailed",
  stopped: "ui.otomeForge.reader.cgStopped",
};

interface QuietCgProps {
  names: string[];
  /** The image's paint state; none, a story played without images. */
  state?: PaintState;
  /** Paints it now (it waited for consent) or tries it again (a failed or stopped one); only on the player's tap. */
  onPaint?: () => void;
  busy?: boolean;
}

/**
 * A key image in the story: until it is painted (or in a story without images), a quiet card in its place. One that
 * waited for "Ask before painting", failed or stopped offers its paint, with its cost.
 */
export function QuietCg({ names, state, onPaint, busy = false }: QuietCgProps) {
  const { t } = useTranslation();
  const statusKey = state ? QUIET_STATUS_KEYS[state] : undefined;
  const offer = onPaint && (state === "waiting-consent" || state === "failed" || state === "stopped");
  const retry = state === "failed" || state === "stopped";
  return (
    <figure className="of-cg-quiet of-glass" data-state={state ?? "none"}>
      <span className="of-cg-frame" role="img" aria-label={t("ui.otomeForge.reader.cgQuiet")}>
        <Sparkles size={22} strokeWidth={1.5} aria-hidden="true" />
        {names.length ? (
          <span className="of-cg-names" aria-hidden="true">
            {names.map(initialsOf).join(" · ")}
          </span>
        ) : null}
      </span>
      <figcaption className="of-cg-caption">
        <span className="of-hand">{t("ui.otomeForge.reader.cgQuiet")}</span>
        {statusKey ? (
          <span className="of-hint" role="status">
            {t(statusKey)}
          </span>
        ) : null}
        {offer ? (
          <>
            <button
              type="button"
              className="of-button of-button--primary of-button--small"
              aria-disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                if (!busy) onPaint();
              }}
            >
              {retry ? (
                <RotateCcw size={15} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Paintbrush size={15} strokeWidth={2} aria-hidden="true" />
              )}
              {retry ? t("ui.otomeForge.reader.cgRetry") : t("ui.otomeForge.reader.cgPaint")}
            </button>
            <CostHint images={1} />
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}
