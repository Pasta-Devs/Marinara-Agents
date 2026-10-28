// Clicks the Beholder panel through in a real browser, against a running Engine.
//
// Run:
//   BEHOLDER_UI_BASE=http://127.0.0.1:8791 BEHOLDER_UI_CHAT="Beholder rig" \
//   node tests/beholder-ui-parity.e2e.mjs
//
// Asserts behaviour, not pixels, so it survives restyling. It covers the chrome the
// panel was missing — build-from-history, the slot sheet, the which-model strip, the
// views, the editor — and the narrow layout, where a CSS specificity bug had made
// every view unreachable without anyone noticing.
import { chromium } from "@playwright/test";

const BASE = process.env.BEHOLDER_UI_BASE ?? "http://127.0.0.1:8791";
const CHAT_NAME = process.env.BEHOLDER_UI_CHAT ?? "Beholder rig";
const CHAT_ID = process.env.BEHOLDER_UI_CHAT_ID ?? "RJNfohKDYuPQ1-PwbUoFT";

// The run seeds its own starting state instead of assuming one. The note-box check
// asserts that a directive CHANGES something, so a second run against the state the
// first run left behind found the gloves already on and correctly reported that nothing
// changed — a real pass turning into a false failure purely from run order.
const SEED_STATE = {
  characters: [
    { name: "Maggie", body: { waist: { worn: [{ item: "belt", damage: "pristine" }] } } },
    { name: "Kheza", body: { right_hand: { holding: { item: "lantern" } } } },
  ],
};
const seeded = await fetch(`${BASE}/api/agents/beholder-state/${CHAT_ID}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ state: SEED_STATE }),
});
if (!seeded.ok) {
  console.error(`could not seed the rig chat (${seeded.status}) — set BEHOLDER_UI_CHAT_ID`);
  process.exit(1);
}

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
// Service workers are blocked for this run. The engine registers one that handles
// every /api/ request as NetworkOnly — correct for the product, but it re-issues the
// request from the worker, and requests made there do not pass through page.route. On
// the first load the worker is not yet controlling the page and interception worked; on
// any reload it silently did not, so a stubbed response was quietly replaced by the
// real one and the checks measured the wrong thing.
const context = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(message.text());
});

// Registered here, before the first navigation, because a route added part-way through
// a session never took effect — the page went on reaching the real endpoint and the
// checks below measured an absent banner instead of an absent interception. Defaults to
// "nothing pending", so it is inert until the update section sets a state.
const updateStates = {
  none: { modelId: "beholder", updateAvailable: false, indeterminate: false },
  available: {
    modelId: "beholder",
    repo: "GetBeholder/Beholder-GGUF",
    installedOid: "aaaaaaaaaaaa1111",
    availableOid: "bbbbbbbbbbbb2222",
    updateAvailable: true,
    indeterminate: false,
  },
  indeterminate: { modelId: "beholder", updateAvailable: true, indeterminate: true },
};
let updateState = "none";
let updateChecks = 0;
await page.route("**/api/utility-sidecar/models/beholder/update-check", (route) => {
  updateChecks += 1;
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(updateStates[updateState]),
  });
});

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // Beholder mounts in the roleplay toolbar, and roleplay chats live behind the RP
  // tab — the default CONVO list does not show them at all.
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll("button,[role=tab],a")].find((el) => el.textContent.trim() === "RP");
    tab?.click();
  });
  await page.waitForTimeout(2000);
  const opened = await page.evaluate((name) => {
    const row = [...document.querySelectorAll("*")].find(
      (el) => el.children.length === 0 && el.textContent.trim() === name,
    );
    if (!row) return false;
    (row.closest("button,[role=button],li,a") ?? row).click();
    return true;
  }, CHAT_NAME);
  check("rig chat opened from the RP list", opened);
  await page.waitForTimeout(6000);

  // The toolbar toggle mounts only when the agent is active for the chat.
  const toggle = await page
    .locator(".bh-hud-toggle, [data-beholder-toggle]")
    .first()
    .elementHandle({ timeout: 15000 })
    .catch(() => null);
  check("toolbar toggle is mounted", !!toggle);
  if (toggle) {
    await toggle.click();
    await page.waitForTimeout(2500);
  }

  const panel = page.locator(".beholder-panel").first();
  check("panel opens", await panel.isVisible().catch(() => false));

  // ── the first-run note ────────────────────────────────────────────────────
  // Checked here because it is shown once per browser: anything that dismisses it
  // earlier would leave the rest of the run unable to see it at all.
  const onboard = page.locator(".beholder-onboard");
  check("a first-run note explains the panel", (await onboard.count()) === 1);
  check(
    "it is positioned rather than left at the top of the page",
    await page.evaluate(() => {
      const tip = document.querySelector(".beholder-onboard");
      if (!tip) return false;
      const style = getComputedStyle(tip);
      const box = tip.getBoundingClientRect();
      return style.position === "fixed" && box.width > 200 && box.top >= 0 && box.left >= 0;
    }),
  );
  check("and points at the panel", ["left", "right", "over"].includes(await onboard.getAttribute("data-side")));
  check("it lists what you can do", (await page.locator(".bh-onboard-tips li").count()) >= 3);
  await page.locator(".bh-onboard-dismiss").click();
  await page.waitForTimeout(500);
  check("dismissing it closes it", (await page.locator(".beholder-onboard").count()) === 0);
  // Reopening the panel must not bring it back; a note that returns is a nag.
  await page.evaluate(() => document.querySelector(".bh-hud-toggle")?.click());
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector(".bh-hud-toggle")?.click());
  await page.waitForTimeout(1200);
  check("and it does not come back", (await page.locator(".beholder-onboard").count()) === 0);

  // ── header controls ───────────────────────────────────────────────────────
  for (const [label, selector] of [
    ["build-from-history button", ".beholder-backfill-btn"],
    ["build options caret", ".beholder-backfill-more"],
    ["prompt view button", '.beholder-tool-btn[data-view="prompt"]'],
    ["doctor view button", '.beholder-tool-btn[data-view="doctor"]'],
    ["characters view button", '.beholder-tool-btn[data-view="characters"]'],
    ["inspector view button", '.beholder-tool-btn[data-view="inspector"]'],
    ["help view button", '.beholder-tool-btn[data-view="help"]'],
    ["tools overflow trigger", ".beholder-tools-more"],
  ]) {
    check(`header has the ${label}`, (await page.locator(selector).count()) > 0);
  }
  check("header no longer offers a new tab", (await page.locator(".bh-dock-popout").count()) === 0);

  // ── which-model strip ─────────────────────────────────────────────────────
  await page.waitForTimeout(1500);
  const banner = await page.evaluate(() => {
    const strip = document.querySelector(".bh-no-model-banner");
    if (!strip) return null;
    return {
      hidden: strip.hidden,
      copy: strip.querySelector(".bh-banner-copy")?.textContent?.trim() ?? "",
      actions: [...strip.querySelectorAll(".bh-banner-btn")].map((b) => b.dataset.action),
    };
  });
  check("panel states which model answers", !!banner && !banner.hidden, banner?.copy?.slice(0, 90) ?? "no strip");
  check("and offers an action for it", (banner?.actions?.length ?? 0) > 0, (banner?.actions ?? []).join(","));

  // ── build options menu ────────────────────────────────────────────────────
  await page.locator(".beholder-backfill-more").first().click();
  await page.waitForTimeout(600);
  const modes = await page.evaluate(() =>
    [...document.querySelectorAll(".beholder-bf-menu .bh-bf-mode")].map((b) => b.dataset.mode),
  );
  check("build menu offers all three modes", modes.length === 3, modes.join(","));
  await page.keyboard.press("Escape");
  await page.evaluate(() => document.body.click());
  await page.waitForTimeout(400);
  check("build menu closes on outside click", (await page.locator(".beholder-bf-menu").count()) === 0);

  // ── views open and close ──────────────────────────────────────────────────
  for (const view of ["prompt", "doctor", "characters", "inspector", "help"]) {
    await page.locator(`.beholder-tool-btn[data-view="${view}"]`).first().click();
    await page.waitForTimeout(view === "prompt" || view === "doctor" ? 2200 : 900);
    const open = await page.locator(".bh-view").count();
    check(`${view} view opens`, open > 0);
    const title = await page
      .locator(".bh-view-title")
      .first()
      .textContent()
      .catch(() => "");
    check(`${view} view is titled`, !!title?.trim(), title?.trim());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    check(`${view} view closes on Escape`, (await page.locator(".bh-view").count()) === 0);
  }

  // ── doctor actually reports checks ────────────────────────────────────────
  await page.locator('.beholder-tool-btn[data-view="doctor"]').first().click();
  await page.waitForTimeout(2500);
  const checksSeen = await page.evaluate(() =>
    [...document.querySelectorAll(".bh-view-body .bh-vlog-row b")].map((b) => b.textContent.trim().replace(/^\W+/, "")),
  );
  check("doctor runs health checks", checksSeen.length >= 3, checksSeen.join(" | "));

  // The vitals grid and the copyable report are rendered from one function, so this
  // also guards against them drifting into two different answers.
  const vitals = await page.evaluate(() =>
    [...document.querySelectorAll(".bh-vitals .bh-vital")].map((row) => ({
      label: row.querySelector(".bh-vital-label")?.textContent?.trim() ?? "",
      value: row.querySelector(".bh-vital-value")?.textContent?.trim() ?? "",
      dot: row.querySelector(".bh-dot")?.className ?? "",
    })),
  );
  check("doctor shows a vitals grid", vitals.length >= 4, vitals.map((v) => v.label).join(" | "));
  check(
    "every vital has a label, a value and a severity dot",
    vitals.length > 0 && vitals.every((v) => v.label && v.value && /bh-dot-/.test(v.dot)),
    JSON.stringify(vitals[0] ?? null),
  );
  const reportSetup = await page.evaluate(async () => {
    const button = document.querySelector(".bh-report-show");
    button?.click();
    await new Promise((r) => setTimeout(r, 1500));
    return document.querySelector(".bh-report-text")?.textContent ?? "";
  });
  check(
    "the pasted report carries the same vitals as the grid",
    vitals.every((v) => reportSetup.includes(v.value)),
    vitals
      .filter((v) => !reportSetup.includes(v.value))
      .map((v) => v.label)
      .join(",") || "all present",
  );

  // Recent reads separate "never ran" from "ran and found nothing" from "failed",
  // which look identical from the panel alone.
  const turns = await page.evaluate(() =>
    [...document.querySelectorAll(".bh-turns tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent.trim()),
    ),
  );
  check("doctor lists recent reads", turns.length > 0, `${turns.length} rows`);
  check(
    "each read reports when, how long and what it found",
    turns.every((row) => row.length === 3 && row.every(Boolean)),
    JSON.stringify(turns[0] ?? null),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ── help explains the colours ─────────────────────────────────────────────
  await page.locator('.beholder-tool-btn[data-view="help"]').first().click();
  await page.waitForTimeout(1200);
  check("help shows the colour legend", (await page.locator(".bh-legend-row").count()) >= 4);
  check(
    "the legend has both a worn bar and a wound dot",
    (await page.locator(".bh-legend-bar").count()) >= 3 && (await page.locator(".bh-legend-dot").count()) >= 1,
  );
  check("help lists writing tips", (await page.locator(".bh-tips li").count()) >= 3);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ── the slot editor ───────────────────────────────────────────────────────
  const card = page.locator(".bh-slot-card[data-slot]").first();
  // Toasts are how every confirmation in this package speaks. They were styled to rest
  // at opacity 0 and raised by a class nothing added, so all of them were invisible —
  // silently, since a message that never appears throws nothing.
  const toastVisible = await page.evaluate(async () => {
    const before = document.querySelector(".bh-toast");
    before?.remove();
    document.querySelector(".bh-slot-card[data-slot]")?.click();
    await new Promise((r) => setTimeout(r, 600));
    document.querySelector(".bh-lock-toggle")?.click();
    await new Promise((r) => setTimeout(r, 700));
    const toast = document.querySelector(".bh-toast");
    if (!toast) return null;
    const style = getComputedStyle(toast);
    return { text: toast.textContent.trim().slice(0, 40), opacity: style.opacity };
  });
  check(
    "a confirmation message is actually visible",
    toastVisible !== null && Number(toastVisible.opacity) > 0.5,
    JSON.stringify(toastVisible),
  );
  // Put the lock back so later checks start from a clean slate.
  await page.evaluate(() => document.querySelector(".bh-lock-toggle")?.click());
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  check("a slot card is present", (await card.count()) > 0);
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(900);
    const editor = await page.evaluate(() => {
      const node = document.querySelector(".bh-editor");
      if (!node) return null;
      return {
        inPanel: !!node.closest(".beholder-panel"),
        title: node.querySelector(".bh-editor-title")?.textContent?.trim() ?? "",
        slot: node.querySelector(".bh-editor-slot")?.textContent?.trim() ?? "",
        hasCancel: !!node.querySelector(".bhe-cancel"),
        hasPrimaryApply: !!node.querySelector(".bh-editor-apply.bh-btn-primary"),
        hasLock: !!node.querySelector(".bh-lock-toggle"),
      };
    });
    check("editor opens", !!editor);
    check("editor is anchored inside the panel", editor?.inPanel);
    check("editor names the character and slot", !!editor?.title && !!editor?.slot, `${editor?.title} ${editor?.slot}`);
    check("editor offers Cancel", editor?.hasCancel);
    check("editor marks Apply as primary", editor?.hasPrimaryApply);
    check("editor carries the lock toggle", editor?.hasLock);

    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check("editor closes on Escape", (await page.locator(".bh-editor").count()) === 0);

    // Removing a worn row must not read as an outside click and close the editor.
    await card.click();
    await page.waitForTimeout(800);
    const survived = await page.evaluate(async () => {
      const add = document.querySelector(".bhe-add-worn");
      if (!add) return null;
      add.click();
      await new Promise((r) => setTimeout(r, 200));
      const remove = document.querySelector(".bh-editor-remove:not(.bhe-drop)");
      if (!remove) return null;
      remove.click();
      await new Promise((r) => setTimeout(r, 350));
      return !!document.querySelector(".bh-editor");
    });
    check("removing a row keeps the editor open", survived === true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Apply a real edit. Everything above only opens and closes the editor, so nothing
    // proved that Apply reaches the server — and the hand-edited mark below needs an
    // actual edit to mark.
    await card.click();
    await page.waitForTimeout(800);
    const editedSlot = await page.evaluate(async () => {
      document.querySelector(".bhe-add-worn")?.click();
      await new Promise((r) => setTimeout(r, 300));
      const field = document.querySelector(".bhe-item");
      if (!field) return null;
      field.value = "parity test scarf";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      const slot = document.querySelector(".bh-editor")?.getAttribute("aria-label") ?? "";
      document.querySelector(".bh-editor-apply")?.click();
      return slot;
    });
    await page.waitForTimeout(3500);
    const persisted = await page.evaluate(async () => {
      const host = document.querySelector("marinara-capability-beholder");
      const res = await fetch(`/api/agents/beholder-state/${host?.capabilityProps?.chatId}`, {
        credentials: "same-origin",
      });
      const payload = await res.json();
      return JSON.stringify(payload?.state ?? {}).includes("parity test scarf");
    });
    check("an applied edit reaches the server", persisted, editedSlot ?? "no editor field");

    // ── locking a slot ──────────────────────────────────────────────────────
    // A switch, not a checkbox: the padlock and the word both have to change, and the
    // card has to carry the mark once the editor is gone, or a locked slot is
    // indistinguishable from an unlocked one at a glance.
    await card.click();
    await page.waitForTimeout(800);
    const toggle = page.locator(".bh-lock-toggle").first();
    check("the editor offers a lock switch", (await toggle.count()) === 1);
    const lockBefore = await toggle.textContent();
    await toggle.click();
    await page.waitForTimeout(700);
    const lockAfter = await toggle.textContent();
    check(
      "the lock switch says which state it is in",
      lockBefore.trim() !== lockAfter.trim(),
      `${lockBefore.trim()} -> ${lockAfter.trim()}`,
    );
    check("and reports that state to a screen reader", (await toggle.getAttribute("aria-checked")) === "true");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    check("a locked slot is marked on the card", (await page.locator(".bh-slot-lock-glyph").count()) >= 1);
    // The mark uses the reference's class so the ported stylesheet reaches it; an
    // unstyled glyph is the failure this replaced.
    const glyphStyled = await page.evaluate(() => {
      const glyph = document.querySelector(".bh-slot-lock-glyph");
      if (!glyph) return null;
      const style = getComputedStyle(glyph);
      return { size: style.fontSize, margin: style.marginLeft };
    });
    check(
      "and the mark is styled by the ported stylesheet",
      glyphStyled?.margin === "5px",
      JSON.stringify(glyphStyled),
    );
    // Put it back so the run leaves no lock behind for the note-box checks.
    await card.click();
    await page.waitForTimeout(700);
    await page.locator(".bh-lock-toggle").first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  }

  // ── the slot sheet ────────────────────────────────────────────────────────
  const sheetOpened = await page.evaluate(() => {
    const button = document.querySelector(".bh-digest-edit");
    if (button) {
      button.click();
      return "button";
    }
    return null;
  });
  if (!sheetOpened) {
    // The Edit slots button lives in the list layout; switch to it.
    await page.evaluate(() => document.querySelector('.bh-ls-opt[data-layout="list"]')?.click());
    await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelector(".bh-digest-edit")?.click());
  }
  await page.waitForTimeout(900);
  const sheet = await page.evaluate(() => {
    const node = document.querySelector(".bh-edit-sheet");
    if (!node) return null;
    return {
      regions: [...node.querySelectorAll(".bh-pick-region-head")].map((h) => h.textContent.trim()),
      slots: node.querySelectorAll(".bh-pick-slot").length,
    };
  });
  check("Edit slots opens the sheet", !!sheet);
  check("sheet groups slots by region", (sheet?.regions?.length ?? 0) >= 3, (sheet?.regions ?? []).join(", "));
  check("sheet lists slots, including empty ones", (sheet?.slots ?? 0) > 10, String(sheet?.slots ?? 0));
  // The lock and the pencil answer different questions — "the story cannot change this"
  // versus "this value is mine" — and the list claimed to show both while only ever
  // drawing the lock.
  check(
    "the sheet marks slots you set by hand",
    (await page.locator(".bh-pick-edited").count()) >= 1,
    `${await page.locator(".bh-pick-edited").count()} pencil marks`,
  );
  if (sheet) {
    const intoEditor = await page.evaluate(async () => {
      document.querySelector(".bh-pick-slot")?.click();
      await new Promise((r) => setTimeout(r, 400));
      return {
        form: !!document.querySelector(".bh-sheet-body .bh-editor-body"),
        back: !document.querySelector(".bh-sheet-back")?.hidden,
      };
    });
    check("picking a slot opens its editor in the sheet", intoEditor.form);
    check("and offers a way back to the list", intoEditor.back);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    check("sheet closes on Escape", (await page.locator(".bh-edit-sheet").count()) === 0);
  }

  // ── the note box ──────────────────────────────────────────────────────────
  // The one feature here that changes real state rather than only rendering, so it is
  // checked by its effect: a sentence goes in, the panel comes back different, and the
  // slots it touched end up locked. The character NOT mentioned must survive untouched —
  // the first working version wiped every other character, because a directive was
  // routed through the retry path that excludes the message being redone.
  check("note box is present", (await page.locator(".beholder-notebox-input").count()) === 1);
  // On an engine without the directive support the request is accepted and the field
  // ignored, so the box would appear to work and quietly re-run the turn instead. It
  // has to be usable here and refuse there.
  check(
    "and usable on an engine that supports it",
    (await page.locator(".beholder-notebox-input").isDisabled()) === false,
  );
  // Read through the server's own state route and localStorage, never through the
  // package's internals: `BH` lives inside the bundle's IIFE, so `window.BH?.dock` is
  // undefined from here and every assertion built on it would pass while seeing nothing.
  const readState = () =>
    page.evaluate(async () => {
      const host = document.querySelector("marinara-capability-beholder");
      const chatId = host?.capabilityProps?.chatId;
      if (!chatId) return null;
      const res = await fetch(`/api/agents/beholder-state/${chatId}`, { credentials: "same-origin" });
      if (!res.ok) return null;
      const payload = await res.json();
      const characters = payload?.state?.characters ?? [];
      const lockKey = Object.keys(localStorage).find((k) => k.startsWith("marinara.beholder.locks"));
      return {
        names: characters.map((c) => c.name).sort(),
        slots: Object.fromEntries(characters.map((c) => [c.name, Object.keys(c.body ?? {}).sort()])),
        locks: Object.keys(JSON.parse(localStorage.getItem(lockKey ?? "") || "{}")).length,
      };
    });

  const before = await readState();
  check("note box test can read the state store", before !== null && before.names.length > 0, JSON.stringify(before));
  await page.fill(".beholder-notebox-input", "Maggie is now wearing black gloves.");
  await page.click(".beholder-notebox-btn");
  // The whole five-pass run happens server-side before the panel refreshes.
  await page.waitForFunction(() => document.querySelector(".beholder-notebox-input")?.value === "", null, {
    timeout: 90000,
  });
  check("note box clears after sending", true);
  const after = await readState();
  check(
    "note box does not drop the other characters",
    JSON.stringify(after?.names) === JSON.stringify(before?.names),
    `${before?.names.join(",")} -> ${after?.names.join(",")}`,
  );
  const hands = after?.slots?.Maggie ?? [];
  check(
    "note box changed the state it was told about",
    hands.includes("left_hand") || hands.includes("right_hand"),
    hands.join(","),
  );
  check(
    "note box locks what it changed",
    (after?.locks ?? 0) > (before?.locks ?? 0),
    `${before?.locks} -> ${after?.locks}`,
  );

  // ── what each message changed ─────────────────────────────────────────────
  // Placed after the note box, which has just produced a real change to point at. These
  // rows live in the host's message list, which this package does not own, so the checks
  // cover the rules that make writing there acceptable as well as the rendering.
  await page.waitForTimeout(2500);
  check("a message carries a row of badges", (await page.locator(".beholder-msg-badges").count()) >= 1);
  const badgeText = await page.evaluate(() =>
    [...document.querySelectorAll(".bh-msg-badge")].map((badge) => ({
      who: badge.querySelector(".bh-msg-char")?.textContent ?? "",
      what: badge.querySelector(".bh-msg-text")?.textContent ?? "",
      kind: (badge.className.match(/bh-msg-(add|clear|hold|wound|heal|mod)/) ?? [])[1] ?? "",
    })),
  );
  check("each badge names who and what", badgeText.length >= 1 && badgeText.every((b) => b.who && b.what));
  // Coloured by what the slot holds NOW. Computing this before the state loaded painted
  // an addition as a removal — the gloves the message had just added read as taken off.
  check(
    "and is coloured by the kind of change",
    badgeText.some((b) => b.kind === "add"),
    badgeText.map((b) => `${b.who}/${b.what}:${b.kind}`).join(" "),
  );
  check(
    "the badges describe the change, not the whole body",
    badgeText.length <= 4,
    `${badgeText.length} badges for a two-slot change`,
  );
  // A removal has to show too. The delta used to be computed over the current state
  // only, which cannot see a slot that is gone: taking a garment off deletes the slot,
  // so the message that did it reported no change at all — on a panel whose whole
  // purpose is tracking things being put on and taken off.
  await page.fill(".beholder-notebox-input", "Maggie takes off her belt.");
  await page.click(".beholder-notebox-btn");
  await page.waitForFunction(() => document.querySelector(".beholder-notebox-input")?.value === "", null, {
    timeout: 90000,
  });
  await page.waitForTimeout(3000);
  const removalBadges = await page.evaluate(() =>
    [...document.querySelectorAll(".bh-msg-badge")].map((badge) => ({
      what: badge.querySelector(".bh-msg-text")?.textContent ?? "",
      kind: (badge.className.match(/bh-msg-(add|clear|hold|wound|heal|mod)/) ?? [])[1] ?? "",
    })),
  );
  check(
    "taking something off is shown as a change",
    removalBadges.some((b) => b.kind === "clear"),
    removalBadges.map((b) => `${b.what}:${b.kind}`).join(" ") || "no badges",
  );

  // They are Beholder's output; leaving them behind would be marking up someone's chat
  // with a feature they turned off.
  await page.evaluate(() => document.querySelector(".bh-hud-toggle")?.click());
  await page.waitForTimeout(1500);
  check("closing Beholder takes them away", (await page.locator(".beholder-msg-badges").count()) === 0);
  // Everything the dock opened outside its own box goes with it. The build menu lived on
  // document.body, so its "Re-extract this turn" could still start an agent run after
  // Beholder was closed.
  check(
    "and nothing it opened is left behind",
    (await page.evaluate(
      () =>
        document.querySelectorAll(".beholder-bf-menu, .beholder-tools-menu, .bh-view, .bh-editor, .beholder-onboard")
          .length,
    )) === 0,
  );
  await page.evaluate(() => document.querySelector(".bh-hud-toggle")?.click());
  await page.waitForTimeout(4000);
  check("reopening brings them back", (await page.locator(".beholder-msg-badges").count()) >= 1);

  // ── merging two names for the same person ─────────────────────────────────
  // The pills only offer names currently on screen, and the one you want often is not
  // among them: the extractor wrote "the guard" once and has settled on a name since.
  await page.locator('.beholder-tool-btn[data-view="characters"]').first().click();
  await page.waitForTimeout(1500);
  await page.locator(".bh-ch-merge").first().click();
  await page.waitForTimeout(800);
  check("merging offers the names on screen", (await page.locator(".bh-ch-pill").count()) >= 1);
  check("and a field for one that is not", (await page.locator(".bh-ch-pick-input").count()) === 1);
  // Escape belongs to the field while a name is being typed. The view registers its own
  // Escape handler on `document` with capture, which runs before anything bubbling from
  // the input — so the first version closed the entire view and lost the row.
  await page.locator(".bh-ch-pick-input").press("Escape");
  await page.waitForTimeout(500);
  check("Escape closes the name field, not the view", (await page.locator(".bh-ch-pick-input").count()) === 0);
  check("and the characters view is still open", (await page.locator(".bh-view").count()) === 1);
  await page.locator(".bh-ch-merge").first().click();
  await page.waitForTimeout(600);

  const beforeRows = await page.locator(".bh-ch").count();
  // Typed rather than picked, but into a name that IS on screen, so the row has
  // something to fold into and the panel stops showing one person twice. Merging into a
  // name nobody uses yet is also allowed — it just records the alias for later, and the
  // toast says so — but it cannot be observed as a row disappearing.
  const otherName = await page.locator(".bh-ch-pill").first().getAttribute("data-target");
  // Lower-cased on purpose: the target is typed by hand, so "rhys" has to find "Rhys".
  // A case-sensitive match recorded the alias and left the row on screen, which reads
  // as the merge having failed.
  await page.fill(".bh-ch-pick-input", (otherName ?? "").toLowerCase());
  await page.locator(".bh-ch-pick-input").press("Enter");
  await page.waitForTimeout(1200);
  check(
    "typing a name merges the row away",
    (await page.locator(".bh-ch").count()) < beforeRows,
    `${beforeRows} rows -> ${await page.locator(".bh-ch").count()} (typed "${(otherName ?? "").toLowerCase()}" for "${otherName}")`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ── clearing everything ───────────────────────────────────────────────────
  // Runs late on purpose: it really does empty the chat's state, so nothing after it
  // may depend on what was seeded. Two presses, and the first must NOT clear.
  await page.locator('.beholder-tool-btn[data-view="doctor"]').first().click();
  await page.waitForTimeout(7000);
  const clearButton = page.locator(".bh-clear-state");
  check("doctor offers a way to start over", (await clearButton.count()) === 1);
  check("and marks it as destructive", ((await clearButton.getAttribute("class")) ?? "").includes("bh-btn-danger"));
  await clearButton.click();
  await page.waitForTimeout(600);
  check("one press only arms it", (await page.locator(".bh-clear-state.bh-btn-armed").count()) === 1);
  const stillThere = await page.evaluate(async () => {
    const host = document.querySelector("marinara-capability-beholder");
    const res = await fetch(`/api/agents/beholder-state/${host?.capabilityProps?.chatId}`, {
      credentials: "same-origin",
    });
    return ((await res.json())?.state?.characters ?? []).length;
  });
  check("and changes nothing on its own", stillThere > 0, `${stillThere} characters still tracked`);
  await clearButton.click();
  await page.waitForTimeout(2500);
  const afterClear = await page.evaluate(async () => {
    const host = document.querySelector("marinara-capability-beholder");
    const res = await fetch(`/api/agents/beholder-state/${host?.capabilityProps?.chatId}`, {
      credentials: "same-origin",
    });
    // Only this chat's keys. A dismissed model update is not about who was tracked
    // here and must survive.
    const chatId = host?.capabilityProps?.chatId;
    const lockKeys = Object.keys(localStorage).filter((k) => k.endsWith(`.${chatId}`));
    return { characters: ((await res.json())?.state?.characters ?? []).length, lockKeys: lockKeys.length };
  });
  check("the second press clears it", afterClear.characters === 0, `${afterClear.characters} characters`);
  // Locks and edit marks describe slots that no longer exist; left behind, they would
  // restore the cleared values on the next turn.
  check("and takes the locks and edit marks with it", afterClear.lockKeys === 0, `${afterClear.lockKeys} keys left`);

  // ── mobile: every view still reachable ────────────────────────────────────
  // The rule is a container query on the panel (max-width: 360px), not a viewport
  // media query, so the viewport has to be narrow enough that the panel itself is —
  // the panel is min(420px, 100vw - 40px).
  await page.setViewportSize({ width: 340, height: 760 });
  await page.waitForTimeout(1500);
  const mobile = await page.evaluate(() => {
    const first = document.querySelector(".beholder-tool-btn");
    const trigger = document.querySelector(".beholder-tools-more");
    return {
      toolsHidden: first ? getComputedStyle(first).display === "none" : null,
      triggerShown: trigger ? getComputedStyle(trigger).display !== "none" : false,
    };
  });
  if (mobile.toolsHidden) {
    check("narrow layout hides the tool row", true);
    check("and reveals the overflow trigger", mobile.triggerShown);
    await page.locator(".beholder-tools-more").first().click();
    await page.waitForTimeout(600);
    const items = await page.evaluate(() =>
      [...document.querySelectorAll(".beholder-tools-menu .beholder-tools-item")].map((b) => b.dataset.view),
    );
    check("overflow menu lists every view", items.length >= 5, items.join(","));
    await page.evaluate(() => document.querySelector(".beholder-tools-menu .beholder-tools-item")?.click());
    await page.waitForTimeout(1800);
    check("a view opens from the overflow menu", (await page.locator(".bh-view").count()) > 0);
    await page.keyboard.press("Escape");
  } else {
    const width = await page.evaluate(() => document.querySelector(".beholder-panel")?.getBoundingClientRect().width);
    check(
      "narrow layout hides the tool row",
      false,
      `panel is ${Math.round(width ?? 0)}px, container query needs <=360`,
    );
  }
  await page.setViewportSize({ width: 1400, height: 950 });
  await page.waitForTimeout(800);

  // ── the model-update strip ────────────────────────────────────────────────
  // Last, because it reloads: the strip only appears when the engine can actually
  // tell that a newer build exists, so the check has to supply that answer. All three
  // answers are exercised — one available, one that could not be determined, and one
  // already dismissed — because the failure that matters is a banner that cries
  // "new model" when a request merely failed.
  const reopenPanel = async () => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll("button,[role=tab],a")].find((el) => el.textContent.trim() === "RP");
      tab?.click();
    });
    await page.waitForTimeout(2000);
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll("*")].find(
        (el) => el.children.length === 0 && el.textContent.trim() === name,
      );
      (row?.closest("button,[role=button],li,a") ?? row)?.click();
    }, CHAT_NAME);
    await page.waitForTimeout(6000);
    // The dock remembers that it was open, so after a reload it comes back by itself.
    // Clicking the toggle unconditionally CLOSED it, and the checks below then measured
    // an absent panel rather than an absent banner.
    if (
      !(await page
        .locator(".beholder-panel")
        .isVisible()
        .catch(() => false))
    ) {
      await page.evaluate(() => document.querySelector(".bh-hud-toggle")?.click());
    }
    await page.locator(".beholder-panel").waitFor({ state: "visible", timeout: 15000 });
    // The update check is a network round trip made after the panel mounts.
    await page.waitForTimeout(4000);
  };

  updateState = "available";
  await reopenPanel();
  const updateDebug = await page.evaluate(() => ({
    children: [...(document.querySelector(".beholder-panel")?.children ?? [])].map((c) => c.className).join(","),
    dismissed: localStorage.getItem("marinara.beholder.updateDismissed"),
  }));
  check(
    "an available update is announced",
    (await page.locator(".bh-update-banner").count()) === 1,
    `checks=${updateChecks} dismissed=${updateDebug.dismissed} children=${updateDebug.children}`,
  );
  check(
    "the strip names both versions",
    /aaaaaaaaaaaa.*bbbbbbbbbbbb/s.test(
      (await page
        .locator(".bh-update-banner-copy")
        .textContent()
        .catch(() => "")) ?? "",
    ),
  );
  check(
    "and offers update, the file itself, and not now",
    (await page.locator(".bh-update-banner-actions .bh-btn").count()) === 3 &&
      (await page.locator(".bh-update-gguf").getAttribute("href"))?.startsWith("https://huggingface.co/"),
  );
  // The reference relies on FontAwesome's fa-spin, which this package does not ship;
  // a motionless spinner reads as a hang.
  const spinAnimation = await page.evaluate(() => {
    const probe = document.createElement("i");
    probe.className = "bh-banner-spin";
    document.querySelector(".bh-update-banner")?.appendChild(probe);
    const name = getComputedStyle(probe).animationName;
    probe.remove();
    return name;
  });
  check("the progress spinner actually spins", spinAnimation === "bh-banner-spin", spinAnimation);

  await page.locator(".bh-update-later").click();
  await page.waitForTimeout(600);
  check("dismissing hides it", (await page.locator(".bh-update-banner").count()) === 0);
  await reopenPanel();
  check("and it stays dismissed for that version", (await page.locator(".bh-update-banner").count()) === 0);

  await page.evaluate(() => localStorage.removeItem("marinara.beholder.updateDismissed"));
  updateState = "indeterminate";
  await reopenPanel();
  check("an update it could not confirm is not announced", (await page.locator(".bh-update-banner").count()) === 0);

  check("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
} finally {
  await page
    .screenshot({ path: process.env.BEHOLDER_UI_SHOT ?? "/tmp/beholder-ui.png", fullPage: false })
    .catch(() => {});
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("failed:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
  process.exit(1);
}
