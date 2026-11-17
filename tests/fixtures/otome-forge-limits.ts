// Otome Hearth's Lines & Veils in the browser: the row each of the player's own limits takes, in the setup wizard's
// Content step and in Settings → Content (both draw ContentControls).
import { expect, type Locator, type Page } from "./package-browser.ts";

/**
 * One of your own limits: the text box takes the room left, and its Allow | Veil | Line pills and a remove button of at
 * least 28px (the icon buttons elsewhere are 38px) share its line, at this width and on a 360px phone. At a large text
 * size the pills may go under the text box, but nothing leaves the screen or scrolls sideways.
 */
export async function expectCustomLimitFits(page: Page, row: Locator, shot: (name: string) => string) {
  const viewport = page.viewportSize()!;
  const fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
  const fits = () =>
    row.evaluate((element) => {
      const box = element.parentElement!.getBoundingClientRect();
      const parts = [...element.querySelectorAll(".of-input, .of-pill, .of-icon-button")];
      return (
        element.parentElement!.scrollWidth <= element.parentElement!.clientWidth &&
        box.right <= document.documentElement.clientWidth &&
        document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
        parts.every((part) => {
          const { left, right } = part.getBoundingClientRect();
          return left >= box.left - 0.5 && right <= box.right + 0.5;
        })
      );
    });
  const middle = (box: { y: number; height: number } | null) => box!.y + box!.height / 2;
  for (const width of viewport.width < 600 ? [viewport.width, 360] : [viewport.width]) {
    await page.setViewportSize({ width, height: viewport.height });
    await row.scrollIntoViewIfNeeded();
    const [text, pills, remove, icon] = await Promise.all([
      row.getByRole("textbox").boundingBox(),
      row.locator(".of-pills").boundingBox(),
      row.getByRole("button").boundingBox(),
      row.getByRole("button").locator("svg").boundingBox(),
    ]);
    expect(Math.abs(middle(pills) - middle(text)), `pills beside the text box at ${width}px`).toBeLessThanOrEqual(2);
    expect(Math.abs(middle(remove) - middle(text)), `remove beside the text box at ${width}px`).toBeLessThanOrEqual(2);
    expect(pills!.x).toBeGreaterThanOrEqual(text!.x + text!.width);
    expect(remove!.x).toBeGreaterThanOrEqual(pills!.x + pills!.width);
    expect(pills!.height, "the three pills on one line").toBeLessThan(40);
    expect(remove!.width).toBeGreaterThanOrEqual(28);
    expect(remove!.width).toBeLessThan(38);
    expect(remove!.height).toBeGreaterThanOrEqual(28);
    expect(icon!.width).toBeLessThanOrEqual(13.5);
    expect(await fits()).toBe(true);
    await page.screenshot({ path: shot(`own-limit-${width}.png`) });
  }
  for (const size of ["26px", "34px"]) {
    await page.evaluate((px) => (document.documentElement.style.fontSize = px), size);
    await row.scrollIntoViewIfNeeded();
    await expect.poll(fits, `nothing overflows at ${size}`).toBe(true);
  }
  await page.screenshot({ path: shot("own-limit-text-34px.png") });
  await page.evaluate((px) => (document.documentElement.style.fontSize = px), fontSize);
  await page.setViewportSize(viewport);
}
