const forgeUltimateElements = new Set(["fire", "water", "wind", "earth", "light", "dark"]);
const forgeUltimateMotifs = {
  fire: "ember",
  water: "ripple",
  wind: "streak",
  earth: "shard",
  light: "ray",
  dark: "orbit",
};

export const forgeCombatUltimateStyles = `
.gf-ultimate-portrait { position: absolute; z-index: 15; inset: 15% 12% 25%; display: flex;
  align-items: center; justify-content: center; gap: 1rem; overflow: hidden; pointer-events: none;
  color: var(--text); border-block: 2px solid var(--gf-ultimate-element,var(--steel));
  background: linear-gradient(90deg,transparent,var(--ink-2) 22%,var(--ink-2) 78%,transparent);
  animation: gf-ultimate-arrive 780ms ease-out both; }
.gf-ultimate-portrait img { position: relative; z-index: 1; align-self: stretch; min-width: 0;
  width: min(28%,12rem); object-fit: contain; object-position: center; }
.gf-ultimate-name { position: relative; z-index: 1; min-width: 0; max-width: 52%;
  overflow-wrap: anywhere; font: 700 var(--t-lg)/1.2 var(--display); text-shadow: 0 2px 4px var(--ink); }
.gf-ultimate-motif { position: absolute; z-index: 0; inset: 0; overflow: hidden;
  pointer-events: none; color: var(--gf-ultimate-element,var(--steel)); }
.gf-ultimate-particle { position: absolute; left: calc(var(--particle-x)*1%); top: calc(var(--particle-y)*1%);
  width: clamp(12px,3cqw,36px); aspect-ratio: 1; opacity: 0;
  animation-duration: 720ms; animation-timing-function: ease-out; animation-fill-mode: both;
  animation-delay: calc(var(--particle-index)*25ms); }
.gf-ultimate-particle svg { width: 100%; height: 100%; }
.gf-ultimate-motif-ember .gf-ultimate-particle { animation-name: gf-ultimate-ember; }
.gf-ultimate-motif-ripple .gf-ultimate-particle { animation-name: gf-ultimate-drop; }
.gf-ultimate-motif-ripple::before,.gf-ultimate-motif-ripple::after { content: ""; position: absolute;
  left: 32%; top: 50%; width: 20%; aspect-ratio: 1; border: 2px solid currentColor;
  border-radius: 50%; animation: gf-ultimate-ring 720ms ease-out both; }
.gf-ultimate-motif-ripple::after { animation-delay: 90ms; }
.gf-ultimate-motif-streak .gf-ultimate-particle { width: clamp(24px,7cqw,90px); animation-name: gf-ultimate-streak; }
.gf-ultimate-motif-shard .gf-ultimate-particle { animation-name: gf-ultimate-shard; }
.gf-ultimate-motif-ray .gf-ultimate-particle { animation-name: gf-ultimate-ray; }
.gf-ultimate-motif-orbit .gf-ultimate-particle { animation-name: gf-ultimate-orbit; }
.gf-ultimate-particle:empty { background: currentColor; }
.gf-ultimate-motif-ember .gf-ultimate-particle:empty { border-radius: 70% 15% 60% 40%; }
.gf-ultimate-motif-ripple .gf-ultimate-particle:empty { border-radius: 75% 5% 75% 75%; }
.gf-ultimate-motif-streak .gf-ultimate-particle:empty { height: 3px; border-radius: 50%; }
.gf-ultimate-motif-shard .gf-ultimate-particle:empty { clip-path: polygon(50% 0,100% 40%,50% 100%,0 40%); }
.gf-ultimate-motif-ray .gf-ultimate-particle:empty { clip-path: polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%); }
.gf-ultimate-motif-orbit .gf-ultimate-particle:empty { background: transparent; border-left: 5px solid currentColor; border-radius: 50%; }
@keyframes gf-ultimate-arrive { 0% { opacity: 0; transform: translateX(-5%); }
  18%,72% { opacity: 1; transform: translateX(0); } 100% { opacity: 0; transform: translateX(3%); } }
@keyframes gf-ultimate-ember { 0% { opacity: 0; transform: translate(-50%,80%) scale(.3) rotate(-20deg); }
  25% { opacity: .8; } 100% { opacity: 0; transform: translate(-10%,-160%) scale(.6) rotate(20deg); } }
@keyframes gf-ultimate-drop { 0% { opacity: 0; transform: translate(-50%,-120%) scale(.5); }
  30% { opacity: .75; } 100% { opacity: 0; transform: translate(-50%,70%) scale(.85); } }
@keyframes gf-ultimate-ring { from { opacity: .7; transform: translate(-50%,-50%) scale(.2); }
  to { opacity: 0; transform: translate(-50%,-50%) scale(2); } }
@keyframes gf-ultimate-streak { 0% { opacity: 0; transform: translate(-160%,-50%) rotate(-12deg); }
  25% { opacity: .8; } 100% { opacity: 0; transform: translate(100%,-85%) rotate(-12deg); } }
@keyframes gf-ultimate-shard { 0% { opacity: 0; transform: translate(-50%,120%) scale(.4) rotate(-25deg); }
  30% { opacity: .8; } 100% { opacity: 0; transform: translate(-70%,-70%) scale(1.1) rotate(20deg); } }
@keyframes gf-ultimate-ray { 0% { opacity: 0; transform: translate(-50%,-50%) scale(.15) rotate(-20deg); }
  30% { opacity: .8; } 100% { opacity: 0; transform: translate(-50%,-50%) scale(1.5) rotate(25deg); } }
@keyframes gf-ultimate-orbit { 0% { opacity: 0; transform: translate(-50%,-50%) rotate(-100deg) translateX(20px) rotate(100deg); }
  30% { opacity: .8; } 100% { opacity: 0; transform: translate(-50%,-50%) rotate(80deg) translateX(35px) rotate(-80deg); } }
@media (prefers-reduced-motion: reduce) {
  .gf-ultimate-portrait { animation: none; }
  .gf-ultimate-motif { display: none; }
}
`;

export function createForgeUltimatePresentation(root, { actors = [], duration = 850, glyphs = {} } = {}) {
  const units = new Map(actors.map((actor) => [String(actor.id), actor]));
  let current = null;
  let timer = null;
  let disposed = false;
  const clear = () => {
    clearTimeout(timer);
    timer = null;
    current?.remove();
    current = null;
  };
  return {
    event(event) {
      if (disposed || event?.op !== "ult" || event.weapon) return;
      clear();
      const actor = units.get(String(event.id));
      if (!actor?.portrait) return;
      const screen = root.querySelector(".screen");
      if (!screen) return;
      const panel = document.createElement("div");
      panel.className = "gf-ultimate-portrait";
      panel.setAttribute("aria-hidden", "true");
      const element = String(actor.affinity || event.aff || "").toLowerCase();
      if (forgeUltimateElements.has(element)) {
        panel.dataset.element = element;
        panel.style.setProperty("--gf-ultimate-element", `var(--${element})`);
      }
      const portrait = document.createElement("img");
      portrait.alt = "";
      portrait.addEventListener("error", () => {
        if (current === panel) clear();
      });
      portrait.src = actor.portrait;
      const name = document.createElement("span");
      name.className = "gf-ultimate-name";
      name.textContent = event.name || actor.name || "";
      panel.append(portrait, name);
      if (forgeUltimateElements.has(element)) {
        const motif = document.createElement("div");
        motif.dataset.motif = forgeUltimateMotifs[element];
        motif.className = `gf-ultimate-motif gf-ultimate-motif-${motif.dataset.motif}`;
        const positions = [
          [12, 70],
          [25, 30],
          [38, 76],
          [60, 25],
          [75, 72],
          [88, 35],
        ];
        for (const [index, [x, y]] of positions.entries()) {
          const particle = document.createElement("i");
          particle.className = "gf-ultimate-particle";
          particle.style.setProperty("--particle-index", String(index));
          particle.style.setProperty("--particle-x", String(x));
          particle.style.setProperty("--particle-y", String(y));
          // Only the game's existing trusted affinity SVGs are passed here; event/model text never becomes HTML.
          if (typeof glyphs[element] === "string") particle.innerHTML = glyphs[element];
          motif.append(particle);
        }
        panel.append(motif);
      }
      screen.append(panel);
      current = panel;
      const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      timer = setTimeout(clear, reduced ? 450 : duration);
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}
