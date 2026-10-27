// Turns a painted creature on a flat background into a small pixel-art sprite form.
// Pure functions on RGBA buffers: no DOM, no canvas, so tests can run them in Node.
import type { SaucelingStage } from "../../../../shared/src/features/agents/saucelings/types.js";

/** An RGBA picture: 4 bytes per pixel, row by row. */
export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Art pixels per side of a sprite frame. */
export const FORM_FRAME = 52;
/** The art row the bottom of every drawing stands on. */
export const FORM_BASELINE = 49;
/** Each art pixel is drawn as this many screen pixels in a strip. */
export const FORM_SCALE = 2;
/** The most colours a form's palette holds. */
export const FORM_COLOURS = 16;
/** The target height of a form's creature, in art pixels, per stage: the built-in sprites' real heights. Its width is capped at FORM_FRAME - 4. */
export const FORM_SIZES: Record<SaucelingStage, number> = {
  egg: 32,
  hatchling: 29,
  juvenile: 37,
  adult: 45,
  elder: 46,
};

/** A rectangle in a picture's pixels. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const blank = (width: number, height: number): Rgba => ({
  data: new Uint8ClampedArray(width * height * 4),
  width,
  height,
});

/** The average colour of a small square patch at (x, y), clamped to the picture. */
const patchAverage = (image: Rgba, x: number, y: number, size: number): [number, number, number] => {
  const sum = [0, 0, 0];
  let count = 0;
  for (let py = y; py < Math.min(y + size, image.height); py++) {
    for (let px = x; px < Math.min(x + size, image.width); px++) {
      const i = (py * image.width + px) * 4;
      sum[0]! += image.data[i]!;
      sum[1]! += image.data[i + 1]!;
      sum[2]! += image.data[i + 2]!;
      count++;
    }
  }
  return [Math.round(sum[0]! / count), Math.round(sum[1]! / count), Math.round(sum[2]! / count)];
};

/** Removes the flat background: every pixel of the corner colour that touches the picture's edge becomes transparent. Background-coloured pixels enclosed by the creature stay. */
export function keyOutBackground(image: Rgba, tolerance = 48): Rgba {
  const { width, height } = image;
  const out: Rgba = { data: new Uint8ClampedArray(image.data), width, height };
  if (width === 0 || height === 0) return out;

  // The background is the colour most corners agree on; ties go to the top-left corner.
  const patch = 4;
  const corners = [
    patchAverage(image, 0, 0, patch),
    patchAverage(image, Math.max(0, width - patch), 0, patch),
    patchAverage(image, 0, Math.max(0, height - patch), patch),
    patchAverage(image, Math.max(0, width - patch), Math.max(0, height - patch), patch),
  ];
  const near = (a: number[], b: number[]) =>
    Math.max(Math.abs(a[0]! - b[0]!), Math.abs(a[1]! - b[1]!), Math.abs(a[2]! - b[2]!)) <= tolerance;
  let background = corners[0]!;
  let best = 0;
  for (const candidate of corners) {
    const votes = corners.filter((other) => near(candidate, other)).length;
    if (votes > best) {
      best = votes;
      background = candidate;
    }
  }

  const matches = (p: number) => {
    const i = p * 4;
    return image.data[i + 3]! < 16 || near([image.data[i]!, image.data[i + 1]!, image.data[i + 2]!], background);
  };

  // Flood fill from the border, 4-connected, with an explicit stack (each pixel is pushed at most once).
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;
  const push = (p: number) => {
    if (seen[p] || !matches(p)) return;
    seen[p] = 1;
    stack[top++] = p;
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (top > 0) {
    const p = stack[--top]!;
    out.data[p * 4 + 3] = 0;
    const x = p % width;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < width * (height - 1)) push(p + width);
  }
  return out;
}

/** The smallest box holding every pixel whose alpha is at least the threshold, or null when there is none. */
export function contentBounds(
  image: Rgba,
  alphaThreshold = 128,
): { x: number; y: number; width: number; height: number } | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3]! < alphaThreshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Scales the part of the picture inside `box` by `scale`, makes the edge crisp, and stands it with its bottom on row
 *  frame - margin - 1: centred, or with its right edge at column `right`. */
const placeBox = (image: Rgba, box: Box, scale: number, frame: number, margin: number, right?: number): Rgba => {
  const out = blank(frame, frame);
  const w = Math.max(1, Math.round(box.width * scale));
  const h = Math.max(1, Math.round(box.height * scale));
  const left = right === undefined ? Math.floor((frame - w) / 2) : right - w;
  const top = frame - margin - h;
  const down = scale < 1;

  for (let y = 0; y < h; y++) {
    if (top + y < 0 || top + y >= frame) continue;
    for (let x = 0; x < w; x++) {
      if (left + x < 0 || left + x >= frame) continue;
      // Source span of this output pixel; the nearest-neighbour case reads one pixel, the area case averages the span.
      const x0 = (x * box.width) / w;
      const x1 = ((x + 1) * box.width) / w;
      const y0 = (y * box.height) / h;
      const y1 = ((y + 1) * box.height) / h;
      let weight = 0;
      let alpha = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      const sxFrom = Math.floor(x0);
      const syFrom = Math.floor(y0);
      const sxTo = down ? Math.ceil(x1) : sxFrom + 1;
      const syTo = down ? Math.ceil(y1) : syFrom + 1;
      for (let sy = syFrom; sy < Math.min(syTo, box.height); sy++) {
        for (let sx = sxFrom; sx < Math.min(sxTo, box.width); sx++) {
          const cover = down
            ? (Math.min(sx + 1, x1) - Math.max(sx, x0)) * (Math.min(sy + 1, y1) - Math.max(sy, y0))
            : 1;
          const i = ((box.y + sy) * image.width + box.x + sx) * 4;
          const a = image.data[i + 3]!;
          weight += cover;
          alpha += cover * a;
          // Colour is weighted by alpha so a faint edge pixel does not darken the average.
          r += cover * a * image.data[i]!;
          g += cover * a * image.data[i + 1]!;
          b += cover * a * image.data[i + 2]!;
        }
      }
      if (alpha <= 0 || alpha / weight < 128) continue;
      const o = ((top + y) * frame + left + x) * 4;
      out.data[o] = Math.round(r / alpha);
      out.data[o + 1] = Math.round(g / alpha);
      out.data[o + 2] = Math.round(b / alpha);
      out.data[o + 3] = 255;
    }
  }
  return out;
};

/** Crops to the creature, scales it to the given height (or narrower, so it fits the frame's width), makes the edge crisp, and stands it centred on the bottom of a square frame. A `scale` overrides the fit, so several drawings can share one. */
export function fitToFrame(image: Rgba, height: number, frame = FORM_FRAME, margin = 2, scale?: number): Rgba {
  const box = contentBounds(image);
  if (!box) return blank(frame, frame);
  return placeBox(image, box, scale ?? Math.min(height / box.height, (frame - 4) / box.width), frame, margin);
}

/** Makes each pixel a factor × factor block, with no smoothing. */
export function upscaleNearest(image: Rgba, factor: number): Rgba {
  const f = Math.max(1, Math.floor(factor));
  const out = blank(image.width * f, image.height * f);
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const from = (Math.floor(y / f) * image.width + Math.floor(x / f)) * 4;
      out.data.set(image.data.subarray(from, from + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

// ---- Animation strips: the three frames each form shows (rest and two squash/stretch or lean poses) ----

/** The first and last rows holding any pixel, or null for an empty frame. */
const rowSpan = (frame: Rgba): { top: number; bottom: number } | null => {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (frame.data[(y * frame.width + x) * 4 + 3]! === 0) continue;
      if (top < 0) top = y;
      bottom = y;
      break;
    }
  }
  return top < 0 ? null : { top, bottom };
};

const copyRow = (from: Rgba, fromRow: number, to: Rgba, toRow: number) => {
  const n = from.width * 4;
  to.data.set(from.data.subarray(fromRow * n, fromRow * n + n), toRow * n);
};

/** The darkest solid colour of a frame (the outline colour), by red + green + blue. Black for an empty frame. */
export function inkOf(frame: Rgba): [number, number, number] {
  let best = Infinity;
  let ink: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < frame.data.length; i += 4) {
    if (frame.data[i + 3]! === 0) continue;
    const sum = frame.data[i]! + frame.data[i + 1]! + frame.data[i + 2]!;
    if (sum < best) {
      best = sum;
      ink = [frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!];
    }
  }
  return ink;
}

/** Gives every pixel that touches the outside (a missing or off-frame 4-neighbour) the outline colour. */
export function reoutline(frame: Rgba, ink: readonly number[]): Rgba {
  const { width, height } = frame;
  const out: Rgba = { data: new Uint8ClampedArray(frame.data), width, height };
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && frame.data[(y * width + x) * 4 + 3]! > 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!solid(x, y) || (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) continue;
      out.data.set([ink[0]!, ink[1]!, ink[2]!], (y * width + x) * 4);
    }
  }
  return out;
}

/** The lower-body row most like the one above it, so dropping or doubling it changes the least; later rows win ties. */
export function quietRow(frame: Rgba): number {
  const span = rowSpan(frame);
  if (!span) return 0;
  const lo = Math.max(1, span.top + Math.floor((span.bottom - span.top) / 2));
  const hi = span.bottom - 2;
  let best = Math.min(lo, span.bottom);
  let bestDiff = Infinity;
  const n = frame.width * 4;
  for (let k = lo; k <= hi; k++) {
    let diff = 0;
    for (let x = 0; x < frame.width; x++) {
      const a = k * n + x * 4;
      const b = a - n;
      if (
        frame.data[a]! !== frame.data[b]! ||
        frame.data[a + 1]! !== frame.data[b + 1]! ||
        frame.data[a + 2]! !== frame.data[b + 2]! ||
        frame.data[a + 3]! !== frame.data[b + 3]!
      )
        diff++;
    }
    if (diff <= bestDiff) {
      bestDiff = diff;
      best = k;
    }
  }
  return best;
}

/** Drops row k: everything above it moves down one row, so the top sinks and the bottom stays. */
export function squashFrame(frame: Rgba, k: number): Rgba {
  const out = blank(frame.width, frame.height);
  for (let y = 0; y < frame.height; y++) {
    if (y === 0) continue;
    if (y <= k) copyRow(frame, y - 1, out, y);
    else copyRow(frame, y, out, y);
  }
  return out;
}

/** Doubles row k: everything above it moves up one row, so the top rises and the bottom stays. */
export function stretchFrame(frame: Rgba, k: number): Rgba {
  const out = blank(frame.width, frame.height);
  for (let y = 0; y < frame.height; y++) {
    if (y < k - 1) copyRow(frame, y + 1, out, y);
    else copyRow(frame, y, out, y);
  }
  return out;
}

/** Rocks the drawing on its base: the top third of its rows shifts d × 2 px, the middle third d × 1 px, the bottom third stays. Nothing wraps. */
export function leanFrame(frame: Rgba, d: number): Rgba {
  const out = blank(frame.width, frame.height);
  const span = rowSpan(frame);
  if (!span) return out;
  const h = span.bottom - span.top + 1;
  for (let y = 0; y < frame.height; y++) {
    const shift = d * (y < span.top + h / 3 ? 2 : y < span.top + (2 * h) / 3 ? 1 : 0);
    for (let x = 0; x < frame.width; x++) {
      const to = x + shift;
      if (to < 0 || to >= frame.width) continue;
      const from = (y * frame.width + x) * 4;
      out.data.set(frame.data.subarray(from, from + 4), (y * frame.width + to) * 4);
    }
  }
  return out;
}

/** The three frames of a creature: rest, squashed, stretched. */
export function creatureStrip(frame: Rgba): Rgba[] {
  const ink = inkOf(frame);
  const k = quietRow(frame);
  return [frame, reoutline(squashFrame(frame, k), ink), reoutline(stretchFrame(frame, k), ink)];
}

/** The three frames of an egg: still, rocked left, rocked right. */
export function eggStrip(frame: Rgba): Rgba[] {
  const ink = inkOf(frame);
  return [frame, reoutline(leanFrame(frame, -1), ink), reoutline(leanFrame(frame, 1), ink)];
}

/** Puts the frames side by side and enlarges each art pixel to scale × scale pixels (3 frames of 52 → 312 × 104). */
export function stripImage(frames: Rgba[], scale = FORM_SCALE): Rgba {
  const width = frames.reduce((sum, f) => sum + f.width, 0);
  const row = blank(width, frames[0]?.height ?? 0);
  let left = 0;
  for (const f of frames) {
    for (let y = 0; y < f.height; y++) {
      row.data.set(f.data.subarray(y * f.width * 4, (y + 1) * f.width * 4), (y * width + left) * 4);
    }
    left += f.width;
  }
  return upscaleNearest(row, scale);
}

// ---- Palette ----

/** Solid pixels with at least two solid neighbours (of eight): a lone speck is not part of the drawing. */
const solidMask = (frame: Rgba): Uint8Array => {
  const { width, height } = frame;
  const mask = new Uint8Array(width * height);
  const alpha = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && frame.data[(y * width + x) * 4 + 3]! >= 128 ? 1 : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alpha(x, y)) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n += alpha(x + dx, y + dy);
      if (n >= 2) mask[y * width + x] = 1;
    }
  }
  return mask;
};

/** One shared palette of at most `colours` colours for all the frames, a 1 px outline in its darkest colour, and no specks. Returns new, fully opaque-or-clear frames. */
export function reducePalette(frames: Rgba[], colours = FORM_COLOURS): Rgba[] {
  const masks = frames.map(solidMask);

  // Pool the solid colours by 4 bits a channel; each bin counts by the square root of its pixels, so a small bright part (a flame) keeps its colour.
  const counts = new Int32Array(4096);
  const first = new Int32Array(4096);
  const order: number[] = [];
  frames.forEach((f, n) => {
    for (let p = 0; p < f.width * f.height; p++) {
      if (!masks[n]![p]) continue;
      const r = f.data[p * 4]!;
      const g = f.data[p * 4 + 1]!;
      const b = f.data[p * 4 + 2]!;
      const bin = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      if (counts[bin]!++ === 0) {
        first[bin] = (r << 16) | (g << 8) | b;
        order.push(bin);
      }
    }
  });
  const items = order.map((bin) => ({
    c: [first[bin]! >> 16, (first[bin]! >> 8) & 255, first[bin]! & 255],
    w: Math.ceil(Math.sqrt(counts[bin]!)),
  }));

  // Median cut: split the box with the widest channel range at its weighted median until there are enough boxes.
  const range = (box: typeof items) => {
    let best = -1;
    let channel = 0;
    for (let c = 0; c < 3; c++) {
      let lo = 255;
      let hi = 0;
      for (const item of box) {
        lo = Math.min(lo, item.c[c]!);
        hi = Math.max(hi, item.c[c]!);
      }
      if (hi - lo > best) {
        best = hi - lo;
        channel = c;
      }
    }
    return { spread: best, channel };
  };
  const boxes = items.length ? [items] : [];
  while (boxes.length < colours) {
    let pick = -1;
    let widest = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      const { spread } = range(box);
      if (spread > widest) {
        widest = spread;
        pick = i;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick]!;
    const { channel } = range(box);
    const sorted = [...box].sort((a, b) => a.c[channel]! - b.c[channel]!);
    const half = sorted.reduce((sum, item) => sum + item.w, 0) / 2;
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += sorted[i]!.w;
      cut = i + 1;
      if (acc >= half) break;
    }
    boxes.splice(pick, 1, sorted.slice(0, cut), sorted.slice(cut));
  }
  const palette = boxes.map((box) => {
    const total = box.reduce((sum, item) => sum + item.w, 0);
    return [0, 1, 2].map((c) => Math.round(box.reduce((sum, item) => sum + item.w * item.c[c]!, 0) / total));
  });
  let ink = palette[0] ?? [0, 0, 0];
  for (const c of palette) if (c[0]! + c[1]! + c[2]! < ink[0]! + ink[1]! + ink[2]!) ink = c;

  const nearest = new Map<number, number>();
  return frames.map((f, n) => {
    const out = blank(f.width, f.height);
    for (let p = 0; p < f.width * f.height; p++) {
      if (!masks[n]![p]) continue;
      const r = f.data[p * 4]!;
      const g = f.data[p * 4 + 1]!;
      const b = f.data[p * 4 + 2]!;
      const key = (r << 16) | (g << 8) | b;
      let index = nearest.get(key);
      if (index === undefined) {
        let best = Infinity;
        index = 0;
        palette.forEach((c, i) => {
          const d = (c[0]! - r) ** 2 + (c[1]! - g) ** 2 + (c[2]! - b) ** 2;
          if (d < best) {
            best = d;
            index = i;
          }
        });
        nearest.set(key, index);
      }
      out.data.set([...palette[index]!, 255], p * 4);
    }
    return reoutline(out, ink);
  });
}

// ---- Reading a sheet of drawings ----

/** The spans of consecutive non-zero entries, where a hole of more than `gap` entries ends a span; spans shorter than `minLen` are dropped. Spans are [start, end). */
const runs = (counts: ArrayLike<number>, gap: number, minLen: number): [number, number][] => {
  const spans: [number, number][] = [];
  let start = -1;
  let prev = -1;
  for (let i = 0; i < counts.length; i++) {
    if (!counts[i]) continue;
    if (start >= 0 && i - prev > gap) {
      spans.push([start, prev + 1]);
      start = -1;
    }
    if (start < 0) start = i;
    prev = i;
  }
  if (start >= 0) spans.push([start, prev + 1]);
  return spans.filter(([a, b]) => b - a >= minLen);
};

/** How many drawings each row of a life sheet holds: two eggs (whole and cracking), four views of each other stage. */
export const sheetLayout = (stages: SaucelingStage[]) => stages.map((stage) => (stage === "egg" ? 2 : 4));

/** Reads a generated sheet: `layout` is the number of drawings expected in each row (e.g. [2, 4, 4, 4, 4]: two eggs, then happy, content, grumpy and side views). Returns each drawing's box in the picture's pixels, notes on anything odd, and the picture with its background (and any scraps cut off a neighbour) keyed out, or null when the rows or columns cannot be found. With `splitTouching` off, a row with too few drawings is not cut apart either. With `firstRows`, rows past the layout's are left out instead of failing the read. */
export function readSheet(
  image: Rgba,
  layout: number[],
  splitTouching = true,
  firstRows = false,
): { cells: Box[][]; notes: string[]; keyed: Rgba } | null {
  const keyed = keyOutBackground(image);
  const { width, height } = keyed;
  const ink = new Uint8Array(width * height);
  for (let p = 0; p < ink.length; p++) ink[p] = keyed.data[p * 4 + 3]! >= 128 ? 1 : 0;
  const unit = Math.max(width, height) / 1024;
  const gap = Math.round(10 * unit);
  const minLen = Math.round(16 * unit);
  const notes: string[] = [];

  /** Ink per row (or per column) inside a rectangle; the array is indexed by absolute row (column). */
  const rowInk = (x0: number, x1: number, y0: number, y1: number) => {
    const counts = new Int32Array(height);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) counts[y]! += ink[y * width + x]!;
    return counts;
  };
  const colInk = (x0: number, x1: number, y0: number, y1: number) => {
    const counts = new Int32Array(width);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) counts[x]! += ink[y * width + x]!;
    return counts;
  };
  const argmin = (counts: Int32Array, lo: number, hi: number) => {
    let at = lo;
    for (let i = lo; i < hi; i++) if (counts[i]! < counts[at]!) at = i;
    return at;
  };
  /** A cell cut from drawings that touch, without the scraps of its neighbours: pieces of ink apart from its body
   *  that reach a cut (hair or a tail across it, at column `cutLeft` or `cutRight`; -1 for none) are keyed out
   *  and left out of its box. */
  const withoutScraps = (box: { l: number; t: number; r: number; b: number }, cutLeft: number, cutRight: number) => {
    const w = box.r - box.l;
    const h = box.b - box.t;
    const part = new Int32Array(w * h).fill(-1);
    const parts: Array<{ size: number; l: number; t: number; r: number; b: number }> = [];
    const inked = (x: number, y: number) => ink[(box.t + y) * width + box.l + x] === 1;
    for (let start = 0; start < w * h; start++) {
      if (part[start] !== -1 || !inked(start % w, Math.floor(start / w))) continue;
      const piece = { size: 0, l: w, t: h, r: 0, b: 0 };
      part[start] = parts.length;
      const stack = [start];
      while (stack.length) {
        const p = stack.pop()!;
        const x = p % w;
        const y = (p - x) / w;
        piece.size++;
        piece.l = Math.min(piece.l, x);
        piece.r = Math.max(piece.r, x + 1);
        piece.t = Math.min(piece.t, y);
        piece.b = Math.max(piece.b, y + 1);
        for (const [nx, ny] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as const) {
          const q = ny * w + nx;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && part[q] === -1 && inked(nx, ny)) {
            part[q] = parts.length;
            stack.push(q);
          }
        }
      }
      parts.push(piece);
    }
    const body = Math.max(...parts.map((p) => p.size));
    const scrap = parts.map((p) => p.size !== body && (box.l + p.l === cutLeft || box.l + p.r === cutRight));
    for (let q = 0; q < w * h; q++) {
      if (part[q]! >= 0 && scrap[part[q]!])
        keyed.data[((box.t + Math.floor(q / w)) * width + box.l + (q % w)) * 4 + 3] = 0;
    }
    const kept = parts.filter((_, i) => !scrap[i]);
    return {
      l: box.l + Math.min(...kept.map((p) => p.l)),
      t: box.t + Math.min(...kept.map((p) => p.t)),
      r: box.l + Math.max(...kept.map((p) => p.r)),
      b: box.t + Math.max(...kept.map((p) => p.b)),
    };
  };

  // Rows of drawings. A band far shorter than the rest is a line of label text; rows that touch are split at their emptiest line.
  const allRows = rowInk(0, width, 0, height);
  let bands = runs(allRows, gap, minLen);
  if (!bands.length) return null;
  const medianHeight = () => bands.map(([a, b]) => b - a).sort((a, b) => a - b)[Math.floor(bands.length / 2)]!;
  const labels = 0.3 * medianHeight();
  bands = bands.filter(([a, b]) => b - a >= labels);
  if (firstRows) bands = bands.slice(0, layout.length);
  while (bands.length < layout.length) {
    let tall = 0;
    bands.forEach(([a, b], i) => {
      if (b - a > bands[tall]![1] - bands[tall]![0]) tall = i;
    });
    const [top, bottom] = bands[tall]!;
    const lo = top + Math.floor(0.3 * (bottom - top));
    const hi = top + Math.floor(0.7 * (bottom - top));
    if (hi <= lo) return null;
    const cut = argmin(allRows, lo, hi);
    if (cut <= top) return null;
    // Two touching rows make a band about twice the height of a row; a band not clearly taller than every other band
    // (rows grow from stage to stage, so not the median) is a row, so a row is missing. A lone band has no other to be
    // measured against, so it is two rows only where its ink thins clearly at the cut.
    const others = bands.filter((_, i) => i !== tall).map(([a, b]) => b - a);
    if (others.length) {
      if (bottom - top < 1.4 * Math.max(...others)) return null;
    } else {
      const typical = Array.from(allRows.subarray(top, bottom)).sort((a, b) => a - b)[Math.floor((bottom - top) / 2)]!;
      if (allRows[cut]! >= 0.25 * typical) return null;
    }
    bands.splice(tall, 1, [top, cut], [cut, bottom]);
  }
  if (bands.length !== layout.length) return null;

  const cells: Box[][] = [];
  for (let r = 0; r < bands.length; r++) {
    const [top, bottom] = bands[r]!;
    const expected = layout[r]!;
    const cols = colInk(0, width, top, bottom);
    let groups = runs(cols, gap, minLen);
    if (!groups.length) return null;

    // A drawing far smaller than the others in its row (a stray spark) is not one of them.
    const sizes = groups.map(([a, b]) => {
      const rows = rowInk(a, b, top, bottom);
      let first = top;
      while (!rows[first]) first++;
      let last = bottom - 1;
      while (!rows[last]) last--;
      return { h: last - first + 1, w: b - a };
    });
    const tall = Math.max(...sizes.map((s) => s.h));
    const wide = Math.max(...sizes.map((s) => s.w));
    groups = groups.filter((_, i) => sizes[i]!.h >= 0.6 * tall || sizes[i]!.w >= 0.6 * wide);

    if (groups.length > 2 * expected) return null;
    let cut = false;
    if (groups.length > expected) {
      // The model repeated the row (front, side, front, side): the first ones are the ones asked for.
      notes.push(`row ${r + 1}: ${groups.length} drawings, first ${expected} used`);
      groups = groups.slice(0, expected);
    } else if (groups.length < expected) {
      if (!splitTouching) return null;
      // Drawings that touch: cut at the emptiest column near each even division.
      const left = groups[0]![0];
      const right = groups[groups.length - 1]![1];
      const step = (right - left) / expected;
      // Only a drawing too wide to be one can be two that touch; a row of narrower ones is missing a drawing.
      if (!groups.some(([a, b]) => b - a > 1.5 * step)) return null;
      const cuts = [left];
      for (let k = 1; k < expected; k++) {
        cuts.push(argmin(cols, Math.floor(left + (k - 0.15) * step), Math.floor(left + (k + 0.15) * step)));
      }
      cuts.push(right);
      groups = cuts.slice(0, -1).map((c, i) => [c, cuts[i + 1]!]);
      cut = true;
      notes.push(`row ${r + 1}: drawings touch, split at ${cuts.slice(1, -1).join(", ")}`);
    }

    const row: Box[] = [];
    for (const [left, right] of groups) {
      // The cell is the tight ink box; a thin wide smear apart from the body (a ground shadow) is cut off.
      const tight = (y0: number, y1: number) => {
        const rows = rowInk(left, right, y0, y1);
        const xs = colInk(left, right, y0, y1);
        let t = y0;
        while (t < y1 && !rows[t]) t++;
        if (t === y1) return null;
        let b = y1 - 1;
        while (!rows[b]) b--;
        let l = left;
        while (!xs[l]) l++;
        let rr = right - 1;
        while (!xs[rr]) rr--;
        return { l, t, r: rr + 1, b: b + 1, rows };
      };
      let box = tight(top, bottom);
      if (!box) return null;
      const lines = runs(box.rows.subarray(0, box.b), 1, 1).filter(([, end]) => end > box!.t);
      if (lines.length > 1) {
        const [from, to] = lines[lines.length - 1]!;
        const xs = colInk(left, right, from, to);
        let lo = left;
        while (!xs[lo]) lo++;
        let hi = right - 1;
        while (!xs[hi]) hi--;
        const smear = hi - lo + 1;
        if (to - from <= 0.12 * (box.b - box.t) && smear >= 4 * (to - from) && smear >= 0.4 * (box.r - box.l)) {
          box = tight(top, lines[lines.length - 2]![1]) ?? box;
        }
      }
      if (cut) {
        const cutLeft = left === groups[0]![0] ? -1 : left;
        const cutRight = right === groups[groups.length - 1]![1] ? -1 : right;
        box = { ...box, ...withoutScraps(box, cutLeft, cutRight) };
      }
      row.push({ x: box.l, y: box.t, width: box.r - box.l, height: box.b - box.t });
    }
    cells.push(row);
  }

  // Notes only: every row is scaled to its stage's height anyway.
  const eggRow = layout.length === 5 ? 0 : -1;
  if (eggRow === 0 && cells[0]!.length > 1) {
    const [a, b] = [cells[0]![0]!.height, cells[0]![1]!.height];
    if (Math.abs(a - b) > 0.25 * Math.max(a, b)) notes.push(`egg row sizes differ: ${a} vs ${b}`);
  }
  const content = (row: Box[]) => row[row.length >= 4 ? 1 : 0]!;
  for (let r = eggRow + 2; r < cells.length; r++) {
    const [now, before] = [content(cells[r]!).height, content(cells[r - 1]!).height];
    if (now < before * 0.95) notes.push(`row ${r + 1} (${now}) smaller than row ${r} (${before})`);
  }
  for (let r = eggRow + 1; r < cells.length; r++) {
    const row = cells[r]!;
    if (row.length < 2) continue;
    const [front, side] = [content(row).height, row[row.length - 1]!.height];
    if (Math.abs(front - side) > 0.3 * Math.max(front, side))
      notes.push(`row ${r + 1}: front ${front} vs side ${side}`);
  }
  return { cells, notes, keyed };
}

/** One form's animation strip(s): each is three frames (rest and two poses) at 2×, 312 × 104. */
export interface FormStrips {
  image: Rgba;
  side?: Rgba;
  happy?: Rgba;
  grumpy?: Rgba;
}

/** Cuts a read sheet into forms. `rowStages` names the stage each row draws. Every drawing in a row is scaled together to the stage's height, the whole sheet shares one palette, and a 4-wide creature row gives happy, content (image), grumpy and side strips. */
export function formsFromSheet(
  image: Rgba,
  read: { cells: Box[][]; keyed?: Rgba },
  rowStages: SaucelingStage[],
): Partial<Record<SaucelingStage, FormStrips>> {
  const keyed = read.keyed ?? keyOutBackground(image);
  const placed: Rgba[][] = read.cells.map((row, r) => {
    const stage = rowStages[r];
    if (!stage) return [];
    const scale = Math.min(
      FORM_SIZES[stage] / Math.max(...row.map((b) => b.height)),
      (FORM_FRAME - 4) / Math.max(...row.map((b) => b.width)),
    );
    return row.map((box) => placeBox(keyed, box, scale, FORM_FRAME, FORM_FRAME - FORM_BASELINE - 1));
  });
  const reduced = reducePalette(placed.flat());
  const forms: Partial<Record<SaucelingStage, FormStrips>> = {};
  let next = 0;
  placed.forEach((row, r) => {
    const frames = reduced.slice(next, next + row.length);
    next += row.length;
    const stage = rowStages[r];
    if (!stage || !frames.length) return;
    const strip = (i: number) => stripImage(stage === "egg" ? eggStrip(frames[i]!) : creatureStrip(frames[i]!));
    if (stage === "egg") forms[stage] = { image: strip(0) };
    else if (frames.length >= 4) {
      forms[stage] = { image: strip(1), happy: strip(0), grumpy: strip(2), side: strip(3) };
    } else forms[stage] = frames.length > 1 ? { image: strip(0), side: strip(1) } : { image: strip(0) };
  });
  return forms;
}

/** A caretaker's figure: eight frames of this many art pixels a side, one image pixel each, in the order of
 *  caretaker-look.ts's FIGURE_POSES. A figure painted before 0.6.0 has three. */
export const FIGURE_FRAME = 96;
/** The drawings in each row of a figure sheet: the poses facing the viewer, then the side views facing the pet. */
export const FIGURE_ROWS = [5, 3] as const;
/** How tall a caretaker's figure stands, and the widest it may be facing the viewer, in art pixels: their feet are
 *  on the frame's bottom row, and the stage shows them on the floor at its right. */
export const FIGURE_HEIGHT = 80;
export const FIGURE_WIDTH = 48;

/** The caretaker's drawings in the order of their poses: five over three as asked, or four over four, then the
 *  same with drawings that touch (big hair, a tail) cut apart. When the second row cannot be read, the first three
 *  of the top row (calm, happy, worried) make a figure of three. */
function figureDrawings(image: Rgba): { front: Box[]; facing: Box[]; keyed: Rgba } | null {
  const tries: Array<[number[], boolean]> = [
    [[...FIGURE_ROWS], false],
    [[4, 4], false],
    [[...FIGURE_ROWS], true],
  ];
  for (const [layout, split] of tries) {
    const read = readSheet(image, layout, split);
    const drawings = read?.cells.flat();
    if (read && drawings) {
      return { front: drawings.slice(0, FIGURE_ROWS[0]), facing: drawings.slice(FIGURE_ROWS[0]), keyed: read.keyed };
    }
  }
  const top = readSheet(image, [3], false, true);
  return top ? { front: top.cells[0]!, facing: [], keyed: top.keyed } : null;
}

/** Reads a picture of the caretaker's eight drawings, five facing the viewer over three facing left, into their
 *  figure strip (768 × 96, or 288 × 96 when only the first three can be read): the drawings scaled together, so
 *  they stand the same height, on one shared palette. The front ones stand centred; a side view stands with its
 *  back where the front ones end, so it reaches toward the pet on its left. Null when not even three drawings can
 *  be found apart. */
export function figureFromSheet(image: Rgba): Rgba | null {
  const drawings = figureDrawings(image);
  if (!drawings) return null;
  const { front, facing, keyed } = drawings;
  const frontWide = Math.max(...front.map((box) => box.width));
  const reach = Math.max(...facing.map((box) => box.width)) - frontWide / 2;
  const scale = Math.min(
    FIGURE_HEIGHT / Math.max(...[...front, ...facing].map((box) => box.height)),
    FIGURE_WIDTH / frontWide,
    // A side view, from the front ones' right edge, stays inside the frame, with two columns spare for rounding.
    reach > 0 ? (FIGURE_FRAME / 2 - 2) / reach : Infinity,
  );
  const width = Math.max(1, Math.round(frontWide * scale));
  const edge = Math.floor((FIGURE_FRAME - width) / 2) + width;
  const frames = reducePalette([
    ...front.map((box) => placeBox(keyed, box, scale, FIGURE_FRAME, 0)),
    ...facing.map((box) => placeBox(keyed, box, scale, FIGURE_FRAME, 0, edge)),
  ]);
  return frames.every((frame) => contentBounds(frame)) ? stripImage(frames, 1) : null;
}

/** The `index`th square frame of a strip, one image pixel an art pixel. */
const frameOf = (strip: Rgba, index: number): Rgba => {
  const side = strip.height;
  const frame = blank(side, side);
  for (let y = 0; y < side; y++) {
    const from = (y * strip.width + index * side) * 4;
    frame.data.set(strip.data.subarray(from, from + side * 4), y * side * 4);
  }
  return frame;
};

// ---- Blinking ----

/** Where a figure's eyes may be, as fractions of its drawing's height from the top: under the top of the hair,
 *  above the chin of a head about a third of its height. */
const EYE_ZONE = [0.12, 0.42] as const;
/** Colours this close (RGB distance) count as one: a face's shading. */
const SAME_COLOUR = 50;
/** An iris's colours are at least this far (RGB distance) from every common colour. */
const UNCOMMON_COLOUR = 45;
/** An iris is a colour at least this strong (its highest channel less its lowest). */
const IRIS_CHROMA = 50;
/** A colour holding this share of the zone is part of the face, the hair or their outline. */
const COMMON_SHARE = 0.04;

/** One eye: its pixels, its box, the colour its lid closes it with, and the lash line drawn across it (none on a
 *  face darker than its outline, such as a mask). */
export interface EyeSpot {
  pixels: number[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  fill: number;
  lid: number | null;
}

/** A frame's eye zone: each pixel's colour as 0xRRGGBB (-1 when clear), the zone's rows [z0, z1), and how often each
 *  colour appears in it. */
interface EyeZone {
  colours: Int32Array;
  width: number;
  z0: number;
  z1: number;
  counts: Map<number, number>;
}

const red = (c: number) => c >> 16;
const green = (c: number) => (c >> 8) & 255;
const blue = (c: number) => c & 255;
const luma = (c: number) => 0.299 * red(c) + 0.587 * green(c) + 0.114 * blue(c);
const chroma = (c: number) => Math.max(red(c), green(c), blue(c)) - Math.min(red(c), green(c), blue(c));
const colourDistance = (a: number, b: number) => Math.hypot(red(a) - red(b), green(a) - green(b), blue(a) - blue(b));
const darkest = (colours: number[]) => colours.reduce((a, b) => (luma(b) < luma(a) ? b : a));

function eyeZone(frame: Rgba): EyeZone | null {
  const bounds = contentBounds(frame);
  if (!bounds) return null;
  const { width, height, data } = frame;
  const colours = new Int32Array(width * height).fill(-1);
  for (let p = 0; p < width * height; p++) {
    if (data[p * 4 + 3]! >= 128) colours[p] = (data[p * 4]! << 16) | (data[p * 4 + 1]! << 8) | data[p * 4 + 2]!;
  }
  const z0 = bounds.y + Math.round(bounds.height * EYE_ZONE[0]);
  const z1 = bounds.y + Math.round(bounds.height * EYE_ZONE[1]);
  const counts = new Map<number, number>();
  for (let p = z0 * width; p < z1 * width; p++) {
    const c = colours[p]!;
    if (c >= 0) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return { colours, width, z0, z1, counts };
}

const boxOfPixels = (pixels: number[], width: number) => {
  const xs = pixels.map((p) => p % width);
  const ys = pixels.map((p) => Math.floor(p / width));
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** The zone's pieces of pixels passing `keep`, joined side to side (and corner to corner when `diagonal`); a piece
 *  is open when it touches a clear pixel or the zone's edge. */
function zonePieces(zone: EyeZone, keep: (c: number) => boolean, diagonal: boolean) {
  const { colours, width, z0, z1 } = zone;
  const steps = diagonal
    ? [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
    : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
  const seen = new Uint8Array(colours.length);
  const pieces: { pixels: number[]; open: boolean }[] = [];
  for (let start = z0 * width; start < z1 * width; start++) {
    if (seen[start] || colours[start]! < 0 || !keep(colours[start]!)) continue;
    seen[start] = 1;
    const stack = [start];
    const pixels: number[] = [];
    let open = false;
    while (stack.length) {
      const p = stack.pop()!;
      pixels.push(p);
      for (const [dx, dy] of steps) {
        const x = (p % width) + dx!;
        const y = Math.floor(p / width) + dy!;
        const q = y * width + x;
        if (x < 0 || x >= width || y < z0 || y >= z1 || colours[q]! < 0) open = true;
        else if (!seen[q] && keep(colours[q]!)) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    pieces.push({ pixels, open });
  }
  return pieces;
}

/** Small enough to be an eye: under 10 × 8, and at least `minRows` tall. */
const eyeSized = (box: { x0: number; x1: number; y0: number; y1: number }, minRows: number) =>
  box.x1 - box.x0 < 10 && box.y1 - box.y0 < 8 && box.y1 - box.y0 + 1 >= minRows;

/** Cartoon eyes: small pieces of another colour wholly inside one of the zone's common colours (the face), with a
 *  colour well apart from it. The lid closes in the face's colour, with a lash line in the eye's darkest. */
function enclosedEyes(zone: EyeZone): EyeSpot[] {
  const faces = [...zone.counts]
    .filter(([, n]) => n >= 30)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([c]) => c);
  return faces.flatMap((face) =>
    zonePieces(zone, (c) => colourDistance(c, face) > SAME_COLOUR, false).flatMap(({ pixels, open }) => {
      const box = boxOfPixels(pixels, zone.width);
      const colours = pixels.map((p) => zone.colours[p]!);
      if (open || pixels.length < 2 || pixels.length > 40 || !eyeSized(box, 2)) return [];
      if (Math.max(...colours.map((c) => colourDistance(c, face))) < 90) return [];
      const dark = darkest(colours);
      return [{ pixels, ...box, fill: face, lid: luma(face) > luma(dark) + 40 ? dark : null }];
    }),
  );
}

/** Coloured eyes whose lashes or glasses run into the outline: a piece of strong, uncommon colour (an iris), with
 *  the uncommon pixels touching it (its pupil and its shine). The lid closes in the colour most common under it,
 *  with a lash line in the zone's darkest common colour (its outline). */
function irisEyes(zone: EyeZone): EyeSpot[] {
  const total = [...zone.counts.values()].reduce((sum, n) => sum + n, 0);
  const common = [...zone.counts].filter(([, n]) => n >= total * COMMON_SHARE).map(([c]) => c);
  if (!common.length) return [];
  const uncommon = (c: number) => c >= 0 && common.every((k) => colourDistance(c, k) > UNCOMMON_COLOUR);
  const ink = darkest(common);
  const { width, colours } = zone;
  return zonePieces(zone, (c) => chroma(c) >= IRIS_CHROMA && uncommon(c), true).flatMap(({ pixels: iris }) => {
    if (iris.length < 2 || iris.length > 36) return [];
    const around = boxOfPixels(iris, width);
    const pixels = new Set(iris);
    const stack = [...iris];
    while (stack.length) {
      const p = stack.pop()!;
      for (const d of [1, -1, width, -width, width + 1, width - 1, 1 - width, -1 - width]) {
        const q = p + d;
        const x = q % width;
        const y = Math.floor(q / width);
        if (pixels.has(q) || x < around.x0 - 1 || x > around.x1 + 1 || y < around.y0 - 1 || y > around.y1 + 1) continue;
        if (y < zone.z0 || y >= zone.z1 || !uncommon(colours[q]!)) continue;
        pixels.add(q);
        stack.push(q);
      }
    }
    const spot = [...pixels];
    const box = boxOfPixels(spot, width);
    if (!eyeSized(box, 1)) return [];
    const under = new Map<number, number>();
    for (const p of spot) {
      let q = p + width;
      while (pixels.has(q)) q += width;
      const c = colours[q] ?? -1;
      if (c >= 0) under.set(c, (under.get(c) ?? 0) + 1);
    }
    const fill = [...under].sort((a, b) => b[1] - a[1])[0]?.[0];
    // Under it is the face, or a shade of it: not another strong colour.
    if (fill === undefined || (chroma(fill) >= IRIS_CHROMA && !common.includes(fill))) return [];
    if (Math.abs(luma(fill) - luma(darkest(spot.map((p) => colours[p]!)))) < 60) return [];
    return [{ pixels: spot, ...box, fill, lid: luma(fill) > luma(ink) + 60 ? ink : null }];
  });
}

/** The likeliest pair of eyes among the spots, left one first: level, alike in size, apart by 2 to 20 columns. */
function eyePair(spots: EyeSpot[]): [EyeSpot, EyeSpot] | null {
  let best: { pair: [EyeSpot, EyeSpot]; score: number } | null = null;
  for (const left of spots) {
    for (const right of spots) {
      const gap = right.x0 - left.x1 - 1;
      const tilt = Math.abs(left.y0 + left.y1 - right.y0 - right.y1) / 2;
      const ratio =
        Math.max(left.pixels.length, right.pixels.length) / Math.min(left.pixels.length, right.pixels.length);
      if (gap < 2 || gap > 20 || tilt > 1.5 || ratio > 2.5) continue;
      if (Math.abs(left.y1 - left.y0 - (right.y1 - right.y0)) > 2) continue;
      const score = left.pixels.length + right.pixels.length - tilt * 4 - ratio * 3;
      if (!best || score > best.score) best = { pair: [left, right], score };
    }
  }
  return best?.pair ?? null;
}

/** A figure frame's eyes (see enclosedEyes and irisEyes), or null when they cannot be found. */
export function findEyes(frame: Rgba): [EyeSpot, EyeSpot] | null {
  const zone = eyeZone(frame);
  return zone ? (eyePair(enclosedEyes(zone)) ?? eyePair(irisEyes(zone))) : null;
}

/** Whether two poses' eyes are the same pair: as high, as wide and as far apart; the head may stand further left
 *  or right. */
const sameEyes = (a: [EyeSpot, EyeSpot], b: [EyeSpot, EyeSpot]) =>
  a.every(
    (eye, i) =>
      Math.abs(eye.y0 + eye.y1 - b[i]!.y0 - b[i]!.y1) <= 4 && Math.abs(eye.x1 - eye.x0 - (b[i]!.x1 - b[i]!.x0)) <= 2,
  ) && Math.abs(a[1].x0 - a[0].x1 - (b[1].x0 - b[0].x1)) <= 2;

/** What a blink draws over a figure strip: in each pose facing the viewer whose eyes match the calm pose's, the
 *  eyes shut (filled with their lid's colour, a lash line across them 60% down); clear everywhere else. Null when
 *  the calm pose's eyes cannot be found, so a face the finder cannot read never blinks. */
export function blinkStrip(strip: Rgba): Rgba | null {
  const side = strip.height;
  const count = Math.floor(strip.width / side);
  const fronts = count === FIGURE_ROWS[0] + FIGURE_ROWS[1] ? FIGURE_ROWS[0] : Math.min(count, 3);
  const calm = count ? findEyes(frameOf(strip, 0)) : null;
  if (!calm) return null;
  const frames = Array.from({ length: count }, (_, i) => {
    const shut = blank(side, side);
    const eyes = i < fronts ? findEyes(frameOf(strip, i)) : null;
    if (!eyes || !sameEyes(eyes, calm)) return shut;
    const paint = (p: number, c: number) => shut.data.set([red(c), green(c), blue(c), 255], p * 4);
    for (const eye of eyes) {
      for (const p of eye.pixels) paint(p, eye.fill);
      if (eye.lid === null) continue;
      const row = eye.y0 + Math.floor((eye.y1 - eye.y0 + 1) * 0.6);
      for (let x = eye.x0; x <= eye.x1; x++) paint(row * side + x, eye.lid);
    }
    return shut;
  });
  return stripImage(frames, 1);
}

/** Two strips of the same frames, one above the other. */
const stacked = (top: Rgba, bottom: Rgba): Rgba => {
  const out = blank(top.width, top.height + bottom.height);
  out.data.set(top.data);
  out.data.set(bottom.data, top.data.length);
  return out;
};

/** A figure strip that breathes as the pets do: the strip above a second row in which each frame drops its
 *  quietRow, so the top sinks one art pixel and the feet stay put; and the blink (see blinkStrip) made the same
 *  way, so the eyes shut where they are in either row. It is not outlined again: the figure's edges keep their
 *  colours. */
export function breathingFigure(strip: Rgba): { body: Rgba; blink: Rgba | null } {
  const count = Math.floor(strip.width / strip.height);
  const rows = Array.from({ length: count }, (_, i) => quietRow(frameOf(strip, i)));
  const squashed = (from: Rgba) =>
    stripImage(
      rows.map((k, i) => squashFrame(frameOf(from, i), k)),
      1,
    );
  const blink = blinkStrip(strip);
  return { body: stacked(strip, squashed(strip)), blink: blink ? stacked(blink, squashed(blink)) : null };
}

// ponytail: both limits come from seven test paintings (flat backgrounds: at most 8% of the edge left and an outline
// ratio of 4-6; gradient and paper: 56%; a forest scene: ratio 44). Tune them from real failures if a good painting
// is refused.
/** The most of a keyed picture's edge pixels that may stay: more means its background was not one flat colour. */
const MAX_EDGE_LEFT = 0.25;
/** The most outline pixels a keyed picture may have per square root of its kept pixels: more means the cut-out is
 *  ragged scraps of a busy background. */
const MAX_OUTLINE_RATIO = 20;

/** Whether keying left one clean creature, not a background that was only partly taken away. */
function cleanCutout(keyed: Rgba): boolean {
  const { width, height, data } = keyed;
  const kept = (p: number) => data[p * 4 + 3]! > 0;
  let edge = 0;
  let edgeKept = 0;
  let area = 0;
  let outline = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (onEdge) edge++;
      if (!kept(p)) continue;
      area++;
      if (onEdge) edgeKept++;
      if (
        (x > 0 && !kept(p - 1)) ||
        (x < width - 1 && !kept(p + 1)) ||
        (y > 0 && !kept(p - width)) ||
        (y < height - 1 && !kept(p + width))
      )
        outline++;
    }
  }
  return edgeKept <= edge * MAX_EDGE_LEFT && outline <= Math.sqrt(area) * MAX_OUTLINE_RATIO;
}

/** The one-picture fallback: key out, fit to the stage's size in a 52×52 frame, reduce the palette, and make the three-frame strip at 2× (312 × 104). Returns null when nothing is left after keying or speck removal (a blank or all-background picture), or when the background was not cleanly taken away (see cleanCutout). */
export function formFromPainting(image: Rgba, stage: SaucelingStage): Rgba | null {
  const keyed = keyOutBackground(image);
  if (!contentBounds(keyed) || !cleanCutout(keyed)) return null;
  const frame = reducePalette([fitToFrame(keyed, FORM_SIZES[stage])])[0]!;
  // Speck removal can leave nothing of a picture that was only specks.
  if (!contentBounds(frame)) return null;
  return stripImage(stage === "egg" ? eggStrip(frame) : creatureStrip(frame));
}
