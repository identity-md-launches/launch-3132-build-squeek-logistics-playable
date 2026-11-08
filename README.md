# SQUEEK LOGISTICS

A playable, single-player logistics game for Squeekchain Genesis. Start with 120 credits, a warehouse, one handcart and a few materials. Gather cargo, build a tiny industry, plan deliveries and reinvest the proceeds. The original isometric pixel world is drawn locally in Canvas; every building plot is also a native keyboard-operable button.

**Play the static export:** serve [`dist/`](dist/) over HTTP. It needs no application server, credentials or wallet. All game credits are off-chain points with no monetary value. Customers, contracts and the local economy are fictional. Nothing mints tokens, signs, sends transactions or claims mainnet deployment.

## Install, develop and rebuild

Use Node 22 or later and npm:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

`npm run build` typechecks the complete TypeScript project and builds `dist/index.html` with its local assets. Vite uses `base: './'`; navigation is contained in one page. The export was exercised under a nested `/preview/squeek/` URL. Hosting is a separate network step; this repository does not publish itself.

No font, image or game asset requires an external service at runtime. The public Squeekchain API is the only external runtime read. A network outage leaves the starter game and saved unlocks playable.

## Controls and first delivery

1. In **Outpost**, choose Gather wood, Gather stone or Gather metal. One free crew works on one gathering job at a time.
2. In **Contracts** on mobile, or the persistent desktop contract board, choose Prepare shipment. Choose a route and vehicle, review capacity, trip fees and reward, then dispatch.
3. In **Shipments**, collect the reward when the delivery arrives. A vehicle slot stays occupied until collection.
4. In **Buildings**, build a sawmill. Its first construction takes eight seconds. Gather another four wood if construction used your last timber, then queue planks.
5. Select a building in the world to manage it. Warehouse → Manage inventory & surplus offers low-value surplus sales when storage is crowded or credits run low.

Use Tab / Shift+Tab to move, Enter or Space to activate buttons, and Escape to close dialogs. The `?` control opens the field guide. Sound is optional and starts muted. The desktop motion control stops decorative smoke; reduced-motion preferences are honored at startup. The world’s shipment positions and displayed timers still update because they represent game progress.

## Economy and timers

| Gathering | Output | Duration | Credit cost |
| --- | --- | --- | --- |
| Wood | 4 | 5 seconds | Free |
| Stone | 3 | 6.5 seconds | Free |
| Metal | 2 | 8 seconds | Free |

| Industry | Base recipe | Base duration |
| --- | --- | --- |
| Sawmill | 2 credits → 8 wood | 15 seconds |
| Sawmill | 4 wood + 2 credits → 3 planks | 12 seconds |
| Quarry | 3 credits → 8 stone | 18 seconds |
| Metalworks | 3 stone + 4 credits → 6 metal | 24 seconds |
| Workshop | 3 planks + 2 metal + 4 credits → 2 tools | 24 seconds |

- Storage starts at 120 units. Warehouse upgrades add 80 units each, up to 280. Queued outputs reserve space, so production cannot silently overflow storage.
- Each production building has a three-batch serial queue; different buildings work independently. Batch duration is base duration × `0.8^(building level − 1)`. An upgrade affects future batches only.
- Every building has three levels. Construction takes `8 × target level` seconds. Costs are paid at enqueue. Upgrades cost the building’s base cost × its current level. Exact costs are displayed before the action.
- Cancellation refunds all inputs and credits. If the refund would overflow storage, make room first. Cancelling a batch moves later batches forward without overlapping them.
- Surplus sale values per unit: wood 1, stone 1, metal 2, planks 3, tools 6 credits. Contracts pay substantially more; surplus is a recovery option.
- Starter contract rewards are 48 credits for 8 wood, 50 for 6 stone, and 64 for 4 metal. Plank and tool orders appear after their respective industries exist.
- The board replenishes after dispatch and always retains a small raw-material order that the free handcart can fulfill. Upgraded depots introduce larger orders, capped to available vehicle capacity, with a 5% bulk premium per additional demand multiple.
- **Neighborly trade:** deliver three different cargo types to earn 20 extra credits, 10 XP and 1 reputation. Repeating a type does not advance the current mix. Completing a mix resets it.
- Every 100 XP earns a logistics level, capped at 10. Metalworks requires level 2; Workshop requires level 3. Five visible goals guide progression; play continues after them.

| Vehicle | Capacity | Travel-time multiplier | Trip fee | Depot level |
| --- | --- | --- | --- | --- |
| Handcart | 12 | 1 | 0 | 1 |
| Acorn van | 24 | 0.65 | 8 credits | 2 |
| Seed hauler | 48 | 1.3 | 12 credits | 3 + 500-block unlock |

| Route / destination | Base time | Reward multiplier | Toll | Settled-block unlock |
| --- | --- | --- | --- | --- |
| Meadow lane / Clover Commons | 18s | 1 | 0 | Always open |
| Canal crossing / Willow Bend | 32s | 1.25 | 3 | 100 |
| Copper ridge / Copper Highlands | 46s | 1.6 | 5 | 250 |
| Sunflower coast / Sunflower Harbor | 65s | 2 | 8 | 500 |
| Genesis express / Genesis Junction | 80s | 2.5 | 12 | 1,000 |

Cargo and fees leave at departure; reward is rounded once from the contract reward × route multiplier. Travel duration is route duration × vehicle multiplier. There is no random loss, expiry deadline, passive income or automatic requeue. Timers use the device clock and finish while the game is closed; reopening completes each queued job once. Shipments await collection.

## Real Squeekchain integration

The implementation follows the [official Developers page](https://docs.squeekchain.com/developers/) and [API reference](https://docs.squeekchain.com/developers/api/). Runtime reads use **GET `https://api.squeekchain.com/v1/core`**, without query parameters or credentials.

The supplied `https://docs.squeekchain.com/sepolia.json` returned HTTP 404. The Developers page links to the working [official deployment record](https://docs.squeekchain.com/assets/deployments/sepolia.json). Its unmodified revision 7 record is bundled in `src/integration/sepolia.json`; the official [Core JSON Schema](https://docs.squeekchain.com/assets/api/core.json) is bundled alongside it. Neither contains chain-state fallback values.

Before a snapshot can unlock content, the client:

- Validates the complete schema/version/status with Ajv, including bounded unsigned decimal formats.
- Requires Ethereum Sepolia **11155111** and SqueekCore **`0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4`**.
- Matches the proxy implementation, implementation code address, runtime hash, storage-layout digest, ProxyAdmin, admin slot and governance identities against that official record.
- Checks deployment/indexed/safe block coverage and `cumulativeBlockUnits = blockHeight × 10^9 + blockProgress` using BigInt.
- Uses **settled** `blockHeight`, `settledThroughRound` and `cumulativeWork` for milestone evidence. A nonzero height with zero settled round/work is rejected. Projected work is explicitly labeled “Not fetched” and never grants unlocks.

The four block thresholds are game rules, not official Squeekchain milestones. They unlock trading destinations/routes; 100 also opens Metalworks, 250 Workshop and 500 the Seed hauler. Unlock evidence is saved permanently with the observed height, round, work, safe Ethereum block and check time. Saved evidence is labeled historical, never presented as current chain state.

The client polls at most once per 30 seconds, reuses ETags unchanged with `If-None-Match`, and handles 304 using only an already-verified snapshot. HTTP 429/503 respect `Retry-After` (seconds or HTTP date), including manual retry. Other failures use bounded backoff; requests time out after 12 seconds. Any unavailable, invalid, mismatched or failed read immediately shows **UNKNOWN**, without reusing old counters. Successful reads expire locally after two minutes; a safe Ethereum block that has not advanced for five minutes becomes unknown. HTTP Date/Age are checked when exposed by CORS. The observed public response exposes ETag and Retry-After, but not Date/Age; in browsers, local response age and safe-block advancement therefore provide the freshness checks. This is not a cryptographic proof of indexer freshness.

**Actual verification:** at `2026-11-08T00:24:15.107Z`, live public GETs passed official schema and deployment comparison: height **2,115**, settled round **603**, cumulative work **19,507**, safe Ethereum block **12,087,189**, release `core-sepolia-20261103`, revision **7**. Full public identity evidence and source hashes are recorded in `docs/sepolia-verification.json`. These are observations at that time, not current counters. Run `npm run verify:integration` to make a fresh check. No independent Ethereum RPC state proof was performed or claimed.

## Local saves

Saves use schema version 1 under `squeek-logistics:v1` in localStorage. Save & load exports/imports a JSON backup and confirms replacement before loading it. Reset requires typing `RESET`. A malformed existing save is preserved and a memory-only session is offered; storage/quota failures leave the game playable and allow export. The import limit is 200 KB and malformed/unsupported saves are rejected before replacement.

Saves are local, editable game data, not authenticated attestations or cloud accounts. Clearing browser data loses local progress; use exports to move devices. Different tabs do not coordinate writes. Device-clock changes affect game timers.

## Validation and limitations

See [`VALIDATION.md`](VALIDATION.md) for actual commands, coverage, fixes and remaining limits. The delivered source and export have:

- Production build and standalone TypeScript typecheck passes.
- **44 engine/integration tests**, including timer boundaries, economy invariants, 500 seeded actions, a 15-delivery playthrough, milestone boundaries, saves, ETag, 429 and unavailable API behavior.
- A Chromium interaction walk using actual 5s gathering, 18s delivery, 8s construction and 12s production timers; reload, export, invalid/valid import, confirmation/reset, surplus trade, and error recovery.
- Responsive inspection at 320, 390, 768, 1000 and 1440 pixels. The product, gather action and world are on the first 390px screen. Axe checks and the pinned taste@1 design probe are recorded in validation.

The browser connector was unavailable. The installed Chromium fallback performed the interaction checks. Its unmocked external API request returned `net::ERR_EMPTY_RESPONSE`, while curl successfully retrieved and validated live official data. Browser success scenarios use an explicitly intercepted, genuine observed response; they do **not** establish live browser connectivity. The production client still calls the real API directly and displays UNKNOWN on failure. WebKit was unavailable, so Safari remains unverified. Physical-device, screen-reader and native-browser zoom checks were not performed. No cloud save, wallet, multiplayer, token reward, mainnet integration or independently verified RPC attestation is provided.

The repeatable contributor browser check is `node scripts/browser-check.mjs` with the assigned Playwright runtime; it owns and closes a temporary local preview. `scripts/render-share.mjs` rasterizes the original SVG share artwork; the committed PNG is already included, so normal builds need no browser. No dependencies, caches or package archives are vendored. `.gitignore` has an explicit **1 KiB path budget**, excluding dependencies/caches at every nesting level while leaving `dist/` eligible for submission. No staging, commits, publishing or `.git/` edits are performed by this implementation.

## Source map

- `src/game.ts`: pure simulation, contracts, economy, timers, versioned saves.
- `src/integration/core.ts`: fail-closed public API client and deployment/schema validation.
- `src/World.tsx`, `src/PixelIcon.tsx`: original procedural pixel art and interactive plots.
- `src/App.tsx`, `src/style.css`: game controls, responsive UI and accessible dialogs.
- `tests/`: engine/integration tests and an explicitly historical real-response fixture.
- `DESIGN.md`: final implemented design system and component rules.
- `docs/design-guide-LICENSE.txt`: preserved notices for the supplied design guidance.
