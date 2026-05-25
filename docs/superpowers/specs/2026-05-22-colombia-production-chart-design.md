# Colombia Production vs. Exports Chart — Design

**Status:** Draft for review
**Date:** 2026-05-22
**Tab affected:** Colombia opportunities (`/viz/coffee-trade/`)
**Author:** klapen + assistant

## Context

The coffee-trade viz currently shows international trade flows from UN Comtrade (HS 0901, years 2015–2023). UN Comtrade has a fundamental blind spot: it only captures cross-border trade, not domestic production. For Colombia — a near-pure-exporter of green coffee — the production-vs-exports gap is the most important domestic indicator (it reveals stocks, domestic consumption, and supply shocks like the 2008–2012 broca crisis or 2022 La Niña).

ICO production data is not publicly accessible. The Federación Nacional de Cafeteros (FNC) publishes monthly production and export statistics on [federaciondecafeteros.org/wp/estadisticas-cafeteras](https://federaciondecafeteros.org/wp/estadisticas-cafeteras/). Pulling Colombia-only data from FNC, plotted alongside the existing trade-map narrative, gives the Colombia tab the missing supply-side context it needs.

## Goal

Add a monthly line chart above the trade map, visible only on the Colombia tab, that plots:

- **Production** — FNC monthly Colombia coffee production (60kg bags)
- **Exports** — FNC monthly Colombia coffee exports (60kg bags)

The gap between the two lines tells the domestic-supply story. A translucent vertical band highlights the year currently selected on the trade slider, so the user sees how each trade-map snapshot maps onto the multi-year production trend.

## Non-goals (v1)

- Department-level production breakdown (Antioquia, Huila, etc.)
- Internal coffee price overlay (FNC carga reference)
- Variety split (Colombia is ~99% Arabica anyway)
- Click-to-pin tooltip behavior
- Backfill before 2015 (trade data starts 2015; keep windows aligned)

## User-facing behavior

1. User clicks the **Colombia** tab.
2. Production chart fades in above the trade map; lines animate from baseline to their values (~400ms).
3. Trade map below presets to `pinnedId='COL'`, `flow='exports'` (existing behavior).
4. The year slider on the trade map drives a translucent band on the production chart — moving the slider re-positions the band over the corresponding 12 months without redrawing the lines.
5. Hovering the production chart shows a vertical guide and a tooltip: month, production, exports, % exported.
6. Switching to any other tab hides the chart.
7. Switching EN/ES updates the title and tooltip labels.

## Data pipeline

### New: `scripts/coffee-trade/download_fnc.py`

Scrapes the FNC estadísticas cafeteras page for monthly production and exports XLSX files. Two sources:

- **Producción de café** — monthly production by year (60kg bags)
- **Exportaciones de café** — monthly exports by year (60kg bags)

Strategy: HTTP GET the FNC stats landing page, find the latest XLSX links by anchor text, download to `scripts/coffee-trade/data/raw/fnc/`. Cache by filename + URL so re-runs only fetch new files.

### New: `scripts/coffee-trade/transform_fnc.py`

Reads the two XLSX files, normalizes to long format using pandas/duckdb, joins production + exports on `(year, month)`, clips to `2015-01 .. 2023-12`. Writes a tidy parquet to `scripts/coffee-trade/data/processed/colombia_monthly.parquet`.

Schema:

| Column | Type | Notes |
|---|---|---|
| `year_month` | string `YYYY-MM` | sortable, ISO-like |
| `production_bags` | int | 60kg bags |
| `exports_bags` | int | 60kg bags |

### Edit: `scripts/coffee-trade/build_viz_data.py`

Add a `build_colombia_monthly()` step that reads the parquet and emits `viz/coffee-trade/data/colombia-monthly.json`:

```json
{
  "unit": "60kg bags",
  "months": ["2015-01", "2015-02", "...", "2023-12"],
  "production": [867432, 723511, "..."],
  "exports":    [712209, 658041, "..."],
  "annualTotals": {
    "2015": { "production": 14176000, "exports": 12716000 },
    "2016": { "production": 14634000, "exports": 12830000 },
    "...":  {}
  }
}
```

`annualTotals` is precomputed for tooltip rollups when the year band is hovered.

## Frontend

### Architecture overview

```
viz/coffee-trade/
├── index.html              (edit)
│   <section id="colombia-chart" hidden>...</section>
│
├── main.js                 (edit)
│   import { wireColombiaChart } from './modules/colombia-chart.js'
│   wireColombiaChart()
│
├── modules/
│   ├── colombia-chart.js   (NEW)
│   │   wireColombiaChart() — wires SVG line chart + state subs
│   │
│   ├── tabs.js             (edit)
│   │   toggle #colombia-chart hidden attribute per tab
│   │
│   ├── data-loader.js      (edit)
│   │   loadColombiaMonthly() — lazy-loaded on first Colombia tab activation
│   │
│   └── state.js            (no change)
│       existing pub/sub store
│
└── data/
    └── colombia-monthly.json (NEW, committed)
```

### Module: `colombia-chart.js`

Public surface:

```js
export function wireColombiaChart() { ... }
```

Internal structure:

1. **Lazy bootstrap.** On first call, attach a `ResizeObserver` to `#colombia-chart`. When the container reports a non-zero width for the first time (i.e., the Colombia tab has just become active), call `loadColombiaMonthly()` and render. This avoids any coupling to a `state.tab` key (which does not exist; `tabs.js` owns tab state in a closure variable).
2. **SVG layout.**
   - Container: `#colombia-chart` (full-width, ~200px tall desktop / ~160px mobile)
   - Margins: `{ top: 32, right: 16, bottom: 24, left: 48 }`
   - X scale: `d3.scaleTime`, domain `[Jan 2015, Dec 2023]`
   - Y scale: `d3.scaleLinear`, domain `[0, max(production)]` (production max ≥ exports max)
3. **Layers** (z-order, bottom to top):
   - Highlight band (`<rect>`, `fill-opacity: 0.08`, white)
   - X-axis ticks (yearly major, monthly minor)
   - Y-axis ticks (4 ticks, formatted as `Xm` for millions)
   - Exports line (`<path>`, dashed, `stroke: rgb(neutral-400)`)
   - Production line (`<path>`, solid, `stroke: var(--color-brand)`)
   - Hover guide (`<line>`, vertical, hidden by default)
   - Tooltip (HTML overlay, absolutely positioned)
4. **State subscriptions.**
   - `state.year` change → update only the highlight band `x` and `width`
   - `state.lang` change → swap title + tooltip labels
   - Container visibility is owned exclusively by `tabs.js` (see *Tab integration* below). The chart module never toggles its own `hidden` attribute.
5. **Resize handling.** `ResizeObserver` on the container; debounced (160ms) redraw via the same breakpoint-snap pattern used elsewhere in the viz.
6. **Hover behavior.** `<rect>` overlay covering the plot area captures `pointermove`; quantize cursor X to the nearest month; show the vertical guide and tooltip.

### Tab integration (`tabs.js`)

The existing `PRESETS` table already covers `colombia`. Extend `activate()` to additionally toggle the chart's visibility:

```js
const colombiaChart = document.getElementById('colombia-chart')
if (colombiaChart) colombiaChart.hidden = name !== 'colombia'
```

This single-line addition is the only change to `tabs.js`.

### Data loader (`data-loader.js`)

Add a memoized loader:

```js
let colombiaMonthlyPromise = null
export function loadColombiaMonthly() {
  if (!colombiaMonthlyPromise) {
    colombiaMonthlyPromise = fetch('./data/colombia-monthly.json').then(r => r.json())
  }
  return colombiaMonthlyPromise
}
```

## Visual design

```
┌──────────────────────────────────────────────────────────┐
│ Tabs ▸ Hallazgos | Últimos 2 | [Colombia] | Corridors    │
├──────────────────────────────────────────────────────────┤
│  Producción vs. Exportaciones — Colombia (2015–2023)     │
│                                                          │
│  bags (M)                                                │
│  14M ┤                  ╭──╮       ░░░                   │  ← prod (brand)
│  12M ┤    ╭──╮    ╭────╯  ╰─╮     ░░░                    │
│  10M ┤────╯  ╰────╯         ╰─────░░░───                 │
│   8M ┤- - - - - - - - - - - - - - ░░░- - -               │  ← exports (dashed)
│   6M ┤                            ░░░                    │
│      └─────────────────────────────────────              │
│       '15  '16  '17  '18  '19  '20  '21  '22  '23        │
│                                  ↑ selected year         │
└──────────────────────────────────────────────────────────┘
```

- **Title**: bilingual via `data-en` / `data-es` attributes (same i18n pattern as existing UI)
- **Height**: 200px desktop, 160px mobile (responsive via container, not viewport)
- **Palette**:
  - Production line: `var(--color-brand)` (existing Tailwind theme token)
  - Exports line: `text-neutral-400` equivalent, dashed (`stroke-dasharray: 4 4`)
  - Highlight band: white at `opacity: 0.08`
  - Tooltip: same dark surface as existing chart tooltip
- **Typography**: `tabular-nums` on numbers; system font stack (no new web fonts)

## State store

No new keys added to the frozen state store. The chart only *reads* `state.year`, `state.lang`, and `state.tab` — all of which already exist.

## i18n

Strings to be added to `index.html` (both EN/ES variants):

| Key | EN | ES |
|---|---|---|
| Section title | `Production vs. Exports — Colombia (2015–2023)` | `Producción vs. Exportaciones — Colombia (2015–2023)` |
| Y-axis legend | `60kg bags` | `Sacos de 60kg` |
| Production label | `Production` | `Producción` |
| Exports label | `Exports` | `Exportaciones` |
| Tooltip: % exported | `Exported: {n}%` | `Exportado: {n}%` |

## Performance budget

- Data payload: ~108 months × 2 series ≈ 4kB JSON gzipped → negligible
- SVG nodes: ~250 (axis ticks + 2 paths + band + hover layers) → negligible
- Year-band updates: only `x` and `width` attributes mutate; no path re-binding
- First paint on Colombia tab: load JSON (likely already cached after first visit) + render ≈ <50ms on a mid-range device

## Risks

| Risk | Mitigation |
|---|---|
| FNC changes XLSX layout | Scraper parses by sheet/column position; if it breaks, fail loudly with a clear message. Pinning the parser to current layout is acceptable since this is a manual refresh cycle. |
| FNC monthly data has revision lag | Acceptable; we publish on commit cadence, not real-time. |
| 2024 data partial | `transform_fnc.py` clips to `2023-12`. |
| Year band misaligns with slider | Single source of truth: `state.year`. Both chart and slider read from it. No drift possible. |
| Tab switch flicker | Container starts `hidden`; chart only renders after layout settles via ResizeObserver. |

## Files changed

| File | Change |
|---|---|
| `viz/coffee-trade/index.html` | Add `<section id="colombia-chart" hidden>` between tabs and grid |
| `viz/coffee-trade/main.js` | Call `wireColombiaChart()` |
| `viz/coffee-trade/modules/tabs.js` | Toggle `#colombia-chart` `hidden` |
| `viz/coffee-trade/modules/data-loader.js` | Add `loadColombiaMonthly()` |
| `viz/coffee-trade/modules/colombia-chart.js` | NEW — chart module |
| `viz/coffee-trade/data/colombia-monthly.json` | NEW — committed dataset |
| `scripts/coffee-trade/download_fnc.py` | NEW — FNC scraper |
| `scripts/coffee-trade/transform_fnc.py` | NEW — FNC normalizer |
| `scripts/coffee-trade/build_viz_data.py` | Add `build_colombia_monthly()` step |

## Open questions resolved

- **Granularity**: National total (no department split).
- **Layout position**: Full-width above the trade map.
- **Resolution**: Monthly, 2015–2023.
- **Slider sync**: Full range visible; selected year highlighted via translucent band.
- **Data source**: FNC for *both* production AND exports (apples-to-apples monthly).
- **Acquisition**: Python scraper in `scripts/coffee-trade/`, same pipeline shape as `download_comtrade.py`.

## Next step

Hand to `writing-plans` skill to produce a step-by-step implementation plan.
