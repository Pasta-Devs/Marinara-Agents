/* global FORGE_FORMATION_ENGINE, FORGE_FORMATION_RULES, forgeFormationCombatEnglish, forgeFormationElements, forgeFormationProjection, forgeFormationPayment, normalizeForgeFormationKit, bt */
const forgeFormationEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/gu,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
  );
const forgeFormationLabel = (key, values) => {
  let text = forgeFormationCombatEnglish[`combat.formation.${key}`] ?? key;
  for (const [name, value] of Object.entries(values || {})) text = text.split(`{${name}}`).join(String(value));
  return text;
};
const forgeFormationGlyphs = () => (typeof bt === "object" && bt ? bt : {});
const forgeFormationGlyph = (element) =>
  `<span class="gf-fglyph" style="--aff:var(--${forgeFormationEscape(element)})" aria-hidden="true">${forgeFormationGlyphs()[element] || ""}</span>`;
const forgeFormationElementName = (element) => forgeFormationLabel(`element.${String(element || "").toLowerCase()}`);
const forgeFormationCircled = (index) => "①②③④⑤⑥"[index] || String(index + 1);
// Effects without their own picture borrow the closest existing skill art.
const forgeFormationArtEffect = {
  restore: "heal",
  regen: "heal",
  silence: "stun",
  taunt: "shield",
  immune: "shield",
  swap: "debuff",
  shuffle: "aoe_damage",
  summon: "buff",
};
const forgeFormationOffensive = new Set([
  "damage",
  "aoe_damage",
  "drain",
  "execute",
  "dot",
  "debuff",
  "stun",
  "silence",
  "swap",
  "shuffle",
]);
const forgeFormationSvg = (path) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const forgeFormationIcons = {
  hold: forgeFormationSvg('<path d="M9 5v14M15 5v14"/>'),
  info: forgeFormationSvg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  fight: forgeFormationSvg('<path d="M4 20 14 10M14 4h6v6M20 20 10 10M4 4l6 6"/>'),
  plus: forgeFormationSvg('<path d="M12 5v14M5 12h14"/>'),
};

/**
 * Front Row seats freed before an action's place in the plan, as the plan resolves in order: a retreat frees one,
 * bringing a support forward fills one, and a swap changes nothing.
 */
export function forgeFormationSeatsFreed(formation, plan = [], actorId) {
  const at = plan.findIndex((entry) => entry.actorId === actorId),
    front = new Set((formation?.allies || []).filter((ally) => ally.position === "front").map((ally) => ally.id));
  let freed = 0;
  for (const entry of at < 0 ? plan : plan.slice(0, at))
    if (entry.action === "row" && !entry.swapId) freed += front.has(entry.moveId || entry.actorId) ? 1 : -1;
  return freed;
}

// Every battle preview and start names the engine and rules it plays, so the server can turn away an older tab
// before it previews, pays for a kit remake or starts a fight.
export function forgeFormationStartRequest(host, path, body) {
  const starting = ["/battle/start", "/farm/start", "/tower/start", "/story-event/battle/start"].includes(path);
  if (!starting && !["/battle", "/farm/battle", "/tower/battle", "/story-event/battle"].includes(path)) return body;
  return {
    ...body,
    ...(starting ? { expectedCombatMode: host._combat?.combatMode || "classic" } : {}),
    expectedFormationEngine: FORGE_FORMATION_ENGINE,
    expectedFormationRules: FORGE_FORMATION_RULES,
  };
}

// Team edits save one at a time and only the newest waits, so a save slowed by a story being written in the
// background can never land after a newer edit and undo it.
export function saveForgeFormation(host, presets, active) {
  const runId = host._run?.runId;
  if (!runId) return;
  const saves = (host._formationSaves ||= new Map());
  const queue = saves.get(runId) || { next: null, running: null };
  saves.set(runId, queue);
  queue.next = { presets, active };
  queue.running ||= (async () => {
    let reply = null;
    while (queue.next) {
      const edit = queue.next;
      queue.next = null;
      // A request that throws counts as a failed save rather than leaving this world's queue stuck.
      reply = await Promise.resolve(host._postJson("/formation/save", { runId, ...edit })).catch(() => null);
    }
    saves.delete(runId);
    const saved = reply?.ok === true && Array.isArray(reply.presets);
    if (host._run?.runId !== runId) return saved;
    if (saved) {
      if (host._formation) host._formation = { ...host._formation, presets: reply.presets, active: reply.active };
    } else if (host._hudView === "formation" || host._hudView === "tower") {
      // The server kept an older team: show the one a battle will actually use.
      host._loadFormation();
    } else {
      host._formation = null;
      host._formationState = "idle";
    }
    return saved;
  })();
}

const forgeFormationSaving = (host) => host._formationSaves?.get(host._run?.runId)?.running;

// A battle reads its team from the server, so it waits until the last team edit is saved.
export function waitForgeFormationSave(host, resume) {
  const pending = forgeFormationSaving(host);
  if (!pending) return false;
  if (host._formationSaveWait !== pending) {
    const runId = host._run?.runId;
    host._formationSaveWait = pending;
    pending.then((saved) => {
      if (host._formationSaveWait === pending) host._formationSaveWait = null;
      // A save from a world the player has since left never touches this one.
      if (host._run?.runId !== runId) return;
      // Load whichever battle is open now. One the player backed out of is never loaded, so nothing is left
      // to release the farm lock that its load would have released.
      const waiting = host._hudView === "combat" && host._combatPhase === "loading";
      if (waiting && saved) return resume();
      if (host._battleLoading) return;
      host._farmBusy = false;
      if (!waiting) return;
      // The edit was not saved, so the battle would use an older team. Show the saved team where it is picked.
      if (host._combatNode?.tower) host._hudView = "tower";
      else {
        host._formationBattleMode = true;
        host._hudView = "formation";
      }
      host._renderBrowser();
    });
  }
  return true;
}

// Reopening Formation reads the team from the server too, so it waits once for edits still being saved.
export function waitForgeFormationLoad(host) {
  const pending = forgeFormationSaving(host);
  if (!pending) {
    // A read that starts now makes any read still queued for an earlier save redundant.
    host._formationLoadWait = null;
    return false;
  }
  if (host._formationLoadWait !== pending) {
    host._formationLoadWait = pending;
    pending.then(() => {
      if (host._formationLoadWait !== pending) return;
      host._formationLoadWait = null;
      if (host._formationState === "loading") host._loadFormation();
    });
  }
  return true;
}

/** One sentence of what an ability does, with its real numbers. Plain text; escape before inserting. */
export function forgeFormationDescribe(ability, affinity = "") {
  if (!ability) return "";
  const target =
    ability.effect === "revive"
      ? forgeFormationLabel(ability.target === "allies" ? "aim.fallenAll" : "aim.fallen")
      : ability.effect === "swap"
        ? forgeFormationLabel("aim.enemyBack")
        : // A heal, shield or buff on front_row reaches the user's own Front Row, not the enemy's.
          ability.target === "front_row" && !forgeFormationOffensive.has(ability.effect)
          ? forgeFormationLabel("aim.ownFront")
          : forgeFormationLabel(`aim.${ability.target}`);
  const percent = (ability.effect === "buff" || ability.effect === "debuff") && ability.stat !== "crit" ? "%" : "";
  return forgeFormationLabel(`does.${ability.effect}`, {
    power: `${Number(ability.power) || 0}${percent}`,
    target,
    turns:
      Number(ability.duration) === 1
        ? forgeFormationLabel("turn")
        : forgeFormationLabel("turns", { count: Number(ability.duration) || 2 }),
    stat: ability.stat ? forgeFormationLabel(`stat.${ability.stat}`) : "",
    element: forgeFormationElementName(affinity),
  });
}

/** The cost as markup: a number, plus the elemental share of an Ultimate as its glyph. */
export function forgeFormationCostHtml(ability, affinity) {
  if (!ability) return "";
  if (!ability.cost) return forgeFormationEscape(forgeFormationLabel("free"));
  return (
    `${Number(ability.cost)}` +
    (ability.elementCost
      ? `<span class="gf-fsep">·</span>${forgeFormationGlyph(affinity)}${Number(ability.elementCost)}`
      : "")
  );
}

const forgeFormationCostText = (ability, affinity) =>
  !ability?.cost
    ? forgeFormationLabel("free")
    : ability.elementCost
      ? forgeFormationLabel("costUltimate", {
          cost: ability.cost,
          element: ability.elementCost,
          name: forgeFormationElementName(affinity),
        })
      : forgeFormationLabel("costAny", { cost: ability.cost });

const forgeFormationPaymentHtml = (payment) => {
  if (!payment) return "";
  const parts = forgeFormationElements.filter((element) => payment[element] > 0);
  if (!parts.length) return "";
  const bonuses = { fire: 5, dark: 8, wind: 10, earth: 3, water: 3, light: 5 };
  return (
    forgeFormationEscape(forgeFormationLabel("pays", { payment: "" })) +
    parts.map((element) => `${forgeFormationGlyph(element)}${payment[element]}`).join(" ") +
    " · " +
    parts
      .map((element) =>
        forgeFormationEscape(forgeFormationLabel(`bonus.${element}`, { value: bonuses[element] * payment[element] })),
      )
      .join(", ")
  );
};

export const forgeFormationCombatStyles = `
.gf-formation-encounter{margin:.5rem;padding:.5rem;border:1px solid var(--coral);font:400 max(12px,var(--t-sm))/1.4 var(--body);color:var(--text)}
.gf-formation-skill{cursor:default}.gf-formation-mechanics{display:block;margin-top:.2em;opacity:.85}
.gf-fglyph{display:inline-grid;place-items:center;vertical-align:-.15em;width:1.05em;height:1.05em;color:var(--aff,var(--steel))}.gf-fglyph svg{width:100%;height:100%}.gf-fsep{margin:0 .15em;opacity:.7}
/* The enemy line starts below the battle bar (its height is measured), and its cards shrink to fit what is
   left, so the boss plate never covers their FRONT/BACK tags. Classic keeps its own layout. */
.root[data-formation] .side.enemies{padding-top:calc(var(--gf-cbar,var(--fbar-h)) + var(--sp-1));--gf-eh:min(calc(var(--f)*16.5),calc(100cqh - var(--band) - var(--gf-cbar,var(--fbar-h)) - var(--sp-1) - var(--sp-2)))}
.root[data-formation] .side.enemies .cbt{height:var(--gf-eh);width:calc(var(--gf-eh)*2/3)}
.root[data-formation] .side.enemies .cbt .nm{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:1.05;font-size:calc(var(--f)*0.92*var(--gf-scale,1))}
.root[data-formation] .side.enemies .gf-fprot{top:28%;max-width:96%;padding:calc(var(--f)*0.15) calc(var(--f)*0.3);font-size:calc(var(--f)*0.6*var(--gf-scale,1));letter-spacing:.02em;line-height:1.1}
.root[data-formation] .cbt .enrow .en,.root[data-formation] .cbt .enrow .ev{display:none}
/* A fallen card whose seat another unit took stays out of the row. Classic relabels the Back Row as FRONT once a
   side has no living Front Row card; in Formation supports step up instead, so Back Row cards keep their tag. */
.root[data-formation] .cbt.gf-fgone{display:none}
.root[data-formation] .side.no-front .row.back .cbt::before{content:"BACK";background:var(--ink-2);color:var(--steel);border:1px solid var(--steel-dark)}
.root[data-formation] .cbt .enrow{min-height:calc(var(--f)*0.62*var(--gf-scale,1))}
.gf-fgen{display:inline-flex;align-items:center;gap:.15em;font-family:var(--display);font-weight:700;font-size:calc(var(--f)*0.66*var(--gf-scale,1));line-height:1;color:var(--text);text-shadow:0 1px 2px rgba(0,0,0,.9);white-space:nowrap}
.gf-fbank{position:absolute;z-index:5;top:calc(var(--f)*0.2);left:calc(var(--f)*1.4);right:0;display:flex;flex-wrap:wrap;align-items:center;gap:calc(var(--f)*0.35);min-height:calc(var(--f)*2.3);font-family:var(--display);color:var(--text)}
.gf-fbank:empty{display:none}
.gf-fbank-lab{font-size:calc(var(--f)*0.72*var(--gf-scale,1));letter-spacing:.14em;text-transform:var(--case);color:var(--steel-faint);white-space:nowrap}
.gf-fchip{display:inline-flex;align-items:center;gap:calc(var(--f)*0.15);height:calc(var(--f)*2);padding:0 calc(var(--f)*0.4);border:1px solid color-mix(in srgb,var(--aff,var(--steel)) 65%,transparent);background:color-mix(in srgb,var(--ink) 82%,transparent);font-weight:700;font-size:calc(var(--f)*0.9*var(--gf-scale,1));font-variant-numeric:tabular-nums;color:var(--text);white-space:nowrap}
.gf-fchip .gf-fglyph{width:calc(var(--f)*1.15);height:calc(var(--f)*1.15)}
.gf-fchip.zero{opacity:.5}.gf-fchip i{font-style:normal;color:var(--amber)}
.gf-fincome{margin-left:auto;font-size:calc(var(--f)*0.78*var(--gf-scale,1));color:var(--steel-faint);white-space:nowrap}
.root[data-formation] .cbt-turn{top:calc(var(--f)*2.9)}
.gf-fside{position:absolute;z-index:8;top:calc(var(--fbar-h) + var(--sp-2));left:calc(var(--f)*1.2);display:flex;flex-direction:column;align-items:flex-start;gap:calc(var(--f)*0.4);max-width:calc(var(--f)*24);pointer-events:none}
.gf-fside .gf-fbank{position:static;pointer-events:auto;row-gap:calc(var(--f)*0.25)}.gf-fside .gf-fbank-lab{flex-basis:100%}.gf-fside .gf-fchip{height:calc(var(--f)*1.7)}
.gf-frules{pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;gap:calc(var(--f)*0.2);max-width:100%;padding:calc(var(--f)*0.35) calc(var(--f)*0.6);border:1px solid var(--amber);background:color-mix(in srgb,var(--ink) 86%,transparent);color:var(--text);font:400 calc(var(--f)*0.85*var(--gf-scale,1))/1.35 var(--body);text-align:left}
.gf-frules b{font-family:var(--display);letter-spacing:.12em;text-transform:var(--case);color:var(--amber);font-size:calc(var(--f)*0.75*var(--gf-scale,1))}
.gf-frules span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.gf-frules[aria-expanded="true"] span{display:block}
.root[data-formation] .side.allies .cbt.gf-ready{cursor:pointer}
.root[data-formation] .side.allies .cbt.gf-ready:not(.is-actor) .ava{box-shadow:0 0 0 2px var(--coral),0 0 calc(var(--f)*1.2) color-mix(in srgb,var(--coral) 45%,transparent)}
.root[data-formation] .cbt:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.gf-fbadge{position:absolute;z-index:5;top:calc(var(--f)*2.6);left:calc(var(--f)*0.45);display:inline-flex;align-items:center;gap:calc(var(--f)*0.15);height:calc(var(--f)*1.9);padding:0 calc(var(--f)*0.35);background:var(--coral);color:var(--ink);font-family:var(--display);font-weight:700;font-size:calc(var(--f)*0.85*var(--gf-scale,1));pointer-events:none}
.gf-fbadge svg{width:calc(var(--f)*1.1);height:calc(var(--f)*1.1)}
.gf-fbadge.hold{background:var(--ink-2);color:var(--steel-faint);border:1px solid var(--steel-dark)}
.gf-fbadge.short{background:var(--alarm);color:var(--ink)}
.gf-fbadge.wait{background:var(--ink-2);color:var(--amber);border:1px solid var(--amber-deep);letter-spacing:.08em;text-transform:var(--case);font-size:calc(var(--f)*0.66*var(--gf-scale,1))}
.gf-ftargets{position:absolute;z-index:6;left:calc(var(--f)*-0.35);top:40%;display:flex;flex-direction:column;gap:2px;pointer-events:none}
.gf-ftargets b{display:grid;place-items:center;width:calc(var(--f)*1.8);height:calc(var(--f)*1.8);border-radius:50%;background:var(--coral);color:var(--ink);font:700 calc(var(--f)*0.85*var(--gf-scale,1)) var(--display)}
/* Below the affinity badge on the right edge: the card's top band can sit under the boss plate on a phone. */
.gf-forder{position:absolute;z-index:5;top:calc(var(--f)*4.9);right:calc(var(--f)*0.45);left:auto;display:grid;place-items:center;min-width:calc(var(--f)*2);height:calc(var(--f)*2);background:var(--amber);color:var(--ink);font:700 calc(var(--f)*1.1*var(--gf-scale,1)) var(--display);pointer-events:none}
.gf-fprot{position:absolute;z-index:7;left:50%;top:44%;transform:translateX(-50%);max-width:94%;padding:calc(var(--f)*0.2) calc(var(--f)*0.45);background:color-mix(in srgb,var(--ink) 92%,transparent);border:1px solid var(--steel-dark);color:var(--text);font:700 calc(var(--f)*0.72*var(--gf-scale,1))/1.2 var(--display);letter-spacing:.06em;text-transform:var(--case);text-align:center;pointer-events:none}
.gf-fslot{position:relative;flex:0 0 auto;width:calc(var(--f)*7.4);height:calc(var(--cw)*1.5);display:grid;place-items:center;align-content:center;gap:calc(var(--f)*0.4);padding:calc(var(--f)*0.4);cursor:pointer;border:2px dashed var(--coral);background:color-mix(in srgb,var(--ink) 55%,transparent);color:var(--text);font:700 calc(var(--f)*0.72*var(--gf-scale,1))/1.25 var(--display);text-align:center}
.gf-fslot svg{width:calc(var(--f)*2.4);height:calc(var(--f)*2.4);color:var(--coral)}
.gf-fslot:hover,.gf-fslot:focus-visible{background:color-mix(in srgb,var(--coral) 18%,var(--ink));outline:none}
.root[data-formation] .side.allies .row.front .gf-fslot{margin-bottom:calc(var(--f)*1.1)}
/* The tray re-renders under the pointer after each choice; a tip that caught the pointer would sit over the
   buttons above it, so tips only inform. */
.root[data-formation] .cbt-tip{pointer-events:none}
.root[data-formation] .cbt-act.gf-queued{border-color:var(--coral);box-shadow:inset 0 0 0 1px var(--coral)}
.root[data-formation] .cbt-act.gf-queued::after{content:"✓";position:absolute;top:calc(var(--f)*-0.5);left:calc(var(--f)*-0.3);z-index:3;background:var(--coral);color:var(--ink);font:700 calc(var(--f)*0.85*var(--gf-scale,1))/calc(var(--f)*1.6) var(--display);padding:0 calc(var(--f)*0.4)}
.root[data-formation] .cbt-act.gf-fight{border-color:var(--coral);background:color-mix(in srgb,var(--coral) 22%,var(--ink-2))}
.root[data-formation] .cbt-act.gf-fight .a-ic{color:var(--coral)}
.gf-fplan{display:flex;flex:1 1 auto;min-width:0;gap:calc(var(--f)*0.7);align-items:stretch}
.gf-fplan-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:calc(var(--f)*0.35);padding:calc(var(--f)*0.5) calc(var(--f)*0.6);background:color-mix(in srgb,var(--ink) 84%,transparent);border:1px solid var(--steel-dark);overflow-y:auto}
.gf-fplan-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 calc(var(--f)*0.6);font-family:var(--display)}
.gf-fplan-head b{font-size:calc(var(--f)*0.95*var(--gf-scale,1));letter-spacing:.12em;text-transform:var(--case);color:var(--coral)}
.gf-fplan-head span{font-size:calc(var(--f)*0.8*var(--gf-scale,1));color:var(--steel-faint)}
.gf-fplan ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--f)*0.3)}
.gf-fplan li{display:flex;align-items:center;gap:calc(var(--f)*0.5);min-width:0}
.gf-fplan li>button.gf-fpick{flex:1 1 auto;min-width:0;min-height:max(28px,calc(var(--f)*2.6));display:flex;align-items:center;gap:calc(var(--f)*0.5);padding:calc(var(--f)*0.25) calc(var(--f)*0.4);background:transparent;border:1px solid transparent;color:var(--text);text-align:left;cursor:pointer;font:400 calc(var(--f)*0.92*var(--gf-scale,1))/1.3 var(--body)}
.gf-fplan li>button.gf-fpick:hover,.gf-fplan li>button.gf-fpick:focus-visible{border-color:var(--coral);outline:none}
.gf-fplan .gf-fnum{flex:none;display:grid;place-items:center;width:calc(var(--f)*1.9);height:calc(var(--f)*1.9);border-radius:50%;background:var(--coral);color:var(--ink);font:700 calc(var(--f)*0.9*var(--gf-scale,1)) var(--display)}
.gf-fplan li.unset .gf-fnum{background:var(--ink-2);color:var(--steel-faint);border:1px solid var(--steel-dark)}
.gf-fplan .gf-fwhat{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gf-fplan .gf-fwhat b{font-family:var(--display)}
.gf-fplan .gf-fpay{flex:none;font:700 calc(var(--f)*0.85*var(--gf-scale,1)) var(--display);color:var(--amber);white-space:nowrap}
.gf-fplan li.short .gf-fpay{color:var(--alarm)}
.gf-fplan .gf-fclear{flex:none;cursor:pointer;width:max(28px,calc(var(--f)*2.6));min-height:max(28px,calc(var(--f)*2.6));background:transparent;border:1px solid var(--steel-dark);color:var(--porcelain-3);font:700 calc(var(--f)*0.9) var(--display)}
.gf-ffight{flex:0 0 auto;align-self:stretch;cursor:pointer;min-width:calc(var(--f)*9);padding:calc(var(--f)*0.6) calc(var(--f)*1.2);background:var(--coral);border:1px solid var(--coral);color:var(--ink);font:700 calc(var(--f)*1.3*var(--gf-scale,1)) var(--title);letter-spacing:.12em;text-transform:var(--case);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--f)*0.3)}
.gf-ffight svg{width:calc(var(--f)*2.2);height:calc(var(--f)*2.2)}
.gf-finfo{display:flex;flex-direction:column;gap:calc(var(--f)*0.45);min-width:0;overflow-y:auto}
.gf-finfo h4{margin:0;font:700 calc(var(--f)*1.2*var(--gf-scale,1))/1.2 var(--display);color:var(--text)}
.gf-finfo p{margin:0;font-size:calc(var(--f)*0.95*var(--gf-scale,1));line-height:1.4;color:var(--porcelain-3)}
.gf-finfo p b{color:var(--text);font-family:var(--display)}
.gf-finfo .gf-fmech{color:var(--steel-faint)}
.root[data-formation] .ai-desc .gf-fmech,.root[data-formation] .cbt-tip .gf-fmech{display:block;margin-top:.25em;color:var(--jade)}
.root[data-formation] .ai-vs .gf-fglyph{width:1.1em;height:1.1em}
/* Widths come from a ResizeObserver: a container query here would re-base --f (a cqw value) on the slot. */
.gf-ftight .gf-fbank-lab{display:none}
.gf-fnarrow .gf-fturn .tu-hero{display:none}.gf-fnarrow .gf-ffight{min-width:calc(var(--f)*7);padding-inline:calc(var(--f)*0.5)}.gf-fnarrow .gf-fincome{display:none}
@media (prefers-reduced-motion: reduce){.gf-fslot{transition:none}}
`;

// Status chips the Formation engine reports; merged into the battle's chip map (Classic keys are untouched).
export const forgeFormationStatusChips = {
  silence: () => ({
    icon: "sap",
    good: false,
    t: forgeFormationLabel("chip.silence"),
    d: forgeFormationLabel("chip.silenceText"),
  }),
  taunt: () => ({
    icon: "defend",
    good: true,
    t: forgeFormationLabel("chip.taunt"),
    d: forgeFormationLabel("chip.tauntText"),
    mine: true,
  }),
  fimmune: () => ({
    icon: "immune",
    good: true,
    t: forgeFormationLabel("chip.immune"),
    d: forgeFormationLabel("chip.immuneText"),
  }),
  fregen: (value) => ({
    icon: "regen",
    good: true,
    t: forgeFormationLabel("chip.regen", { value }),
    d: forgeFormationLabel("chip.regenText", { value }),
  }),
  fcrit: (value) => ({
    icon: "critUp",
    good: value > 0,
    t: forgeFormationLabel("chip.crit", { value: (value > 0 ? "+" : "") + value }),
    d: forgeFormationLabel("chip.critText", { value: (value > 0 ? "+" : "") + value }),
  }),
  fmarked: () => ({
    icon: "marked",
    good: false,
    t: forgeFormationLabel("chip.marked"),
    d: forgeFormationLabel("chip.markedText"),
  }),
  fcharging: () => ({
    icon: "charging",
    good: true,
    t: forgeFormationLabel("chip.charging"),
    d: forgeFormationLabel("chip.chargingText"),
    mine: true,
  }),
};

const forgeFormationSkillSection = (heading, ability, affinity, image, extra = "") =>
  `<div class="sec"><div class="h">${forgeFormationEscape(heading)}</div><div class="skill"><span class="ic has-art">${image}</span><div><div class="sn">${forgeFormationEscape(ability.name)}</div><div class="mech"><span class="m">${forgeFormationEscape(forgeFormationLabel(`effect.${ability.effect}`))}</span>${extra}</div><div class="derived">${forgeFormationEscape(forgeFormationDescribe(ability, affinity))}</div>${ability.description ? `<p class="flavour">${forgeFormationEscape(ability.description)}</p>` : ""}</div></div></div>`;

/** The foe sheet's Formation half: the kit that actually fights, its mechanics, row and income. */
export function forgeFormationFoeSheet(enemy, image, mechIcons = {}) {
  // An Echo has no kit of its own: its sheet says what it is instead of listing its owner's.
  if (String(enemy?.id ?? "").includes("~"))
    return `<div class="sec"><div class="h">${forgeFormationEscape(forgeFormationLabel("echo"))}</div><p>${forgeFormationEscape(forgeFormationLabel("echoInfo", { owner: enemy.echoOwner || enemy.name || "" }))}</p></div>`;
  const kit = normalizeForgeFormationKit(enemy?.formationKit);
  if (!kit) return "";
  const affinity = String(enemy.affinity || "").toLowerCase();
  const art = (ability) =>
    typeof image === "function"
      ? image(forgeFormationArtEffect[ability.effect] || ability.effect, affinity, ability.target, ability.name)
      : "";
  const mechs = (Array.isArray(enemy.mech) ? enemy.mech : [])
    .filter((mech) => forgeFormationCombatEnglish[`combat.formation.mech.${mech}`])
    .map(
      (mech) =>
        `<div class="rule">${mechIcons[mech] || ""}<b>${forgeFormationEscape(forgeFormationLabel(`mechName.${mech}`))}</b><span>${forgeFormationEscape(forgeFormationLabel(`mech.${mech}`))}</span></div>`,
    )
    .join("");
  const cost = (ability) => `<span class="m"><b>${forgeFormationCostHtml(ability, affinity)}</b></span>`;
  return (
    (mechs
      ? `<div class="sec"><div class="h">${forgeFormationEscape(forgeFormationLabel("foeRules"))}</div><div class="fs-rules">${mechs}</div></div>`
      : "") +
    forgeFormationSkillSection(
      forgeFormationLabel("standard"),
      kit.standard,
      affinity,
      art(kit.standard),
      cost(kit.standard),
    ) +
    forgeFormationSkillSection(
      forgeFormationLabel("ultimate"),
      kit.ultimate,
      affinity,
      art(kit.ultimate),
      cost(kit.ultimate),
    ) +
    forgeFormationSkillSection(
      forgeFormationLabel("passive"),
      kit.passive,
      affinity,
      art(kit.passive),
      `<span class="m trig">${forgeFormationEscape(forgeFormationLabel(`trigger.${kit.passive.trigger}`))}</span><span class="m">${forgeFormationEscape(forgeFormationLabel(`row.${kit.passive.row}`))}</span>`,
    ) +
    (enemy.position === "back"
      ? `<div class="sec"><div class="h">${forgeFormationEscape(forgeFormationLabel("row.back"))}</div><p class="flavour">${forgeFormationGlyph(affinity)} ${forgeFormationEscape(forgeFormationLabel("generates", { element: forgeFormationElementName(affinity) }))} ${forgeFormationEscape(forgeFormationLabel("supportInfo"))}</p></div>`
      : "")
  );
}

export function createForgeFormationPresentation(root, payload, hooks = {}) {
  const inert = {
    turn: () => false,
    click: () => false,
    label: () => false,
    rail: () => false,
    event() {},
    dispose() {},
  };
  if (payload?.combatMode !== "formation") return inert;
  const {
    run = {},
    choose = () => {},
    card = (id) => root.querySelector(`.cbt[data-id="${String(id).replace(/"/gu, "")}"]`),
    hero = () => "",
    button = () => "",
    banner = () => {},
    art = () => "",
    icons = {},
    actions = {},
    relabel = () => {},
    silhouette = "",
  } = hooks;
  const shell = root.querySelector(".root") || root;
  shell.dataset.formation = "";
  const screen = root.querySelector(".screen");
  const units = new Map([...(payload.allies || []), ...(payload.enemies || [])].map((unit) => [String(unit.id), unit]));
  const allyIds = new Set((payload.allies || []).map((unit) => String(unit.id)));
  const unitOf = (id) => units.get(String(id)) || units.get(String(id).split("~")[0]) || null;
  const nameOf = (id) => {
    const node = card(id)?.querySelector(".nm");
    return node?.textContent || unitOf(id)?.name || "";
  };
  const rules = Array.isArray(payload.formationRules) ? payload.formationRules : [];
  const order = rules.find((rule) => rule.kind === "defeat_order")?.order || [];
  const enemyIds = (payload.enemies || []).map((unit) => String(unit.id));
  const timers = new Set();
  const later = (callback, ms) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, ms);
    timers.add(timer);
  };
  // The team strip lives beside the turn panel (outside it, so resolving a plan never wipes it); the foe strip
  // and the encounter rules sit in the enemy half.
  const slot = root.querySelector(".cbt-turn-slot");
  const strip = document.createElement("div");
  strip.className = "gf-fbank";
  strip.dataset.formationBank = "ally";
  strip.setAttribute("role", "status");
  slot?.append(strip);
  const resize =
    slot && typeof ResizeObserver === "function"
      ? new ResizeObserver(([entry]) => {
          const width = entry?.contentRect?.width || 0;
          slot.classList.toggle("gf-ftight", width < 420);
          slot.classList.toggle("gf-fnarrow", width < 300);
        })
      : null;
  resize?.observe(slot);
  const bar = root.querySelector(".cbar");
  const barSize =
    bar && typeof ResizeObserver === "function"
      ? new ResizeObserver(() =>
          shell.style.setProperty("--gf-cbar", `${Math.ceil(bar.getBoundingClientRect().height)}px`),
        )
      : null;
  barSize?.observe(bar);
  const side = document.createElement("div");
  side.className = "gf-fside";
  const foeStrip = document.createElement("div");
  foeStrip.className = "gf-fbank";
  foeStrip.dataset.formationBank = "enemy";
  side.append(foeStrip);
  // The objective and rules stay on screen all fight; tap to read them in full.
  const objective = typeof payload.objective === "string" ? payload.objective.trim() : "";
  if (rules.length || objective) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "gf-frules";
    chip.dataset.formationRules = "";
    chip.setAttribute("aria-expanded", "false");
    chip.innerHTML =
      (objective
        ? `<b>${forgeFormationEscape(forgeFormationLabel("objective"))}</b><span>${forgeFormationEscape(objective)}</span>`
        : "") +
      (rules.length
        ? `<b>${forgeFormationEscape(forgeFormationLabel("rules"))}</b>${rules.map((rule) => `<span>${forgeFormationEscape(rule.description)}</span>`).join("")}`
        : "");
    chip.addEventListener("click", () =>
      chip.setAttribute("aria-expanded", String(chip.getAttribute("aria-expanded") !== "true")),
    );
    side.append(chip);
  }
  (root.querySelector(".arena") || screen)?.append(side);
  const banks = { ally: null, enemy: null };
  for (const step of (run.steps || []).slice(0, run.stepI || 0))
    for (const event of step.events || []) if (event.op === "formation-bank") banks[event.side] = event.bank;
  banks.ally ||= run.pending?.options?.formation?.bank || null;
  let phase = "ally",
    disposed = false,
    // Keyboard focus was in the fight when Fight was pressed; the host clears the panel while the turn resolves.
    refocus = false;
  const state = () => {
    const prompt = run.pending?.options?.formation ? run.pending : null;
    if (!run.forgeFormation || run.forgeFormation.prompt !== prompt)
      run.forgeFormation = { prompt, plan: [], selected: null, mode: "tray", aim: null, info: null, container: null };
    return run.forgeFormation;
  };
  const planning = () => {
    const current = state();
    return !!current.prompt && !run.auto && !run.done && (run.stepI || 0) >= (run.steps || []).length;
  };
  const formation = () => state().prompt?.options?.formation || null;
  const fighter = (id) => formation()?.fighters.find((unit) => unit.id === String(id)) || null;
  const entryOf = (id) => state().plan.find((entry) => entry.actorId === String(id)) || null;
  const projection = () => forgeFormationProjection(formation(), state().plan);
  // The bank an action would pay from: everything queued before its own place in the plan.
  const bankBefore = (id) => {
    const plan = state().plan,
      at = plan.findIndex((entry) => entry.actorId === id);
    return forgeFormationProjection(formation(), at < 0 ? plan : plan.slice(0, at)).bank;
  };
  const skillOf = (unit, action) =>
    action === "ultimate" ? unit?.ultimate : action === "normal" ? unit?.normal : null;
  const lockOf = (unit, action) => {
    const skill = skillOf(unit, action);
    if (!skill) return "target";
    if (unit.silenced) return "silenced";
    const reach = unit.targets[action];
    if (
      (["enemy", "enemy-back", "fallen"].includes(reach.kind) ||
        ["revive", "swap", "summon", "immune"].includes(skill.effect)) &&
      !reach.ids.length &&
      // A summon can fill a seat a retreat earlier in the plan frees.
      !(skill.effect === "summon" && forgeFormationSeatsFreed(formation(), state().plan, unit.id) > 0)
    )
      return "target";
    if (
      reach.kind === "set" &&
      forgeFormationOffensive.has(skill.effect) &&
      skill.effect !== "shuffle" &&
      !reach.ids.length
    )
      return "target";
    const bank = bankBefore(unit.id);
    if (forgeFormationPayment(bank, skill, unit.aff)) return null;
    // Enough energy in all, but not of the element its share needs.
    const total = forgeFormationElements.reduce((sum, element) => sum + (Number(bank[element]) || 0), 0);
    return total >= (Number(skill.cost) || 0) ? "element" : "energy";
  };
  const lockValues = (unit, skill) => {
    const bank = bankBefore(unit.id),
      wild = ["light", "dark"].filter((element) => element !== unit.aff);
    const native = (Number(bank[unit.aff]) || 0) + wild.reduce((sum, element) => sum + (Number(bank[element]) || 0), 0);
    return {
      cost: skill?.cost || 0,
      element: Math.max(1, (Number(skill?.elementCost) || 0) - native),
      name: forgeFormationElementName(unit.aff),
    };
  };
  const drawBank = (target, bank, after, income, floor, label) => {
    if (!target) return;
    if (!bank) {
      target.replaceChildren();
      return;
    }
    const total = income ? Object.values(income).reduce((sum, value) => sum + value, 0) : 0;
    target.setAttribute("aria-label", label);
    target.innerHTML =
      `<span class="gf-fbank-lab">${forgeFormationEscape(label)}</span>` +
      forgeFormationElements
        .map((element) => {
          const now = Number(bank[element]) || 0,
            next = after ? Number(after[element]) || 0 : now;
          return `<span class="gf-fchip${now || next ? "" : " zero"}" data-formation-energy="${element}" style="--aff:var(--${element})" title="${forgeFormationEscape(forgeFormationLabel("projected", { element: forgeFormationElementName(element), now, after: next }))}">${forgeFormationGlyph(element)}${now}${next !== now ? `<i>→${next}</i>` : ""}</span>`;
        })
        .join("") +
      (income
        ? `<span class="gf-fincome">${forgeFormationEscape(total ? forgeFormationLabel("income", { count: total }) : floor ? forgeFormationLabel("incomeFloor") : "")}</span>`
        : "");
  };
  const drawBanks = () => {
    const live = planning() ? formation() : null;
    drawBank(
      strip,
      live ? live.bank : banks.ally,
      live ? projection().bank : null,
      live?.income,
      live?.floor,
      forgeFormationLabel("energy"),
    );
    const foe = banks.enemy;
    drawBank(
      foeStrip,
      foe && Object.values(foe).some(Boolean) ? foe : null,
      null,
      null,
      false,
      forgeFormationLabel("foeEnergy"),
    );
  };
  const clearDecor = () => {
    for (const node of root.querySelectorAll(".gf-fbadge,.gf-ftargets,.gf-fprot,.gf-fslot")) node.remove();
    for (const node of root.querySelectorAll(".cbt.gf-ready,.cbt[tabindex],.cbt[aria-label]")) {
      node.classList.remove("gf-ready");
      node.removeAttribute("tabindex");
      node.removeAttribute("role");
      node.removeAttribute("aria-label");
    }
    for (const node of root.querySelectorAll(".cbt.gf-protected")) node.classList.remove("gf-protected");
  };
  // What every card says about itself: supports their income, enemies their place in a defeat order.
  const drawStatic = () => {
    for (const node of root.querySelectorAll(".cbt")) {
      const back =
        !!node.closest(".row.back") && !node.classList.contains("dead") && !String(node.dataset.id).includes("~");
      let gen = node.querySelector(".gf-fgen");
      if (back) {
        const element = String(unitOf(node.dataset.id)?.affinity || "").toLowerCase();
        if (!gen) {
          gen = document.createElement("span");
          gen.className = "gf-fgen";
          node.querySelector(".enrow")?.append(gen);
        }
        gen.innerHTML = `+1${forgeFormationGlyph(element)}`;
        gen.title = forgeFormationLabel("generates", { element: forgeFormationElementName(element) });
      } else gen?.remove();
    }
    for (const node of root.querySelectorAll('.cbt[data-id*="~"] .gf-forder, .cbt[data-id*="~"] .gf-enemy-tier'))
      node.remove();
    order.forEach((index, at) => {
      const node = card(enemyIds[index]);
      if (!node || node.querySelector(".gf-forder")) return;
      const badge = document.createElement("span");
      badge.className = "gf-forder";
      badge.textContent = forgeFormationCircled(at);
      badge.title = forgeFormationLabel("orderBadge", { order: forgeFormationCircled(at) });
      node.append(badge);
    });
  };
  const describeEntry = (entry) => {
    const unit = fighter(entry.actorId);
    if (entry.action === "hold") return forgeFormationLabel("planHold");
    if (entry.action === "row") {
      if (entry.swapId) return forgeFormationLabel("moveTo.swap", { name: nameOf(entry.swapId) });
      if (entry.moveId && entry.moveId !== entry.actorId)
        return forgeFormationLabel("moveTo.pull", { name: nameOf(entry.moveId) });
      return forgeFormationLabel("moveTo.back");
    }
    const skill = skillOf(unit, entry.action);
    return `${skill?.name || ""}${entry.targetId ? ` ${forgeFormationLabel("target", { name: nameOf(entry.targetId) })}` : ""}`;
  };
  const drawCards = () => {
    clearDecor();
    drawStatic();
    if (!planning()) return;
    const current = state(),
      live = formation(),
      outcome = projection().results;
    for (const unit of live.fighters) {
      const node = card(unit.id);
      if (!node) continue;
      node.classList.add("gf-ready");
      node.setAttribute("role", "button");
      node.tabIndex = 0;
      node.classList.toggle("is-actor", current.selected === unit.id);
      const at = current.plan.findIndex((entry) => entry.actorId === unit.id);
      if (at < 0) continue;
      const entry = current.plan[at],
        badge = document.createElement("span");
      badge.className = `gf-fbadge${entry.action === "hold" ? " hold" : outcome[at]?.ok === false ? " short" : ""}`;
      const skill = skillOf(unit, entry.action);
      badge.innerHTML =
        forgeFormationCircled(at) +
        (entry.action === "row"
          ? actions.row || ""
          : entry.action === "hold"
            ? forgeFormationIcons.hold
            : icons[skill?.effect] || icons.damage || "");
      node.append(badge);
      if (entry.targetId) {
        const target = card(entry.targetId);
        if (target) {
          let marks = target.querySelector(".gf-ftargets");
          if (!marks) {
            marks = document.createElement("span");
            marks.className = "gf-ftargets";
            target.append(marks);
          }
          marks.insertAdjacentHTML("beforeend", `<b>${forgeFormationCircled(at)}</b>`);
        }
      }
    }
    for (const waiting of live.waiting) {
      const node = card(waiting.id);
      if (!node) continue;
      const badge = document.createElement("span");
      badge.className = "gf-fbadge wait";
      badge.textContent = forgeFormationLabel(`wait.${waiting.reason}`);
      node.append(badge);
    }
  };
  const markTargets = (ids, set, blocked = {}) => {
    const lit = new Set(ids.map(String));
    for (const node of root.querySelectorAll(".cbt")) {
      node.classList.remove("targetable", "dimmed", "aim");
      if (node.classList.contains("dead") && !lit.has(node.dataset.id)) {
        node.classList.add("dimmed");
        continue;
      }
      node.classList.add(lit.has(node.dataset.id) ? (set ? "aim" : "targetable") : "dimmed");
      // A pickable card is a keyboard target too.
      if (lit.has(node.dataset.id) && !set) {
        node.setAttribute("role", "button");
        node.tabIndex = 0;
        node.setAttribute("aria-label", forgeFormationLabel("choose", { name: nameOf(node.dataset.id) }));
      }
      const reason = blocked[node.dataset.id];
      if (reason && !lit.has(node.dataset.id)) {
        const chip = document.createElement("span");
        chip.className = "gf-fprot";
        chip.textContent =
          reason === "barrier"
            ? forgeFormationLabel("protected.barrier", {
                elements: (rules.find((rule) => rule.kind === "element_barrier")?.elements || [])
                  .map(forgeFormationElementName)
                  .join(", "),
              })
            : reason === "order"
              ? forgeFormationLabel("protected.order", {
                  order: forgeFormationCircled(
                    Math.max(
                      0,
                      order.findIndex(
                        (index) => card(enemyIds[index]) && !card(enemyIds[index]).classList.contains("dead"),
                      ),
                    ),
                  ),
                })
              : reason === "taunt"
                ? forgeFormationLabel("protected.taunt", { name: ids.map(nameOf).join(", ") })
                : forgeFormationLabel("protected.back");
        node.classList.add("gf-protected");
        node.append(chip);
      }
    }
  };
  const unmark = () => {
    for (const node of root.querySelectorAll(".cbt")) {
      node.classList.remove("targetable", "dimmed", "aim", "gf-protected");
      // "Choose X" belongs to the aim that set it.
      node.removeAttribute("aria-label");
    }
    for (const node of root.querySelectorAll(".gf-fprot,.gf-fslot")) node.remove();
  };
  const queue = (entry) => {
    const current = state(),
      at = current.plan.findIndex((item) => item.actorId === entry.actorId);
    if (at >= 0) current.plan[at] = entry;
    else current.plan.push(entry);
    const next = formation().fighters.find((unit) => !entryOf(unit.id));
    current.selected = next ? next.id : null;
    current.mode = next ? "tray" : "summary";
    current.aim = null;
    current.info = null;
    render();
  };
  const fight = () => {
    if (!planning()) return;
    const active = root.getRootNode?.()?.activeElement || globalThis.document?.activeElement;
    refocus = !!active && !!root.contains?.(active) && active !== root;
    const plan = state().plan.map((entry) => ({ ...entry }));
    unmark();
    clearDecor();
    screen?.classList.remove("picking");
    phase = "ally";
    choose({ action: "plan", plan });
  };
  const select = (id) => {
    const current = state();
    current.selected = id;
    current.mode = id ? "tray" : "summary";
    current.aim = null;
    current.info = null;
    render();
  };
  const trayButtons = (unit) => {
    const entry = entryOf(unit.id);
    const skillButton = (action) => {
      const skill = skillOf(unit, action),
        lock = lockOf(unit, action);
      return {
        key: action,
        name: skill.name,
        icon: icons[skill.effect] || icons[forgeFormationArtEffect[skill.effect]] || icons.damage || "",
        art: art(forgeFormationArtEffect[skill.effect] || skill.effect, unit.aff, skill.target),
        aff: unit.aff,
        chip: action === "ultimate" ? "ULT" : "",
        cost: lock ? "" : forgeFormationCostHtml(skill, unit.aff),
        wait: lock ? forgeFormationEscape(forgeFormationLabel(`lock.${lock}`, lockValues(unit, skill))) : "",
        locked: !!lock,
        tip:
          forgeFormationEscape(skill.description || "") +
          `<span class="gf-fmech">${forgeFormationEscape(forgeFormationDescribe(skill, unit.aff))}</span>`,
        vs: forgeFormationEscape(
          lock
            ? forgeFormationLabel(`lockTip.${lock}`, lockValues(unit, skill))
            : forgeFormationCostText(skill, unit.aff),
        ),
      };
    };
    return [
      skillButton("normal"),
      skillButton("ultimate"),
      {
        key: "row",
        name: forgeFormationLabel("move"),
        icon: actions.row || "",
        art: art("row"),
        locked: !unit.moves.length,
        wait: unit.moves.length ? "" : forgeFormationEscape(forgeFormationLabel("lock.move")),
        tip: forgeFormationEscape(forgeFormationLabel("moveTip")),
      },
      {
        key: "info",
        name: forgeFormationLabel("info"),
        icon: forgeFormationIcons.info,
        tip: forgeFormationEscape(forgeFormationLabel("infoTip")),
      },
      {
        key: "hold",
        name: forgeFormationLabel("hold"),
        icon: forgeFormationIcons.hold,
        tip: forgeFormationEscape(forgeFormationLabel("holdTip")),
      },
      {
        key: "fight",
        name: forgeFormationLabel("fight"),
        icon: forgeFormationIcons.fight,
        chip: forgeFormationEscape(forgeFormationLabel("fight")),
        tip: forgeFormationEscape(forgeFormationLabel("fightTip")),
      },
    ].map((item) => ({ ...item, queued: entry?.action === item.key }));
  };
  const aimHtml = (title, body, foot, image = "", iconHtml = "") =>
    `<div class="ai-art">${image ? `<img src="${forgeFormationEscape(image)}" alt="">` : ""}<span class="ai-ic">${iconHtml}</span></div><div class="ai-body"><b class="ai-nm">${forgeFormationEscape(title)}</b>${body}<div class="ai-foot">${foot}</div></div>`;
  const drawAim = (aim, unit) => {
    const current = state(),
      skill = skillOf(unit, current.aim),
      reach = unit.targets[current.aim];
    const payment = forgeFormationPayment(bankBefore(unit.id), skill, unit.aff);
    const set = !["enemy", "ally", "fallen", "enemy-back"].includes(reach.kind);
    const hint = set
      ? forgeFormationLabel("pick.set", { count: reach.ids.length || (skill.effect === "summon" ? 1 : 0) })
      : forgeFormationLabel(
          reach.kind === "enemy"
            ? "pick.enemy"
            : reach.kind === "ally"
              ? "pick.ally"
              : reach.kind === "fallen"
                ? "pick.fallen"
                : "pick.enemyBack",
        );
    aim.innerHTML = aimHtml(
      skill.name,
      `<p class="ai-desc">${forgeFormationEscape(skill.description || "")}<span class="gf-fmech">${forgeFormationEscape(forgeFormationDescribe(skill, unit.aff))}</span></p><p class="ai-vs">${forgeFormationEscape(forgeFormationCostText(skill, unit.aff))}${payment && skill.cost ? ` · ${forgeFormationPaymentHtml(payment)}` : ""}</p>`,
      `<span class="ai-hint">${forgeFormationEscape(hint)}</span>${set ? `<button class="ai-x" type="button" data-formation-confirm>${forgeFormationEscape(forgeFormationLabel("confirm"))}</button>` : ""}<button class="ai-x" type="button" data-formation-cancel>${forgeFormationEscape(forgeFormationLabel("cancel"))}</button>`,
      art(forgeFormationArtEffect[skill.effect] || skill.effect, unit.aff, skill.target),
      icons[skill.effect] || icons.damage || "",
    );
    markTargets(reach.ids, set, reach.blocked);
    aim
      .querySelector("[data-formation-confirm]")
      ?.addEventListener("click", () => queue({ actorId: unit.id, action: current.aim }));
  };
  const drawMove = (aim, unit) => {
    const current = state();
    const busy = new Set(
      current.plan
        .filter((entry) => entry.action === "row" && entry.actorId !== unit.id)
        .flatMap((entry) => [entry.moveId, entry.swapId])
        .filter(Boolean),
    );
    const moves = unit.moves.filter((move) => !busy.has(move.moveId) && !busy.has(move.swapId));
    const pulling = current.mode === "pull";
    const ids = pulling
      ? moves.filter((move) => move.to === "front").map((move) => move.moveId)
      : moves.filter((move) => move.swapId).map((move) => move.swapId);
    aim.innerHTML = aimHtml(
      forgeFormationLabel("move"),
      `<p class="ai-desc">${forgeFormationEscape(forgeFormationLabel("moveTip"))}</p>`,
      `<span class="ai-hint">${forgeFormationEscape(forgeFormationLabel(pulling ? "pick.pull" : "pick.move", { name: nameOf(unit.id) }))}</span><button class="ai-x" type="button" data-formation-cancel>${forgeFormationEscape(forgeFormationLabel("cancel"))}</button>`,
      art("row"),
      actions.row || "",
    );
    markTargets(ids, false);
    if (pulling) return;
    const seats = (row, legal, onPick) => {
      const host = root.querySelector(`.side.allies .row.${row}`) || root.querySelector(".side.allies");
      const filled = root.querySelectorAll(`.side.allies .row.${row} .cbt:not(.dead)`).length;
      for (let index = filled; index < 3 && legal; index += 1) {
        const ghost = document.createElement("button");
        ghost.type = "button";
        ghost.className = "gf-fslot";
        ghost.dataset.formationSeat = row;
        ghost.innerHTML = `${forgeFormationIcons.plus}<span>${forgeFormationEscape(forgeFormationLabel(`seat.${row}`))}</span>${row === "front" ? `<span>${forgeFormationEscape(forgeFormationLabel("seat.arrives"))}</span>` : ""}`;
        ghost.addEventListener("click", (event) => {
          event.stopPropagation();
          onPick();
        });
        host.append(ghost);
        break;
      }
    };
    seats(
      "back",
      moves.some((move) => move.moveId === unit.id && !move.swapId),
      () => queue({ actorId: unit.id, action: "row", moveId: unit.id }),
    );
    seats(
      "front",
      moves.some((move) => move.to === "front"),
      () => {
        current.mode = "pull";
        render();
      },
    );
  };
  const drawInfo = (aim, id) => {
    if (String(id).includes("~")) {
      aim.innerHTML = `<div class="gf-finfo"><h4>${forgeFormationEscape(nameOf(id))}</h4><p>${forgeFormationEscape(forgeFormationLabel("echoInfo", { owner: nameOf(String(id).split("~")[0]) }))}</p></div><div class="ai-foot"><button class="ai-x" type="button" data-formation-cancel>${forgeFormationEscape(forgeFormationLabel("close"))}</button></div>`;
      return;
    }
    const unit = fighter(id);
    const support = formation()?.supports.find((entry) => entry.id === String(id));
    const base = unitOf(id) || {};
    const element = String(base.affinity || unit?.aff || support?.aff || "").toLowerCase();
    const kit = unit
      ? { standard: unit.normal, ultimate: unit.ultimate, passive: unit.passive, traits: unit.traits }
      : normalizeForgeFormationKit(base.formationKit);
    const ability = (heading, skill, extra = "") =>
      skill
        ? `<p><b>${forgeFormationEscape(heading)} · ${forgeFormationEscape(skill.name)}</b>${extra}<br>${forgeFormationEscape(skill.description || "")} <span class="gf-fmech">${forgeFormationEscape(forgeFormationDescribe(skill, element))}</span></p>`
        : "";
    const body = [
      support
        ? `<p>${forgeFormationGlyph(element)} ${forgeFormationEscape(forgeFormationLabel("generates", { element: forgeFormationElementName(element) }))} ${forgeFormationEscape(forgeFormationLabel("supportInfo"))}</p>`
        : "",
      kit
        ? ability(
            forgeFormationLabel("passive"),
            kit.passive,
            ` · ${forgeFormationEscape(forgeFormationLabel(`trigger.${kit.passive.trigger}`))} · ${forgeFormationEscape(forgeFormationLabel(`row.${kit.passive.row}`))}`,
          )
        : "",
      kit
        ? ability(forgeFormationLabel("standard"), kit.standard, ` · ${forgeFormationCostHtml(kit.standard, element)}`)
        : "",
      kit
        ? ability(forgeFormationLabel("ultimate"), kit.ultimate, ` · ${forgeFormationCostHtml(kit.ultimate, element)}`)
        : "",
      ...(kit?.traits || []).map(
        (trait) =>
          `<p class="gf-fmech">${forgeFormationEscape(forgeFormationLabel(trait.kind, { power: trait.power }))}</p>`,
      ),
    ].join("");
    aim.innerHTML = `<div class="gf-finfo"><h4>${forgeFormationEscape(base.name || unit?.name || "")}</h4>${body}</div><div class="ai-foot"><button class="ai-x" type="button" data-formation-cancel>${forgeFormationEscape(forgeFormationLabel("close"))}</button></div>`;
  };
  const summaryHtml = () => {
    const live = formation(),
      outcome = projection().results,
      current = state();
    const row = (unit, entry, at) => {
      const result = at >= 0 ? outcome[at] : null;
      const skill = entry ? skillOf(unit, entry.action) : null;
      const what = entry ? describeEntry(entry) : forgeFormationLabel("planUnset");
      const pay =
        result?.payment && skill?.cost
          ? forgeFormationElements
              .filter((element) => result.payment[element])
              .map((element) => `${forgeFormationGlyph(element)}${result.payment[element]}`)
              .join(" ")
          : result?.ok === false
            ? forgeFormationEscape(forgeFormationLabel("planShort"))
            : "";
      return `<li class="${entry ? (result?.ok === false ? "short" : "") : "unset"}"><button type="button" class="gf-fpick" data-formation-pick="${forgeFormationEscape(unit.id)}"><span class="gf-fnum">${at >= 0 ? forgeFormationCircled(at) : "–"}</span><span class="gf-fwhat"><b>${forgeFormationEscape(unit.name)}</b> ${forgeFormationEscape(what)}</span><span class="gf-fpay">${pay}</span></button>${entry ? `<button type="button" class="gf-fclear" data-formation-clear="${forgeFormationEscape(unit.id)}" aria-label="${forgeFormationEscape(`${forgeFormationLabel("clear")} ${unit.name}`)}">✕</button>` : ""}</li>`;
    };
    const queued = current.plan.map((entry, at) => row(fighter(entry.actorId), entry, at)).join("");
    const unset = live.fighters
      .filter((unit) => !entryOf(unit.id))
      .map((unit) => row(unit, null, -1))
      .join("");
    return `<div class="gf-fplan" data-formation-plan><div class="gf-fplan-main"><div class="gf-fplan-head"><b>${forgeFormationEscape(forgeFormationLabel("plan"))}</b><span>${forgeFormationEscape(forgeFormationLabel(current.plan.length ? "planHint" : "planEmpty"))}</span></div><ol>${queued}${unset}</ol></div><button type="button" class="gf-ffight" data-formation-fight>${forgeFormationIcons.fight}${forgeFormationEscape(forgeFormationLabel("fight"))}</button></div>`;
  };
  function render() {
    if (disposed) return;
    // Keyboard focus follows the plan: remember whether it was in this fight before the panel is redrawn.
    const active = root.getRootNode?.()?.activeElement || globalThis.document?.activeElement;
    const focused = !!active && root.contains?.(active) && active !== root;
    drawBanks();
    drawCards();
    relabel();
    if (railNode) drawRail(railNode);
    const current = state(),
      container = current.container;
    if (!container || !planning()) return;
    draw(current, container);
    if (focused || refocus) {
      refocus = false;
      restoreFocus(current, container);
    }
  }
  const restoreFocus = (current, container) => {
    // A plan still missing a fighter keeps focus on that fighter, so a repeated Enter never resolves it.
    const target =
      current.mode === "summary"
        ? container.querySelector(".unset [data-formation-pick]") || container.querySelector("[data-formation-fight]")
        : ["aim", "move", "pull"].includes(current.mode)
          ? root.querySelector(".cbt.targetable[tabindex], [data-formation-seat]") ||
            container.querySelector("[data-formation-confirm], [data-formation-cancel]")
          : current.mode === "info"
            ? container.querySelector("[data-formation-cancel]")
            : container.querySelector(".cbt-act.gf-queued") || container.querySelector(".cbt-act");
    target?.focus?.();
  };
  function draw(current, container) {
    unmark();
    container.classList.add("gf-fturn");
    const unit = fighter(current.selected);
    if (!unit && current.mode !== "info") current.mode = "summary";
    screen?.classList.toggle("picking", ["aim", "move", "pull", "info"].includes(current.mode));
    if (current.mode === "summary") {
      container.innerHTML = summaryHtml();
      container.querySelector("[data-formation-fight]")?.addEventListener("click", fight);
      for (const pick of container.querySelectorAll("[data-formation-pick]"))
        pick.addEventListener("click", () => select(pick.dataset.formationPick));
      for (const clear of container.querySelectorAll("[data-formation-clear]"))
        clear.addEventListener("click", () => {
          current.plan = current.plan.filter((entry) => entry.actorId !== clear.dataset.formationClear);
          render();
        });
      return;
    }
    const shown = unit || unitOf(current.info) || {};
    const heroUnit = unitOf(shown.id || current.info) || shown;
    const items = unit ? trayButtons(unit) : [];
    container.style.setProperty("--aff", `var(--${String(heroUnit.affinity || unit?.aff || "steel").toLowerCase()})`);
    container.innerHTML = `${hero(heroUnit)}<div class="cbt-acts">${items.map((item) => button(item)).join("")}</div><div class="cbt-aim" data-aim></div>`;
    items.forEach((item) => {
      const node = container.querySelector(`[data-act="${item.key}"]`);
      if (!node) return;
      if (item.queued) node.classList.add("gf-queued");
      if (item.key === "fight") node.classList.add("gf-fight");
      // Screen readers hear what the button costs or why it waits, not only its name.
      if (item.locked) node.setAttribute("aria-disabled", "true");
      const note = node.querySelector(".ai-vs")?.textContent || node.querySelector(".ai-desc")?.textContent || "";
      if (note) node.setAttribute("aria-description", note);
      node.addEventListener("click", () => act(unit, item));
    });
    const aim = container.querySelector("[data-aim]");
    if (current.mode === "aim") drawAim(aim, unit);
    else if (current.mode === "move" || current.mode === "pull") drawMove(aim, unit);
    else if (current.mode === "info") drawInfo(aim, current.info || unit?.id);
    aim.querySelector("[data-formation-cancel]")?.addEventListener("click", () => {
      current.mode = unit ? "tray" : "summary";
      current.aim = null;
      current.info = null;
      render();
    });
  }
  const act = (unit, item) => {
    const current = state();
    if (item.locked) {
      banner(
        item.name,
        item.key === "row"
          ? forgeFormationLabel("lockTip.move")
          : forgeFormationLabel(`lockTip.${lockOf(unit, item.key)}`, lockValues(unit, skillOf(unit, item.key))),
      );
      return;
    }
    // With fighters still unplanned, the tray's Fight opens the plan to check first; its Fight carries it out.
    if (item.key === "fight") return current.plan.length < formation().fighters.length ? select(null) : fight();
    if (item.key === "hold") return queue({ actorId: unit.id, action: "hold" });
    if (item.key === "info") {
      current.mode = "info";
      current.info = unit.id;
    } else if (item.key === "row") current.mode = "move";
    else {
      current.mode = "aim";
      current.aim = item.key;
    }
    render();
  };
  // A turn starts: select the first fighter without an action, or show the plan once everyone has one.
  function turn(prompt, container) {
    const current = state();
    current.container = container;
    if (current.prompt !== prompt) return false;
    if (!current.selected && current.mode === "tray") {
      const next = formation().fighters.find((unit) => !entryOf(unit.id));
      current.selected = next?.id || null;
    }
    render();
    return true;
  }
  const click = (node) => {
    if (!planning() || disposed) return false;
    const current = state(),
      id = String(node.dataset.id),
      enemy = node.classList.contains("enemy");
    if (current.mode === "aim") {
      if (node.classList.contains("targetable"))
        queue({ actorId: current.selected, action: current.aim, targetId: id });
      return true;
    }
    if (current.mode === "move" || current.mode === "pull") {
      if (enemy || !node.classList.contains("targetable")) return true;
      const unit = fighter(current.selected);
      if (current.mode === "pull") queue({ actorId: unit.id, action: "row", moveId: id });
      else queue({ actorId: unit.id, action: "row", moveId: unit.id, swapId: id });
      return true;
    }
    if (enemy) return false;
    if (fighter(id)) {
      if (current.selected === id && current.mode === "tray") select(null);
      else select(id);
      return true;
    }
    current.mode = "info";
    current.info = id;
    render();
    return true;
  };
  const keys = (event) => {
    if (!planning()) return;
    const node = event.target?.closest?.(".cbt[tabindex]");
    if (node && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      node.click();
    } else if (event.key === "Escape" && ["aim", "move", "pull", "info"].includes(state().mode)) {
      const current = state();
      current.mode = fighter(current.selected) ? "tray" : "summary";
      render();
    }
  };
  root.addEventListener("keydown", keys);
  // The rail lists this turn's fighters and the enemy front; the fighter being planned is the large tile.
  let railNode = null;
  function drawRail(target) {
    const live = formation();
    const mine = live ? [...live.fighters.map((unit) => unit.id), ...live.waiting.map((unit) => unit.id)] : [];
    const theirs = live ? live.foes.filter((foe) => foe.position === "front").map((foe) => foe.id) : [];
    const key = `${run.round || 1}|${mine.join(",")}|${theirs.join(",")}`;
    if (target.dataset.formationRail === key) {
      for (const tile of target.querySelectorAll(".q-t[data-formation-tile]"))
        tile.classList.toggle("now", tile.dataset.formationTile === state().selected);
      return;
    }
    const tile = (id, foe) => {
      const unit = unitOf(id) || {};
      return `<span class="q-t${foe ? " foe" : ""}${!foe && state().selected === id ? " now" : ""}"${foe ? "" : ` data-formation-tile="${forgeFormationEscape(id)}"`} style="--aff:var(--${forgeFormationEscape(String(unit.affinity || "steel").toLowerCase())})" title="${forgeFormationEscape(nameOf(id))}">${unit.portrait ? `<img src="${forgeFormationEscape(unit.portrait)}" alt="">` : silhouette}</span>`;
    };
    target.dataset.formationRail = key;
    target.innerHTML = `<span class="q-lab">${forgeFormationEscape(forgeFormationLabel("round", { round: run.round || 1 }))}</span><div class="q-strip">${mine.map((id) => tile(id, false)).join("")}${theirs.map((id) => tile(id, true)).join("")}</div>`;
  }
  const floatOn = (id, html, color) => {
    const node = card(id)?.querySelector("[data-fx]");
    if (!node) return;
    const label = document.createElement("span");
    label.className = "dmg b";
    if (color) label.style.color = color;
    label.innerHTML = html;
    node.append(label);
    later(() => label.remove(), 1100);
  };
  drawBanks();
  drawStatic();
  return {
    turn,
    click,
    rail(target) {
      if (!target) return true;
      railNode = target;
      drawRail(target);
      return true;
    },
    label(target) {
      if (!target) return true;
      const current = state();
      const text = run.done
        ? forgeFormationLabel("label.over")
        : run.auto
          ? forgeFormationLabel("label.auto")
          : planning()
            ? current.mode === "aim"
              ? forgeFormationLabel("label.aim")
              : current.mode === "move" || current.mode === "pull"
                ? forgeFormationLabel("label.move")
                : forgeFormationLabel("label.plan", {
                    planned: current.plan.length,
                    total: formation().fighters.length,
                  })
            : forgeFormationLabel(phase === "enemy" ? "label.enemies" : "label.allies");
      if (target.textContent !== text) {
        target.textContent = text;
        target.classList.remove("turned");
        void target.offsetWidth;
        target.classList.add("turned");
      }
      if (run.auto && !planning()) {
        unmark();
        clearDecor();
        drawStatic();
      }
      return true;
    },
    event(event) {
      if (disposed || !event) return;
      switch (event.op) {
        case "formation-bank":
          banks[event.side] = event.bank;
          drawBanks();
          break;
        case "act":
          if (phase !== (allyIds.has(String(event.id).split("~")[0]) ? "ally" : "enemy")) {
            phase = phase === "ally" ? "enemy" : "ally";
            relabel();
          }
          break;
        case "energy-gain":
          floatOn(
            event.id,
            `+${Number(event.amount) || 1}${forgeFormationGlyph(event.element)}`,
            `var(--${forgeFormationEscape(event.element)})`,
          );
          break;
        case "passive":
          floatOn(event.id, forgeFormationEscape(event.name));
          break;
        case "formation-held":
          floatOn(event.id, forgeFormationEscape(forgeFormationLabel(`held.${event.reason}`)), "var(--steel-faint)");
          break;
        case "sapped":
          banner(forgeFormationLabel("sapped"), forgeFormationLabel("sappedSub"));
          break;
        case "formation-fatigue":
          banner(forgeFormationLabel("fatigue"), forgeFormationLabel("fatigueSub"));
          break;
        case "summon":
          // Echo cards are clones of their owner's: they carry the Echo's own name and none of its badges.
          queueMicrotask(() => {
            const node = card(event.id);
            if (!node) return;
            for (const badge of node.querySelectorAll(".gf-forder, .gf-enemy-tier")) badge.remove();
            const name = node.querySelector(".nm");
            if (name && event.name) name.textContent = event.name;
            if (event.name) banner(forgeFormationLabel("reinforcements"), event.name);
          });
          break;
        case "death":
          // Echoes never return, so their cards leave instead of piling up in the band.
          if (String(event.id).includes("~")) later(() => card(event.id)?.remove(), 700);
          break;
        case "row":
          // A unit arriving in front takes a fallen card's place there; that card steps aside until it is revived.
          if (event.position === "front")
            queueMicrotask(() => {
              const node = card(event.id),
                row = node?.parentElement;
              const fallen = row?.classList.contains("front")
                ? row.querySelector('.cbt.dead:not(.gf-fgone):not([data-id*="~"])')
                : null;
              if (!fallen) return;
              fallen.before(node);
              fallen.classList.add("gf-fgone");
            });
          queueMicrotask(drawStatic);
          break;
        case "revive":
          card(event.id)?.classList.remove("gf-fgone");
          queueMicrotask(drawStatic);
          break;
        default:
          break;
      }
    },
    dispose() {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      root.removeEventListener("keydown", keys);
      resize?.disconnect();
      barSize?.disconnect();
      shell.style.removeProperty("--gf-cbar");
      slot?.classList.remove("gf-ftight", "gf-fnarrow");
      strip.remove();
      side.remove();
      clearDecor();
    },
  };
}

/** The unit's Formation kit while this world fights in Formation, else null. */
export function forgeFormationActiveKit(host) {
  if (host._run?.combat?.mode !== "formation" || !host._unit) return null;
  return normalizeForgeFormationKit((host._unit.unit || host._unit).formationKit);
}

/**
 * The Skills tab in Formation: the kit's abilities in the classic skill-row style, replacing the classic skills
 * (Formation ignores classic skill levels and weapon skills). `icon` and `fallbackIcon` are the bundle's skill art.
 */
export function forgeFormationSkillList(unit, kit, icon, fallbackIcon) {
  const affinity = String(unit?.affinity || "").toLowerCase();
  const mechanics = (ability) =>
    `${forgeFormationLabel(`effect.${ability.effect}`)} · ${forgeFormationDescribe(ability, affinity)}`;
  const row = (kind, name, meta, line, ability) => {
    const art = ability
      ? icon(forgeFormationArtEffect[ability.effect] || ability.effect, unit.affinity, ability.target, ability.name)
      : "";
    return (
      `<div class="sk-row gf-formation-skill"><span class="ic${art ? " has-art" : ""}">${art || fallbackIcon}</span>` +
      `<span class="sk-id"><span class="sk-kind">${forgeFormationEscape(kind)}</span>` +
      `<span class="sk-nm">${forgeFormationEscape(name)}</span></span>` +
      `<span class="sk-lv">${meta}</span><span class="sk-line">${forgeFormationEscape(line.text)}` +
      (line.mechanics ? `<span class="gf-formation-mechanics">${forgeFormationEscape(line.mechanics)}</span>` : "") +
      "</span></div>"
    );
  };
  const cost = (ability) =>
    `${forgeFormationEscape(forgeFormationLabel("cost"))} ${forgeFormationCostHtml(ability, affinity)}`;
  const describe = (ability) => ({ text: ability.description, mechanics: mechanics(ability) });
  return (
    '<div class="sk-list">' +
    `<p class="gf-formation-mechanics">${forgeFormationEscape(forgeFormationLabel(`prefers.${kit.preferredRow}`))}</p>` +
    row(forgeFormationLabel("standard"), kit.standard.name, cost(kit.standard), describe(kit.standard), kit.standard) +
    row(forgeFormationLabel("ultimate"), kit.ultimate.name, cost(kit.ultimate), describe(kit.ultimate), kit.ultimate) +
    row(
      forgeFormationLabel("passive"),
      kit.passive.name,
      forgeFormationEscape(
        `${forgeFormationLabel(`trigger.${kit.passive.trigger}`)} · ${forgeFormationLabel(`row.${kit.passive.row}`)}`,
      ),
      describe(kit.passive),
      kit.passive,
    ) +
    kit.traits
      .map((trait) => {
        const [name, ...rest] = forgeFormationLabel(trait.kind, { power: trait.power }).split(": ");
        return row(forgeFormationLabel("traits"), name, "", { text: rest.join(": ") }, null);
      })
      .join("") +
    "</div>"
  );
}

export function forgeFormationErrorLabel(error) {
  if (error === "formation-team-size" || error === "formation-team-duplicate") return forgeFormationLabel("teamSize");
  if (error === "formation-rows") return forgeFormationLabel("rows");
  if (error === "formation-element-required") return forgeFormationLabel("unavailable");
  if (error === "formation-engine-changed") return forgeFormationLabel("engineChanged");
  if (error === "story-changed") return forgeFormationLabel("storyChanged");
  if (error === "combat-conversion-failed") return forgeFormationLabel("kitFailed");
  if (["conversion-in-progress", "formation-conversion-required", "combat-conversion-in-progress"].includes(error))
    return forgeFormationLabel("kitPending");
  return "";
}

const forgeFormationEditorStyles = `
.gf-fbadge-row{position:absolute;z-index:4;bottom:calc(100% - 1.9em);left:.35em;display:grid;place-items:center;min-width:1.7em;height:1.7em;padding:0 .3em;background:var(--ink-2);border:1px solid var(--steel-dark);color:var(--text);font:700 max(11px,var(--t-xs))/1 var(--display)}
.gf-fbadge-row[data-row="front"]{border-color:var(--coral);color:var(--coral)}.gf-fbadge-row[data-row="hybrid"]{border-color:var(--amber);color:var(--amber)}
[data-pick] .gf-fbadge-row{position:static;display:inline-grid;margin-left:.4em;vertical-align:middle}
.gf-feditor{display:flex;flex-wrap:wrap;align-items:center;gap:.3em .8em;margin-top:.4em;font:600 max(12px,var(--t-xs))/1.4 var(--display);color:var(--text)}
.gf-feditor .gf-fglyph{width:1.2em;height:1.2em}.gf-feditor .warn{color:var(--alarm)}
.slot .slot-name{color:var(--text);text-shadow:0 1px 2px rgba(0,0,0,.9)}
`;

/** The team editor in a Formation world: six seats with row labels, preferred-row badges and the energy a team makes. */
export function forgeFormationEditor(root, data, roster, board) {
  if (data?.combatMode !== "formation" || !root || !roster || !board) return;
  if (!root.querySelector("style[data-gf-formation-editor]")) {
    const style = document.createElement("style");
    style.dataset.gfFormationEditor = "";
    style.textContent = forgeFormationEditorStyles + forgeFormationCombatStyles;
    (root.querySelector(".root") || root).append(style);
  }
  const labels = root.querySelectorAll(".board .row-lab");
  if (labels[0]) labels[0].textContent = forgeFormationLabel("editor.front");
  if (labels[1]) labels[1].textContent = forgeFormationLabel("editor.back");
  const unitOf = (id) => (id === roster.LEADER ? roster.leaderObj : roster.byId?.get(id)) || null;
  const preferred = (unit) => normalizeForgeFormationKit(unit?.kit?.formationKit)?.preferredRow || null;
  const badge = (unit) => {
    const row = preferred(unit);
    return row
      ? `<span class="gf-fbadge-row" data-row="${row}" title="${forgeFormationEscape(forgeFormationLabel(`prefers.${row}`))}" aria-label="${forgeFormationEscape(forgeFormationLabel(`prefers.${row}`))}">${forgeFormationEscape(forgeFormationLabel(`badge.${row}`))}</span>`
      : "";
  };
  for (const row of ["front", "back"])
    (board[row] || []).forEach((id, index) => {
      const node = root.querySelector(`[data-slot="${row}:${index}"]`),
        unit = id && unitOf(id);
      if (!node || !unit || node.querySelector(".gf-fbadge-row")) return;
      node.insertAdjacentHTML("beforeend", badge(unit));
    });
  for (const node of root.querySelectorAll("[data-pick]")) {
    const unit = unitOf(node.dataset.pick);
    if (unit && !node.querySelector(".gf-fbadge-row"))
      node.querySelector(".b-name")?.insertAdjacentHTML("beforeend", badge(unit));
  }
  const front = (board.front || []).filter(Boolean),
    back = (board.back || []).filter(Boolean);
  const elements = back.map((id) => String(unitOf(id)?.aff || "").toLowerCase()).filter(Boolean);
  const foot = root.querySelector(".board-foot");
  if (!foot) return;
  let line = foot.querySelector(".gf-feditor");
  if (!line) {
    line = document.createElement("div");
    line.className = "gf-feditor";
    line.dataset.formationEditor = "";
    line.setAttribute("role", "status");
    foot.append(line);
  }
  line.innerHTML =
    `<span>${forgeFormationEscape(forgeFormationLabel("editor.count", { front: front.length, back: back.length }))}</span>` +
    `<span>${elements.length ? forgeFormationEscape(forgeFormationLabel("editor.income", { count: elements.length })) + " " + elements.map(forgeFormationGlyph).join("") : forgeFormationEscape(forgeFormationLabel("editor.floor"))}</span>` +
    (front.length ? "" : `<span class="warn">${forgeFormationEscape(forgeFormationLabel("editor.needFront"))}</span>`);
}

const forgeFormationGuides = {
  combat: { kick: "Battle", topics: ["turn", "energy", "rows", "elements", "auto"] },
  formation: { kick: "Formation", topics: ["placing", "rows", "leader", "teams"] },
};

/** The help guide for a Formation world's battle and team editor; Classic worlds keep their own. */
export function forgeFormationGuide(host, key) {
  const guide = forgeFormationGuides[key];
  if (!guide || host?._run?.combat?.mode !== "formation") return null;
  return {
    kick: guide.kick,
    intro: forgeFormationLabel(`guide.${key}.intro`),
    topics: guide.topics.map((topic) => ({
      k: forgeFormationLabel(`guide.${key}.${topic}`),
      a: forgeFormationLabel(`guide.${key}.${topic}Text`),
    })),
  };
}

export function wireForgeFormationPreview(host) {
  if (host._run?.combat?.mode !== "formation") return;
  const root = host._root;
  if (host._combat?.formationRules?.length && host._combatPhase === "prebattle") {
    const target = root.querySelector(".brief-scroll") || root.querySelector(".screen");
    if (target && !target.querySelector("[data-formation-rule-preview]")) {
      const note = document.createElement("div");
      note.className = "gf-formation-encounter";
      note.dataset.formationRulePreview = "";
      note.innerHTML = `<style>${forgeFormationCombatStyles}</style><b>${forgeFormationEscape(forgeFormationLabel("rules"))}</b> ${host._combat.formationRules.map((rule) => forgeFormationEscape(rule.description)).join(" · ")}`;
      target.append(note);
    }
  }
}
