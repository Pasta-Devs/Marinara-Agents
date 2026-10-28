/**
 * Slurp 0.3.0 release step (user, 2026-09-29): restored failed Pulse tasks say where to start them
 * again, Stir sub-pages have a back arrow and close on Android / browser back, the Stir tab icon is
 * a plain nav glyph, the last phone tab is More again, and Pulse has its quick starts back.
 */
import assert from "node:assert/strict";
import {
  SLP_CREATOR_CHIPS_SEARCH_FROM,
  slpCreatorChipList,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/chrome/slp-creator-chips.ts";
import { slpTaskAgainScreen } from "../packages/slurp2/src/engine/packages/client/src/slp/base/state/slp-task-list.ts";
import { registerSlpBackLayer } from "../packages/slurp2/src/engine/packages/client/src/slp/base/navigation/slp-back-layer.ts";
import { slurp2Source } from "./slurp2-source.ts";

const root = new URL("../packages/slurp2/src/engine/packages/", import.meta.url);
const client = (path: string) => slurp2Source(new URL(`client/src/slp/${path}`, root));

// 1. A failed task restored after a reload names the screen it started from.
{
  assert.equal(slpTaskAgainScreen({ kind: "stir-play" }), "stir");
  assert.equal(slpTaskAgainScreen({ kind: "stir-plan" }), "stir");
  assert.equal(slpTaskAgainScreen({ kind: "generate-posts", accountIds: ["a"] }), "generate");
  assert.equal(slpTaskAgainScreen({ kind: "auto-post", accountIds: ["a"] }), "creator");
  assert.equal(slpTaskAgainScreen({ kind: "generate-post-image", accountIds: ["a"] }), "creator");
  assert.equal(slpTaskAgainScreen({ kind: "auto-post", accountIds: [] }), null, "no Creator, no page");
  assert.equal(slpTaskAgainScreen({ kind: "sign-up" }), "add");
  assert.equal(slpTaskAgainScreen({ kind: "something-new" }), null);
  const rows = client("modules/chrome/SlpPulseRows.tsx");
  assert.match(rows, /failed && !task\.retry && onStartAgain \? slpTaskAgainScreen\(task\) : null/u);
  assert.match(rows, /t\(`ui\.slurp\.pulse\.again\.\$\{againScreen\}`\)/u);
  const host = client("app/SlpHomeHost.tsx");
  assert.match(host, /onStartAgain: \(screen, task\) => \{/u);
  assert.match(host, /screen === "add"\) setOnboardingMode\("add-creators"\)/u);
}

// 2. Slurp's back layer: while a sub-page is open, a back step is cancelled before any `popstate`
// (so the Engine's back handler never closes the browser Slurp runs in) and the top page closes.
function backLayer() {
  const navigation = Object.assign(new EventTarget(), { currentEntry: { index: 3 } });
  (globalThis as { window?: unknown }).window = { navigation };
  const back = (to: number, cancelable = true) => {
    const event = Object.assign(new Event("navigate", { cancelable }), {
      navigationType: "traverse",
      destination: { index: to },
    });
    navigation.dispatchEvent(event);
    return event.defaultPrevented;
  };
  assert.equal(back(2), false, "no Slurp page open: back is the Engine's");
  const closed: string[] = [];
  const releaseA = registerSlpBackLayer(() => closed.push("a"));
  const releaseB = registerSlpBackLayer(() => closed.push("b"));
  assert.equal(back(2), true, "back is cancelled");
  assert.deepEqual(closed, ["b"], "the top page closes");
  releaseB();
  assert.equal(back(4), false, "forward stays the browser's");
  assert.equal(back(2, false), false, "a back the browser does not let us cancel goes on");
  assert.equal(back(2), true);
  assert.deepEqual(closed, ["b", "a"]);
  releaseA();
  assert.equal(back(2), false, "all closed: back is the Engine's again");
  delete (globalThis as { window?: unknown }).window;
  assert.doesNotThrow(() => registerSlpBackLayer(() => {})(), "no window, no navigation: nothing happens");
}
backLayer();

// 3. Wiring: Stir sub-pages, the nav, Pulse's quick starts, the Stir welcome line.
{
  const sheet = client("modules/chrome/SlpSheet.tsx");
  assert.match(sheet, /open && back \? registerSlpBackLayer\(\(\) => onCloseRef\.current\(\)\) : undefined/u);
  assert.match(sheet, /const showBack = back && !desktop;/u);
  assert.match(client("features/stir/SlpStirPlaySheet.tsx"), /onClose=\{onClose\}\n\s+back\n/u);
  assert.match(client("features/stir/SlpStirCards.tsx"), /onClose=\{close\}\n\s+back\n/u);
  assert.match(client("features/stir/SlpStirCreatorSheet.tsx"), /onClose=\{close\}\s+back\s/u);
  const stir = client("features/stir/SlpStirScreen.tsx");
  // 0.3.11: the People map is Stir's one full sheet, with the back arrow.
  assert.match(
    stir,
    /<SlpSheet\s+open=\{people\}\s+onClose=\{\(\) => setPeople\(false\)\}[\s\S]{0,120}size="full"[\s\S]{0,60}back/u,
  );
  assert.match(stir, /t\("ui\.slurp\.stir\.hint\.more"\)/u);

  const shell = client("modules/chrome/SlpShell.tsx");
  assert.match(shell, /icon=\{<SlpStirGlyph size=\{20\} filled=\{activeView === "stir"\} \/>\}/u);
  assert.doesNotMatch(
    shell,
    /bg-\[var\(--noodle-accent\)\] text-\[var\(--slurp-on-accent\)\] shadow-\[var\(--slurp-glow\)\]/u,
  );
  assert.match(shell, /onClick=\{\(\) => onMobileDrawerOpenChange\(true\)\}\n\s+aria-expanded=\{mobileDrawerOpen\}/u);
  assert.match(shell, /localizeUi\("ui\.slurp\.navigation\.more", \{ defaultValue: "More" \}\)/u);
  assert.match(shell, /<SlpMoreGlyph size=\{20\} filled=\{mobileDrawerOpen\} \/>/u);
  assert.match(shell, /onOpenDashboard && \(/u);

  const pulse = client("modules/chrome/SlpPulse.tsx");
  const quick = pulse.indexOf("<PulseQuickStarts");
  assert.ok(quick > 0 && quick < pulse.indexOf("<PulseAiToday"), "the quick starts sit at the top");
  const rows = client("modules/chrome/SlpPulseRows.tsx");
  assert.match(rows, /kind: "run-audience",[\s\S]*?api\.post\("\/slurp2\/slurp\/actions\/run-audience", \{\}\)/u);
}

// 4. Long Creator lists (user): past 12 Creators the pickers get a search; picked ones stay in front.
{
  const creators = Array.from({ length: 30 }, (_, index) => ({
    id: `c${index}`,
    name: index === 7 ? "Mira Vale" : index === 21 ? "Kai North" : `Creator ${index}`,
    avatarUrl: null,
  }));
  assert.equal(SLP_CREATOR_CHIPS_SEARCH_FROM, 12);
  assert.equal(slpCreatorChipList(creators, [], "").length, 30, "no words: everyone");
  assert.deepEqual(
    slpCreatorChipList(creators, ["c21"], "mira").map((creator) => creator.name),
    ["Kai North", "Mira Vale"],
    "picked first even when the words do not match, then matches in any case",
  );
  assert.deepEqual(slpCreatorChipList(creators, [], "  zz ").length, 0);
  const chips = client("modules/chrome/SlpCreatorChips.tsx");
  assert.match(chips, /const searchable = creators\.length > SLP_CREATOR_CHIPS_SEARCH_FROM;/u);
  // 0.3.5: the play sheet's creator picker moved to SlpStirFormParts.tsx.
  assert.match(client("features/stir/SlpStirFormParts.tsx"), /<SlpCreatorChips creators=\{creators\}/u);
  assert.match(client("features/projects/SlpCollabsPanel.tsx"), /<SlpCreatorChips\s+creators=\{creators\.filter/u);
}

console.log("slurp2 release 0.3.0: ok");
