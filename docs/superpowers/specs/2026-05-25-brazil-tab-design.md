# Brazil Tab Design

**Date:** 2026-05-25
**Status:** Approved, ready for implementation plan
**Related:** [Colombia production chart design](./2026-05-22-colombia-production-chart-design.md)

## Goal

Add a `brazil` tab to the coffee-trade viz that shows how Brazilian coffee export composition has evolved month-by-month from 2017 to present, with particular emphasis on the differentiated (specialty + certified + sustainable) share of the market.

## Motivation

The existing tabs show global flows (`insights`, `recent`, `corridors`) and a Colombia-specific producer view. A Brazil tab adds the world's largest producer as a counterpart, and answers a question the data already raises: *how much of Brazil's coffee is "specialty / differentiated" and is that share growing?*

Cecafé's monthly export reports publish a five-way breakdown (arabica differentiated, arabica natural, robusta differentiated, robusta medium, processed) which we use directly. Varietal-level (Geisha, Bourbon) and process-level (natural, washed, honey) data is not publicly tracked at scale and is explicitly out of scope.

## Approach

Mirror the Colombia tab's structure: a dedicated chart module (`brazil-chart.js`) that follows the same patterns as `colombia-chart.js` (lazy bootstrap on tab visibility, rAF-debounced resize observer, language sync, year-band synced to the main slider). Add new ETL scripts (`download_cecafe.py`, `transform_cecafe.py`) that parallel the FNC pipeline used for Colombia.

The chart itself is a 5-band stacked area with a small toggle that switches between absolute bag counts and percent-share view.

## File Layout

```
viz/coffee-trade/
  index.html                  [edit] Tab button + <section id="brazil-chart">
  modules/
    brazil-chart.js           [NEW]  Stacked area + toggle, mirrors colombia-chart.js
    tabs.js                   [edit] Toggle #brazil-chart visibility
    data-loader.js            [edit] Add loadBrazilMonthly()
  main.js                     [edit] Import + call wireBrazilChart() in boot()

src/public/viz/coffee-trade/data/
  brazil-monthly.json         [NEW]  ETL output

scripts/coffee-trade/
  download_cecafe.py          [NEW]  Fetch monthly PDFs 2017-01..present
  transform_cecafe.py         [NEW]  Extract section 1.10 via pdfplumber
  build_viz_data.py           [edit] Add build_brazil_monthly()
  pyproject.toml              [edit] Add pdfplumber dep
```

## ETL Pipeline

### `download_cecafe.py`

Loop over months from 2017-01 through the current month. Build URL from this pattern:

```
https://www.cecafe.com.br/site/wp-content/uploads/graficos/CECAFE-Relatorio-Mensal-{MES_PT}-{YEAR}.pdf
```

`MES_PT` is the Portuguese month name uppercased: `JANEIRO`, `FEVEREIRO`, `MARCO` (no cedilha — observed pattern), `ABRIL`, `MAIO`, `JUNHO`, `JULHO`, `AGOSTO`, `SETEMBRO`, `OUTUBRO`, `NOVEMBRO`, `DEZEMBRO`.

Skip-on-exists. Output: `data/raw/cecafe/{year}-{MM}.pdf` (~110 files, ~250 MB total). Use `httpx` with a browser User-Agent (Cecafé returns 404 to bare-bones clients).

### `transform_cecafe.py`

For each PDF:

1. Open with `pdfplumber`.
2. Locate the page containing section 1.10 ("EXPORTAÇÕES BRASILEIRAS DE CAFÉS DIFERENCIADOS"). In the April 2026 report this is page 13.
3. Extract these five YTD rows by matching row labels:
   - `Arábicas Diferenciados` → `arabica_diff`
   - `Arábicas Naturais` → `arabica_natural`
   - `Robustas Diferenciados` → `robusta_diff`
   - `Robustas Médios` → `robusta_medium`
   - `Industrializado (Solúvel e T&M)` → `processed`
4. Parse the "Volume sacas 60 Kg" column (first numeric column). Brazilian number formatting uses `.` as thousands separator (e.g., `1.992.870` = 1,992,870).
5. Write one row per (year, month, category, ytd_bags) to `data/processed/cecafe-ytd.parquet`.

**YTD → monthly derivation** (done in `transform_cecafe.py` after all PDFs parsed):

For each category and each (year, month):
- January: `monthly = ytd[Jan]`
- Other months: `monthly = ytd[month] - ytd[month-1]`

Validation gates (fail loudly):
- All five categories present in every PDF
- No negative monthly deltas (a negative delta means parser misread a digit or rows swapped)
- December YTD == sum of monthly values for that year (within rounding)
- Output covers every month from 2017-01 through the most recent published month with no gaps

Output: `data/processed/cecafe-monthly.parquet` with columns `year, month, arabica_natural, arabica_diff, robusta_medium, robusta_diff, processed`.

### `build_viz_data.py` (additive)

Add `build_brazil_monthly()` that reads `cecafe-monthly.parquet`, sorts by `(year, month)`, and emits `brazil-monthly.json` (shape below) to `src/public/viz/coffee-trade/data/`.

### Known ETL risks

- Older PDFs (2017-2019) may use slightly different row labels or section numbering. Mitigation: validate the parser on Jan-2017, Jul-2019, Dec-2023, Apr-2026 first; if labels drift, build a small alias map.
- Cecafé republishes the latest month's PDF if numbers are revised. Skip-on-exists could miss revisions. Mitigation: always re-download the latest 2 months.
- PDF table extraction can fail silently if pdfplumber's table detection picks up adjacent rows. Mitigation: the validation gates above catch this.

## Chart Behavior

### Visual structure

- **5-band stacked area chart**, monthly granularity, x-axis spans `start_month` to `end_month` from the JSON.
- **Stacking order (bottom → top):** `arabica_natural`, `robusta_medium`, `processed`, `arabica_diff`, `robusta_diff`. Rationale: commodity bands below, differentiated bands above, so the "diferenciados" share reads as a visually distinct upper portion.
- **Color palette:**
  - `arabica_natural` — warm brown (`#a16a3d`)
  - `robusta_medium` — slate (`#4a6878`)
  - `processed` — neutral gray (`#737373`)
  - `arabica_diff` — gold/amber (`#d4a96a`)
  - `robusta_diff` — light blue (`#7ba6c4`)

  Colors are local to `brazil-chart.js`, not theme tokens. The Colombia chart's `var(--color-brand)` is intentionally not reused — Brazil's palette tells a different story (commodity vs differentiated grouping).

- **Canvas height:** `h-[260px]` (taller than Colombia's `200px` because 5 bands need more vertical room).
- **Legend:** below the chart, horizontal flex-wrap. Static (no click interactions in v1; see Out of Scope).

### Toggle (Bags ⇄ %)

- Two-button group in the top-right of the chart container, sibling to the title.
- Default: `Bags` (absolute, y-axis in millions of 60-kg bags).
- `%` switches the stack to `d3.stackOffsetExpand` (each x-value normalized to 100%) and reformats the y-axis.
- State lives in the chart module (closure variable, not the global store). The toggle is a local UI control with no implications for other tabs.

### Year-band sync

- Subscribe to `getState().year` via the `state.js` store.
- Render an SVG `<rect class="year-band">` that covers the selected year's x-range.
- Only show the band when the selected year is between `start_month` and `end_month` (parsed from JSON). Hide otherwise so the chart still works for years outside Brazil's data range.
- Implementation mirrors Colombia's `updateBand()` function.

### Hover guide & tooltip

- Single full-height vertical guide-line that snaps to the nearest month via `d3.leastIndex`.
- Tooltip shows 6 rows: total + 5 bands. Values format based on active toggle (bags vs %).
- Tooltip header shows the month in the active language (e.g. "Apr 2024" / "Abr 2024").
- `pointerleave` hides both the guide and tooltip.

### Lazy bootstrap & resize

- ResizeObserver on the canvas. On first non-zero-width observation, call the boot path (load data → render). All renders wrap inside `requestAnimationFrame` to batch resize events.
- Subsequent resizes only update SVG dimensions and re-run scales; no full re-render.

### Language sync

- Static text (title, toggle button labels) uses `data-en`/`data-es` attributes (handled by existing `i18n.js`).
- Dynamic text rendered by D3 (legend, tooltip rows) reads `getState().lang` and looks up labels from a module-local table:

  ```js
  const LABELS = {
    en: {
      arabica_natural: 'Arabica natural',
      arabica_diff: 'Arabica differentiated',
      robusta_medium: 'Robusta medium',
      robusta_diff: 'Robusta differentiated',
      processed: 'Processed (soluble + R&G)',
      total: 'Total',
      bags: 'bags',
    },
    es: {
      arabica_natural: 'Arábica natural',
      arabica_diff: 'Arábica diferenciada',
      robusta_medium: 'Robusta media',
      robusta_diff: 'Robusta diferenciada',
      processed: 'Procesado (soluble + T&M)',
      total: 'Total',
      bags: 'sacas',
    },
  }
  ```

- Subscribe to state changes; re-render legend and tooltip when `next.lang !== prev.lang`.

## Data Shape

**`src/public/viz/coffee-trade/data/brazil-monthly.json`:**

```json
{
  "unit": "60kg bags",
  "source": "Cecafé monthly export reports, section 1.10",
  "start_month": "2017-01",
  "end_month": "2026-04",
  "months":          ["2017-01", "2017-02", "..."],
  "arabica_natural": [4823100,   4691200,   "..."],
  "arabica_diff":    [ 612400,    589300,   "..."],
  "robusta_medium":  [  82100,     78400,   "..."],
  "robusta_diff":    [   2300,      2100,   "..."],
  "processed":       [ 245600,    231800,   "..."]
}
```

**Constraints:**

- Flat structure, no nested objects (matches Colombia's `months/production/exports` philosophy).
- Every series array has exactly `months.length` integer entries. No nulls, no missing months.
- Values are 60-kg bag counts as integers.

**Loader (`data-loader.js`):**

Add `loadBrazilMonthly()` paralleling `loadColombiaMonthly()`:
- Memoized promise
- `fetch('./data/brazil-monthly.json')`
- Shape-guard assertion: all five series arrays present and length-matched

## Tab Integration

**Tab order (insert between Colombia and Corridors):**

```
Insights → Recent → Colombia → Brazil → Corridors
```

**`index.html`:**

- Tab button: `<button role="tab" data-tab="brazil" data-en="Brazil" data-es="Brasil">…</button>` after the Colombia tab button.
- Chart section after Colombia's:

  ```html
  <section id="brazil-chart"
           class="mx-auto w-full max-w-screen-2xl px-4 mb-4"
           hidden aria-labelledby="brazil-chart-title">
    <div id="brazil-chart-header"
         class="flex items-center justify-between mb-2">
      <h2 id="brazil-chart-title"
          class="text-sm font-medium text-neutral-200"
          data-en="Composition of Brazilian coffee exports (2017–2026)"
          data-es="Composición de las exportaciones de café de Brasil (2017–2026)">
        Composition of Brazilian coffee exports (2017–2026)
      </h2>
      <div id="brazil-chart-toggle"
           class="flex gap-1 text-xs"
           role="group" aria-label="View mode">
        <button data-mode="bags"
                class="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:border-brand"
                aria-pressed="true"
                data-en="Bags" data-es="Sacas">Bags</button>
        <button data-mode="share"
                class="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:border-brand"
                aria-pressed="false">%</button>
      </div>
    </div>
    <div id="brazil-chart-canvas" class="relative w-full h-[260px]"></div>
  </section>
  ```

**`tabs.js`** — add inside `activate(name)` after the existing Colombia visibility line:

```js
const brazilChart = document.getElementById('brazil-chart')
if (brazilChart) brazilChart.hidden = name !== 'brazil'
```

## Out of Scope

- Varietal-level breakdowns (Geisha, Bourbon, Catuaí). Not publicly tracked at scale.
- Process-level breakdowns (natural, washed, honey). Same constraint.
- Brazilian domestic consumption (ABIC data). Could be a follow-up tab or sidebar later.
- Specialty sub-category breakdown (specialty vs certified vs sustainable vs microregion). Cecafé bundles these into "diferenciados" — not separable from this data source.
- Click-to-mute legend interactivity. Nice-to-have, not required for v1.

## Open Risks

1. **Cecafé PDF schema drift across years** (2017-2019 may differ from 2024+). Mitigation: validate parser against four spot-check reports before bulk run.
2. **Latest-month republication** (Cecafé may revise the most recent report). Mitigation: ETL always re-downloads the latest 2 months.
3. **Section 1.10 location** may shift across years (it was page 13 in Apr 2026). Mitigation: locate by text content ("CAFÉS DIFERENCIADOS"), not by page number.
4. **Negative monthly deltas** would indicate an extraction error. Mitigation: validation gate fails the build.
