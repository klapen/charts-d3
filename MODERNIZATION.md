# Modernization plan

Strategic plan for porting the 16 visualizations from D3 v3 / C3 / Leaflet 0.7 to a modern stack. Drafted 2026-05-05.

## Framing

Most viz are **D3 v3 (2014)** with **C3 (dead — last release 2019)** and **Leaflet 0.7 (2014)**. None are unsafe — they're static code that still runs — but the libraries are abandoned, the API style is dated, and a few features (like sync XHR) are being phased out by browsers.

**Honest take:** porting all 16 is ~50–80 hours of work. The right move is **selective modernization** — pick 3–5 showcase pieces, port those properly, and treat the rest as a frozen archive. That's how mature portfolios stay alive without becoming a maintenance treadmill.

## Tooling targets

| For… | Use… | Why |
|---|---|---|
| Standard charts (bar, line, area, scatter, hist, heatmap, pyramid) | **Observable Plot v0.6+** | ~10× less code than raw D3. Declarative. Made by the D3 team. |
| Custom interactive charts (force, treemap, sankey, custom maps) | **D3 v7** | Plot can't express these; raw D3 is still the right tool. |
| Multi-chart dashboards (replacing C3) | **Apache ECharts 5** | Closest API to C3, actively maintained, bigger feature set. |
| Maps | **Leaflet 1.9** (simple) or **MapLibre GL** (vector tiles) | Leaflet 1.9 has the same API as 0.7 but actually maintained. |
| Build | Keep Vite | Already in place. |

## Per-viz triage

| # | Viz | LOC | Type | Recommend | Effort |
|---|---|---:|---|---|:---:|
| 1 | **choco** | 1127 | Dashboard (Leaflet+C3+radar) | Leaflet 1.9 + **ECharts** | ~6h |
| 2 | **conceptual-map** | 161 | Force-directed network | **D3 v7 port** | ~3h |
| 3 | **zoom-treemap** | 107 | Zoomable hierarchy | **D3 v7 port** | ~2h |
| 4 | **zoom-aggr-treemap** | 208 | Same with aggregation | **D3 v7 port** | ~3h |
| 5 | **map-and-horizontal-bars** | 294 | Linked map + bars | Leaflet 1.9 + **Plot** | ~3h |
| 6 | **population-pyramid** | 288 | Standard pyramid | **Plot** (massive simplification) | ~2h |
| 7 | **circular-bar-chart** | 147 | Radial bars | **D3 v7** (Plot can't do this well) | ~2h |
| 8 | **temp** | 368 | Map + C3 + time series | Leaflet 1.9 + **Plot** | ~4h |
| 9 | **labour** | 84 | C3 indicators | **Plot** | ~1.5h |
| 10 | **ipc** | 342 | Economic chart | **Plot** | ~3h |
| 11 | **presupuesto** | 401 | Budget breakdown | **Plot** + maybe D3 for treemap part | ~4h |
| 12 | **copa-america** | 130 | Match calendar 2016 | Archive — data is frozen | — |
| 13 | **futbol** | 147 | Match-day | Archive — niche, data frozen | — |
| 14 | **goals** | 294 | Scoring patterns | Archive — same | — |
| 15 | **focaldata** | 160 | Survey viz | Archive — niche | — |
| 16 | **d3-charts gallery** | huge | 15 chart-type demos | Port 3 best as Plot examples; archive rest | ~6h |

## Tier 1 — showcase (~16h total)

Do these first — they're the "this is what I can build" portfolio pieces:

1. **choco** — most ambitious dashboard. Leaflet 1.9 (Chocó department GeoJSON, simplified with mapshaper to ~200 KB), ECharts for the C3 panels, optional D3 v7 for the radar.
2. **conceptual-map** — `d3.forceSimulation` is gorgeous in v7. Code shrinks ~30%.
3. **zoom-treemap** — `d3.treemap` + `d3.zoom` in v7 is night-and-day cleaner than the v3 + d3.layout.js it currently uses.
4. **population-pyramid** — best Plot demo. ~290 LOC → ~50 LOC.

## Tier 2 — only if Tier 1 went well (~10h total)

5. **map-and-horizontal-bars**, **labour**, **ipc**, **presupuesto** — useful Spanish-language data viz.

## Archive — frozen, still works

`copa-america`, `futbol`, `goals`, `focaldata` — data is dated (2016 sports, niche surveys). Add a small "Archive 2014–2016" badge on the cards and stop touching them. They keep working as static D3 v3 + their CDN libs.

## Process per viz

For each modernization:

1. Create `src/public/viz/<name>-next/` (don't touch the original — keep as fallback).
2. Build with Vite ES modules: `import * as d3 from "d3"` and/or `import * as Plot from "@observablehq/plot"`. Real npm deps, no more `<script>` tags for these.
3. Reuse the existing `data/` files verbatim — only the viz code changes.
4. When the new version works, swap card link, delete the old folder.
5. Commit per viz. Easy to revert.

Each port is a self-contained PR-sized chunk — perfect for a "weekend project" cadence.

## Concrete first port

Pick **one**. Recommended:

- **`population-pyramid` → Plot** — fastest win, best "before/after" demo of why Plot is worth it. ~2h.
- **`zoom-treemap` → D3 v7** — most fun port, biggest visual payoff, code shrinks ~50%.

## Open questions

- Which viz to port first (or commit to "Tier 1 in order").
- Confirm tooling: D3 v7 + Observable Plot + ECharts (or pushback on any of those).
- Keep Leaflet (simple) or move to MapLibre (more modern)?
