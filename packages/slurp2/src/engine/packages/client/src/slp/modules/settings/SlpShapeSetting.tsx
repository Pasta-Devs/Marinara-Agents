/**
 * Picture size as a shape, not as two numbers. Four common shapes cover almost every model; "Own
 * size" opens the exact width and height for the rest. A stored size that matches no shape shows
 * as "Own size" with its numbers, so nothing is lost. The caller draws the search anchors.
 */
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { NumberSetting } from "./SlpSettingsControls";

const SHAPES = [
  { id: "square", width: 1024, height: 1024 },
  { id: "portrait", width: 1024, height: 1280 },
  { id: "tall", width: 768, height: 1344 },
  { id: "landscape", width: 1216, height: 832 },
] as const;

export function slpShapeFor(width: number, height: number): string | null {
  return SHAPES.find((shape) => shape.width === width && shape.height === height)?.id ?? null;
}

export function ShapeSetting({
  label,
  detail,
  width,
  height,
  onSave,
}: {
  label: string;
  detail?: string;
  width: number;
  height: number;
  onSave: (width: number, height: number) => void;
}) {
  const { t } = useTranslation();
  const name = useId();
  const matched = slpShapeFor(width, height);
  // Decided once from the stored size, then only by the player's clicks: typing an exact size
  // that happens to match a shape must not close the inputs under the cursor.
  const [own, setOwn] = useState(matched === null);
  const option = (
    id: string,
    checked: boolean,
    onPick: () => void,
    frame: { width: number; height: number } | null,
  ) => (
    <label
      key={id}
      className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl p-2 text-center ring-1 ring-inset transition-colors focus-within:ring-2 focus-within:ring-[var(--slurp-focus,var(--noodle-accent))] motion-reduce:transition-none ${checked ? "bg-[var(--slurp-nav-active)] ring-[var(--noodle-accent)]/45" : "bg-[var(--slurp-canvas,var(--background))] ring-[var(--slurp-outline,var(--border))] hover:bg-[var(--accent)]/40"}`}
    >
      <input type="radio" name={name} checked={checked} onChange={onPick} className="sr-only" />
      {/* The frame is the shape itself, scaled to fit a 40 px box. */}
      <span className="grid h-10 place-items-center" aria-hidden="true">
        <span
          className={`block rounded-[3px] border-2 ${checked ? "border-[var(--noodle-accent)]" : "border-[var(--slurp-muted,var(--muted-foreground))]"} ${frame ? "" : "border-dashed"}`}
          style={
            frame
              ? {
                  width: `${(40 * frame.width) / Math.max(frame.width, frame.height)}px`,
                  height: `${(40 * frame.height) / Math.max(frame.width, frame.height)}px`,
                }
              : { width: 30, height: 30 }
          }
        />
      </span>
      <span className="text-xs font-semibold">{t(`ui.slurp.settings.images.shape.${id}`)}</span>
      {frame && (
        <span className="-mt-1.5 text-[11px] tabular-nums text-[var(--slurp-muted,var(--muted-foreground))]">
          {frame.width}×{frame.height}
        </span>
      )}
    </label>
  );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="float-left mb-2 w-full text-sm font-semibold">{label}</legend>
      {detail && <p className="clear-left max-w-prose text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>}
      <div className="clear-left grid grid-cols-3 gap-2 sm:grid-cols-5">
        {SHAPES.map((shape) =>
          option(
            shape.id,
            !own && matched === shape.id,
            () => {
              setOwn(false);
              onSave(shape.width, shape.height);
            },
            shape,
          ),
        )}
        {option("own", own, () => setOwn(true), null)}
      </div>
      {own && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
          <NumberSetting
            label={t("ui.slurp.settings.images.width")}
            value={width}
            min={64}
            max={4096}
            onSave={(value) => onSave(value, height)}
          />
          <span className="text-[var(--slurp-muted,var(--muted-foreground))]" aria-hidden="true">
            ×
          </span>
          <NumberSetting
            label={t("ui.slurp.settings.images.height")}
            value={height}
            min={64}
            max={4096}
            onSave={(value) => onSave(width, value)}
          />
          <span className="text-xs text-[var(--slurp-muted,var(--muted-foreground))]">px</span>
        </div>
      )}
    </fieldset>
  );
}
