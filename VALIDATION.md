# Squeek Logistics validation

Checked 2026-11-08. This is the builder’s evidence record, not independent certification.

## Scope and result

| Area | Actual result |
| --- | --- |
| Playable simulation | Gathering, six buildable/upgradable buildings, serial production, reserved storage, surplus trade, five routes, three vehicles, replenishing contracts, delivery rewards, XP, reputation and goals implemented |
| Production export | `dist/index.html` plus local, relative assets; tested under a nested static URL |
| Build / typecheck | `npm run build` and `npm run typecheck` passed |
| Engine / integration tests | 44 tests passed across two test files |
| Chromium interaction walk | 15 scenarios passed; actual game timers used for the primary loop |
| Live official HTTP verification | Available Core payload passed the official schema and deployment-record identity comparison |
| Direct external browser read | Failed with `net::ERR_EMPTY_RESPONSE`; UI showed UNKNOWN; live browser transport remains unverified |
| Responsive game views | No horizontal document overflow at 320, 390, 768, 1000 or 1440; desktop contract board/mobile Contracts view exercised |
| First 390px screen | Product, gathering action and full pixel world visible; screenshot inspected |
| taste@1 | 16/16 checks passed on the export |
| Automated accessibility | Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA rules: zero violations across all five 390px game views |
| WebKit / Safari | Not performed: optional WebKit runtime unavailable |

## Commands and boundaries

- `npm run build`: TypeScript and Vite production build; static files written to `dist/`.
- `npm run typecheck`: standalone `tsc --noEmit`, including source/tests/configuration.
- `npm test`: Vitest engine and integration suite. No network required.
- `npm run verify:integration`: fresh public GETs with curl; validates the official schema and live identity fields against the official deployment record. Evidence is saved in `docs/sepolia-verification.json` and an artifact copy.
- `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node scripts/browser-check.mjs`: the assigned Chromium runtime, a temporary foreground static server, real game interactions, intercepted historical success/unavailable scenarios, Axe and viewport checks. The script closes its server and browser. Its screenshots/logs are scratch material, not runtime dependencies.
- `IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste`: pinned design probe. Its final initial-state screenshots were visually inspected.
- `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node scripts/render-share.mjs`: rendered the original SVG into the included 1200 × 630 PNG share card; the resulting image was inspected.

The browser connector returned “Transport closed”; the installed Playwright fallback provided the browser evidence. The fallback’s direct public API navigation returned `net::ERR_EMPTY_RESPONSE`, including a diagnostic attempt that ignored browser certificate errors. This does not establish an application CORS or deployment failure. A separate curl request returned HTTP 200 with `Access-Control-Allow-Origin: *` and exposed ETag/Retry-After headers. No production TLS bypass or intermediary API proxy was added.

The positive browser integration scenario explicitly intercepts `/v1/core` with `tests/fixtures/core-observed.json`, a real historical response. It verifies the browser-side schema/identity code, not live connectivity. The unavailable scenario uses a deliberately unavailable response and earns no unlocks. Neither fixture is used by the production application as a fallback.

## Tested mechanics and recovery

- Resource increments occur after timers, never immediately. A second gathering action cannot double-book the crew.
- Production pays inputs once, reserves output space, enforces three serial batches/site, permits independent lanes and speeds up future batches after upgrades.
- Cancellation refunds inputs and cannot overflow storage; remaining serial batches are rescheduled without overlap.
- Construction charges once and enables a building only at completion; upgrades change capacity/fleet/production as defined.
- Shipment dispatch consumes the exact cargo and departure fees. Capacity, depot level, global routes, available vehicle slots and inventory are checked in the engine, not only in disabled controls.
- Early collection and duplicate collection are rejected; reward, XP and reputation are paid once. The actual 18-second starter shipment was dispatched and collected in Chromium.
- Neighborly trade rewards three different cargo types once per mix. Bulk demand fits an unlocked vehicle. A small raw order and surplus sales preserve recovery paths.
- A 15-delivery offline playthrough reaches progression without API access. A 500-action seeded sequence checks nonnegative stock/credits, reserved capacity and save validity after every step.
- Thresholds tested at 0, 99, 100, 249, 250, 499, 500, 999, 1000 and 1001. Zero work/round earns no unlock. Reapplying a verified threshold is idempotent; earlier earned unlocks persist.
- Round-trip saves preserve timers and finish queued work once. Invalid versions, malformed JSON, negative stock, over-capacity state, invalid timestamps and duplicate identifiers are rejected.
- Chromium exercised reload, JSON download, bad-file rejection, valid import replacement, typed reset confirmation, corrupt existing-save preservation and localStorage quota failure with successful memory-only export.
- API tests cover official schema/identity validation, unsafe/mismatched state, bounded uint values, unavailable payloads, invalid JSON, HTTP failures, ETag/304, 429 Retry-After, local expiry and a stalled safe block. The default fetch receiver has a regression test for the browser issue found during development.

## Real Sepolia evidence

At **2026-11-08T00:24:15.107Z**, the official API reported:

| Field | Observed value |
| --- | --- |
| Network | Ethereum Sepolia, 11155111 |
| SqueekCore | `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4` |
| Release / revision | `core-sepolia-20261103` / 7 |
| Settled Squeek blockHeight | 2115 |
| settledThroughRound | 603 |
| cumulativeWork | 19507 |
| Safe Ethereum block | 12087189 |

The full official Core JSON Schema passed. Core, implementation address, runtime hash, storage layout, ProxyAdmin/admin slot and governance identities matched the official deployment record. All displayed state is API-reported; no independent Ethereum RPC state proof was made. The original supplied deployment URL returned 404; the working canonical record was discovered through the official Developers page and bundled without modification. Sources and SHA-256 hashes are retained in [`docs/sepolia-verification.json`](docs/sepolia-verification.json).

## Better Interface review: all six domains

| Domain | Coverage | Evidence and limits |
| --- | --- | --- |
| Accessibility | Checked | Native controls/dialogs; named plot/utility controls; Enter/Escape/focus restoration walk; Axe on five views; probe target checks. No screen-reader session or full conformance claim. |
| Layout | Checked | Screenshots at phone/desktop, five viewport widths across views, maximum local counters at 320/390/1440; no document overflow. Native 200% zoom and RTL mirror unperformed. |
| Writing | Checked | Costs, timing and trip quote beside actions; recovery copy for queues/storage/materials/import/saving/API errors; local-only and nonmonetary limits stated. No user research/localization test. |
| Typography | Checked | Five sizes used at desktop, four at 390; two families, three weights; system font stack, tabular counters, 16px form inputs. Native iOS font rendering unverified. |
| Colors | Checked | Probe passed all measured resolved-solid pairs at 4.5:1/3:1. Seventeen boxes over canvas/imagery were excluded from numerical contrast measurement; visually inspected only. No dark theme is implemented or claimed. |
| UI details | Checked | Build/queue/loading/empty/in-transit/arrived/error states, native modal dismissal, reset confirmation, focus styles, restricted transitions, reduced-motion initial state and no missing local assets. No animation-panel slow-motion replay. |

The visual idea is a tiny isometric hamster outpost surrounded by a calm paper-and-forest interface. The final source’s exact colors, type, components and responsive rules are documented in `DESIGN.md`.

## Findings and fixes

All applicable observed blockers were corrected before delivery. References point to the implemented fixes in source, not a generated bundle.

| Severity / domain | Source | Finding and correction | Recheck |
| --- | --- | --- | --- |
| High / functional | `src/game.ts:223` | Save validation originally capped numbers below valid Unix-millisecond timestamps, rejecting the game’s own saves. Safe integers and explicit valid Date bounds now distinguish counters/timestamps. | Round-trip/offline-work tests and real browser reload/import passed. |
| High / integration | `src/integration/core.ts:55` | A default fetch stored as an instance method lost the browser global receiver. Wrapped the call through `globalThis.fetch`. | Browser fixture validated and earned unlocks; a receiver regression test passes. The remaining external transport failure is separately reported. |
| High / economy | `src/game.ts:203`, `src/game.ts:62`, `src/App.tsx:147` | Exclusive manufactured/bulk demand or full storage could block recovery with low credits. Preserve a small free-handcart raw order; add explicitly priced warehouse surplus sales. | Economy tests, long playthrough and browser surplus transaction passed. |
| Medium / accessibility | `src/App.tsx:182` | Mobile hides the save button’s text, leaving its icon unnamed. Added `aria-label="Save & load"`. | Mobile export/import/reset walk and Axe passed. |
| Medium / layout | `src/style.css:129` | Very long reputation values needed a wrapping bound in the page heading. Added constrained wrapping, flexible heading width and numeric overflow handling. | Maximum safe-integer local counters fit at 320/390/1440. |
| Medium / integration | `src/integration/core.ts:77` | A 200 response without an exposed ETag could keep a tag belonging to an older representation. Clear the old tag on 200; retain it only for valid 304 reuse. | Conditional request tests passed. |

## Probe results and visual evidence

taste@1: **16/16 passed**: render, layout, targets, contrast, casing, tracking, eyebrows, type-sizes, type-faces, glyphs, slogans, repetition, copy-budget, chrome, motion and share. It found no missing local resources, script errors, horizontal overflow, text-box overlap, floating-control overlap or hidden overflow clipping on the inspected initial export.

At 390px it measured 21 controls satisfying the 24px-or-spacing rule; 13 are below the 44px comfort recommendation. Resolved text contrast passed; canvas/imagery compositing remains the stated exclusion. There were 19 prose words on the first phone screen and 25 on the first desktop screen. The title, description, favicon, og:title and og:image are present. All share-art assets are local.

The first-screen 390px screenshot was inspected at full resolution: wordmark/resources/navigation appear first, gathering is immediately actionable beneath the tutorial, and the complete home outpost is visible above the viewport end. The full desktop screenshot shows the map, workbench, empty queue, persistent contract board, goals and neighborly mix. The original PNG share card was also inspected.

## Submission integrity

The added, eligible source/export bundle is approximately **0.86 MiB**, below the **8 MiB (8,388,608-byte)** limit. The production export is approximately **0.51 MiB**. The check used the repository’s eligible untracked file list, so ignored dependency/cache paths were excluded; none were eligible for submission. `.gitignore` is 230 bytes, within its explicit 1 KiB budget. `dist/index.html` is not ignored. All referenced static script, stylesheet, favicon and share-image files exist with relative production URLs. No submodule, package archive or browser dependency is needed to serve the export. The worker performs the eventual Git commit; this implementation does not stage or commit files.

## Remaining limitations

- Direct live browser API connectivity failed in the available browser runtime. Real HTTP evidence and intercepted browser validation are distinct; no unverified live-browser success is claimed.
- WebKit/Safari, physical phones, screen-reader use, native browser 200% zoom and RTL were not verified. This is an English light-theme game.
- The API does not expose Date/Age through the observed CORS policy. Local two-minute expiry and safe-block advancement checks detect stale reads within their stated windows; there is no independent proof of indexer freshness or Ethereum RPC state.
- Saves and unlock history are editable, browser-local game data. There is no cloud sync, tab coordination, multiplayer or authenticated attestation. Device clock changes affect timers.
- The simulation is finite queued work with repeatable local contracts; no endless passive production, contract deadlines, shipment loss or regions with separate physical inventories are implemented. Regional trade is represented by actual route timing, capacity/fees and reward differences.
- Hosting/publication is outside this implementation. `dist/` is prepared for the network’s separate publication step.
