import React from "react";

/** Phone screen aspect (matches .vp-shell). The crop box and exported image both use it. */
const ASPECT_W = 9;
const ASPECT_H = 19.5;
const VIEW_W = 150;
const VIEW_H = Math.round((VIEW_W * ASPECT_H) / ASPECT_W);
const OUT_W = 720;
const OUT_H = Math.round((OUT_W * ASPECT_H) / ASPECT_W);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Pan-and-zoom cropper for a picked wallpaper. The image always covers the phone-shaped viewport;
 * dragging moves it and the slider zooms in, then Use exports just the visible region as a JPEG.
 */
export function WallpaperCropper({ src, onCancel, onDone }: { src: string; onCancel(): void; onDone(dataUrl: string): void }) {
  const [nat, setNat] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const drag = React.useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  // Scale that makes the image just cover the viewport; zoom multiplies it.
  const cover = nat ? Math.max(VIEW_W / nat.w, VIEW_H / nat.h) : 1;
  const scale = cover * zoom;
  const dispW = nat ? nat.w * scale : VIEW_W;
  const dispH = nat ? nat.h * scale : VIEW_H;

  const clampOffset = React.useCallback((x: number, y: number) => ({
    x: clamp(x, VIEW_W - dispW, 0),
    y: clamp(y, VIEW_H - dispH, 0),
  }), [dispW, dispH]);

  React.useEffect(() => { setOffset((current) => clampOffset(current.x, current.y)); }, [clampOffset]);

  const onDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
  };
  const onMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const next = clampOffset(drag.current.ox + (event.clientX - drag.current.px), drag.current.oy + (event.clientY - drag.current.py));
    setOffset(next);
  };
  const onUp = () => { drag.current = null; };

  const apply = () => {
    const img = imgRef.current;
    if (!img || !nat) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // The viewport shows a window into the scaled image; map it back to source pixels.
    const srcX = -offset.x / scale;
    const srcY = -offset.y / scale;
    ctx.drawImage(img, srcX, srcY, VIEW_W / scale, VIEW_H / scale, 0, 0, OUT_W, OUT_H);
    onDone(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="vp-cropper">
      <p className="vp-muted-note">Drag to reposition, slide to zoom.</p>
      <div className="vp-cropper-view" style={{ width: VIEW_W, height: VIEW_H }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => { const el = event.currentTarget; setNat({ w: el.naturalWidth, h: el.naturalHeight }); }}
          style={{ position: "absolute", left: offset.x, top: offset.y, width: dispW, height: dispH, maxWidth: "none", userSelect: "none", touchAction: "none" }}
        />
      </div>
      <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="vp-range" aria-label="Zoom" />
      <div className="vp-cropper-actions">
        <button type="button" onClick={onCancel} className="vp-surface-btn">Cancel</button>
        <button type="button" onClick={apply} disabled={!nat} className="vp-accent-btn">Use</button>
      </div>
    </div>
  );
}
