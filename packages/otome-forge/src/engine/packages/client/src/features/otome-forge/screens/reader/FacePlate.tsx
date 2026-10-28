// ──────────────────────────────────────────────
// Otome Forge: the love interest on stage. His face changes line by line: with a painted face (M2b) the two image
// layers crossfade (the next one decodes behind the shown one first); without art he is his initials on his accent
// colour, and the face shows as an aura and a labelled chip, so the change never rests on colour or a picture alone.
// ──────────────────────────────────────────────
import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Heart, HeartCrack, Snowflake, Sparkles, type LucideIcon } from "lucide-react";
import { forgeStoryExpressionArt } from "@forge-kit/story-expressions.mjs";
import { accentOf, initialsOf } from "../../lib/accent";
import type { RunLiView } from "../../shared/api-types";
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

/** The painted faces an LI view carries once M2b paints them (absent until then). */
type WithExpressions = RunLiView & { expressions?: Record<string, unknown> };

interface FacePlateProps {
  li: RunLiView | null;
  face: Face | "";
  /** The current line is his. */
  speaking: boolean;
}

export function FacePlate({ li, face, speaking }: FacePlateProps) {
  const { t } = useTranslation();
  if (!li) return null;
  const shown = forgeStoryExpressionArt(
    { art: li.portrait ?? "", expressions: (li as WithExpressions).expressions ?? {} },
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

/** A key image the story stored a brief for (M2b paints it): until then, a quiet card in its place. */
export function QuietCg({ names }: { names: string[] }) {
  const { t } = useTranslation();
  return (
    <figure className="of-cg-quiet of-glass" role="img" aria-label={t("ui.otomeForge.reader.cgQuiet")}>
      <span className="of-cg-frame" aria-hidden="true">
        <Sparkles size={22} strokeWidth={1.5} />
        {names.length ? <span className="of-cg-names">{names.map(initialsOf).join(" · ")}</span> : null}
      </span>
      <figcaption className="of-hand">{t("ui.otomeForge.reader.cgQuiet")}</figcaption>
    </figure>
  );
}
