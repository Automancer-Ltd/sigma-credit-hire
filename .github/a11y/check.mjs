// Serve the site from this checkout and fail on WCAG 2.2 A/AA violations
// (axe-core) at desktop and phone widths. Usage: node check.mjs <site-root>
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(process.argv[2]);
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
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
let failed = 0;
for (const viewport of [{ width: 1280, height: 900 }, { width: 320, height: 640 }]) {
  // Reduced motion shows scroll-reveal content at once, so axe checks it.
  const page = await (await browser.newContext({ viewport, reducedMotion: "reduce" })).newPage();
  await page.goto(url, { waitUntil: "networkidle" });
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
console.log(failed ? `${failed} accessibility violation(s)` : "No WCAG A/AA violations");
process.exit(failed ? 1 : 0);
