# SQUEEK LOGISTICS design system

## Overview

This is a compact single-player game built around an isometric hamster industrial outpost. The world is the visual focus; controls sit beside the game state they change. Warm paper surfaces, forest-green text, timber-colored pixel art and a restrained rust-orange action color keep the interface legible without competing with the world.

The desktop composition is a navigation/progression rail, a central playable world/workbench and a persistent contract board. On phones the same functions become five explicit navigation views. The initial phone screen contains the product name, resources, gathering controls and the outpost itself. There is no marketing page or blocking welcome dialog.

## Colors

Canonical CSS values are in `src/style.css` under `:root`. Primitive values feed semantic tokens:

| Semantic token | Primitive / value | Role |
| --- | --- | --- |
| `--color-page` | `--cream-100` / `#f4f4ec` | Page and left rail |
| `--color-surface` | `--cream-50` / `#fffef8` | Header, resource bar, work panels, dialogs, contract board |
| `--color-subtle` | `--cream-200` / `#eceee3` | Quiet badges, quotes and hover surfaces |
| `--color-border` | `--sage-200` / `#dce2d5` | Structural separators |
| `--color-text` | `--forest-900` / `#293d32` | Body, headings, numbers |
| `--color-muted` | `--sage-600` / `#5f6e5c` | Supporting copy and metadata |
| `--color-accent` | `--orange-600` / `#b54b25` | Primary actions |
| `--color-accent-hover` | `--orange-700` / `#953c1c` | Primary hover |
| `--color-success` | `--forest-700` / `#356044` | Ready/earned feedback with labels/icons |
| `--color-danger` | `--red-700` / `#a1362d` | Errors, shortages and reset action |
| `--color-focus` | `#1a62b5` | 3px keyboard outline, offset 3px |

Additional implemented tones include `#f4e8d5` for the tutorial, `#c2cdbb` for control boundaries, `#dfe7d8` for selected navigation and `#dce4d4` for the map background. Art has its own material palette in `src/World.tsx`; it is not a source of UI status colors.

The taste@1 probe measured all resolved solid-background text pairs at or above 4.5:1, or 3:1 for large text. It excluded 17 text boxes over canvas/imagery; those were visually inspected but their exact composited contrast was not measured. There is one intentional light theme. Forced-colors styling preserves control boundaries and progress bars.

## Typography

- Main UI: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`; regular 400, semibold 600 and bold 700. These are system fonts, not downloaded assets.
- Wordmark only: `'Courier New', monospace`, bold. Prose does not use monospace.
- Used type sizes: 12px supporting labels, 14px body/buttons, 16px section titles and form inputs, 20px mobile page titles/desktop resource values/dialog titles, 24px desktop page title/large Core values. A 28px token is declared but unused.
- Body line height is 1.6; headings 1.25–1.4; compact labels 1.4–1.5. Main headings have modest negative tracking (−0.035em desktop, −0.03em mobile). The wordmark’s small line uses +0.03em.
- Resource counts and inventory counters use tabular numbers. Large numeric values wrap instead of clipping. Supporting messages use natural casing. Required UNKNOWN statuses and the header wordmark are intentional exceptions.
- The XP rail switches to “Maximum level” and a full progress bar at level 10. Storage shortages beside gathering point to surplus trade, dispatch or expansion.
- Inputs/selects remain 16px on phones. There are no text truncation/ellipsis rules hiding critical values.

## Layout

`src/style.css` uses the 4/8/12/16/20/24/28/32px spacing steps present in the implementation. The shell is at most 1800px wide and centers on larger displays. Most game sections use 16–24px padding and 16px internal gaps.

| Width rule | Implemented behavior |
| --- | --- |
| Above 1600px | 220px navigation, flexible game, 320px contract board; 32px game gutters |
| 1241–1600px | 204px navigation, flexible game, 300px board; 24px game gutters |
| Up to 1240px | Navigation moves above the two-column game/board. The workbench stacks. |
| Up to 900px | Single column; Contracts becomes an explicit navigation view and the desktop board hides elsewhere. Workbench may use two columns. |
| Up to 600px | Two rows of three resources, five icon/text nav buttons, 16px game gutters, stacked workbench/buildings, compact map pins, stacked Core stats. |
| Up to 350px | 12px gutters, simpler gather controls, tutorial portrait removed, wrapping build costs/actions. |

The map canvas is 500 × 310 logical pixels, scaled with `image-rendering: pixelated`. The containing map is 500:310 on desktop and 500:340 on phones; HTML plot controls remain at percentage coordinates above it. On phones only the selected plot shows its full label; every plot retains its accessible building name and level.

Observed layouts: 320, 390, 768, 1000 and 1440 CSS pixels across the game views; no horizontal document overflow. Maximum safe-integer local counters were also tested at 320, 390 and 1440. Native browser zoom, physical devices and an RTL mirror were not tested.

## Elevation & Depth

The interface uses flat tonal surfaces and structural borders. It has no decorative box shadows, gradients, glass or background texture layers. Depth is concentrated in the isometric art. Native dialogs use a dark translucent backdrop (`#1e322bb3`) and the browser’s top layer; underlying content becomes inert automatically. Map pins sit above the canvas with `z-index: 1`, and the selected pin uses `z-index: 2`. The skip link sits above normal content.

## Shapes

Panels and buttons generally use a 6px radius, map 7px, dialogs 10px, small badges/pins 4px. Progress tracks are 5px high with 3px rounded ends. The level medal uses a shield-shaped clip path; pixel art remains intentionally angular. Structural borders are 1px, while focus uses a distinct 3px perimeter.

Dense map pins are at least 30px; standard buttons are 40px desktop, 44px for key mobile contract actions, and gather buttons are 52–56px. Small utility controls remain at least 24px with separation. The probe reports 13 controls below the 44px comfort recommendation; all pass its 24px-or-spacing baseline.

## Components

| Component / pattern | Source | Use and behavior |
| --- | --- | --- |
| `World` | `src/World.tsx` | Deterministic original terrain, creek, rail, trees, hamsters and building art. Construction changes the rendered building; active shipments follow their timer. Native plot buttons select the workbench. |
| `PixelIcon` | `src/PixelIcon.tsx` | Original crisp-edge SVG resources, credits, hamster and crate. Decorative icons are hidden from the accessibility tree; adjacent text supplies meaning. |
| `.button` | `src/style.css` | `primary`, `secondary`, `quiet`, `danger`, `small`. Native disabled state prevents unavailable actions; costs/reasons appear nearby. |
| `Progress` | `src/App.tsx` | Bounded numeric progressbar with accessible label/value. Used for storage, timers, cargo readiness and XP. |
| `CostLine` | `src/App.tsx` | Resource icon, amount and screen-reader resource name. Shortages use danger color with explicit nearby recovery instructions. |
| `buildingPanel` | `src/App.tsx` | Build/upgrade cost, construction state, level gate, global gate, storage/fleet or timed recipes. Queue slots and reserved capacity determine availability. |
| Contract / dispatch | `src/App.tsx` | Local order, cargo readiness and base reward; Prepare opens a dialog with route/vehicle selectors and the exact trip quote. |
| `Modal` | `src/App.tsx` | Native `dialog.showModal()`, named heading, close button, Escape dismissal, focus restoration. Save reset/import require explicit confirmation. |
| Save controls | `src/App.tsx` | Device-local autosave, export/import, unsupported-file errors, memory-only recovery, typed reset confirmation. |
| `tradeBonus` | `src/App.tsx` | Saved three-type cargo mix with visible progress and a fixed reward. Reuses resource icons and standard status copy. |
| Genesis panel | `src/App.tsx`, `src/integration/core.ts` | Verified settled state or UNKNOWN. Source, check time, retry state and saved historical unlock evidence are separate. |

Primary interactions use a 120ms background/press transition and a scale of 0.96 only when reduced motion is not requested. Progress width transitions last 200ms. There is no page-load entrance animation or `transition: all`. Dynamic routine feedback uses a stable polite status region. Errors persist until dismissed/replaced by another action; save errors remain visible until recovery.

The app has meaningful empty queues/shipments, loading/unknown Core states, insufficient materials, locked content, full queues, storage limits, pending construction, in-transit/arrived cargo, invalid import and failed saving states. Their availability comes from the simulation, never from decorative placeholders.

## Do’s and Don’ts

- Start new game surfaces with `.section-top`, one heading and plain supporting text. Reuse cost lines, badges and progress rather than inventing more card types.
- Keep gathering and the active game visible before explanatory copy. Use one dominant action within a task; keep secondary choices quieter.
- Keep body copy in the system sans font and respect the existing five-size used scale. Use the pixel style in art and resource icons.
- Keep fictional economy values separate from chain data. A missing API response is UNKNOWN; a saved unlock is historical evidence, not a current read.
- Add routes through `ROUTES`, buildings through `BUILDING`, and simulation changes through the pure engine. Include costs, capacity, timer, save and failure-state coverage.
- Keep asset URLs relative and game assets local. Do not add wallet infrastructure, claimed monetary rewards, cloud saves or apparent live players to this single-player game.

## Guidance attribution

The implementation and review used the supplied Better Interface guide by Jakub Krehel (MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`) and its documentation method adapted from Paul Bakaus’s Impeccable (Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). Original notices/license texts are preserved in [`docs/design-guide-LICENSE.txt`](docs/design-guide-LICENSE.txt). The game’s artwork and mechanics were authored for this assignment.
