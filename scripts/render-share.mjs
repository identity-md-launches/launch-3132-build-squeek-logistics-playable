import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL('/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<style>body{margin:0}svg{display:block}</style>${await readFile('public/share.svg', 'utf8')}`);
  await page.screenshot({ path: 'public/share.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log('Rendered the original share artwork to public/share.png (1200 × 630).');
} finally { await browser.close(); }
