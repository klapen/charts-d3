# Coffee Trade Visualization — Design

**Date:** 2026-05-15
**Source spec:** `new-d3force-graph.md` (heavily scoped down — see "Scope" below)
**Target:** new gallery entry at `viz/coffee-trade/`, deployed alongside the rest of klapen.com.co.

---

## 1. Goal

A new entry in the charts-d3 gallery: an animated, force-directed D3 visualization of global coffee trade flows between countries, 2015–2023. Particles move along trade links from exporter to importer. The viewer can scrub a year slider, toggle between green and roasted coffee, hover countries and flows for detail, and switch between a curated top-N view and a full ~150-country view.

The viz is a standalone static page — no backend, no runtime API — matching how every other entry in this gallery is built.

## 2. Scope decisions

The source spec describes a full production platform (FastAPI backend, DuckDB pipelines built to scale to tens of millions of rows, multiple visualization modes). It also contradicts itself on whether there's a backend. We scoped this down to a single gallery viz with a one-shot Python pipeline.

**In scope:**
- Python pipeline that fetches Comtrade + ICO data, transforms via DuckDB, and emits pre-baked JSON files into `viz/coffee-trade/data/`.
- D3 v7 force-directed graph with year slider, play/pause, coffee-type toggle, tier toggle (top flows / all countries), hover and click interactions.
- Two renderers: SVG for the curated top tier, Canvas for the full tier.
- Particle animation along links via a dedicated Canvas overlay.
- Responsive sizing via breakpoint-driven re-layout (see §6).
- EN/ES i18n consistent with the existing gallery.
- Two READMEs (operator-facing + viz-page) and one landing-page card.

**Explicitly out of scope:**
- FastAPI backend or any runtime API.
- DuckDB-WASM in the browser.
- Sankey, globe, deck.gl, shipping-routes overlays, climate overlays.
- Automated tests (see [[feedback-no-tests]] — this gallery does not test viz code or ETL scripts).
- "Tens of millions of rows" pipeline engineering — the actual dataset is ~5–50 K rows.

## 3. Architecture

```
charts-d3/
├── scripts/coffee-trade/         # Python ETL — never deployed
│   ├── pyproject.toml            # uv: httpx, pandas, duckdb, pyarrow
│   ├── download_comtrade.py      # Resumable, rate-limited Comtrade fetcher
│   ├── download_ico.py           # ICO public-CSV fetcher
│   ├── transform.py              # DuckDB-driven: dedupe, ISO normalization
│   ├── build_viz_data.py         # parquet → viz JSON files
│   ├── data/raw/                 # Comtrade JSON + ICO CSV dumps (gitignored)
│   ├── data/processed/           # Intermediate parquet (gitignored)
│   └── data/reference/           # ISO 3166 + country lat/lon (committed)
│
└── viz/coffee-trade/             # Ships to klapen.com.co/viz/coffee-trade/
    ├── index.html
    ├── main.js                   # Entry — wires modules, owns state
    ├── style.css                 # Cyberpunk-ish dark palette
    ├── modules/
    │   ├── data-loader.js        # fetch meta, lazy-load year files, cache
    │   ├── state.js              # current {year, type, tier}; pub/sub
    │   ├── force-sim.js          # d3-force setup, tick handler
    │   ├── renderer-svg.js       # SVG path for top tier
    │   ├── renderer-canvas.js    # Canvas path for full tier
    │   ├── particles.js          # rAF loop, particle pool
    │   ├── controls.js           # slider, play, toggles
    │   ├── tooltip.js            # hover + focus interactions
    │   └── scales.js             # radius, link width, color
    └── data/
        ├── meta.json             # Years, country lookup, version
        ├── 2015-all.json
        ├── 2015-green.json
        ├── 2015-roasted.json
        └── … (one trio per year)
```

The contract between the two trees is the JSON schema in `viz/coffee-trade/data/`. The viz has no awareness of where the data came from; the pipeline has no awareness of how the viz consumes it beyond honoring the schema.

## 4. Data shape

### `meta.json` (loaded once on page open)

```json
{
  "version": "2026-05-15",
  "years": [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
  "countries": {
    "BRA": { "name": "Brazil",   "lat": -14.2, "lon": -51.9, "region": "South America" },
    "COL": { "name": "Colombia", "lat":   4.6, "lon": -74.1, "region": "South America" }
  }
}
```

### Per-year file, e.g. `2020-all.json`

```json
{
  "year": 2020,
  "type": "all",
  "nodes": [
    { "id": "BRA", "exports_usd": 4910000000, "imports_usd":  18000000 },
    { "id": "USA", "exports_usd":   62000000, "imports_usd": 5900000000 }
  ],
  "edges": [
    { "source": "BRA", "target": "USA", "value_usd": 1240000000, "quantity_kg": 580000000 }
  ],
  "tier": {
    "top":  { "node_ids": ["BRA","COL","VNM"], "edge_indices": [0,1,2] },
    "full": { "node_ids": ["..."],             "edge_indices": [] }
  }
}
```

Notes:
- Country metadata (name, lat/lon, region) lives only in `meta.json` — never duplicated per year.
- The `tier` selector is precomputed index lists. Switching tiers is in-memory, never a refetch.
- Edge `source`/`target` use ISO3 IDs — the form `d3-force`'s `forceLink` expects.

Three per-year files for each year: `{year}-all.json`, `{year}-green.json`, `{year}-roasted.json`. Lazy-loaded on demand and cached in memory after first fetch.

## 5. Python pipeline

### `download_comtrade.py`
- Uses `httpx` (modern HTTP, clean retries and timeouts).
- Iterates `(year, reporter_country)` pairs for HS codes 090111, 090112, 090121, 090122.
- **Reporter list:** queries Comtrade's `getReporters` endpoint once per run, takes every country marked as a current reporter, iterates against that list. The reporter list is cached in `data/raw/reporters.json` between runs.
- **Resumable:** skips `raw/comtrade/{year}/{reporter}.json` if it already exists.
- **Rate-limited:** `asyncio.Semaphore(1)` + 1-second sleep — respects Comtrade free-tier limits.
- **Retries:** exponential backoff on 5xx/429, max 5 tries. Permanent failures log to `failures.csv` and the run continues.
- Top of file carries a comment: `# Manual, ~yearly job. See README.md before running.`

### `download_ico.py`
- Plain HTTP GET against ICO's published annual CSV indicators (exports by country, imports by country, re-exports).
- No rate limiting needed — these are static files.

### `transform.py`
- Pure DuckDB SQL. Reads raw JSONs via `read_json_auto`, CSVs via `read_csv_auto`.
- Normalizes country names → ISO3 via `data/reference/iso_3166.csv`.
- Deduplicates: Comtrade wins for pairs it covers; ICO fills gaps.
- Aggregates partner-reported flows (importer report when available, exporter report otherwise — per Comtrade guidance).
- Outputs: `processed/flows.parquet`, `processed/nodes.parquet`.

### `build_viz_data.py`
- Reads the parquet files, emits one trio of JSON files per year plus `meta.json`.
- Computes the three coffee-type splits: `all`, `green` (090111+090112), `roasted` (090121+090122).
- Computes the `top` tier: rank by node total exports+imports, take top ~30 countries, keep edges *between* those countries, cap at ~100 edges.
- The **only** committed pipeline output is `viz/coffee-trade/data/*`. Raw downloads and intermediate parquet are gitignored.

### Refresh cadence (also documented in `scripts/coffee-trade/README.md`)

| Source | Publisher cadence | Practical lag | Refresh recommendation |
|---|---|---|---|
| UN Comtrade | Monthly submissions; annual data settles ~Q2 of Y+1 | 6–12 months | Re-run once a year around **June** |
| ICO | Monthly bulletin + annual reports | 3–6 months | Same yearly cadence; ICO is the cross-check |

Re-running mid-year wastes API quota — Comtrade's current-year numbers stay partial until ~Q2 of the following year. To refresh a single year, delete `raw/comtrade/{year}/` and re-run; everything else is skipped.

## 6. Frontend — viz module

### State (owned by `main.js`)

```js
{ year: 2020, type: "all", tier: "top", playing: false, hoveredId: null }
```

A 30-line pub/sub in `state.js` (`setState(patch)` / `subscribe(fn)`). Each module subscribes to the slice it cares about. No framework.

### Data flow

```
page load
  └─ load meta.json (once)
     └─ paint empty chart + controls
        └─ load 2020-all.json (default year/type)
           └─ build sim, render top tier, start particle loop
```

- **Year change:** debounced fetch of new year file (cache hit if visited) → ease node radii / link widths over ~600 ms → `simulation.alpha(0.3).restart()` → particles redraw against new edges.
- **Type change (all/green/roasted):** same as year change, different file.
- **Tier change (top ↔ full):** no fetch (already in the loaded file) → swap renderer → restart sim with the new node/edge set.

### Force simulation

```js
d3.forceSimulation(nodes)
  .force("link",    d3.forceLink(edges).id(d => d.id)
                       .distance(d => 80 + 200 / Math.sqrt(d.weight)))
  .force("charge",  d3.forceManyBody().strength(-300))
  .force("center",  d3.forceCenter(w / 2, h / 2))
  .force("collide", d3.forceCollide().radius(d => d.radius + 4))
```

Charge negative (repel). Link distance inversely proportional to flow magnitude (stronger trade pulls countries closer). `alphaTarget` stays at ~0.01 to keep a quiet always-on drift — the "cinematic" feel.

### Particle animation

A pool of particles (~3 per edge in top tier, ~1 per edge in full tier) drawn on a dedicated Canvas overlay even in SVG mode (one DOM node per particle × hundreds at 60 fps would choke SVG). Each particle has `{ edgeIndex, t }`; `t` ∈ [0, 1) advances proportional to edge weight, wraps to 0 — constant motion, no spawning logic. Position interpolated along the link's current source/target positions every frame so particles follow nodes the sim is still moving.

### Renderers

- **`renderer-svg.js`** (top tier): one `<g>` per layer (links / nodes / labels); `.data(..., d => d.id).join(...)` for clean enter/update/exit transitions on year change; SVG-native hover.
- **`renderer-canvas.js`** (full tier): one canvas for static layer (nodes + links), redrawn every tick; hover via `d3-quadtree` spatial index; labels only on top ~15 nodes.

Both renderers share `scales.js`. The mode switch tears down one and stands up the other; the sim and particles are unaffected.

### Interactions

- **Hover node:** highlight node, fade unrelated edges to ~10% opacity, edges touching the node stay opaque, tooltip shows country + total exports + total imports.
- **Hover edge:** fade everything else, tooltip shows `{Exporter → Importer: $X · Y kg}`.
- **Click node:** pin highlight; click empty space to unpin.
- **Year slider:** live update while dragging, debounced 80 ms.
- **Play button:** advances year by 1 every 1.2 s, loops; pause replaces it while playing. The 600 ms year-transition runs during the first half of each tick; the second half holds the new state so the eye can register it before the next transition starts.
- **Spacebar:** play/pause shortcut. **Esc:** unpin.

### Responsive sizing — breakpoint-driven

Per [[feedback-responsive-sizing]]: bucket the container width to discrete breakpoints, recompute layout only at threshold crossings. Between thresholds the SVG + Canvas scale via CSS + viewBox at zero JS cost.

| Name | Container width ≥ | Canonical `(w, h)` |
|------|------------------:|---------------------|
| `xs` | 360 px | 480 × 420 |
| `sm` | 600 px | 720 × 480 |
| `md` | 900 px | 1080 × 660 |
| `lg` | 1200 px | 1280 × 720 |

Aligns with the landing page's Tailwind sm/md/lg thresholds.

```js
const BREAKPOINTS = [
  { name: 'lg', minWidth: 1200, w: 1280, h: 720 },
  { name: 'md', minWidth:  900, w: 1080, h: 660 },
  { name: 'sm', minWidth:  600, w:  720, h: 480 },
  { name: 'xs', minWidth:    0, w:  480, h: 420 },
]

const ro = new ResizeObserver(debounce(() => {
  const next = BREAKPOINTS.find(bp => container.clientWidth >= bp.minWidth)
  if (next.name === current.name) return       // segment jump only
  current = next
  rebuildLayout(next)
  simulation.alpha(0.3).restart()
}, 150))
ro.observe(container)
```

At a breakpoint crossing: SVG `viewBox` updates; Canvas backing buffer resizes (`canvas.width = bp.w * dpr; canvas.height = bp.h * dpr; ctx.scale(dpr, dpr)`); scales and `forceCenter` rebuild; simulation soft-restarts with `alpha(0.3)`.

Between breakpoints: SVG scales fluidly via viewBox; Canvas scales via CSS. The Canvas backing buffer becomes slightly mis-matched (e.g. drawing at 1080-px buffer onto a 1150-px display), causing minor blur — accepted trade-off for zero layout cost on small drags.

**Mobile sanity:** at `xs` the tier toggle locks to **Top flows** and hides the full-tier switch (Canvas rendering of 150 nodes in a 360-px frame is unreadable). Controls strip wraps to two rows at `xs`/`sm`.

## 7. Visual style

**Palette (dark, native to gallery):**
- Background: `#0a0a0b`.
- Nodes colored by **region** (5 hues, desaturated): South America `#ff7a59`, Africa `#f5c451`, Asia `#5ac6c0`, Europe `#9b8cff`, North America `#ff6ec7`, fallback `#8b8b95`.
- Links: source country's color at ~0.18 opacity.
- Particles: brighter lift of the same source color, opacity ~0.7.
- Labels: light gray `#d4d4d8`, hovered/pinned → white.
- Selection/hover: unrelated elements drop to 0.08 opacity (no new colors, just contrast).

**Typography:** system UI stack; tabular numerals in tooltips. Sizes 11/12/13 px.

**Layout:** header (title + one-line subtitle + data source line, ~80 px) → viz frame (full remaining viewport, max 720 px high × 1200 px wide centered) → controls strip (play · slider · type toggle, with tier toggle as smaller secondary control beneath) → region legend (clickable to filter).

**Motion principles:**
- Always-on subtle drift (`alphaTarget ≈ 0.01`).
- Year transitions ease 600 ms with `d3.easeCubicInOut`.
- Particle speed scales with flow magnitude.
- Hover dim 120 ms ease-out (highlights instant, de-emphasis slightly slower).

**Accessibility:**
- Color is not the only channel — region also encoded in the legend; tooltips carry exact numbers and country names.
- Slider is a real `<input type="range">` (keyboard arrows work).
- `prefers-reduced-motion: reduce` disables particles and freezes the drift; graph remains usable as static snapshot.
- Tooltips `aria-live="polite"`; focus rings match gallery's `focus:ring-brand`.

**Internationalization:** EN/ES via `data-en` / `data-es` attributes, propagated by the gallery's localStorage-backed lang state.

## 8. Verification

Per [[feedback-no-tests]] — no automated tests for viz code or ETL scripts.

- **Python pipeline:** after a run, eyeball `meta.json` and a couple of year files. Numbers should look sane (Brazil tops exports, USA tops imports, totals match ICO bulletin order of magnitude). If they don't, fix the script.
- **Frontend:** `npm run dev`, open the viz, manually verify slider scrubs, play loops, hover dims, tier swap works, type toggle reloads, lang persists, and the four breakpoint sizes (resize through 360 / 600 / 900 / 1200) all rebuild correctly.

One runtime guard (not a test): `console.assert(data.year && Array.isArray(data.nodes) && Array.isArray(data.edges))` after each fetch, so a bad Python output surfaces as a console error rather than a silent layout failure.

## 9. Documentation

Two READMEs and one landing-page card.

### `scripts/coffee-trade/README.md` (operator-facing)

Run order, refresh cadence table, instructions for adding a year and refreshing a single year.

### `viz/coffee-trade/README.md` (gallery-style, brief)

What it shows, data sources, dev command.

### Top-level `README.md`

Add one line under the Layout tree pointing to `scripts/coffee-trade/`.

### Landing page (`index.html`)

Add one card linking to `/viz/coffee-trade/` with `data-tags="economics,maps"` and a placeholder image until a screenshot is grabbed.

## 10. Things intentionally left out

- **FastAPI backend or runtime API** — every other viz in this gallery is static; we match that pattern.
- **DuckDB-WASM** — ships 5+ MB of WASM for browser-side queries we don't need at this data scale.
- **Sankey / globe / deck.gl / overlays** — listed in the source spec under "extra ideas"; out of scope for the initial build.
- **Tens-of-millions-of-rows engineering** — dataset is ~5–50 K rows; DuckDB handles it instantly, no partitioning or sharding.
- **Incremental refresh tooling beyond the resumable raw-fetch step** — manual yearly refresh is sufficient.
- **Automated test suites** — see [[feedback-no-tests]].
