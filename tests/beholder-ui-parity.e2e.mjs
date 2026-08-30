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

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? "  ok  " : "  FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(message.text());
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
    const open = await page.locator(".bh-view-overlay").count();
    check(`${view} view opens`, open > 0);
    const title = await page
      .locator(".bh-view-title")
      .first()
      .textContent()
      .catch(() => "");
    check(`${view} view is titled`, !!title?.trim(), title?.trim());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    check(`${view} view closes on Escape`, (await page.locator(".bh-view-overlay").count()) === 0);
  }

  // ── doctor actually reports checks ────────────────────────────────────────
  await page.locator('.beholder-tool-btn[data-view="doctor"]').first().click();
  await page.waitForTimeout(2500);
  const checksSeen = await page.evaluate(() =>
    [...document.querySelectorAll(".bh-view-body .bh-vlog-row b")].map((b) => b.textContent.trim().replace(/^\W+/, "")),
  );
  check("doctor runs health checks", checksSeen.length >= 3, checksSeen.join(" | "));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // ── the slot editor ───────────────────────────────────────────────────────
  const card = page.locator(".bh-slot-card[data-slot]").first();
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
        hasLock: !!node.querySelector(".bhe-lock"),
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
  }

  // ── the slot sheet ────────────────────────────────────────────────────────
  const sheetOpened = await page.evaluate(() => {
    BH_TEST_HOOK: {
    }
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
    check("a view opens from the overflow menu", (await page.locator(".bh-view-overlay").count()) > 0);
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
