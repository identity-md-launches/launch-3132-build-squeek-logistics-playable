import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';

// Use the assigned browser runtime. This script owns its foreground preview and closes everything.
const { chromium, webkit } = await import(process.env.IMD_PLAYWRIGHT ? pathToFileURL(resolve(process.env.IMD_PLAYWRIGHT)).href : 'playwright-core');
const fixture = JSON.parse(await readFile('tests/fixtures/core-observed.json', 'utf8'));
const output = 'test/scratch/interaction'; await mkdir(output, { recursive: true });
const root = resolve('dist'); const prefix = '/preview/squeek/';
// A verification header, not a modification to the hosting policy. Real page
// scripts (including the negative control) run without any eval permission.
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.squeekchain.com; object-src 'none'; base-uri 'self'";
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    if (pathname === prefix + 'csp-negative-control.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Content-Security-Policy': csp });
      // Deliberately forbidden test code, served only by this check, never dist/.
      res.end('try { Function("return 1")(); window.cspBlockedEvaluation = false; } catch (error) { window.cspBlockedEvaluation = error.name === "EvalError"; }');
      return;
    }
    const filename = resolve(root, decodeURIComponent(pathname.slice(prefix.length)) || 'index.html');
    if (!filename.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
    const data = await readFile(filename); res.writeHead(200, { 'Content-Type': mime[extname(filename)] || 'application/octet-stream', 'Content-Security-Policy': csp }); res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const address = server.address(); const url = `http://127.0.0.1:${address.port}${prefix}`;
const results = [], errors = [], consoleErrors = [], violations = [];
function record(name, details) { results.push({ name, passed: true, details }); console.log(`PASS ${name}: ${details}`); }
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const policy = await browser.newPage();
  await policy.goto(url);
  const header = (await policy.request.get(url)).headers()['content-security-policy'];
  assert.equal(header, csp);
  await policy.addScriptTag({ url: url + 'csp-negative-control.js' });
  assert.equal(await policy.evaluate(() => window.cspBlockedEvaluation), true);
  record('CSP negative control', 'The preview sends script-src self; a real external page script attempting Function construction receives EvalError. No eval permission is present.');
  await policy.close();
  // First inspect a real network request, without intercepting chain state.
  const live = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const livePage = await live.newPage();
  const liveErrors = []; livePage.on('pageerror', e => liveErrors.push(e.message));
  await livePage.goto(url); await livePage.getByRole('button', { name: 'Genesis', exact: true }).click();
  await livePage.waitForFunction(() => !document.querySelector('.chain-panel')?.textContent?.includes('Checking the settled frontier'), { timeout: 18000 }).catch(() => {});
  const liveText = await livePage.locator('.chain-panel').innerText();
  results.push({ name: 'Unmocked browser API read', passed: /Verified API state/.test(liveText), details: liveText });
  console.log('LIVE browser state:', liveText.slice(0, 1300));
  assert.deepEqual(liveErrors, []);
  await livePage.screenshot({ path: `${output}/live-genesis.png`, fullPage: true }); await live.close();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await context.exposeBinding('__recordCspViolation', (_source, violation) => violations.push(violation));
  await context.route('https://api.squeekchain.com/v1/core', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ETag: '"browser-fixture"' }, body: JSON.stringify(fixture) }));
  const page = await context.newPage();
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => {
      const violation = { directive: e.effectiveDirective, blockedURI: e.blockedURI };
      window.__cspViolations.push(violation); void window.__recordCspViolation(violation);
    });
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).unlocked.length === 4);
  record('Verified settled milestone rendering', 'The official observed fixture passes the browser validator and unlocks all four thresholds. This is an explicitly mocked scenario.');
  await page.getByRole('button', { name: 'Gather wood', exact: false }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).jobs.some(j => j.kind === 'gather'));
  assert(await page.getByRole('button', { name: 'Gather stone', exact: false }).isDisabled());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).inventory.wood === 16, { timeout: 8000 });
  record('Gathering crew and timer', 'Wood changes 12 → 16 after five seconds; other gathering buttons lock while busy.');
  await page.getByRole('button', { name: 'Contracts', exact: true }).click();
  await page.getByRole('button', { name: 'Prepare shipment', exact: true }).first().click();
  await page.getByLabel('Choose a route').selectOption('meadow');
  assert.equal(await page.getByRole('button', { name: 'Dispatch shipment' }).isEnabled(), true);
  await page.getByRole('button', { name: 'Dispatch shipment' }).click();
  await page.getByRole('heading', { name: 'On the road' }).waitFor();
  assert(await page.getByRole('button', { name: 'In transit', exact: true }).isDisabled());
  await page.screenshot({ path: `${output}/390-shipment.png`, fullPage: true });
  await page.getByRole('button', { name: 'Collect reward', exact: true }).waitFor({ timeout: 23000 });
  await page.getByRole('button', { name: 'Collect reward', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).deliveries === 1);
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')));
  assert.equal(saved.credits, 168); assert.equal(saved.xp, 25); assert.equal(saved.inventory.wood, 8);
  record('Contract → route → dispatch → reward', 'Mobile interaction consumed 8 wood; rewarded 48 credits, 25 XP, 2 reputation after the actual 18s timer.');
  await page.getByRole('button', { name: 'Buildings', exact: true }).click();
  const sawmill = page.getByRole('region', { name: 'Sawmill', exact: true });
  await sawmill.getByRole('button', { name: 'Build', exact: true }).click();
  await sawmill.getByRole('button', { name: 'Queue batch', exact: true }).first().waitFor({ timeout: 11000 });
  await page.getByRole('button', { name: 'Outpost', exact: true }).click();
  await page.getByRole('button', { name: 'Select Sawmill, level 1', exact: true }).click();
  await page.getByRole('button', { name: 'Gather wood', exact: false }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).inventory.wood === 4);
  await page.getByRole('region', { name: 'Sawmill', exact: true }).getByRole('button', { name: 'Queue batch', exact: true }).nth(1).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).inventory.planks === 3, { timeout: 16000 });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')));
  assert.equal(saved.credits, 106); assert.equal(saved.inventory.wood, 0); assert.equal(saved.buildings.sawmill, 1);
  record('Construction and production', 'Sawmill built after 8s; 4 wood + 2 credits produced 3 planks after 12s.');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.resource-bar')?.textContent?.includes('106'));
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')));
  assert.equal(saved.inventory.planks, 3); assert.equal(saved.deliveries, 1);
  record('Browser reload save/load', 'Inventory, credits, buildings, trade mix and delivery progress survived reload.');
  await page.getByText('Manage inventory & surplus', { exact: true }).click();
  await page.getByRole('button', { name: /Sell 4 stone/ }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')));
  assert.equal(saved.credits, 110); assert.equal(saved.inventory.stone, 0);
  record('Warehouse surplus trading', 'Selling 4 spare stone frees four storage spaces and returns four in-game credits.');
  await page.getByRole('button', { name: 'Save & load', exact: true }).click();
  const exported = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export save', exact: true }).click();
  const download = await exported; await download.saveAs(`${output}/exported-save.json`);
  assert.equal(JSON.parse(await readFile(`${output}/exported-save.json`, 'utf8')).credits, 110);
  const bad = Buffer.from('{"version":99}');
  await page.getByLabel('Import a Squeek Logistics JSON save').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: bad });
  await page.getByText('Unsupported save version.', { exact: false }).waitFor();
  await page.getByLabel('Import a Squeek Logistics JSON save').setInputFiles(`${output}/exported-save.json`);
  await page.getByRole('button', { name: 'Replace with imported save', exact: true }).click();
  await page.getByRole('button', { name: 'Save & load', exact: true }).click();
  assert(await page.getByRole('button', { name: 'Reset this outpost', exact: true }).isDisabled());
  await page.getByLabel('Type RESET to confirm').fill('RESET');
  await page.getByRole('button', { name: 'Reset this outpost', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).credits === 120);
  record('Export, import validation, replacement and reset', 'Downloaded JSON matches state; incompatible file rejected; valid import confirmed; destructive reset needs typed confirmation.');
  // Focus and native dialog checks.
  await page.getByRole('button', { name: 'Open field guide', exact: true }).focus(); await page.keyboard.press('Enter');
  assert(await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Open field guide');
  record('Keyboard dialog behavior', 'Enter opens the native modal, Escape dismisses it and restores focus to its trigger.');

  // Deliberately unavailable Core must never masquerade as a zero or unlock new content.
  const unknown = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await unknown.route('https://api.squeekchain.com/v1/core', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schemaVersion: 1, installationId: 'test-unavailable', status: 'unavailable', reason: 'indexer_unavailable' }) }));
  const unavailable = await unknown.newPage(); await unavailable.goto(url);
  await unavailable.getByRole('button', { name: 'Genesis', exact: true }).click();
  await unavailable.getByRole('heading', { name: 'Global state: UNKNOWN', exact: true }).waitFor();
  assert.equal(await unavailable.locator('.core-stats').count(), 0);
  const unknownSave = await unavailable.evaluate(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')));
  assert.equal(unknownSave.unlocked.length, 0);
  await unavailable.screenshot({ path: `${output}/390-unknown.png`, fullPage: true });
  await unavailable.getByRole('button', { name: 'Outpost', exact: true }).click();
  await unavailable.getByRole('button', { name: 'Gather wood', exact: false }).click();
  assert(await unavailable.getByRole('button', { name: 'Gather stone', exact: false }).isDisabled());
  record('Unavailable API in the UI', 'Shows UNKNOWN with retry guidance and no zero chain stats or new unlocks; starter gathering still works.');
  await unknown.close();

  const recovery = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await recovery.route('https://api.squeekchain.com/v1/core', r => r.abort());
  await recovery.addInitScript(() => localStorage.setItem('squeek-logistics:v1', '{broken-save'));
  const recovered = await recovery.newPage(); await recovered.goto(url);
  await recovered.getByText('Local save could not be read.', { exact: false }).first().waitFor();
  assert.equal(await recovered.evaluate(() => localStorage.getItem('squeek-logistics:v1')), '{broken-save');
  record('Corrupt save recovery', 'A broken existing save is preserved rather than overwritten; the session warns that it is running in memory.');
  await recovery.close();
  const quota = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await quota.route('https://api.squeekchain.com/v1/core', r => r.abort());
  await quota.addInitScript(() => Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } }));
  const quotaPage = await quota.newPage(); await quotaPage.goto(url);
  await quotaPage.getByText('Local saving is unavailable.', { exact: false }).first().waitFor();
  await quotaPage.getByRole('button', { name: 'Save & load', exact: true }).click();
  const quotaExport = quotaPage.waitForEvent('download'); await quotaPage.getByRole('button', { name: 'Export save', exact: true }).click();
  await (await quotaExport).saveAs(`${output}/memory-save.json`);
  assert.equal(JSON.parse(await readFile(`${output}/memory-save.json`, 'utf8')).credits, 120);
  record('Storage quota recovery', 'Blocked localStorage produces a persistent warning; a valid JSON save can still be exported from memory.');
  await quota.close();

  // Render every game view at the content breakpoints; record real overflow and screenshots.
  for (const width of [320, 390, 768, 1000, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const view of ['Outpost', 'Buildings', ...(width <= 900 ? ['Contracts'] : []), 'Shipments', 'Genesis']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert(!overflowing, `${view} overflows at ${width}`);
      if (width === 390) {
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        await writeFile(`${output}/axe-${view.toLowerCase()}.json`, JSON.stringify({ violations: axe.violations, passes: axe.passes.length }, null, 2));
        assert.deepEqual(axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), [], `Axe ${view}`);
      }
    }
    await page.getByRole('button', { name: 'Outpost', exact: true }).click();
    await page.screenshot({ path: `${output}/${width}-outpost.png`, fullPage: true });
  }
  record('Responsive view coverage', 'All five views fit at 320, 390 and 768; desktop views fit at 1000 and 1440 without horizontal document overflow.');
  record('Automated accessibility', 'Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA rules found no violations in all five 390px game views. This is not a screen-reader or full conformance audit.');
  const extremeState = JSON.parse(await readFile(`${output}/exported-save.json`, 'utf8'));
  extremeState.credits = Number.MAX_SAFE_INTEGER; extremeState.xp = Number.MAX_SAFE_INTEGER; extremeState.reputation = Number.MAX_SAFE_INTEGER;
  const longValues = await browser.newContext();
  await longValues.route('https://api.squeekchain.com/v1/core', r => r.abort());
  await longValues.addInitScript(value => localStorage.setItem('squeek-logistics:v1', value), JSON.stringify(extremeState));
  const longPage = await longValues.newPage();
  for (const width of [320, 390, 1440]) {
    await longPage.setViewportSize({ width, height: 1000 }); await longPage.goto(url);
    assert.equal(await longPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Maximum counters overflow at ${width}`);
  }
  await longPage.screenshot({ path: `${output}/1440-long-values.png`, fullPage: true });
  record('Maximum local counters', 'Maximum safe-integer credits, XP and reputation do not create horizontal document overflow at 320, 390 or 1440.');
  await longValues.close();
  assert.deepEqual(violations, []); assert.deepEqual(consoleErrors, []);
  await context.close();
  assert.deepEqual(errors, []); record('Runtime and static subpath', 'No JavaScript exceptions or missing local assets under /preview/squeek/.');
  record('Strict-CSP gameplay console', 'All five game screens and the gathering/production/shipment/save loop ran with zero page errors, console errors or CSP violations under the enforced preview policy.');

  // Recovery must be tested separately: the following errors are intentional.
  const boundary = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await boundary.route('https://api.squeekchain.com/v1/core', r => r.abort());
  const backup = await readFile(`${output}/exported-save.json`, 'utf8');
  await boundary.addInitScript(value => {
    localStorage.setItem('squeek-logistics:v1', value);
    if (!sessionStorage.getItem('canvas-fault-tested')) {
      sessionStorage.setItem('canvas-fault-tested', 'yes');
      HTMLCanvasElement.prototype.getContext = function () { throw new Error('Intentional canvas failure for boundary validation'); };
    }
  }, backup);
  const fault = await boundary.newPage(); const caught = [];
  fault.on('console', message => { if (message.type() === 'error') caught.push(message.text()); });
  await fault.goto(url);
  await fault.getByRole('heading', { name: 'The outpost could not open' }).waitFor();
  assert(caught.some(message => message.includes('Game rendering failed.')), 'React error boundary must report the original failure');
  const storedAfterFault = JSON.parse(await fault.evaluate(() => localStorage.getItem('squeek-logistics:v1')));
  const backupState = JSON.parse(backup);
  // App's ordinary mount autosave refreshes savedAt; all progress must survive.
  delete storedAfterFault.savedAt; delete backupState.savedAt;
  assert.deepEqual(storedAfterFault, backupState);
  await fault.screenshot({ path: `${output}/390-error-boundary.png`, fullPage: true });
  const fallbackAxe = await new AxeBuilder({ page: fault }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(fallbackAxe.violations.map(v => v.id), []);
  await fault.getByRole('button', { name: 'Reload game', exact: true }).focus();
  await fault.keyboard.press('Enter');
  await fault.getByRole('button', { name: 'Gather wood', exact: false }).waitFor();
  assert.equal(await fault.evaluate(() => JSON.parse(localStorage.getItem('squeek-logistics:v1')).credits), 110);
  await boundary.close();
  record('React boundary and reload recovery', 'An injected Canvas effect failure renders a named, accessible recovery screen; original error stays in Console, the saved backup is preserved, and keyboard reload returns to the game.');

  const startup = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await startup.route(/\/assets\/App-.*\.js$/, r => r.abort());
  const loadingFailure = await startup.newPage(); await loadingFailure.goto(url);
  await loadingFailure.getByRole('heading', { name: 'The outpost could not open' }).waitFor();
  await startup.close();
  record('Failed application chunk', 'A blocked dynamic App module produces the visible error screen before the game mounts.');

  const asynchronous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await asynchronous.route('https://api.squeekchain.com/v1/core', r => r.abort());
  const asyncPage = await asynchronous.newPage(); await asyncPage.goto(url);
  await asyncPage.getByRole('button', { name: 'Gather wood', exact: false }).waitFor();
  await asyncPage.evaluate(() => { setTimeout(() => { throw new Error('Intentional timer failure'); }, 0); });
  await asyncPage.getByRole('heading', { name: 'The outpost could not open' }).waitFor();
  await asyncPage.reload();
  await asyncPage.getByRole('button', { name: 'Gather wood', exact: false }).waitFor();
  await asyncPage.evaluate(() => { void Promise.reject(new Error('Intentional promise failure')); });
  await asyncPage.getByRole('heading', { name: 'The outpost could not open' }).waitFor();
  await asynchronous.close();
  record('Uncaught async failure recovery', 'Unhandled timer errors and promise rejections both show the fallback instead of leaving an unusable game.');

  const noScripts = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noScriptPage = await noScripts.newPage(); await noScriptPage.goto(url);
  assert(await noScriptPage.getByRole('link', { name: 'Reload game' }).isVisible());
  // Playwright's text engine intentionally excludes noscript descendants.
  assert(await noScriptPage.locator('noscript p').isVisible());
  assert.match(await noScriptPage.locator('noscript p').innerText(), /Enable JavaScript to play this game/);
  await noScripts.close();
  record('Static startup fallback', 'Even when JavaScript never starts, index.html contains product identification, reload action and save-preservation guidance.');

  // This optional engine is available only when the contributor runtime includes WebKit.
  try {
    const safari = await webkit.launch({ headless: true });
    const p = await safari.newPage({ viewport: { width: 390, height: 844 } });
    await p.route('https://api.squeekchain.com/v1/core', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }));
    await p.goto(url); await p.getByRole('button', { name: 'Gather wood', exact: false }).click();
    assert(await p.getByRole('button', { name: 'Gather stone', exact: false }).isDisabled());
    await safari.close(); record('WebKit smoke', 'Primary gathering control works at 390px.');
  } catch (e) { results.push({ name: 'WebKit smoke', passed: null, details: e.message.includes("Executable doesn't exist") ? 'WebKit executable is not installed in the assigned runtime.' : 'The assigned WebKit runtime could not launch; Safari behavior remains unverified.' }); console.log('WebKit unavailable; recorded as unperformed.'); }
} catch (error) { results.push({ name: 'Interaction suite', passed: false, details: error.stack }); console.error(error); process.exitCode = 1; }
finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ checkedAt: new Date().toISOString(), csp, results, errors, consoleErrors, violations }, null, 2) + '\n');
  await browser?.close(); await new Promise(r => server.close(r));
}
