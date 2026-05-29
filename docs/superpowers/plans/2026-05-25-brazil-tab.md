# Brazil Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `brazil` tab to `viz/coffee-trade/` that shows a 5-band stacked-area chart of Brazilian coffee export composition (arabica/robusta × differentiated/commodity + processed) from Cecafé monthly reports, 2017-01 through present, with a Bags↔% toggle.

**Architecture:** Mirror the Colombia tab pattern. New ETL scripts (`download_cecafe.py`, `transform_cecafe.py`) parallel the FNC pipeline. New `brazil-chart.js` D3 module follows `colombia-chart.js` patterns (lazy bootstrap, rAF resize, year-band sync, language sync). Data emitted as a flat JSON to `src/public/viz/coffee-trade/data/brazil-monthly.json`.

**Tech Stack:** Python 3.12 + uv + pdfplumber + duckdb (ETL); D3.js v7 + Tailwind v4 (viz); Vite 6 (build).

**Verification policy:** Per project convention (user memory `feedback_no_tests`), this codebase does NOT use test suites for viz or ETL code. Each task ends with a manual verification step that runs the code or opens the browser and checks the result. Do not add unit tests, pytest files, or vitest specs. If a verification step fails, fix the code and re-run.

**Spec:** `docs/superpowers/specs/2026-05-25-brazil-tab-design.md`

---

## Task 1: Add pdfplumber dep and verify Cecafé URL pattern

**Files:**
- Modify: `scripts/coffee-trade/pyproject.toml`

- [ ] **Step 1: Add pdfplumber to project deps**

Edit `scripts/coffee-trade/pyproject.toml`, append `pdfplumber>=0.11` to the `dependencies` array:

```toml
dependencies = [
    "httpx>=0.27", "duckdb>=1.0", "pyarrow>=16",
    "pandas>=2.2", "openpyxl>=3.1", "pdfplumber>=0.11",
]
```

- [ ] **Step 2: Sync deps**

Run from `scripts/coffee-trade/`:

```bash
uv sync
```

Expected: `pdfplumber` and its transitive deps (`pdfminer.six`, `pillow`) appear in the install summary.

- [ ] **Step 3: Spot-check the URL pattern with curl**

Run:

```bash
for ym in JANEIRO-2017 JULHO-2019 DEZEMBRO-2023 ABRIL-2026; do
  url="https://www.cecafe.com.br/site/wp-content/uploads/graficos/CECAFE-Relatorio-Mensal-${ym}.pdf"
  code=$(curl -sLI --max-time 10 -A "Mozilla/5.0" -o /dev/null -w "%{http_code}" "$url")
  echo "$ym: $code"
done
```

Expected: all four return `200`.

- [ ] **Step 4: Commit**

```bash
git add scripts/coffee-trade/pyproject.toml scripts/coffee-trade/uv.lock
git commit -m "Coffee trade: add pdfplumber dep for Cecafé PDF parsing"
```

---

## Task 2: Write download_cecafe.py

**Files:**
- Create: `scripts/coffee-trade/download_cecafe.py`

- [ ] **Step 1: Write the downloader**

Create `scripts/coffee-trade/download_cecafe.py`:

```python
"""Download Cecafé monthly export PDFs from 2017-01 through the most recent month.

Run: uv run python download_cecafe.py
Output: data/raw/cecafe/{year}-{MM}.pdf  (skip-on-exists; always re-download
        the most recent 2 months because Cecafé republishes revisions).
"""
from __future__ import annotations
import logging
import sys
from datetime import date
from pathlib import Path
import httpx

ROOT = Path(__file__).parent
OUT = ROOT / "data" / "raw" / "cecafe"

MES_PT = {
    1: "JANEIRO", 2: "FEVEREIRO", 3: "MARCO", 4: "ABRIL",
    5: "MAIO", 6: "JUNHO", 7: "JULHO", 8: "AGOSTO",
    9: "SETEMBRO", 10: "OUTUBRO", 11: "NOVEMBRO", 12: "DEZEMBRO",
}
UA = "Mozilla/5.0 (compatible; charts-d3-etl/1.0)"
START_YEAR = 2017

log = logging.getLogger("download_cecafe")


def _url(year: int, month: int) -> str:
    return (
        "https://www.cecafe.com.br/site/wp-content/uploads/graficos/"
        f"CECAFE-Relatorio-Mensal-{MES_PT[month]}-{year}.pdf"
    )


def _iter_months() -> list[tuple[int, int]]:
    today = date.today()
    out: list[tuple[int, int]] = []
    for year in range(START_YEAR, today.year + 1):
        for month in range(1, 13):
            if (year, month) > (today.year, today.month):
                break
            out.append((year, month))
    return out


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    OUT.mkdir(parents=True, exist_ok=True)

    months = _iter_months()
    # Always refresh the latest 2 entries — Cecafé republishes revisions.
    refresh_keys = set(months[-2:])

    with httpx.Client(headers={"User-Agent": UA}, timeout=30.0, follow_redirects=True) as client:
        ok = miss = err = 0
        for year, month in months:
            path = OUT / f"{year}-{month:02d}.pdf"
            if path.exists() and (year, month) not in refresh_keys:
                ok += 1
                continue
            url = _url(year, month)
            try:
                r = client.get(url)
                if r.status_code == 404:
                    log.warning("404 %s", url)
                    miss += 1
                    continue
                r.raise_for_status()
                path.write_bytes(r.content)
                log.info("got %s (%d KB)", path.name, len(r.content) // 1024)
                ok += 1
            except httpx.HTTPError as e:
                log.error("error %s: %s", url, e)
                err += 1

    log.info("done: %d ok, %d 404, %d error", ok, miss, err)
    return 0 if err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Spot-run for 4 months to verify**

Temporarily set `START_YEAR = 2023` and add `if month not in (1, 7, 12): continue` after the `for month` line to grab just three 2023 months. Run:

```bash
cd scripts/coffee-trade
uv run python download_cecafe.py
```

Expected: 3 PDFs downloaded into `data/raw/cecafe/2023-{01,07,12}.pdf`. Inspect with `file data/raw/cecafe/2023-01.pdf` — should report "PDF document".

Revert the temporary changes (`START_YEAR = 2017`, remove the month filter).

- [ ] **Step 3: Commit**

```bash
git add scripts/coffee-trade/download_cecafe.py
git commit -m "Coffee trade: add Cecafé monthly PDF downloader"
```

---

## Task 3: Run full Cecafé download

**Files:** No new files. Data lands under `scripts/coffee-trade/data/raw/cecafe/`.

- [ ] **Step 1: Add the raw data dir to .gitignore (if not already covered)**

Check if `scripts/coffee-trade/data/` is gitignored. If not, add this to `.gitignore`:

```
scripts/coffee-trade/data/raw/
scripts/coffee-trade/data/processed/
```

Verify it's covered by inspecting `.gitignore`. Do NOT track raw PDFs.

- [ ] **Step 2: Run the full download**

```bash
cd scripts/coffee-trade
uv run python download_cecafe.py
```

Expected: ~110 PDFs written (depends on current month). The log ends with `done: N ok, M 404, 0 error`. Some early months (2017 specifically — re-verify) may 404; record any genuine 404s before proceeding.

- [ ] **Step 3: Inventory the result**

```bash
ls scripts/coffee-trade/data/raw/cecafe/ | wc -l
du -sh scripts/coffee-trade/data/raw/cecafe/
```

Expected: file count matches ok+miss from the run, total size ~200-300 MB.

- [ ] **Step 4: Commit (no data files, just any .gitignore changes)**

```bash
git add .gitignore  # if you edited it
git commit -m "Coffee trade: gitignore Cecafé raw/processed data" || true
```

(Skip if .gitignore didn't need changes.)

---

## Task 4: Write transform_cecafe.py parser and validate on 4 spot-check PDFs

**Files:**
- Create: `scripts/coffee-trade/transform_cecafe.py`

- [ ] **Step 1: Write the parser**

Create `scripts/coffee-trade/transform_cecafe.py`:

```python
"""Parse Cecafé monthly PDFs into a YTD parquet, then derive monthly volumes.

Section 1.10 of each monthly report ("EXPORTAÇÕES BRASILEIRAS DE CAFÉS
DIFERENCIADOS") publishes year-to-date volumes for five categories. We
extract those, then compute monthly = ytd[N] - ytd[N-1].

Run: uv run python transform_cecafe.py
Output:
  data/processed/cecafe-ytd.parquet      (one row per year/month/category)
  data/processed/cecafe-monthly.parquet  (one row per year/month, 5 columns)
"""
from __future__ import annotations
import logging
import re
import sys
from pathlib import Path
import pandas as pd
import pdfplumber

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw" / "cecafe"
PROCESSED = ROOT / "data" / "processed"

# Map Cecafé row label → output category. Labels are matched case-insensitive
# after stripping accents (handled by _norm()). Order is irrelevant.
ROW_LABELS = {
    "arabicas diferenciados": "arabica_diff",
    "arabicas naturais": "arabica_natural",
    "robustas diferenciados": "robusta_diff",
    "robustas medios": "robusta_medium",
    "industrializado (soluvel e t&m)": "processed",
}
EXPECTED = set(ROW_LABELS.values())

log = logging.getLogger("transform_cecafe")


def _norm(s: str) -> str:
    """Lowercase, strip accents and surrounding whitespace."""
    import unicodedata
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.strip().lower()


def _parse_bags(cell: str) -> int:
    """Cecafé prints '1.992.870' for ~2 million bags. Strip dots, return int."""
    if cell is None:
        return 0
    digits = re.sub(r"[^\d]", "", cell)
    return int(digits) if digits else 0


def parse_pdf(path: Path) -> dict[str, int]:
    """Return {category: ytd_bags} for the five categories in section 1.10.

    Strategy: locate the page containing "CAFÉS DIFERENCIADOS" by text search.
    Extract tables on that page. Find the row whose first cell matches a known
    label; take the first numeric cell as the YTD bag count.
    """
    with pdfplumber.open(path) as pdf:
        target_page = None
        for page in pdf.pages:
            text = page.extract_text() or ""
            if "DIFERENCIADOS" in text.upper() and "1.10" in text:
                target_page = page
                break
        if target_page is None:
            raise ValueError(f"{path.name}: section 1.10 page not found")

        found: dict[str, int] = {}
        for table in target_page.extract_tables() or []:
            for row in table:
                if not row or row[0] is None:
                    continue
                key = _norm(row[0])
                category = ROW_LABELS.get(key)
                if category is None:
                    continue
                # First non-empty cell after the label is the YTD bag count.
                for cell in row[1:]:
                    if cell and re.search(r"\d", cell):
                        found[category] = _parse_bags(cell)
                        break

    missing = EXPECTED - set(found)
    if missing:
        raise ValueError(f"{path.name}: missing categories {missing}")
    return found


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    PROCESSED.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(RAW.glob("*.pdf"))
    if not pdfs:
        log.error("no PDFs in %s — run download_cecafe.py first", RAW)
        return 1

    ytd_rows: list[dict] = []
    for path in pdfs:
        m = re.match(r"(\d{4})-(\d{2})\.pdf", path.name)
        if not m:
            log.warning("skipping unexpected filename: %s", path.name)
            continue
        year, month = int(m[1]), int(m[2])
        try:
            cats = parse_pdf(path)
        except Exception as e:
            log.error("FAIL %s: %s", path.name, e)
            return 2
        for cat, bags in cats.items():
            ytd_rows.append({"year": year, "month": month, "category": cat, "ytd_bags": bags})
        log.info("ok %s: %s", path.name, {k: cats[k] for k in sorted(cats)})

    ytd = pd.DataFrame(ytd_rows)
    ytd.to_parquet(PROCESSED / "cecafe-ytd.parquet", index=False)

    # Pivot to wide: index=(year,month), columns=category, values=ytd_bags.
    wide = ytd.pivot_table(index=["year", "month"], columns="category",
                            values="ytd_bags", aggfunc="first").reset_index()
    wide = wide.sort_values(["year", "month"]).reset_index(drop=True)

    # Derive monthly via YTD diffs within each year.
    cats = sorted(EXPECTED)
    monthly_rows: list[dict] = []
    for year, group in wide.groupby("year", sort=True):
        group = group.sort_values("month").reset_index(drop=True)
        prev = {c: 0 for c in cats}
        for _, row in group.iterrows():
            this = {c: int(row[c]) for c in cats}
            monthly = {c: this[c] - prev[c] for c in cats}
            monthly_rows.append({"year": int(row["year"]), "month": int(row["month"]), **monthly})
            prev = this

    monthly = pd.DataFrame(monthly_rows)

    # Validation gates.
    for c in cats:
        bad = monthly[monthly[c] < 0]
        if not bad.empty:
            log.error("negative monthly deltas in %s:\n%s", c, bad)
            return 3

    # December YTD must equal the year's monthly sum (within rounding — but
    # values are integers, so equality should hold).
    for year, group in wide.groupby("year"):
        if 12 not in set(group["month"]):
            continue
        dec_ytd = group[group["month"] == 12].iloc[0]
        msum = monthly[monthly["year"] == year][cats].sum()
        for c in cats:
            if int(dec_ytd[c]) != int(msum[c]):
                log.error("year %d %s: dec YTD=%d but monthly sum=%d",
                          year, c, int(dec_ytd[c]), int(msum[c]))
                return 4

    monthly.to_parquet(PROCESSED / "cecafe-monthly.parquet", index=False)
    log.info("wrote %d monthly rows across %d years",
             len(monthly), monthly["year"].nunique())
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Spot-check on 4 PDFs first (don't run on full set yet)**

Temporarily edit `main()` to limit the PDF set:

```python
# Replace `pdfs = sorted(RAW.glob("*.pdf"))` with:
pdfs = [RAW / f for f in ("2017-01.pdf", "2019-07.pdf", "2023-12.pdf", "2026-04.pdf")]
pdfs = [p for p in pdfs if p.exists()]
```

Also comment out the December-YTD validation gate for this spot run (it requires the full year). Run:

```bash
cd scripts/coffee-trade
uv run python transform_cecafe.py
```

Expected: 4 lines starting `ok 20XX-MM.pdf:` each showing the 5 categories with bag counts.

- [ ] **Step 3: Sanity-check the Apr 2026 numbers against the PDF**

Open `scripts/coffee-trade/data/raw/cecafe/2026-04.pdf` page 13 (or use any PDF viewer). Section 1.10 should show, for Jan-Apr 2026:

- Arábicas Diferenciados: 1.992.870
- Arábicas Naturais: 6.990.825
- Robustas Diferenciados: 83.482
- Robustas Médios: 1.200.175
- Industrializado (Solúvel e T&M): 1.351.816

The parser output for 2026-04 must match these exact integers. If not, debug the parser (likely table-detection issue with pdfplumber — try `target_page.extract_table()` singular, or iterate `extract_tables(table_settings={"vertical_strategy":"text"})`).

- [ ] **Step 4: Revert the spot-check limitation**

Restore `pdfs = sorted(RAW.glob("*.pdf"))` and uncomment the December-YTD validation.

- [ ] **Step 5: Commit**

```bash
git add scripts/coffee-trade/transform_cecafe.py
git commit -m "Coffee trade: add Cecafé PDF parser with YTD-to-monthly derivation"
```

---

## Task 5: Run full transform and validate

**Files:** No code changes — running the script from Task 4.

- [ ] **Step 1: Run full transform**

```bash
cd scripts/coffee-trade
uv run python transform_cecafe.py
```

Expected: `ok` line for every PDF, ending with `wrote N monthly rows across M years`. No errors. If validation gates trip, the script returns non-zero — inspect the error message, fix the parser, re-run.

- [ ] **Step 2: Inspect output**

```bash
uv run python -c "
import pandas as pd
m = pd.read_parquet('data/processed/cecafe-monthly.parquet')
print(m.head(3))
print(m.tail(3))
print('rows:', len(m))
print('years:', sorted(m.year.unique()))
print('totals (millions of bags):')
print((m[['arabica_natural','arabica_diff','robusta_medium','robusta_diff','processed']].sum()/1e6).round(2))
"
```

Expected: ~100+ rows, years 2017 through current, arabica_natural total far larger than others (~300M+ bags), arabica_diff total ~50M+ bags.

- [ ] **Step 3: Commit (parquet is gitignored — nothing to commit)**

No commit needed.

---

## Task 6: Add build_brazil_monthly() to build_viz_data.py

**Files:**
- Modify: `scripts/coffee-trade/build_viz_data.py`

- [ ] **Step 1: Read existing structure**

Open `scripts/coffee-trade/build_viz_data.py` and locate the existing `build_colombia_monthly()` function. The new `build_brazil_monthly()` follows the same shape: read parquet, emit JSON to `VIZ_DATA`.

- [ ] **Step 2: Add the function**

Append after `build_colombia_monthly()`:

```python
def build_brazil_monthly() -> None:
    """Emit brazil-monthly.json from cecafe-monthly.parquet."""
    src = PROCESSED / "cecafe-monthly.parquet"
    if not src.exists():
        raise FileNotFoundError(f"{src} not found — run transform_cecafe.py first")
    import pandas as pd
    df = pd.read_parquet(src).sort_values(["year", "month"]).reset_index(drop=True)

    months = [f"{int(r['year']):04d}-{int(r['month']):02d}" for _, r in df.iterrows()]
    cats = ["arabica_natural", "arabica_diff", "robusta_medium", "robusta_diff", "processed"]
    payload = {
        "unit": "60kg bags",
        "source": "Cecafé monthly export reports, section 1.10",
        "start_month": months[0],
        "end_month": months[-1],
        "months": months,
    }
    for c in cats:
        payload[c] = [int(v) for v in df[c].tolist()]

    out = VIZ_DATA / "brazil-monthly.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    log.info("wrote %s (%d months)", out, len(months))
```

- [ ] **Step 3: Wire it into `main()`**

Find the existing `main()` function. After the call to `build_colombia_monthly()`, add:

```python
    build_brazil_monthly()
```

- [ ] **Step 4: Run and verify**

```bash
cd scripts/coffee-trade
uv run python build_viz_data.py
```

Expected: log line `wrote .../brazil-monthly.json (N months)`. The file appears at `src/public/viz/coffee-trade/data/brazil-monthly.json`.

```bash
uv run python -c "
import json
p = json.load(open('../../src/public/viz/coffee-trade/data/brazil-monthly.json'))
print('months:', len(p['months']), p['months'][0], '..', p['months'][-1])
print('start:', p['start_month'], 'end:', p['end_month'])
print('keys:', sorted(p.keys()))
print('first row:', {k: p[k][0] for k in ['arabica_natural','arabica_diff','robusta_medium','robusta_diff','processed']})
"
```

Expected: `months: N 2017-01 .. 20XX-MM`, all five series keys present, first-row values are positive integers.

- [ ] **Step 5: Commit**

```bash
git add scripts/coffee-trade/build_viz_data.py src/public/viz/coffee-trade/data/brazil-monthly.json
git commit -m "Coffee trade: build brazil-monthly.json from Cecafé data"
```

---

## Task 7: Add `loadBrazilMonthly()` to data-loader.js

**Files:**
- Modify: `viz/coffee-trade/modules/data-loader.js`

- [ ] **Step 1: Append loader function**

Open `viz/coffee-trade/modules/data-loader.js`. Locate `loadColombiaMonthly()` at the bottom. Append after it:

```js
let brazilMonthlyPromise = null

export function loadBrazilMonthly() {
  if (!brazilMonthlyPromise) {
    brazilMonthlyPromise = fetch('./data/brazil-monthly.json').then(async r => {
      if (!r.ok) throw new Error(`brazil-monthly: ${r.status}`)
      const data = await r.json()
      const series = ['arabica_natural', 'arabica_diff', 'robusta_medium', 'robusta_diff', 'processed']
      console.assert(
        Array.isArray(data.months)
          && data.months.length > 0
          && typeof data.start_month === 'string'
          && typeof data.end_month === 'string'
          && series.every(k => Array.isArray(data[k]) && data[k].length === data.months.length),
        'coffee-trade: bad brazil-monthly shape',
      )
      return data
    })
    brazilMonthlyPromise.catch(() => { brazilMonthlyPromise = null })
  }
  return brazilMonthlyPromise
}
```

- [ ] **Step 2: Sanity-check via dev server**

Run:

```bash
npm run dev
```

In a browser tab at `http://localhost:5173/viz/coffee-trade/`, open the JS console and run:

```js
(await (await import('./modules/data-loader.js')).loadBrazilMonthly())
```

Expected: object with `months`, `start_month`, `end_month`, and the five series. No assertion failures in console.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add viz/coffee-trade/modules/data-loader.js
git commit -m "Coffee trade: add loadBrazilMonthly data loader"
```

---

## Task 8: HTML container + tab button + tabs.js visibility

**Files:**
- Modify: `viz/coffee-trade/index.html`
- Modify: `viz/coffee-trade/modules/tabs.js`

- [ ] **Step 1: Add the Brazil tab button**

Open `viz/coffee-trade/index.html` and find the existing `colombia` tab button:

```html
<button role="tab" data-tab="colombia" aria-selected="false" ...>Colombia</button>
```

Add the Brazil tab button directly after the closing `</button>` of `colombia`. Use the same CSS classes as the surrounding tab buttons (copy class list verbatim from the `colombia` button):

```html
<button role="tab" data-tab="brazil" aria-selected="false"
        class="[COPY-CLASSES-FROM-COLOMBIA-BUTTON]"
        data-en="Brazil" data-es="Brasil">
  Brazil
</button>
```

(Replace `[COPY-CLASSES-FROM-COLOMBIA-BUTTON]` with the actual class list from the existing Colombia button.)

- [ ] **Step 2: Add the chart section**

Locate the existing `<section id="colombia-chart">` block. After its closing `</section>`, add:

```html
<section id="brazil-chart"
         class="mx-auto w-full max-w-screen-2xl px-4 mb-4"
         hidden aria-labelledby="brazil-chart-title">
  <div id="brazil-chart-header" class="flex items-center justify-between mb-2">
    <h2 id="brazil-chart-title"
        class="text-sm font-medium text-neutral-200"
        data-en="Composition of Brazilian coffee exports (2017–present)"
        data-es="Composición de las exportaciones de café de Brasil (2017–presente)">
      Composition of Brazilian coffee exports (2017–present)
    </h2>
    <div id="brazil-chart-toggle" class="flex gap-1 text-xs" role="group" aria-label="View mode">
      <button data-mode="bags"
              class="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:border-brand text-neutral-200"
              aria-pressed="true"
              data-en="Bags" data-es="Sacas">Bags</button>
      <button data-mode="share"
              class="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:border-brand text-neutral-400"
              aria-pressed="false">%</button>
    </div>
  </div>
  <div id="brazil-chart-canvas" class="relative w-full h-[260px]"></div>
</section>
```

- [ ] **Step 3: Update tabs.js to toggle visibility**

Open `viz/coffee-trade/modules/tabs.js`. Find the existing Colombia visibility line:

```js
const colombiaChart = document.getElementById('colombia-chart')
if (colombiaChart) colombiaChart.hidden = name !== 'colombia'
```

Add directly below:

```js
const brazilChart = document.getElementById('brazil-chart')
if (brazilChart) brazilChart.hidden = name !== 'brazil'
```

- [ ] **Step 4: Verify in dev server**

```bash
npm run dev
```

Open `http://localhost:5173/viz/coffee-trade/`. Click each tab in turn. Expected:
- Brazil tab button is present and visible after Colombia
- Clicking Brazil hides Colombia chart and reveals an empty Brazil section (the canvas div is empty — no chart wired yet)
- Clicking back to other tabs hides the Brazil section

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/index.html viz/coffee-trade/modules/tabs.js
git commit -m "Coffee trade: add Brazil tab button and empty chart container"
```

---

## Task 9: brazil-chart.js skeleton with lazy bootstrap and rAF resize

**Files:**
- Create: `viz/coffee-trade/modules/brazil-chart.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Create the chart module skeleton**

Create `viz/coffee-trade/modules/brazil-chart.js`:

```js
import * as d3 from 'd3'
import { getState, subscribe } from './state.js'
import { loadBrazilMonthly } from './data-loader.js'

const CATEGORIES = ['arabica_natural', 'robusta_medium', 'processed', 'arabica_diff', 'robusta_diff']
const COLORS = {
  arabica_natural: '#a16a3d',
  robusta_medium:  '#4a6878',
  processed:       '#737373',
  arabica_diff:    '#d4a96a',
  robusta_diff:    '#7ba6c4',
}
const LABELS = {
  en: {
    arabica_natural: 'Arabica natural',
    arabica_diff:    'Arabica differentiated',
    robusta_medium:  'Robusta medium',
    robusta_diff:    'Robusta differentiated',
    processed:       'Processed (soluble + R&G)',
    total:           'Total',
    bags:            'bags',
  },
  es: {
    arabica_natural: 'Arábica natural',
    arabica_diff:    'Arábica diferenciada',
    robusta_medium:  'Robusta media',
    robusta_diff:    'Robusta diferenciada',
    processed:       'Procesado (soluble + T&M)',
    total:           'Total',
    bags:            'sacas',
  },
}

let root        // <div id="brazil-chart-canvas">
let data        // loaded JSON payload
let svg         // d3 selection of root <svg>
let hasBooted = false
let viewMode = 'bags'    // 'bags' | 'share'
let xScale, innerH, parsedMonths

export function wireBrazilChart() {
  root = document.getElementById('brazil-chart-canvas')
  if (!root) return

  const ro = new ResizeObserver(entries => {
    requestAnimationFrame(() => {
      const w = entries[0].contentRect.width
      if (!hasBooted && w > 0) {
        hasBooted = true
        boot()
      } else if (hasBooted) {
        render()
      }
    })
  })
  ro.observe(root)

  // Wire toggle buttons (in #brazil-chart-toggle, sibling of canvas).
  const toggle = document.getElementById('brazil-chart-toggle')
  if (toggle) {
    toggle.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mode]')
      if (!btn) return
      const next = btn.dataset.mode
      if (next === viewMode) return
      viewMode = next
      for (const b of toggle.querySelectorAll('button[data-mode]')) {
        const active = b.dataset.mode === viewMode
        b.setAttribute('aria-pressed', active ? 'true' : 'false')
        b.classList.toggle('text-neutral-200', active)
        b.classList.toggle('text-neutral-400', !active)
      }
      if (hasBooted) render()
    })
  }

  subscribe((next, prev) => {
    if (!hasBooted) return
    // Will be implemented in Tasks 12 and 14.
  })
}

async function boot() {
  data = await loadBrazilMonthly()
  parsedMonths = data.months.map(s => {
    const [y, m] = s.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  render()
}

function render() {
  // Implemented in Task 10.
}
```

- [ ] **Step 2: Wire it into main.js**

Open `viz/coffee-trade/main.js`. Find the existing import of `wireColombiaChart`:

```js
import { wireColombiaChart } from './modules/colombia-chart.js'
```

Add directly below:

```js
import { wireBrazilChart } from './modules/brazil-chart.js'
```

Find the existing call `wireColombiaChart()` inside `boot()`. Add directly below:

```js
  wireBrazilChart()
```

- [ ] **Step 3: Verify boot fires**

Add a `console.log('brazil-chart boot fired')` line at the top of `boot()` inside `brazil-chart.js`.

Run `npm run dev`. Open the viz. Click the Brazil tab. Expected: the log message appears in the console exactly once. Switch to another tab and back to Brazil — the log should NOT fire again (lazy bootstrap).

Remove the debug log line.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/brazil-chart.js viz/coffee-trade/main.js
git commit -m "Coffee trade: add brazil-chart.js skeleton with lazy bootstrap"
```

---

## Task 10: Render 5-band stacked area (absolute view)

**Files:**
- Modify: `viz/coffee-trade/modules/brazil-chart.js`

- [ ] **Step 1: Implement render()**

Replace the empty `render()` function in `brazil-chart.js` with this implementation. Also add helper utilities at the top of the module (after the constants):

```js
const MARGIN = { top: 8, right: 8, bottom: 18, left: 48 }

function dims() {
  const w = root.clientWidth
  const h = root.clientHeight
  return {
    w,
    h,
    innerW: Math.max(0, w - MARGIN.left - MARGIN.right),
    innerH: Math.max(0, h - MARGIN.top - MARGIN.bottom),
  }
}

function stackedData() {
  const stack = d3.stack()
    .keys(CATEGORIES)
    .order(d3.stackOrderNone)
    .offset(viewMode === 'share' ? d3.stackOffsetExpand : d3.stackOffsetNone)
  return stack(data.months.map((_, i) => {
    const row = { i }
    for (const c of CATEGORIES) row[c] = data[c][i]
    return row
  }))
}
```

Replace `render()`:

```js
function render() {
  if (!data) return
  const { w, h, innerW, innerH: ih } = dims()
  if (innerW === 0 || ih === 0) return
  innerH = ih

  if (!svg) {
    svg = d3.select(root)
      .append('svg')
      .attr('class', 'block w-full h-full')
    svg.append('g').attr('class', 'plot')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
    svg.append('g').attr('class', 'x-axis')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top + ih})`)
    svg.append('g').attr('class', 'y-axis')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  }
  svg.attr('viewBox', `0 0 ${w} ${h}`)

  xScale = d3.scaleTime()
    .domain(d3.extent(parsedMonths))
    .range([0, innerW])

  const stacked = stackedData()
  const yMax = d3.max(stacked, layer => d3.max(layer, d => d[1]))
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([ih, 0])

  const area = d3.area()
    .x((_, i) => xScale(parsedMonths[i]))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  const plot = svg.select('g.plot')
  const layers = plot.selectAll('path.layer').data(stacked, d => d.key)
  layers.enter()
    .append('path')
    .attr('class', 'layer')
    .merge(layers)
    .attr('fill', d => COLORS[d.key])
    .attr('d', area)
  layers.exit().remove()

  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeYear.every(1))
    .tickFormat(d3.timeFormat('%Y'))
    .tickSize(4)
  svg.select('g.x-axis')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top + ih})`)
    .call(xAxis)
    .call(g => g.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10))
    .call(g => g.selectAll('line, path').attr('stroke', '#404040'))

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(viewMode === 'share'
      ? d3.format('.0%')
      : v => `${(v / 1e6).toFixed(1)}M`)
    .tickSize(4)
  svg.select('g.y-axis')
    .call(yAxis)
    .call(g => g.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10))
    .call(g => g.selectAll('line, path').attr('stroke', '#404040'))
}
```

- [ ] **Step 2: Add legend below the chart**

Add this helper at the bottom of the module (just before the exports section):

```js
function renderLegend() {
  if (!root) return
  let legend = root.parentElement.querySelector('.brazil-legend')
  if (!legend) {
    legend = document.createElement('div')
    legend.className = 'brazil-legend flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-neutral-400'
    root.after(legend)
  }
  const lang = getState().lang || 'en'
  legend.innerHTML = CATEGORIES.slice().reverse().map(c => `
    <span class="inline-flex items-center gap-1.5">
      <span class="inline-block w-2.5 h-2.5" style="background:${COLORS[c]}"></span>
      ${LABELS[lang][c]}
    </span>`).join('')
}
```

Call `renderLegend()` from inside `render()`, after the layer paths are drawn (just before the x-axis block):

```js
  renderLegend()
```

- [ ] **Step 3: Verify visually**

```bash
npm run dev
```

Open the Brazil tab. Expected:
- 5-band stacked area chart fills the canvas
- Bottom band (largest, brown) is `arabica_natural`
- Top band (thinnest, light blue) is `robusta_diff`
- Y-axis shows values in millions of bags (e.g., `5.0M`, `10.0M`)
- X-axis shows years 2017 through current
- Legend appears below with 5 colored swatches and labels

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/brazil-chart.js
git commit -m "Coffee trade: render Brazil 5-band stacked area chart"
```

---

## Task 11: Wire the Bags ⇄ % toggle

**Files:**
- Modify: `viz/coffee-trade/modules/brazil-chart.js`

- [ ] **Step 1: Confirm toggle is already wired**

The toggle click handler was added in Task 9's `wireBrazilChart()`. The render function already reads `viewMode` and uses `d3.stackOffsetExpand` for share mode and the right tick format. The work in this task is to verify, not to add new code.

- [ ] **Step 2: Verify visually**

```bash
npm run dev
```

Brazil tab. Click `%` button. Expected:
- Stack flattens into a 100%-height area chart
- Y-axis re-labels as `0%`, `25%`, `50%`, `75%`, `100%`
- `arabica_natural` band (bottom) takes ~60-70% of vertical space
- `arabica_diff` band visibly grows from ~10% in 2017 to ~17%+ in 2023+
- Toggle button styling updates: active button has `text-neutral-200`, inactive has `text-neutral-400`

Click `Bags` to switch back. Expected: chart returns to absolute view.

Stop the dev server.

- [ ] **Step 3: Commit (no code changes)**

If no code changes were needed in this task, skip the commit. If you had to fix a bug, commit it:

```bash
git add viz/coffee-trade/modules/brazil-chart.js
git commit -m "Coffee trade: fix Brazil chart toggle [describe fix]"
```

---

## Task 12: Year-band synced to main slider

**Files:**
- Modify: `viz/coffee-trade/modules/brazil-chart.js`

- [ ] **Step 1: Add year-band rendering**

In `brazil-chart.js`, add this helper function (after `renderLegend()`):

```js
function updateBand() {
  if (!svg || !data) return
  const plot = svg.select('g.plot')
  let band = plot.select('rect.year-band')
  if (band.empty()) {
    band = plot.insert('rect', ':first-child').attr('class', 'year-band')
  }

  const year = getState().year
  const startYear = Number(data.start_month.slice(0, 4))
  const endYear = Number(data.end_month.slice(0, 4))
  if (!year || year < startYear || year > endYear) {
    band.attr('display', 'none')
    return
  }
  const x0 = xScale(new Date(year, 0, 1))
  const x1 = xScale(new Date(year, 11, 31))
  band.attr('display', null)
    .attr('x', x0)
    .attr('y', 0)
    .attr('width', Math.max(0, x1 - x0))
    .attr('height', innerH)
    .attr('fill', 'var(--color-brand)')
    .attr('fill-opacity', 0.08)
    .attr('stroke', 'var(--color-brand)')
    .attr('stroke-dasharray', '2 3')
    .attr('stroke-opacity', 0.5)
}
```

Call `updateBand()` from the end of `render()`.

- [ ] **Step 2: Subscribe to year changes**

Update the `subscribe()` call inside `wireBrazilChart()`:

```js
  subscribe((next, prev) => {
    if (!hasBooted) return
    if (next.year !== prev.year) updateBand()
  })
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Brazil tab. Move the year slider through 2015 → 2018 → 2023 → 2026. Expected:
- 2015, 2016: no band (outside Brazil's data range)
- 2018: vertical band covers the full year, dashed brand-colored border
- 2023: band slides to 2023's x-range
- 2026: band shows only Jan-Apr (or however far data goes), because end_month is mid-year

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/brazil-chart.js
git commit -m "Coffee trade: add year-band sync to Brazil chart"
```

---

## Task 13: Hover guide and tooltip

**Files:**
- Modify: `viz/coffee-trade/modules/brazil-chart.js`

- [ ] **Step 1: Add tooltip + guide elements**

Add these helpers below `updateBand()`:

```js
function ensureTooltip() {
  let t = root.querySelector('.brazil-tooltip')
  if (!t) {
    t = document.createElement('div')
    t.className = 'brazil-tooltip absolute pointer-events-none hidden bg-neutral-900/95 border border-neutral-700 rounded p-2 text-[11px] text-neutral-200 shadow-lg'
    t.style.zIndex = '10'
    root.appendChild(t)
  }
  return t
}

function ensureGuide() {
  if (!svg) return null
  let g = svg.select('line.guide')
  if (g.empty()) {
    g = svg.append('line')
      .attr('class', 'guide pointer-events-none')
      .attr('stroke', '#e5e5e5')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-dasharray', '2 3')
      .attr('display', 'none')
  }
  return g
}

function attachHover() {
  if (!svg) return
  const overlay = svg.selectAll('rect.hover-overlay').data([null])
  overlay.enter().append('rect')
    .attr('class', 'hover-overlay')
    .attr('fill', 'transparent')
    .merge(overlay)
    .attr('x', MARGIN.left)
    .attr('y', MARGIN.top)
    .attr('width', dims().innerW)
    .attr('height', innerH)
    .on('pointermove', onMove)
    .on('pointerleave', onLeave)
}

function onMove(event) {
  const [mx] = d3.pointer(event, svg.node())
  const xIn = mx - MARGIN.left
  if (xIn < 0 || xIn > dims().innerW) return onLeave()
  const t = xScale.invert(xIn)
  const idx = d3.leastIndex(parsedMonths, d => Math.abs(d - t))
  if (idx == null) return onLeave()

  const xAt = xScale(parsedMonths[idx]) + MARGIN.left
  ensureGuide()
    .attr('display', null)
    .attr('x1', xAt).attr('x2', xAt)
    .attr('y1', MARGIN.top).attr('y2', MARGIN.top + innerH)

  const tooltip = ensureTooltip()
  const lang = getState().lang || 'en'
  const L = LABELS[lang]
  const monthLabel = parsedMonths[idx].toLocaleDateString(
    lang === 'es' ? 'es-CO' : 'en-US',
    { month: 'short', year: 'numeric' })
  const total = CATEGORIES.reduce((s, c) => s + data[c][idx], 0)
  const fmt = (v) => viewMode === 'share'
    ? `${((v / total) * 100).toFixed(1)}%`
    : `${(v / 1000).toFixed(0)}k ${L.bags}`
  const rows = CATEGORIES.slice().reverse().map(c => `
    <div class="flex items-center gap-2">
      <span class="inline-block w-2 h-2" style="background:${COLORS[c]}"></span>
      <span class="flex-1">${L[c]}</span>
      <span class="tabular-nums">${fmt(data[c][idx])}</span>
    </div>`).join('')
  tooltip.innerHTML = `
    <div class="font-medium mb-1">${monthLabel}</div>
    ${rows}
    <div class="border-t border-neutral-700 mt-1 pt-1 flex items-center gap-2">
      <span class="flex-1">${L.total}</span>
      <span class="tabular-nums">${viewMode === 'share' ? '100%' : `${(total / 1000).toFixed(0)}k ${L.bags}`}</span>
    </div>`
  tooltip.classList.remove('hidden')

  // Position tooltip near pointer but constrained inside root.
  const rootRect = root.getBoundingClientRect()
  const tooltipW = tooltip.offsetWidth || 180
  const left = Math.min(Math.max(0, xAt - tooltipW / 2), rootRect.width - tooltipW)
  tooltip.style.left = `${left}px`
  tooltip.style.top = `${MARGIN.top}px`
}

function onLeave() {
  ensureGuide()?.attr('display', 'none')
  const t = root.querySelector('.brazil-tooltip')
  if (t) t.classList.add('hidden')
}
```

- [ ] **Step 2: Call attachHover() from render()**

At the very end of `render()`, after `updateBand()`:

```js
  attachHover()
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Brazil tab. Move the cursor across the chart. Expected:
- A vertical dashed guide-line follows the cursor, snapping to the nearest month
- Tooltip shows: month label (e.g. "Apr 2024"), 5 rows of band values, total
- In Bags mode: values like `1200k bags`, `120k bags`
- In % mode: percentages like `60.2%`, `17.0%`, total shows `100%`
- Tooltip hides when cursor leaves the chart area

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/brazil-chart.js
git commit -m "Coffee trade: add hover guide and tooltip to Brazil chart"
```

---

## Task 14: Language sync (EN/ES)

**Files:**
- Modify: `viz/coffee-trade/modules/brazil-chart.js`

- [ ] **Step 1: Re-render on language change**

Update the `subscribe()` call inside `wireBrazilChart()`:

```js
  subscribe((next, prev) => {
    if (!hasBooted) return
    if (next.year !== prev.year) updateBand()
    if (next.lang !== prev.lang) renderLegend()
    // Tooltip language updates on next pointermove (it reads getState().lang
    // inside onMove), so no action needed here.
  })
```

- [ ] **Step 2: Verify**

```bash
npm run dev
```

Brazil tab. Click `ES` in the language selector. Expected:
- Tab button label changes to "Brasil"
- Chart title changes to "Composición de las exportaciones de café de Brasil (2017–presente)"
- Toggle button labels become "Sacas" / "%"
- Legend re-renders with Spanish labels (e.g. "Arábica natural", "Procesado (soluble + T&M)")
- Hover over the chart: tooltip shows month in Spanish (e.g. "abr. 2024"), band names in Spanish, "sacas" suffix

Click `EN`. Expected: everything reverts to English.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add viz/coffee-trade/modules/brazil-chart.js
git commit -m "Coffee trade: sync Brazil chart legend and tooltip with EN/ES toggle"
```

---

## Task 15: Final visual verification and production build

**Files:** No code changes unless verification surfaces a bug.

- [ ] **Step 1: Cross-tab verification**

```bash
npm run dev
```

Open `http://localhost:5173/viz/coffee-trade/`. Cycle through all five tabs (Insights → Recent → Colombia → Brazil → Corridors). Expected:
- Each tab renders correctly
- Brazil chart only renders when its tab is active (lazy bootstrap)
- Switching tabs hides previous tab's content, including Brazil's chart canvas
- No console errors

- [ ] **Step 2: Toggle, slider, and resize**

On the Brazil tab:
- Toggle Bags ⇄ % — chart updates smoothly
- Move year slider through 2015, 2018, 2023, 2026 — year-band appears/hides per data range
- Resize the browser window (drag from wide to narrow viewport) — chart re-renders without overflowing or breaking layout

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build succeeds, `dist/viz/coffee-trade/index.html` exists, `dist/viz/coffee-trade/data/brazil-monthly.json` exists.

```bash
ls -1 dist/viz/coffee-trade/data/ | grep brazil
```

Expected: `brazil-monthly.json` is present.

- [ ] **Step 4: Preview server check**

```bash
npm run preview -- --port 4173 > /tmp/preview.log 2>&1 &
echo $! > /tmp/preview.pid
sleep 2
curl -s -o /dev/null -w "brazil-monthly.json: HTTP %{http_code} | %{content_type}\n" http://localhost:4173/viz/coffee-trade/data/brazil-monthly.json
kill $(cat /tmp/preview.pid)
```

Expected: `brazil-monthly.json: HTTP 200 | application/json`.

Manually open `http://localhost:4173/viz/coffee-trade/` (start preview again with `npm run preview` if you killed it) and verify the Brazil tab renders identically to dev mode.

Stop the preview server.

- [ ] **Step 5: Commit anything that surfaced (if anything)**

If verification surfaced bugs and you fixed them in this task, commit those fixes. Otherwise:

```bash
echo "No additional commits needed — verification passed."
```

---

## Out of Scope (do not implement)

- Varietal-level breakdowns (Geisha, Bourbon, Catuaí)
- Process-level breakdowns (natural, washed, honey)
- Brazilian domestic consumption (ABIC data) — possible future tab
- Specialty sub-category breakdown (Cecafé bundles these into "diferenciados")
- Click-to-mute legend interactivity

## Known Risks

See `docs/superpowers/specs/2026-05-25-brazil-tab-design.md` § "Open Risks" for parser drift mitigations.
