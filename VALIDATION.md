# Squeek Logistics CSP repair validation

Checked 2026-11-08. This is the contributor's evidence record, not independent certification. The existing game, visual design, simulation, save format and Squeekchain deployment were retained.

## Result and scope

| Area | Actual result |
| --- | --- |
| Original failure | Reproduced in Chromium under enforced CSP: Ajv's Function constructor threw at `assets/index-CsNp8EDF.js:203:27558`; `#root` was empty |
| Root-cause fix | Ajv schema compilation moved to Node generation; browser imports ordinary precompiled ESM; full official schema and identity/accounting checks preserved |
| Production build / typecheck | `npm run build` and `npm run typecheck`: exit 0 |
| Unit / integration / CSP regressions | `npm test`: 59/59 passed in three files (32 engine, 12 integration, 15 CSP) |
| Generated-validator freshness | `node scripts/generate-core-validator.mjs --check`: exit 0 |
| Production runtime audit | Both emitted JS chunks parsed; no eval/Function execution or string timers; compiler graph guard passed |
| Production preview interactions | 21 scenarios passed under enforced `script-src 'self'` at `/preview/squeek/` |
| Normal gameplay Console | Zero page errors, zero console errors and zero CSP violations; zero missing local resources |
| Responsive views | No horizontal document overflow across all game screens at 320, 390, 768, 1000 and 1440px |
| Recovery | React effect error, blocked App chunk, uncaught timer and rejected promise all show recovery; keyboard reload preserves saved progress; static fallback works with JavaScript disabled |
| Automated accessibility | Axe WCAG 2 A/AA, 2.1 AA and 2.2 AA rules: zero violations on all five 390px game views and the recovery view |
| Interface probe | Pinned taste@1: 16/16 checks passed on the final export |
| First screen at 390px | Product identification, gathering controls and world visible; screenshot inspected |
| Real external API | Failed to fetch in this browser environment; the UI correctly displayed UNKNOWN and starter play remained available |
| Public updated deployment | Not tested: publication is a separate step; the existing ENS gateway attempt returned `net::ERR_EMPTY_RESPONSE` |
| WebKit / Safari | Not performed: assigned runtime has no WebKit executable |

The interaction report contains 23 entries: **21 passed**, one failed external live-read observation, and one unperformed WebKit check. It is not an all-green live-service report. The successful integration scenario explicitly intercepts `https://api.squeekchain.com/v1/core` with the existing **historical real-response fixture**; no fixture is imported into the production app as a fallback. The original public verification record in `docs/sepolia-verification.json` remains historical and unchanged; no fresh RPC or live-HTTP attestation is claimed by this repair.

## Commands and reproducibility

Dependencies were installed from unchanged copies of the existing manifest/lockfile using:

```sh
npm ci --prefix test/scratch/runtime --cache test/scratch/npm-cache --no-audit --no-fund
```

All source, tests, public assets, scripts and Vite/TypeScript settings were mirrored into that disposable directory. From its root, the following completed successfully after the final implementation change:

```sh
npm run build
npm run typecheck
npm test
node scripts/check-csp.mjs dist
node scripts/generate-core-validator.mjs --check
```

The final build used Vite 6.4.5 and TypeScript checking, transformed 1,588 modules and produced the two JS chunks plus CSS listed in `artifacts/csp-build-results.json`. The build's plugin regenerates the validator and checks the browser module graph and emitted JS. The standalone generator output is committed so the typecheck preceding Vite can resolve it. Parity/freshness tests catch stale generated code. The 59 tests completed in about one second; the final Vite build took 2.85 seconds.

`node scripts/browser-check.mjs` ran with the assigned installed Playwright module specified through `IMD_PLAYWRIGHT` and its installed browsers through `PLAYWRIGHT_BROWSERS_PATH`. The script owns/closes a temporary foreground HTTP server and Chromium, serves the actual production export at a nested path, and writes evidence only under `test/scratch/interaction/`. The exact browser result is retained at `artifacts/csp-browser-results.json`, timestamped `2026-11-08T03:46:09.213Z`.

The browser connector itself could not initialize: it reported that its configured Chrome distribution was missing. The installed Chromium fallback provided the rendered observations and interaction checks. WebKit launch reported a missing executable. Neither limitation prompted a production configuration change or a request for credentials.

From the repository root, the final design probe ran as:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Its installed Playwright module/browser paths were supplied through the same tool variables. The probe's 16 check results are retained in `artifacts/taste-checks.json`; scratch screenshots/logs are not runtime assets. The final served preview and the copied `dist/` were compared byte-for-byte, as were the submitted source/configuration and the build mirror.

## CSP diagnosis and protection

See `docs/csp-diagnosis.md` and `artifacts/csp-original-error.json` for the original error, exact dependency version/source and bundle coordinates. The culprit was **Ajv 8.20.0**, `compileSchema`, distributed `ajv/dist/compile/index.js:89` / TypeScript source `ajv/lib/compile/index.ts:171`. The original Core module compiled schemas at import time, before the app mounted.

The official schema's SHA-256 remains `e748b59cfced3a2c210034edc33efebd002c7c7d754e564696da2cf676c7073a`. The generator uses the same Ajv options and shared unsigned-decimal formats; tests compare generated validation with the original Node compiler across valid, unavailable, malformed, overflow, Unicode-length, extra-property and event-limit inputs. A separate Node process with `--disallow-code-generation-from-strings` successfully imports and runs the generated validator. Existing identity, settled-accounting, freshness, ETag, rate-limit and permanent-unlock tests still pass.

The verification server sends:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.squeekchain.com; object-src 'none'; base-uri 'self'
```

This is a test header only. No hosting CSP, CSP meta override or evaluation permission was added. A **separate negative-control page** loads a real external script attempting Function construction and receives `EvalError`, confirming that the browser enforces the policy. That deliberately invalid code is served only by the harness and is absent from `dist/`. Normal gameplay is checked separately and produces no CSP violation. Static AST detection covers known direct/member execution forms; it is not a proof about arbitrary future reflective code. Enforced-CSP interaction coverage complements it.

## Interaction and recovery coverage

The production-preview walk used actual timers: gather 4 wood after 5 seconds, dispatch an 8-wood handcart order, collect after the 18-second trip, build a sawmill in 8 seconds, then make 3 planks from 4 wood and 2 credits in 12 seconds. Credits, inventory, XP, reputation and saved building/delivery state were asserted. Busy gathering and in-transit collection were disabled at the appropriate time.

The walk also covered all navigation screens, route and vehicle choices, warehouse surplus sales, reload persistence, exported JSON, invalid import rejection, confirmed valid import, typed RESET confirmation, Enter/Escape field-guide behavior with focus return, unavailable Core, preservation of malformed existing saves, storage quota errors with memory-only export, and maximum safe-integer counters at phone/desktop widths. The unchanged engine tests additionally cover serial queue/cancellation/capacity, upgrades, routes/vehicles, milestone boundaries, economy invariants, a 15-delivery playthrough and seeded actions.

Recovery checks deliberately inject failures in isolated contexts: Canvas effect error, blocked dynamic application chunk, uncaught timer error and rejected promise. Each shows the visible recovery screen. The React boundary reports the original error to Console; recovery never hides the cause. The saved state was compared in full except for the normal autosave timestamp, and keyboard Reload game restored the saved 110-credit outpost. The static index fallback and noscript guidance remained visible with JavaScript disabled. Intentional error tests are not counted as a clean normal-gameplay Console.

## Better Interface review: six domains

The supplied Better Interface workflow and core principles of all six domains were read and applied within the CSP/recovery scope. The existing visual idea remains an isometric hamster outpost surrounded by a calm paper-and-forest game interface. Wallet-connector guidance is not applicable: this retained integration reads the public API and does not sign transactions.

| Domain | Coverage and evidence | Limitations |
| --- | --- | --- |
| Accessibility | Checked: native recovery button/link, one main/h1, focused failure heading, alert text, keyboard reload and field-guide focus return; Axe on five views and recovery; probe target baseline passed | No screen-reader session or full WCAG-conformance claim; focus was visually inspected on recovery, not every control/background combination |
| Layout | Checked: game views at 320/390/768/1000/1440; recovery at 390; maximum counters; inspected phone/desktop screenshots; no document overflow | Native 200% browser zoom, translation expansion and RTL mirror not tested |
| Writing | Checked in source and rendered recovery: product vocabulary retained, plain error and verb-first Reload game, explicit preservation guidance; API failures say UNKNOWN | No localization/user-research claim; save text does not guarantee unsaved in-memory progress |
| Typography | Checked: fallback reuses 12/14/20px tokens, existing system font/weights and wrapping; probe finds four sizes at 390 and five at desktop, two families and three weights | Physical iOS/Safari font rendering and text-resize preferences unverified |
| Colors | Checked: existing semantic tokens reused with exact startup fallback values; probe passes resolved-solid text pairs at 4.5:1 or 3:1 large; recovery passes Axe | Seventeen text boxes over canvas/imagery are excluded from numeric contrast measurement; no dark theme is implemented |
| UI details | Checked: loading, empty queue, pending construction/production, in-transit/arrived shipment, unavailable Core, saving errors and failure/reload states; 44px recovery action, focus border, no new motion; probe reduced-motion check passed | No animation-panel slow-motion replay, physical device or Safari check |

`DESIGN.md` documents the actual source tokens, typography, components, responsive behavior and recovery surface. The existing design-guide attribution/licenses are retained in `docs/design-guide-LICENSE.txt`.

## Findings, corrections and rechecks

| Severity / source | Finding | Change and evidence |
| --- | --- | --- |
| High / `src/integration/core.ts:1`, `vite.config.ts:10` | Import-time schema compilation blocked the complete game before React rendered | Import the generated validator; compile only in Node; guard compiler graph and emitted chunks. Original error reproduced; 59 tests, strict-CSP gameplay and audit pass. Exact old bundle location is in diagnosis. |
| High / `src/main.tsx:17`, `src/main.tsx:22`, `src/GameErrorBoundary.tsx:17`, `index.html:19` | A failed module/render left no visible recovery | Install error/rejection handling before App import; wrap React in a boundary; retain static recovery HTML. Forced module/effect/timer/promise failures and JavaScript-disabled context all showed usable recovery. |
| Medium / `src/GameErrorBoundary.tsx:4`, `src/fallback.css:21` | A new recovery view needed accessible orientation and a usable primary action | Focus the named h1, announce the error, reuse the existing tokens, and use a native 44px reload control. Screenshot inspected; Axe and keyboard reload pass; stored game preserved. |

No game redesign or unrelated interface changes were needed. The new fallback was corrected to reuse semantic tokens before the final build. During test development, raw-save equality was refined to exclude its normally refreshed `savedAt`, and the noscript test uses a direct DOM selector because Playwright text locators exclude noscript descendants; these were harness assertions, not product failures.

## Probe and visual evidence

All 16 taste@1 checks passed: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes, type faces, glyphs, slogans, repetition, copy budget, chrome, motion and share. The 390px screen has 19 prose words, under the 60-word bar. All 21 controls meet the 24px-or-spacing baseline; the existing dense UI has 13 below the 44px comfort recommendation. There were no measured text overlaps, clipped text, floating controls over text, horizontal scroll, decorative shadow/border stacks or missing metadata.

Screenshots inspected and retained:

- `artifacts/mobile-outpost.png`: 390 CSS pixels wide (device scale 2), first screen includes the game and gather controls.
- `artifacts/desktop-outpost.png`: 1440 CSS pixels wide, map and persistent contract board visible.
- `artifacts/mobile-recovery.png`: 390 CSS pixels wide, focused failure heading, reload action and readable preservation guidance.

The title, favicon, description, og:title and local og:image remain present. Dynamic imports, stylesheet, favicon and share artwork use relative production URLs suitable for static gateway subpaths.

## Submission and completion limits

The complete eligible repository file set, including existing source/lockfile, export and retained evidence, is conservatively under **1.5 MiB**, below **8,388,608 bytes**. The finished export is **449,738 bytes**. The final exact file inventory/byte/hash check is recorded in `artifacts/csp-build-results.json`. No dependency/cache/registry archive is part of the deliverable, and there is no new submodule. The unchanged `.gitignore` is 230 bytes within its existing explicit 1 KiB path budget, excludes generated dependency/cache directories at every nesting level, and leaves `dist/` eligible for submission. Protected package manifests/lockfiles and existing game/chain settings were not changed. No Git metadata or publishing operation was used.

**Repository implementation and production-preview checks complete.** Public verification of the updated ENS deployment remains unperformed until the separate publisher installs this export and the gateway is reachable. The live browser API check failed in this environment; success was not invented or replaced with fixture data in production. WebKit, physical devices, screen readers, native zoom and an independent Ethereum RPC proof remain unverified. These limits do not prevent delivery of the working CSP-compatible static export.
