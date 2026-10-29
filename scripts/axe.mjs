// Fail on WCAG 2.2 A/AA violations (axe-core) at desktop and phone widths.
// Usage: node axe.mjs <site-root | https://url>. A directory is served from here; a URL is read as is.
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const target = process.argv[2];
const live = /^https?:\/\//.test(target);
const root = live ? "" : path.resolve(target);
const disabled = (process.env.A11Y_DISABLE_RULES ?? "").split(",").filter(Boolean);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(path.join(root, path.normalize(p)));
    res.writeHead(200, { "content-type": types[path.extname(p)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = live ? target : `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let failed = 0;
for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 640 }]) {
  // Reduced motion shows scroll-reveal content at once, so axe checks it.
  const page = await (await browser.newContext({ viewport, reducedMotion: "reduce" })).newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`script error: ${e.message}`));
  page.on("requestfailed", (r) => problems.push(`request failed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()}: ${r.url()}`));
  await page.goto(url, { waitUntil: "networkidle" });
  // Visitor journey (read-only): the page loads whole, a caller can see a phone number at once, and
  // "Get in Touch" lands on the contact details. Failing any of these costs the business a lead.
  const inView = (loc) => loc.evaluateAll((els) => els.some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; }));
  if (!(await page.locator("h1").first().isVisible())) problems.push("headline not visible");
  if (!(await inView(page.locator('a[href="tel:+447516211991"]')))) problems.push("no tap-to-call number visible without scrolling");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push("page scrolls sideways");
  if (await page.evaluate(() => [...document.images].some((i) => !i.naturalWidth))) problems.push("an image did not load");
  const shot = await page.screenshot();
  if (shot.length < 20000) problems.push(`screenshot looks blank (${shot.length} bytes)`);
  if (process.env.SHOT_DIR) await writeFile(path.join(process.env.SHOT_DIR, `home-${viewport.width}.png`), shot);
  await page.getByRole("link", { name: "Get in Touch" }).click();
  await page.waitForTimeout(800);
  if (!(await inView(page.locator('#contact a[href^="mailto:"]')))) problems.push("Get in Touch does not reach the contact email");
  // Phone menu: Tab from the opened toggle enters the menu; Escape, focus moving outside the nav and a click
  // outside it each close the menu and set aria-expanded back to false.
  const toggle = page.locator(".nav-toggle");
  if (await toggle.isVisible()) {
    const closed = async () => !(await page.locator(".nav-links").isVisible()) && (await toggle.getAttribute("aria-expanded")) === "false";
    const reopen = async () => { if (await closed()) await toggle.click(); if (await closed()) problems.push("menu button does not open the menu"); };
    await toggle.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    if (!(await page.evaluate(() => document.activeElement?.closest(".nav-links")))) problems.push("Tab from the opened menu button skips the menu links");
    await page.keyboard.press("Escape");
    if (!(await closed()) || !(await toggle.evaluate((e) => e === document.activeElement))) problems.push("Escape does not close the menu and return to its button");
    await reopen();
    await page.locator('#contact a[href^="mailto:"]').focus();
    if (!(await closed())) problems.push("menu stays open when keyboard focus leaves the nav");
    await reopen();
    await page.locator("#contact h2").click({ timeout: 5000 }).catch(() => problems.push("could not click the page outside the open menu"));
    if (!(await closed())) problems.push("menu stays open after a click outside the nav");
  }
  for (const m of problems) { failed++; console.log(`${viewport.width}px journey: ${m}`); }
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .disableRules(disabled)
    .analyze();
  for (const v of violations) {
    failed++;
    console.log(`${viewport.width}px ${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`);
  }
}
await browser.close();
server.close();
console.log(failed ? `${failed} accessibility or journey failure(s)` : "No WCAG A/AA violations or journey failures");
process.exit(failed ? 1 : 0);
