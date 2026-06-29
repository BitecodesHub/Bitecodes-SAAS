// Mobile screenshot harness — uses the npx-cached playwright + downloaded
// chromium (no project dependency added). Run after `next start` on :3000.
import { mkdirSync } from "node:fs";
import pkg from "/Users/mac/.npm/_npx/48b1ca104c3549f4/node_modules/playwright/index.js";
const { chromium } = pkg;

const BASE = "http://localhost:3000";
const OUT = "/tmp/bitecodes-shots";
mkdirSync(OUT, { recursive: true });

const pages = [
  ["home", "/"],
  ["services", "/services"],
  ["service-detail", "/services/website-development"],
  ["pricing", "/pricing"],
  ["portfolio", "/portfolio"],
  ["blog", "/blog"],
  ["contact", "/contact"],
  ["about", "/about"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();

for (const [name, path] of pages) {
  const url = BASE + path;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(600);
    // Above-the-fold (viewport) shot
    await page.screenshot({ path: `${OUT}/${name}-fold.png` });
    // Full-page shot (capped)
    await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
    const title = await page.title();
    console.log(`OK  ${name}  ${path}  | ${title}`);
  } catch (e) {
    console.log(`ERR ${name}  ${path}  | ${e.message}`);
  }
}

await browser.close();
console.log(`shots in ${OUT}`);
