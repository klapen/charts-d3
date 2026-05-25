# Colombia Production vs. Exports Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a monthly production-vs-exports line chart above the trade map on the Colombia tab of `viz/coffee-trade/`, sourcing data from Federación Nacional de Cafeteros (FNC).

**Architecture:** Two-layer feature. **ETL layer**: a Python scraper + transform extends the existing `scripts/coffee-trade/` pipeline to emit a single `viz/coffee-trade/data/colombia-monthly.json`. **Frontend layer**: a new D3 SVG module (`modules/colombia-chart.js`) renders the chart, subscribes to `state.year` for a translucent year-band that tracks the existing trade slider, and is shown/hidden by `tabs.js` based on the active tab.

**Tech Stack:** Python 3.12 + uv + pandas + openpyxl + duckdb + pyarrow (ETL). D3 v7 + Tailwind v4 + vanilla ES modules + Vite (frontend). Per `feedback_no_tests` memory: **no test suites** — verify by running the script / dev server and inspecting output.

**Constraints:**
- Per `feedback_responsive_sizing` memory: chart must size to container via `ResizeObserver`. Never hardcode dimensions.
- Don't touch root-level `README.md` or `package.json`.
- Stage commits with specific paths — never `git add -A` or `git add .`.

---

## File Structure

```
scripts/coffee-trade/
├── pyproject.toml                              EDIT  add openpyxl dep
├── download_fnc.py                             NEW   scrape FNC XLSX
├── transform_fnc.py                            NEW   XLSX → parquet
├── build_viz_data.py                           EDIT  add build_colombia_monthly()
└── data/
    ├── raw/fnc/                                NEW   (gitignored cache dir)
    │   ├── produccion.xlsx
    │   └── exportaciones.xlsx
    └── processed/
        └── colombia_monthly.parquet            NEW   (gitignored intermediate)

viz/coffee-trade/
├── index.html                                  EDIT  add <section id="colombia-chart">
├── main.js                                     EDIT  wireColombiaChart()
├── data/
│   └── colombia-monthly.json                   NEW   committed dataset
└── modules/
    ├── colombia-chart.js                       NEW   SVG chart module
    ├── tabs.js                                 EDIT  toggle chart visibility
    └── data-loader.js                          EDIT  loadColombiaMonthly()
```

Each `colombia-chart.js` function has a single responsibility (data load, render, year-band update, hover, language swap) so the file stays under ~250 lines.

---

## Milestone A — Data pipeline

### Task 1: Add openpyxl dependency and pin FNC URLs

**Files:**
- Modify: `scripts/coffee-trade/pyproject.toml`

- [ ] **Step 1: Discover FNC XLSX URLs**

Open https://federaciondecafeteros.org/wp/estadisticas-cafeteras/ in a browser. Find the two relevant downloads:

1. **"Producción de café de Colombia"** — monthly production by year
2. **"Exportaciones de café de Colombia"** — monthly exports by year

Right-click each, copy the XLSX URL. Record both in a scratch note for use in Task 2. They typically look like `https://federaciondecafeteros.org/wp/wp-content/uploads/produccion_YYYY.xlsx` but verify by hand — the FNC site does not have a stable URL contract.

- [ ] **Step 2: Add openpyxl to pyproject.toml**

```toml
dependencies = [
    "httpx>=0.27",
    "duckdb>=1.0",
    "pyarrow>=16",
    "pandas>=2.2",
    "openpyxl>=3.1",
]
```

- [ ] **Step 3: Sync deps**

```bash
cd scripts/coffee-trade && uv sync
```

Expected: openpyxl appears in the lockfile diff.

- [ ] **Step 4: Add raw/fnc to gitignore**

Append to `scripts/coffee-trade/.gitignore` (create if missing):

```
data/raw/fnc/
data/processed/colombia_monthly.parquet
```

- [ ] **Step 5: Commit**

```bash
git add scripts/coffee-trade/pyproject.toml scripts/coffee-trade/uv.lock scripts/coffee-trade/.gitignore
git commit -m "Coffee trade: pin openpyxl for FNC XLSX parsing"
```

---

### Task 2: FNC download script

**Files:**
- Create: `scripts/coffee-trade/download_fnc.py`

- [ ] **Step 1: Create the download script**

```python
"""Download FNC monthly production and exports XLSX files.

Run: uv run python download_fnc.py
Output:
  data/raw/fnc/produccion.xlsx
  data/raw/fnc/exportaciones.xlsx

Skips files that already exist on disk. Delete them locally to force a refresh.
"""
from __future__ import annotations
import logging
import sys
from pathlib import Path
import httpx

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "data" / "raw" / "fnc"

# URLs discovered in Task 1. Update both whenever FNC publishes a new version.
SOURCES = {
    "produccion.xlsx":     "<PASTE PRODUCCION XLSX URL HERE>",
    "exportaciones.xlsx":  "<PASTE EXPORTACIONES XLSX URL HERE>",
}

log = logging.getLogger("fnc_download")


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        log.info("skip (exists): %s", dest.name)
        return
    log.info("downloading: %s", url)
    with httpx.stream("GET", url, follow_redirects=True, timeout=60) as r:
        r.raise_for_status()
        dest.write_bytes(r.read())
    log.info("wrote %d bytes -> %s", dest.stat().st_size, dest)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        if url.startswith("<PASTE"):
            log.error("URL for %s not set — update SOURCES in this file", name)
            return 1
        fetch(url, RAW_DIR / name)
    log.info("Done. Files in %s", RAW_DIR)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Paste the URLs discovered in Task 1**

Replace the two `<PASTE ... HERE>` strings with the actual FNC URLs.

- [ ] **Step 3: Run the script**

```bash
cd scripts/coffee-trade && uv run python download_fnc.py
```

Expected: two files in `data/raw/fnc/`, sizes >50KB each. Re-running should print `skip (exists)` for both.

- [ ] **Step 4: Inspect the downloaded files**

```bash
ls -lh scripts/coffee-trade/data/raw/fnc/
file scripts/coffee-trade/data/raw/fnc/*.xlsx
```

Expected: both files identified as `Microsoft OOXML` / `Excel`. If `file` reports HTML, the URL is wrong (FNC returned the landing page).

- [ ] **Step 5: Commit the script**

```bash
git add scripts/coffee-trade/download_fnc.py
git commit -m "Coffee trade: add FNC XLSX downloader"
```

---

### Task 3: FNC transform script

**Files:**
- Create: `scripts/coffee-trade/transform_fnc.py`

- [ ] **Step 1: Manually inspect XLSX layout**

Open both `produccion.xlsx` and `exportaciones.xlsx` in a spreadsheet app. Note for each:

- Which sheet name has the monthly time series
- Which row contains the column headers
- Whether years are rows or columns
- The unit (should be 60kg bags, but confirm — FNC sometimes uses thousand-bag rounding)

Write findings as comments at the top of `transform_fnc.py`.

- [ ] **Step 2: Create the transform script**

```python
"""Normalize FNC XLSX files into a long-format parquet.

Run: uv run python transform_fnc.py
Input:
  data/raw/fnc/produccion.xlsx
  data/raw/fnc/exportaciones.xlsx
Output:
  data/processed/colombia_monthly.parquet

Schema: year_month (str YYYY-MM) | production_bags (int) | exports_bags (int)
Clipped to 2015-01 .. 2023-12.
"""
from __future__ import annotations
import logging
import sys
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).parent
RAW_DIR = ROOT / "data" / "raw" / "fnc"
PROCESSED = ROOT / "data" / "processed"

START = "2015-01"
END = "2023-12"

log = logging.getLogger("fnc_transform")


def load_long(xlsx_path: Path, value_col: str) -> pd.DataFrame:
    """Read an FNC XLSX into long format with columns: year_month, {value_col}.

    NOTE: sheet name, header row, and column layout discovered in Task 3 Step 1.
    Update the read_excel call to match the actual file layout.
    """
    raw = pd.read_excel(
        xlsx_path,
        sheet_name=0,         # update if not the first sheet
        header=0,             # update if header row is different
        engine="openpyxl",
    )
    # Reshape: depending on layout, you may need raw.melt(...) here.
    # Target: a 2-column DataFrame: year_month (str), value (int).
    # Example if FNC layout is rows=year, cols=Jan..Dec:
    #
    #   long = raw.melt(id_vars="Año", var_name="month", value_name=value_col)
    #   long["year_month"] = long["Año"].astype(int).astype(str) + "-" + \
    #       long["month"].map(SPANISH_MONTH_TO_NUM).astype(str).str.zfill(2)
    #   long = long[["year_month", value_col]]
    #
    # Adapt the body below to match the discovered layout.
    raise NotImplementedError("Adapt to FNC layout discovered in Task 3 Step 1")


SPANISH_MONTH_TO_NUM = {
    "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4, "Mayo": 5, "Junio": 6,
    "Julio": 7, "Agosto": 8, "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12,
    # short forms appear in some FNC sheets
    "Ene": 1, "Feb": 2, "Mar": 3, "Abr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Ago": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dic": 12,
}


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    PROCESSED.mkdir(parents=True, exist_ok=True)

    prod = load_long(RAW_DIR / "produccion.xlsx", "production_bags")
    exp = load_long(RAW_DIR / "exportaciones.xlsx", "exports_bags")

    df = prod.merge(exp, on="year_month", how="outer").sort_values("year_month")
    df = df[(df["year_month"] >= START) & (df["year_month"] <= END)].reset_index(drop=True)
    df["production_bags"] = df["production_bags"].fillna(0).astype("int64")
    df["exports_bags"] = df["exports_bags"].fillna(0).astype("int64")

    log.info("Rows: %d, range: %s..%s", len(df), df["year_month"].iloc[0], df["year_month"].iloc[-1])
    log.info("Production sum: %d bags", df["production_bags"].sum())
    log.info("Exports sum:    %d bags", df["exports_bags"].sum())
    log.info("Sample:\n%s", df.head())

    out = PROCESSED / "colombia_monthly.parquet"
    df.to_parquet(out, index=False)
    log.info("Wrote %s", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Fill in `load_long()` body based on XLSX layout from Step 1**

Replace the `raise NotImplementedError` with the actual reshape logic. Use `df.melt()` for wide-to-long, the `SPANISH_MONTH_TO_NUM` dict to map month names, and produce a 2-column DataFrame with `year_month` (string `YYYY-MM`) and the requested `value_col`.

- [ ] **Step 4: Run the transform**

```bash
cd scripts/coffee-trade && uv run python transform_fnc.py
```

Expected output:
- `Rows: 108` (Jan 2015 → Dec 2023)
- Range `2015-01..2023-12`
- Production sum ~110M bags
- Exports sum ~100M bags

If either sum is off by 1000× the unit may be thousand-bags — multiply in `load_long()`.

- [ ] **Step 5: Inspect the parquet**

```bash
uv run python -c "import pandas as pd; df = pd.read_parquet('data/processed/colombia_monthly.parquet'); print(df.head()); print(df.tail()); print(df.describe())"
```

Expected: 108 rows, two integer columns, monotonic `year_month` index, both columns roughly in the 500K–1.5M range per month.

- [ ] **Step 6: Commit the transform**

```bash
git add scripts/coffee-trade/transform_fnc.py
git commit -m "Coffee trade: normalize FNC monthly data to parquet"
```

---

### Task 4: Build JSON for the viz

**Files:**
- Modify: `scripts/coffee-trade/build_viz_data.py`

- [ ] **Step 1: Add `build_colombia_monthly()` function**

Insert just above `main()` in `build_viz_data.py`:

```python
def build_colombia_monthly() -> None:
    """Emit viz/coffee-trade/data/colombia-monthly.json from the FNC parquet."""
    parquet = PROCESSED / "colombia_monthly.parquet"
    if not parquet.exists():
        log.warning("Skipping colombia-monthly: %s not found (run transform_fnc.py first)", parquet)
        return

    df = duckdb.connect(":memory:").execute(
        f"SELECT year_month, production_bags, exports_bags "
        f"FROM read_parquet('{_sql_path(parquet)}') ORDER BY year_month"
    ).df()

    annual = {}
    for ym, prod, exp in zip(df["year_month"], df["production_bags"], df["exports_bags"]):
        y = ym[:4]
        slot = annual.setdefault(y, {"production": 0, "exports": 0})
        slot["production"] += int(prod)
        slot["exports"]    += int(exp)

    payload = {
        "unit": "60kg bags",
        "months":     df["year_month"].tolist(),
        "production": [int(v) for v in df["production_bags"]],
        "exports":    [int(v) for v in df["exports_bags"]],
        "annualTotals": annual,
    }
    (VIZ_DATA / "colombia-monthly.json").write_text(json.dumps(payload, separators=(",", ":")))
    log.info("Wrote colombia-monthly.json with %d months", len(payload["months"]))
```

- [ ] **Step 2: Call it from `main()`**

In `build_viz_data.py:main()`, after the for-loop that writes year files (around line 172), add:

```python
    build_colombia_monthly()
```

- [ ] **Step 3: Run the build**

```bash
cd scripts/coffee-trade && uv run python build_viz_data.py
```

Expected log line: `Wrote colombia-monthly.json with 108 months`.

- [ ] **Step 4: Inspect the JSON**

```bash
uv run python -c "import json; d = json.load(open('../../viz/coffee-trade/data/colombia-monthly.json')); print('months:', len(d['months']), d['months'][0], '..', d['months'][-1]); print('annualTotals years:', sorted(d['annualTotals'].keys())); print('sample 2020:', d['annualTotals']['2020'])"
```

Expected:
```
months: 108 2015-01 .. 2023-12
annualTotals years: ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023']
sample 2020: {'production': ...}
```

- [ ] **Step 5: Commit**

```bash
git add scripts/coffee-trade/build_viz_data.py viz/coffee-trade/data/colombia-monthly.json
git commit -m "Coffee trade: emit colombia-monthly.json from FNC pipeline"
```

---

## Milestone B — Chart skeleton

### Task 5: HTML container + tab visibility wiring

**Files:**
- Modify: `viz/coffee-trade/index.html`
- Modify: `viz/coffee-trade/modules/tabs.js`

- [ ] **Step 1: Find the insertion point in index.html**

```bash
grep -n 'story-tabs' viz/coffee-trade/index.html | head -5
```

Expected: the line where `<nav id="story-tabs">` closes (likely `</nav>`).

- [ ] **Step 2: Insert the chart section directly after the tabs nav**

Add immediately after the `</nav>` that closes `#story-tabs`:

```html
<section id="colombia-chart"
         class="mx-auto w-full max-w-screen-2xl px-4 mb-4"
         hidden
         aria-labelledby="colombia-chart-title">
  <h2 id="colombia-chart-title"
      class="text-sm font-medium text-neutral-200 mb-2"
      data-en="Production vs. Exports — Colombia (2015–2023)"
      data-es="Producción vs. Exportaciones — Colombia (2015–2023)">
    Production vs. Exports — Colombia (2015–2023)
  </h2>
  <div id="colombia-chart-canvas" class="relative w-full h-[200px] md:h-[200px]"></div>
</section>
```

- [ ] **Step 3: Add visibility toggle in tabs.js**

Open `viz/coffee-trade/modules/tabs.js`. Inside `activate()`, after the existing `for (const t of tabs)` loop (around line 35), add:

```js
    const colombiaChart = document.getElementById('colombia-chart')
    if (colombiaChart) colombiaChart.hidden = name !== 'colombia'
```

- [ ] **Step 4: Run dev server and verify visibility**

```bash
npm run dev -- --port 5180
```

In a browser open `http://localhost:5180/viz/coffee-trade/`. Click each tab in turn:
- Insights / Últimos 2 / Corridors → section is hidden, no layout gap
- Colombia → section appears, shows the title text, area below the title is empty (chart not wired yet)

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/index.html viz/coffee-trade/modules/tabs.js
git commit -m "Coffee trade: add Colombia chart container and tab visibility toggle"
```

---

### Task 6: Data loader extension

**Files:**
- Modify: `viz/coffee-trade/modules/data-loader.js`

- [ ] **Step 1: Append `loadColombiaMonthly()` to data-loader.js**

Add at the bottom of the file (after `loadYear`):

```js
let colombiaMonthlyPromise = null

export function loadColombiaMonthly() {
  if (!colombiaMonthlyPromise) {
    colombiaMonthlyPromise = fetch('./data/colombia-monthly.json').then(async r => {
      if (!r.ok) throw new Error(`colombia-monthly: ${r.status}`)
      const data = await r.json()
      console.assert(
        Array.isArray(data.months)
          && Array.isArray(data.production)
          && Array.isArray(data.exports)
          && data.months.length === data.production.length
          && data.months.length === data.exports.length,
        'coffee-trade: bad colombia-monthly shape',
      )
      return data
    })
    colombiaMonthlyPromise.catch(() => { colombiaMonthlyPromise = null })
  }
  return colombiaMonthlyPromise
}
```

- [ ] **Step 2: Quick verify in browser console**

With the dev server running, in the browser DevTools console run:

```js
const m = await import('/viz/coffee-trade/modules/data-loader.js')
const data = await m.loadColombiaMonthly()
console.log(data.months.length, data.months[0], data.months.at(-1))
```

Expected: `108 "2015-01" "2023-12"`.

- [ ] **Step 3: Commit**

```bash
git add viz/coffee-trade/modules/data-loader.js
git commit -m "Coffee trade: add loadColombiaMonthly data loader"
```

---

### Task 7: Chart module skeleton with lazy bootstrap

**Files:**
- Create: `viz/coffee-trade/modules/colombia-chart.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Create the module skeleton**

Write `viz/coffee-trade/modules/colombia-chart.js`:

```js
import * as d3 from 'd3'
import { getState, subscribe } from './state.js'
import { loadColombiaMonthly } from './data-loader.js'

const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 }

export function wireColombiaChart() {
  const root = document.getElementById('colombia-chart-canvas')
  if (!root) return

  let data = null
  let svg = null
  let dims = { width: 0, height: 0 }
  let hasBooted = false

  const ro = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect
    if (width === 0) return
    dims = { width, height }
    if (!hasBooted) {
      hasBooted = true
      loadColombiaMonthly().then(d => { data = d; render() })
    } else if (data) {
      render()
    }
  })
  ro.observe(root)

  function render() {
    // populated in Task 8
    console.log('[colombia-chart] render', dims, data?.months?.length)
  }

  subscribe((next, prev) => {
    // populated in Tasks 9 and 11
  })
}
```

- [ ] **Step 2: Wire into main.js**

Open `viz/coffee-trade/main.js`. Find the line that imports/calls `wireTabs` and add the colombia-chart import + call alongside it:

```js
import { wireColombiaChart } from './modules/colombia-chart.js'
// ...
wireTabs()
wireColombiaChart()
```

- [ ] **Step 3: Run dev server, verify bootstrap fires once**

```bash
npm run dev -- --port 5180
```

In the browser, open DevTools → Console, then click the Colombia tab. Expected one log line: `[colombia-chart] render { width: ~1100, height: 200 } 108`.

Click away to another tab and back to Colombia. Expected the chart re-renders (logs again) but does NOT re-fetch (only one network request to `colombia-monthly.json` in the Network tab).

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/colombia-chart.js viz/coffee-trade/main.js
git commit -m "Coffee trade: skeleton Colombia chart module with lazy data load"
```

---

## Milestone C — Rendering

### Task 8: Render axes and the two lines

**Files:**
- Modify: `viz/coffee-trade/modules/colombia-chart.js`

- [ ] **Step 1: Implement the render() function**

Replace the placeholder `render()` body in `colombia-chart.js`:

```js
function render() {
  const { width, height } = dims
  if (!data || width === 0) return

  const innerW = Math.max(0, width  - MARGIN.left - MARGIN.right)
  const innerH = Math.max(0, height - MARGIN.top  - MARGIN.bottom)

  const dates = data.months.map(m => new Date(m + '-01'))
  const xScale = d3.scaleTime().domain(d3.extent(dates)).range([0, innerW])
  const yMax   = d3.max(data.production)
  const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

  // Build the SVG only once; on later renders, reuse selections.
  if (!svg) {
    svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .style('display', 'block')

    const g = svg.append('g').attr('class', 'plot')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
    g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`)
    g.append('g').attr('class', 'y-axis')
    g.append('rect').attr('class', 'year-band').attr('fill', '#ffffff').attr('fill-opacity', 0.08).attr('pointer-events', 'none')
    g.append('path').attr('class', 'exports-line').attr('fill', 'none')
      .attr('stroke', 'rgb(163 163 163)').attr('stroke-dasharray', '4 4').attr('stroke-width', 1.5)
    g.append('path').attr('class', 'production-line').attr('fill', 'none')
      .attr('stroke', 'var(--color-brand)').attr('stroke-width', 1.75)
  }

  const g = svg.select('g.plot')
  svg.attr('viewBox', `0 0 ${width} ${height}`)
  g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  g.select('.x-axis')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%Y')))
    .call(sel => sel.selectAll('text').attr('fill', 'rgb(163 163 163)'))
    .call(sel => sel.selectAll('line, path').attr('stroke', 'rgb(82 82 82)'))

  g.select('.y-axis')
    .call(d3.axisLeft(yScale).ticks(4).tickFormat(v => `${(v / 1_000_000).toFixed(1)}M`))
    .call(sel => sel.selectAll('text').attr('fill', 'rgb(163 163 163)'))
    .call(sel => sel.selectAll('line, path').attr('stroke', 'rgb(82 82 82)'))

  const line = d3.line()
    .x((_, i) => xScale(dates[i]))
    .y(v => yScale(v))
    .curve(d3.curveMonotoneX)

  g.select('.production-line').attr('d', line(data.production))
  g.select('.exports-line').attr('d', line(data.exports))
}
```

- [ ] **Step 2: Run dev server and verify lines render**

```bash
npm run dev -- --port 5180
```

Click the Colombia tab. Expected: two lines visible — a solid brand-color line (production, higher) and a dashed grey line (exports, lower), with year labels along the X-axis and `Xm` values along the Y-axis. The lines should track each other but with a visible gap between them.

- [ ] **Step 3: Resize the browser and verify the chart redraws**

Drag the window narrower then wider. The axes and lines should re-fit the available width without overlapping.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/colombia-chart.js
git commit -m "Coffee trade: render production and exports lines"
```

---

### Task 9: Highlight band synced to year slider

**Files:**
- Modify: `viz/coffee-trade/modules/colombia-chart.js`

- [ ] **Step 1: Add band update logic inside render()**

At the bottom of `render()` (after the two line draws), add:

```js
  updateBand(xScale, innerH)
```

- [ ] **Step 2: Add the updateBand helper**

Add at module scope (above `render`):

```js
function updateBand(xScale, innerH) {
  const { year } = getState()
  if (!year || !svg) return
  const x0 = xScale(new Date(`${year}-01-01`))
  const x1 = xScale(new Date(`${year}-12-31`))
  svg.select('rect.year-band')
    .attr('x', x0)
    .attr('y', 0)
    .attr('width', Math.max(0, x1 - x0))
    .attr('height', innerH)
}
```

Move this function inside `wireColombiaChart` (as a closure) so it can capture `svg`, OR keep `xScale` and `innerH` in module-scope refs. Cleanest: keep `updateBand` inside `wireColombiaChart` next to `render`, and refactor `xScale`/`innerH` into closure variables that `render` updates and `updateBand` reads.

Final shape inside `wireColombiaChart`:

```js
let xScale = null
let innerH = 0

function render() {
  // ... compute innerW, innerH, xScale, yScale ...
  innerH = Math.max(0, dims.height - MARGIN.top - MARGIN.bottom)
  xScale = d3.scaleTime()...
  // ... line draws ...
  updateBand()
}

function updateBand() {
  const { year } = getState()
  if (!year || !svg || !xScale) return
  const x0 = xScale(new Date(`${year}-01-01`))
  const x1 = xScale(new Date(`${year}-12-31`))
  svg.select('rect.year-band')
    .attr('x', x0)
    .attr('y', 0)
    .attr('width', Math.max(0, x1 - x0))
    .attr('height', innerH)
}
```

- [ ] **Step 3: Wire state subscription**

Update the `subscribe` call at the bottom of `wireColombiaChart`:

```js
subscribe((next, prev) => {
  if (next.year !== prev.year) updateBand()
})
```

- [ ] **Step 4: Verify slider sync**

Run dev server. On the Colombia tab, drag the year slider on the trade chart. The translucent band on the production chart should slide left/right to cover the matching year.

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/modules/colombia-chart.js
git commit -m "Coffee trade: sync year band with trade slider"
```

---

### Task 10: Hover guide and tooltip

**Files:**
- Modify: `viz/coffee-trade/modules/colombia-chart.js`

- [ ] **Step 1: Add hover elements during initial SVG build**

Inside the `if (!svg)` block in `render()`, after the line paths, add:

```js
    g.append('line').attr('class', 'hover-guide')
      .attr('stroke', 'rgb(212 212 212)').attr('stroke-width', 1).attr('stroke-dasharray', '2 3')
      .style('display', 'none')
    g.append('rect').attr('class', 'hover-capture')
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
```

Also create the tooltip element once at the start of `wireColombiaChart`:

```js
const tooltip = document.createElement('div')
tooltip.className = 'absolute pointer-events-none rounded bg-neutral-900/95 ' +
  'border border-neutral-700 text-neutral-100 text-xs px-2 py-1 ' +
  'shadow-lg tabular-nums'
tooltip.style.display = 'none'
root.appendChild(tooltip)
```

- [ ] **Step 2: Wire hover handler at the end of render()**

In `render()`, after `updateBand()`:

```js
const capture = g.select('rect.hover-capture')
  .attr('width', innerW).attr('height', innerH)

capture.on('pointermove', (event) => {
  const [mx] = d3.pointer(event)
  const dateAtCursor = xScale.invert(mx)
  // Nearest-month snap
  const idx = d3.leastIndex(dates, d => Math.abs(d - dateAtCursor))
  if (idx == null) return
  const x = xScale(dates[idx])
  g.select('.hover-guide')
    .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
    .style('display', null)
  const prod = data.production[idx]
  const exp  = data.exports[idx]
  const pct  = prod > 0 ? Math.round((exp / prod) * 100) : 0
  const lang = getState().lang
  const labels = lang === 'es'
    ? { prod: 'Producción', exp: 'Exportaciones', pctOf: 'Exportado' }
    : { prod: 'Production', exp: 'Exports',       pctOf: 'Exported'  }
  tooltip.innerHTML = `<div>${data.months[idx]}</div>
    <div>${labels.prod}: ${prod.toLocaleString()}</div>
    <div>${labels.exp}: ${exp.toLocaleString()}</div>
    <div>${labels.pctOf}: ${pct}%</div>`
  tooltip.style.display = 'block'
  // Position: 12px to the right of the cursor, inside root
  const rect = root.getBoundingClientRect()
  const px = Math.min(rect.width  - tooltip.offsetWidth  - 8, x + MARGIN.left + 12)
  tooltip.style.left = `${px}px`
  tooltip.style.top  = `8px`
})

capture.on('pointerleave', () => {
  g.select('.hover-guide').style('display', 'none')
  tooltip.style.display = 'none'
})
```

- [ ] **Step 3: Verify hover behavior**

Run the dev server. On the Colombia tab, hover across the chart. Expected:
- A dashed vertical line follows the cursor (snapping to month columns)
- A small dark tooltip appears showing `YYYY-MM`, production, exports, % exported
- Moving off the chart hides both

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/colombia-chart.js
git commit -m "Coffee trade: hover guide and tooltip on Colombia chart"
```

---

### Task 11: Language sync (EN/ES)

**Files:**
- Modify: `viz/coffee-trade/modules/colombia-chart.js`

- [ ] **Step 1: Already handled in tooltip — verify**

The tooltip already reads `getState().lang` on hover, so tooltip language updates automatically when the user toggles EN/ES (the next hover uses the new language).

The chart title (in HTML) already has `data-en` / `data-es` attributes, and the existing language toggle logic in the app already handles those. Verify by opening the dev server, switching to Colombia tab, then toggling EN/ES — the title should swap.

- [ ] **Step 2: If the title doesn't swap, add a subscribe block**

Inspect how other elements (e.g. the existing trade chart legend) wire i18n. If language toggling only re-renders elements that have explicit text swaps (via `textContent` on `data-en`/`data-es` nodes), the chart title swap already works because it's plain HTML with those attributes.

No code change needed unless the toggle is broken — skip to Step 3.

- [ ] **Step 3: Verify in browser**

On the Colombia tab, click the EN/ES toggle. Expected: title text swaps; next hover shows tooltip in the new language.

- [ ] **Step 4: Commit (only if Step 2 required code changes)**

```bash
# If you added code:
git add viz/coffee-trade/modules/colombia-chart.js
git commit -m "Coffee trade: language sync for Colombia chart tooltip"
```

If no code change was needed, skip this commit.

---

## Milestone D — Polish

### Task 12: Debounce resize redraws

**Files:**
- Modify: `viz/coffee-trade/modules/colombia-chart.js`

- [ ] **Step 1: Look for the project's debounce pattern**

```bash
grep -rn 'debounce\|requestAnimationFrame' viz/coffee-trade/modules/
```

Use the same pattern already in use (likely `rAF` or a tiny `setTimeout` wrapper). If multiple patterns exist, prefer the one used by the main trade chart's resize handler.

- [ ] **Step 2: Wrap the ResizeObserver callback**

Replace the existing ResizeObserver setup in `wireColombiaChart`:

```js
let resizeRaf = 0
const ro = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect
  if (width === 0) return
  dims = { width, height }
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0
    if (!hasBooted) {
      hasBooted = true
      loadColombiaMonthly().then(d => { data = d; render() })
    } else if (data) {
      render()
    }
  })
})
ro.observe(root)
```

- [ ] **Step 3: Verify smooth resize**

Drag the browser window edges. Expected: chart redraws smoothly without flicker, with axes and lines following the new width.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/colombia-chart.js
git commit -m "Coffee trade: debounce Colombia chart resize via rAF"
```

---

### Task 13: Final visual verification and build

- [ ] **Step 1: Build production bundle**

```bash
npm run build
```

Expected: build succeeds; `dist/viz/coffee-trade/` exists; `dist/viz/coffee-trade/data/colombia-monthly.json` is present.

⚠️ If `dist/viz/coffee-trade/` is missing, `viz/coffee-trade/index.html` was never added to `vite.config.js` rollupOptions.input. Add it before continuing (this is a known gap; see prior planning notes).

- [ ] **Step 2: Preview production build**

```bash
npm run preview
```

In a browser open `http://localhost:4173/viz/coffee-trade/`. Run through all four tabs in both EN and ES; verify the Colombia chart appears only on the Colombia tab, the band moves with the slider, and the tooltip works.

- [ ] **Step 3: Final visual review**

Take a screenshot of the Colombia tab with the slider at 2017 (peak production year) and another at 2022 (La Niña dip). Verify:
- Production line clearly above exports
- Gap visible — that's the domestic supply story the chart exists to tell
- Year band crisply covers exactly 12 months
- No console errors

- [ ] **Step 4: Final commit (if any uncommitted polish)**

```bash
git status
# If anything is uncommitted:
git add <specific paths>
git commit -m "Coffee trade: Colombia production chart polish"
```

---

## Open items deferred to a follow-up

- Department-level production breakdown
- Internal price overlay
- Click-to-pin tooltip
- 2024 partial data once FNC publishes the full year
