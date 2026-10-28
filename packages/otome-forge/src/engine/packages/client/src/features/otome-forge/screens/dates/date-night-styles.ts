// ──────────────────────────────────────────────
// Otome Forge: Date Night's rules for the one stylesheet (theme/styles.ts lists DATE_NIGHT_RULES with the others)
// ──────────────────────────────────────────────
// Scoped under `.of-root`, on the look's tokens. Places wear their scene's mood gradient (`.of-mood`, READER_RULES),
// so the screen needs no image; a place the story painted wears its picture over it. The cards are `.of-date-place`,
// apart from M2b's `.of-place` (the reader's painted backdrop layer). Layout is one column at phone width (390 px): two place cards a row, the two looks
// side by side. Every animation stops under prefers-reduced-motion (MOTION_RULES).
import { PALETTE } from "../../theme/tokens";

const R = ".of-root";

export const DATE_NIGHT_RULES = `
${R} .of-dates { gap: 16px; }
${R} .of-dates-reading { flex: 1; min-height: 0; display: flex; flex-direction: column; }
${R} .of-date-head { display: flex; align-items: center; gap: 12px; padding-top: 4px; }
${R} .of-date-head .of-avatar { box-shadow: 0 0 0 2px var(--of-li-accent, var(--of-rose)), 0 0 22px var(--of-glow-soft); }
${R} .of-date-head-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
${R} .of-date-head .of-title { font-size: clamp(1.5rem, 7cqw, 1.95rem); }
${R} .of-date-head .of-hand { font-size: 1.3rem; transform: rotate(-1.5deg); transform-origin: left center; }
${R}[dir="rtl"] .of-date-head .of-hand { transform-origin: right center; }
${R} .of-dates-actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; }
${R} .of-dates-actions > .of-button--primary { margin-inline-start: auto; }
${R} .of-dates-pick-hint { text-align: end; margin-top: -8px; }

/* The places: two cards a row, each in its scene's gradient. */
${R} .of-places {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; padding: 0; border: 0;
  min-width: 0;
}
${R} .of-date-place {
  position: relative; isolation: isolate; overflow: clip; display: flex; flex-direction: column; gap: 4px;
  min-height: 128px; padding: 12px 12px 12px; border-radius: 20px; cursor: pointer; color: var(--of-text);
  border: 1px solid var(--of-border); box-shadow: inset 0 1px 0 var(--of-highlight);
  transition: transform 420ms var(--of-ease), box-shadow 420ms var(--of-ease), border-color 420ms var(--of-ease);
}
${R} .of-date-place > .of-mood { z-index: -2; opacity: 0.9; }
/* Each place glows in its own colour over its scene: blue water, lantern light, a sunset, the stars. */
${R} .of-place-sheen {
  position: absolute; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(85% 70% at 88% 0%, var(--of-place-glow, transparent), transparent 72%),
    linear-gradient(180deg, transparent 30%, var(--of-floor) 100%);
}
${R} .of-date-place[data-place="aquarium"] { --of-place-glow: rgb(96 176 236 / 0.5); }
${R} .of-date-place[data-place="rooftop"] { --of-place-glow: rgb(140 214 150 / 0.4); }
${R} .of-date-place[data-place="bookshop"] { --of-place-glow: rgb(214 168 110 / 0.48); }
${R} .of-date-place[data-place="night-market"] { --of-place-glow: rgb(255 150 90 / 0.46); }
${R} .of-date-place[data-place="observatory"] { --of-place-glow: rgb(150 140 255 / 0.5); }
${R} .of-date-place[data-place="seaside"] { --of-place-glow: rgb(255 168 140 / 0.48); }
${R} .of-date-place[data-place="cafe"] { --of-place-glow: rgb(196 150 118 / 0.44); }
${R} .of-date-place[data-place="fairground"] { --of-place-glow: rgb(255 120 190 / 0.46); }
${R} .of-date-place[data-place="partner-choice"] { --of-place-glow: rgb(230 201 138 / 0.55); }
${R} .of-date-place:hover { transform: translateY(-2px); box-shadow: 0 12px 26px var(--of-glow-soft); }
${R} .of-date-place:has(input:focus-visible) { outline: 2px solid var(--of-focus); outline-offset: 3px; }
${R} .of-date-place[data-checked="true"] {
  border-color: ${PALETTE.champagne};
  box-shadow: 0 0 0 2px ${PALETTE.champagne}, 0 10px 26px var(--of-glow);
}
${R} .of-date-place[data-partner="true"] { grid-column: 1 / -1; min-height: 96px; }
/* A place the story painted: its own picture under the sheen, which keeps the words readable. */
${R} .of-date-place-art {
  position: absolute; inset: 0; z-index: -2; width: 100%; height: 100%; object-fit: cover; opacity: 0.85;
}
${R} .of-date-place[data-place="story"] { --of-place-glow: rgb(230 201 138 / 0.4); }
${R} .of-date-place[data-place="story"] .of-place-sheen {
  background: linear-gradient(180deg, transparent 18%, var(--of-floor) 92%);
}
${R} .of-places-story { grid-column: 1 / -1; margin: 6px 2px 0; }
${R} .of-place-icon {
  display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; margin-bottom: auto;
  color: var(--of-champagne-text);
}
${R} .of-place-name {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.12rem; line-height: 1.08; overflow-wrap: anywhere;
}
${R} .of-place-text { font-size: 0.76rem; line-height: 1.3; color: var(--of-text-soft); }
${R} .of-place-check {
  position: absolute; top: 10px; inset-inline-end: 10px; display: grid; place-items: center; width: 24px; height: 24px;
  border-radius: 50%; color: ${PALETTE.ink}; background: linear-gradient(135deg, #f3dcaa, ${PALETTE.champagne});
  box-shadow: 0 0 12px var(--of-wish-glow); animation: of-rise 300ms var(--of-ease) both;
}

/* The looks: the two of them side by side. */
${R} .of-looks { display: flex; flex-direction: column; gap: 8px; }
${R} .of-looks-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
${R} .of-looks-person { display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
${R} .of-looks-who {
  padding: 0; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--of-champagne-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
${R} .of-look { display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
${R} .of-look-frame {
  position: relative; display: grid; place-items: center; aspect-ratio: 3 / 4; overflow: clip; border-radius: 20px;
  background:
    radial-gradient(circle at 30% 18%, rgb(255 255 255 / 0.4), transparent 50%),
    linear-gradient(170deg, color-mix(in srgb, var(--of-li-accent) 70%, transparent), var(--of-surface-solid) 92%);
  border: 1px solid var(--of-border); box-shadow: inset 0 1px 0 var(--of-highlight), var(--of-panel-shadow);
  transition: box-shadow 420ms var(--of-ease), transform 420ms var(--of-ease);
}
${R} .of-look-frame img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 10%; }
${R} .of-look-initials {
  font-family: var(--of-font-display); font-weight: 600; font-size: 2.6rem; color: var(--of-on-accent);
  text-shadow: 0 2px 12px rgb(255 255 255 / 0.35);
}
${R} .of-look[data-checked="true"] .of-look-frame { box-shadow: 0 0 0 2px ${PALETTE.champagne}, 0 10px 26px var(--of-glow); }
${R} .of-look:has(input:focus-visible) .of-look-frame { outline: 2px solid var(--of-focus); outline-offset: 3px; }
${R} .of-look-name {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px; font-size: 0.82rem; font-weight: 700;
}
${R} .of-look-name svg { color: var(--of-champagne-text); }
${R} .of-looks-note { display: flex; align-items: center; justify-content: center; gap: 6px; text-align: center; }

/* Tonight, before it begins. */
${R} .of-date-summary {
  border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
  background: linear-gradient(150deg, var(--of-tint-strong), transparent 62%), var(--of-surface);
}
${R} .of-date-summary-title { display: flex; align-items: center; gap: 8px; }
${R} .of-date-summary-title svg { flex: none; color: var(--of-champagne-text); }
${R} .of-date-summary .of-body { max-width: none; }
${R} .of-date-mend svg { color: var(--of-accent-text); }

/* The evenings so far. */
${R} .of-date-mend-eyebrow { display: inline-flex; align-items: center; gap: 4px; color: var(--of-accent-text); }
${R} .of-date-history { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
${R} .of-date-memory {
  display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 16px;
  background: var(--of-surface-hover); border-inline-start: 3px solid var(--of-li-accent, var(--of-rose));
}
${R} .of-date-memory-art {
  position: relative; flex: none; display: grid; place-items: center; width: 52px; height: 52px; overflow: clip;
  border-radius: 12px; object-fit: cover; color: var(--of-champagne-text);
}
${R} .of-date-memory-art--quiet > svg { position: relative; }
${R} .of-date-memory-text { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
${R} .of-date-memory-title {
  font-family: var(--of-font-display); font-weight: 600; font-size: 1.06rem; line-height: 1.1; overflow-wrap: anywhere;
}

/* How the evening went. */
${R} .of-date-counting { margin-top: 18px; }
${R} .of-date-counting .of-section-title:focus { outline: none; }
${R} .of-date-ending { display: flex; flex-direction: column; gap: 14px; }
${R} .of-date-ending-card {
  position: relative; isolation: isolate; overflow: clip; display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 26px 18px 20px; border-radius: 26px; text-align: center;
}
${R} .of-date-ending-card > .of-mood { z-index: -1; opacity: 0.55; }
${R} .of-date-ending-card .of-avatar { box-shadow: 0 0 0 3px var(--of-li-accent, var(--of-rose)), 0 0 34px var(--of-glow); }
${R} .of-date-ending-card .of-body { max-width: 34ch; }
${R} .of-date-ending-hearts {
  display: flex; align-items: flex-end; gap: 6px; height: 26px; color: var(--of-li-accent, var(--of-rose));
  filter: drop-shadow(0 0 8px var(--of-glow));
}
${R} .of-date-ending-hearts svg { animation: of-heart-float 2.8s ease-in-out infinite; }
${R} .of-date-ending-hearts svg:nth-child(2) { animation-delay: 0.4s; }
${R} .of-date-ending-hearts svg:nth-child(3) { animation-delay: 0.8s; }
${R} .of-date-ending[data-outcome="awkward"] .of-date-ending-hearts { color: var(--of-text-faint); filter: none; }
${R} .of-date-ending[data-outcome="awkward"] .of-date-ending-hearts svg { animation-name: of-heart-wobble; }
${R} .of-date-line { margin: 6px 0 0; max-width: 30ch; }
${R} .of-date-line blockquote { margin: 0; }
${R} .of-date-line p {
  font-family: var(--of-font-hand); font-weight: 500; font-size: 1.5rem; line-height: 1.15;
  color: var(--of-accent-text);
}
${R} .of-date-line figcaption { margin-top: 4px; font-size: 0.76rem; font-weight: 700; color: var(--of-text-soft); }
${R} .of-date-picks { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
${R} .of-date-pick {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 14px; background: var(--of-surface-hover);
}
${R} .of-date-pick-mark {
  flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  color: var(--of-text-faint); background: var(--of-surface-hover);
}
${R} .of-date-pick[data-score="1"] .of-date-pick-mark {
  color: var(--of-li-accent, var(--of-rose)); background: var(--of-tint-strong); box-shadow: 0 0 12px var(--of-glow-soft);
}
${R} .of-date-pick[data-score="-1"] .of-date-pick-mark { color: var(--of-danger); }
${R} .of-date-pick-text { flex: 1; min-width: 0; font-weight: 600; font-size: 0.9rem; overflow-wrap: anywhere; }
${R}[data-look="pearl"] .of-date-pick[data-score="1"] .of-date-pick-mark { filter: brightness(0.82) saturate(1.3); }

/* The keepsake: a polaroid, tilted a little. */
${R} .of-keepsake > .of-button { align-self: flex-start; }
${R} .of-keepsake-busy { display: flex; align-items: center; gap: 6px; }
${R} .of-keepsake-photo {
  align-self: center; width: min(100%, 280px); margin: 4px 0 6px; padding: 10px 10px 14px; border-radius: 6px;
  background: #fbf7f1; color: ${PALETTE.ink}; transform: rotate(-1.6deg);
  box-shadow: 0 16px 34px rgb(4 2 18 / 0.36), 0 0 0 1px rgb(43 34 54 / 0.08);
  animation: of-rise 520ms var(--of-ease) both;
}
${R} .of-keepsake-photo img { display: block; width: 100%; aspect-ratio: 9 / 16; object-fit: cover; border-radius: 2px; }
${R} .of-keepsake-caption {
  margin-top: 8px; text-align: center; font-family: var(--of-font-hand); font-size: 1.35rem; line-height: 1.1;
}
@keyframes of-heart-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes of-heart-wobble { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-10deg); } }`;
