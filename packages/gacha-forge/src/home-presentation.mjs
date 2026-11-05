// Maintained Home presentation, using the bundle's own affinity map and symbols.
const forgeHomeEnglish = {
  "home.affinities.title": "Element matchups",
  "home.affinities.hint":
    "Arrows show 1.5× damage. Reversing the Fire, Water, Wind and Earth arrows deals 0.75× damage. Light and Dark are strong against each other. All other matchups deal 1× damage.",
};
const forgeHomeAffinities = {
  fire: { name: "Fire", x: 24, y: 20 },
  water: { name: "Water", x: 82, y: 20 },
  wind: { name: "Wind", x: 82, y: 68 },
  earth: { name: "Earth", x: 24, y: 68 },
  light: { name: "Light", x: 145, y: 24 },
  dark: { name: "Dark", x: 191, y: 64 },
};
const forgeHomeLayout = `
.hm-scene:has(> .gf-home-column) { container-type: size; container-name: gfhome; }
.gf-home-column {
  flex: none; display: flex; flex-direction: column; align-items: flex-start;
  min-height: 0; width: min(49.333cqh, 30%); gap: var(--sp-1);
}
.gf-home-column > .hm-chat {
  position: static; flex: none; margin: var(--sp-3) var(--sp-3) 0;
  max-width: calc(100% - 2 * var(--sp-3));
}
.gf-home-affinities {
  flex: none; display: block; margin: 0 var(--sp-3);
  width: min(calc(var(--f) * 13), calc(100% - 2 * var(--sp-3)));
  color: var(--text); background: color-mix(in srgb, var(--ink) 72%, transparent);
  border: 1px solid var(--steel-dark); border-radius: var(--radius-sm);
}
.gf-home-affinities .gf-home-arrow { fill: none; stroke: var(--coral); stroke-width: 1.5; }
.gf-home-affinities .gf-home-arrowhead { fill: var(--coral); }
.gf-home-column > .hm-plate {
  flex: 1 1 0; min-height: 0; height: auto; max-height: min(74cqh, 45cqw);
  width: auto; max-width: 100%; aspect-ratio: 2 / 3; align-self: flex-start;
}
/* Reduced motion gives every element a tiny transition duration; the crop must not animate from its old position. */
.hm-screen > .hm-bg { object-position: 50% 0; transition-property: none; }
`;

function forgeHomeAffinityGraph(icons, advantages) {
  const edges = Object.entries(advantages).filter(
    ([from, to]) => Object.hasOwn(forgeHomeAffinities, from) && Object.hasOwn(forgeHomeAffinities, to),
  );
  const nodes = Object.entries(forgeHomeAffinities).filter(([key]) => typeof icons[key] === "string");
  if (nodes.length !== 6 || !edges.length) return null;
  const relationships = edges.map(([from, to]) => {
    const start = forgeHomeAffinities[from];
    const end = forgeHomeAffinities[to];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const dx = (end.x - start.x) / length;
    const dy = (end.y - start.y) / length;
    const offset = advantages[to] === from ? 4 : 0;
    const x1 = start.x + dx * 16 - dy * offset;
    const y1 = start.y + dy * 16 + dx * offset;
    const x2 = end.x - dx * 16 - dy * offset;
    const y2 = end.y - dy * 16 + dx * offset;
    return `<g data-forge-advantage-from="${from}" data-forge-advantage-to="${to}"><title>${start.name} → ${end.name}: 1.5× damage</title><path class="gf-home-arrow" d="M${x1} ${y1} L${x2} ${y2}"/><path class="gf-home-arrowhead" d="M${x2} ${y2} L${x2 - dx * 6 - dy * 3} ${y2 - dy * 6 + dx * 3} L${x2 - dx * 6 + dy * 3} ${y2 - dy * 6 - dx * 3} Z"/></g>`;
  });
  const graph = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  graph.classList.add("gf-home-affinities");
  graph.setAttribute("viewBox", "0 0 216 88");
  graph.setAttribute("role", "img");
  graph.setAttribute("aria-labelledby", "gf-home-affinities-title gf-home-affinities-description");
  graph.innerHTML = `<title id="gf-home-affinities-title">${forgeHomeEnglish["home.affinities.title"]}</title><desc id="gf-home-affinities-description">${forgeHomeEnglish["home.affinities.hint"]} ${edges.map(([from, to]) => `${forgeHomeAffinities[from].name} → ${forgeHomeAffinities[to].name}: 1.5×.`).join(" ")}</desc>${relationships.join("")}${nodes.map(([key, { name, x, y }]) => `<g data-forge-affinity="${key}"><title>${name}</title>${icons[key].replace("<svg ", `<svg x="${x - 12}" y="${y - 12}" width="24" height="24" `)}</g>`).join("")}`;
  return graph;
}

export function wireForgeHome(host, icons, advantages) {
  const root = host._root;
  const scene = root.querySelector(".gf-stage > .gf-view .hm-scene");
  if (!scene || scene.querySelector(".gf-home-column")) return;
  const letters = scene.querySelector(".hm-chat");
  const portrait = scene.querySelector(".hm-plate");
  const graph = forgeHomeAffinityGraph(icons, advantages);
  if (!letters || !portrait || !graph) return;
  if (!root.querySelector("[data-forge-home-layout]")) {
    const sheet = document.createElement("style");
    sheet.dataset.forgeHomeLayout = "";
    sheet.textContent = forgeHomeLayout;
    root.append(sheet);
  }
  const column = document.createElement("div");
  column.className = "gf-home-column";
  letters.before(column);
  column.append(letters, graph, portrait);
}
