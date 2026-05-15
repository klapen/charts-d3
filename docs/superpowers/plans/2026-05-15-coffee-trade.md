# Coffee Trade Viz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new gallery viz at `viz/coffee-trade/` showing animated global coffee trade flows (force-directed graph with particle animation), backed by a one-shot Python pipeline at `scripts/coffee-trade/` that fetches data from UN Comtrade + ICO and emits pre-baked JSON files.

**Architecture:** Two trees. (1) Python ETL: `httpx` for downloads, DuckDB for transformation, JSON output committed to git. (2) Frontend: D3 v7 force simulation, SVG for top tier (~30 nodes), Canvas overlay for particles, Canvas renderer for full tier (~150 nodes). Pub/sub state, breakpoint-driven responsive layout, EN/ES i18n consistent with the rest of the gallery.

**Tech Stack:**
- Python 3.12, uv, httpx, duckdb, pyarrow, pandas
- D3 v7.9 (already in package.json), Vite, vanilla JS modules
- Tailwind CSS v4 (already wired)

> **Important conventions for this repo:**
> - **No automated tests** — neither for Python ETL nor for D3 viz. Verification is manual (run the script, eyeball the output; load the viz, click around). See `memory/feedback_no_tests.md` for context.
> - **Responsive sizing must be breakpoint-driven** — bucket container width to discrete breakpoints; only rebuild layout at threshold crossings. See `memory/feedback_responsive_sizing.md`.
> - **Spec is the source of truth.** Open `docs/superpowers/specs/2026-05-15-coffee-trade-design.md` before starting any task and cross-check.

---

## File Structure (decomposition)

### Python pipeline — `scripts/coffee-trade/`

| File | Responsibility |
|---|---|
| `pyproject.toml` | uv project manifest, pinned deps |
| `README.md` | Operator-facing run instructions + refresh cadence table |
| `.gitignore` | Excludes `data/raw/` and `data/processed/` |
| `data/reference/iso_3166.csv` | ISO 3166 country lookup (committed) |
| `data/reference/country_centroids.csv` | Country lat/lon for `meta.json` (committed) |
| `download_ico.py` | Plain HTTP GET against ICO public CSVs |
| `download_comtrade.py` | Resumable, rate-limited Comtrade fetcher |
| `transform.py` | DuckDB SQL: dedupe, ISO normalize, aggregate |
| `build_viz_data.py` | parquet → final JSON files |

### Frontend viz — `viz/coffee-trade/`

| File | Responsibility |
|---|---|
| `index.html` | Page shell, header, controls markup, language toggle |
| `style.css` | Local additions on top of Tailwind (palette, layout) |
| `main.js` | Entry — wires modules, owns state object |
| `modules/state.js` | 30-line pub/sub for current `{year, type, tier, ...}` |
| `modules/data-loader.js` | Fetch `meta.json` once; lazy-load + cache per-year files |
| `modules/scales.js` | Radius, link width, particle radius, color-by-region |
| `modules/force-sim.js` | `d3-force` setup, tick handler |
| `modules/renderer-svg.js` | Top-tier SVG renderer |
| `modules/renderer-canvas.js` | Full-tier Canvas renderer |
| `modules/particles.js` | `requestAnimationFrame` loop drawing particles on a dedicated Canvas |
| `modules/controls.js` | Slider, play button, type toggle, tier toggle wiring |
| `modules/tooltip.js` | Hover + click interactions, tooltip DOM |
| `modules/responsive.js` | Breakpoint detection + ResizeObserver |
| `modules/i18n.js` | EN/ES strings + language-change handler |

### Cross-cutting

| File | Responsibility |
|---|---|
| `README.md` (top-level) | Add one line under "Layout" tree referencing `scripts/coffee-trade/` |
| `index.html` (top-level) | Add one card for the new viz |
| `img/coffee-trade.webp` | Placeholder thumbnail (data:image until a screenshot exists) |

---

## Phase A — Python pipeline

### Task A1: Skeleton + reference data

**Files:**
- Create: `scripts/coffee-trade/pyproject.toml`
- Create: `scripts/coffee-trade/README.md`
- Create: `scripts/coffee-trade/.gitignore`
- Create: `scripts/coffee-trade/data/reference/iso_3166.csv`
- Create: `scripts/coffee-trade/data/reference/country_centroids.csv`

- [ ] **Step 1: Create the folder structure**

```bash
mkdir -p scripts/coffee-trade/data/raw/comtrade
mkdir -p scripts/coffee-trade/data/raw/ico
mkdir -p scripts/coffee-trade/data/processed
mkdir -p scripts/coffee-trade/data/reference
```

- [ ] **Step 2: Write `pyproject.toml`**

Content:

```toml
[project]
name = "coffee-trade-etl"
version = "0.1.0"
description = "ETL for charts-d3 coffee-trade viz"
requires-python = ">=3.12"
dependencies = [
    "httpx>=0.27",
    "duckdb>=1.0",
    "pyarrow>=16",
    "pandas>=2.2",
]

[tool.uv]
package = false
```

- [ ] **Step 3: Write `.gitignore`**

```
data/raw/
data/processed/
.venv/
__pycache__/
*.pyc
```

- [ ] **Step 4: Write `README.md`**

```markdown
# Coffee trade — data pipeline

Pre-fetches and transforms coffee trade flows from UN Comtrade + ICO into the
JSON files served by `viz/coffee-trade/`. Run manually, ~once a year.

## When to run

| Source     | Refresh recommendation                       |
|------------|----------------------------------------------|
| Comtrade   | June of year Y+1, to capture year Y cleanly  |
| ICO        | Same yearly cadence; ICO is the cross-check  |

Re-running mid-year wastes API quota — Comtrade's current-year numbers stay
partial until ~Q2 of the following year.

## Run

    uv sync
    uv run python download_comtrade.py        # ~30 min, resumable
    uv run python download_ico.py             # ~30 sec
    uv run python transform.py                # ~10 sec
    uv run python build_viz_data.py           # ~5 sec

Then `git status` should show new/updated files only under `viz/coffee-trade/data/`.
Commit those.

## Adding a year

Edit `YEARS = range(2015, 2024)` at the top of `download_comtrade.py`. Re-run
all four steps. The downloader skips years already on disk under `raw/comtrade/`.

## Refreshing a single year

Delete `raw/comtrade/{year}/` and re-run. Everything else stays cached.
```

- [ ] **Step 5: Add `data/reference/iso_3166.csv`**

This is a minimal ISO 3166-1 alpha-3 lookup. Use the Wikipedia source list ([https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3)). Schema (committed file):

```csv
iso3,name,aliases
BRA,Brazil,Brasil
COL,Colombia,Colombie
USA,United States,United States of America|US|USA
DEU,Germany,Deutschland|FRG
…
```

`aliases` is pipe-separated. Include all ~250 territories. (For the engineer: it's fine to copy from a maintained source like https://github.com/datasets/country-codes — strip down to columns `ISO3166-1-Alpha-3` and `official_name_en`; add an `aliases` column manually for the ~30 country names where Comtrade and ICO disagree, e.g. `"Korea, Rep."|"Republic of Korea"` → `KOR`.)

- [ ] **Step 6: Add `data/reference/country_centroids.csv`**

Lat/lon centroids per ISO3, used to populate `meta.json` and (optionally, in a future tier) to seed force positions. Source: [https://developers.google.com/public-data/docs/canonical/countries_csv](https://developers.google.com/public-data/docs/canonical/countries_csv) — its `country` column is alpha-2; the engineer must map it to alpha-3 using the file from Step 5. Schema:

```csv
iso3,name,lat,lon,region
BRA,Brazil,-14.235,-51.925,South America
COL,Colombia,4.571,-74.297,South America
USA,United States,37.090,-95.713,North America
…
```

`region` follows the spec's 5 buckets: South America, North America, Europe, Africa, Asia (Oceania → Asia for simplicity).

- [ ] **Step 7: Verify `uv sync` works**

Run:
```bash
cd scripts/coffee-trade && uv sync
```
Expected: creates `.venv/`, prints `Resolved N packages`. No errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/coffee-trade/pyproject.toml scripts/coffee-trade/README.md \
        scripts/coffee-trade/.gitignore \
        scripts/coffee-trade/data/reference/iso_3166.csv \
        scripts/coffee-trade/data/reference/country_centroids.csv
git commit -m "Scaffold scripts/coffee-trade with reference data"
```

---

### Task A2: `download_ico.py`

**Files:**
- Create: `scripts/coffee-trade/download_ico.py`

- [ ] **Step 1: Write the downloader**

```python
"""Download annual coffee statistics from ICO public datasets.

Run: uv run python download_ico.py
Output: data/raw/ico/*.csv
"""
from __future__ import annotations
import csv
import logging
import sys
from pathlib import Path
import httpx

# ICO publishes monthly historical statistics as CSVs at fixed URLs.
# Sources: https://www.ico.org/new_historical.asp
# These files cover 1990+ and are small (~50 KB each).
ICO_DATASETS = {
    "exports": "https://www.ico.org/historical/1990%20onwards/CSV/1a-total-production.csv",
    "imports": "https://www.ico.org/historical/1990%20onwards/CSV/3a-imports.csv",
    "reexports": "https://www.ico.org/historical/1990%20onwards/CSV/4-re-exports.csv",
}

RAW_DIR = Path(__file__).parent / "data" / "raw" / "ico"
log = logging.getLogger("ico")


def download_one(client: httpx.Client, name: str, url: str) -> None:
    out = RAW_DIR / f"{name}.csv"
    log.info("GET %s -> %s", url, out)
    r = client.get(url, follow_redirects=True, timeout=30.0)
    r.raise_for_status()
    out.write_bytes(r.content)
    log.info("  %d bytes", len(r.content))


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    with httpx.Client() as client:
        for name, url in ICO_DATASETS.items():
            try:
                download_one(client, name, url)
            except httpx.HTTPError as exc:
                log.error("Failed %s: %s", name, exc)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the script**

```bash
cd scripts/coffee-trade && uv run python download_ico.py
```

Expected output: three lines like `2026-... INFO GET https://... -> .../data/raw/ico/exports.csv` followed by `... bytes`.

- [ ] **Step 3: Eyeball the output files**

```bash
ls -la scripts/coffee-trade/data/raw/ico/
head -3 scripts/coffee-trade/data/raw/ico/exports.csv
```

Expected: three CSVs present; each starts with a header row and has comma-separated numeric columns. If any file is HTML (ICO returned an error page), inspect the URL in a browser — ICO occasionally renames CSVs; update the constants and re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/coffee-trade/download_ico.py
git commit -m "Add ICO downloader for annual coffee statistics"
```

---

### Task A3: `download_comtrade.py`

**Files:**
- Create: `scripts/coffee-trade/download_comtrade.py`

UN Comtrade exposes a free-tier API at `https://comtradeapi.un.org/public/v1/`. The free endpoint does not require an API key for the `preview` data and is rate-limited to ~1 request/sec. Documentation: [https://uncomtrade.org/docs/welcome-to-un-comtrade/](https://uncomtrade.org/docs/welcome-to-un-comtrade/). If the URL or surface has shifted since this plan was written, check the docs and adapt the request signature accordingly — keep the resumable-on-disk pattern intact.

- [ ] **Step 1: Write the downloader**

```python
"""Download coffee trade flows from UN Comtrade free-tier API.

Manual, ~yearly job. See README.md before running.

Run: uv run python download_comtrade.py
Output: data/raw/comtrade/{year}/{reporter_iso3}.json
"""
from __future__ import annotations
import json
import logging
import sys
import time
from pathlib import Path
from typing import Iterable
import httpx

YEARS: list[int] = list(range(2015, 2024))  # inclusive 2015..2023
HS_CODES = ["090111", "090112", "090121", "090122"]
BASE_URL = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
REQ_SLEEP_SECONDS = 1.1  # respect ~1 req/sec free-tier limit
MAX_RETRIES = 5
RAW_DIR = Path(__file__).parent / "data" / "raw" / "comtrade"
REPORTERS_CACHE = Path(__file__).parent / "data" / "raw" / "reporters.json"
FAILURES_CSV = Path(__file__).parent / "data" / "raw" / "failures.csv"
log = logging.getLogger("comtrade")


def fetch_reporters(client: httpx.Client) -> list[dict]:
    """Return Comtrade's current reporter list, cached on disk after first run."""
    if REPORTERS_CACHE.exists():
        return json.loads(REPORTERS_CACHE.read_text())
    log.info("Fetching reporter list")
    r = client.get(
        "https://comtradeapi.un.org/files/v1/app/reference/Reporters.json",
        timeout=30.0,
    )
    r.raise_for_status()
    data = r.json()["results"]
    REPORTERS_CACHE.write_text(json.dumps(data))
    return data


def fetch_year_reporter(
    client: httpx.Client, year: int, reporter_code: str
) -> dict | None:
    """Fetch one (year, reporter) tuple covering all 4 HS codes."""
    url = (
        f"{BASE_URL}/{year}/ALL?"
        f"reporterCode={reporter_code}"
        f"&cmdCode={','.join(HS_CODES)}"
        f"&flowCode=M,X"          # imports + exports
        f"&motCode=0&customsCode=C00&partner2Code=0"
    )
    backoff = 1.0
    for attempt in range(MAX_RETRIES):
        try:
            r = client.get(url, timeout=60.0)
            if r.status_code == 200:
                return r.json()
            if r.status_code in (429, 500, 502, 503, 504):
                log.warning("  %s on attempt %d, sleeping %.1fs", r.status_code, attempt + 1, backoff)
                time.sleep(backoff)
                backoff *= 2
                continue
            log.error("  permanent %s for %s/%s", r.status_code, year, reporter_code)
            return None
        except httpx.HTTPError as exc:
            log.warning("  network err on attempt %d: %s", attempt + 1, exc)
            time.sleep(backoff)
            backoff *= 2
    return None


def log_failure(year: int, iso3: str, reason: str) -> None:
    FAILURES_CSV.parent.mkdir(parents=True, exist_ok=True)
    new = not FAILURES_CSV.exists()
    with FAILURES_CSV.open("a") as f:
        if new:
            f.write("year,iso3,reason\n")
        f.write(f"{year},{iso3},{reason}\n")


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    with httpx.Client() as client:
        reporters = fetch_reporters(client)

        # The reporter list includes "World" and aggregates; keep only countries
        # that have a 3-letter ISO code in their record.
        countries = [
            r for r in reporters
            if r.get("isoAlpha3") and len(r["isoAlpha3"]) == 3
        ]
        log.info("%d reporter countries", len(countries))

        for year in YEARS:
            year_dir = RAW_DIR / str(year)
            year_dir.mkdir(parents=True, exist_ok=True)

            for c in countries:
                iso3 = c["isoAlpha3"]
                reporter_code = str(c["id"])  # Comtrade numeric code
                out = year_dir / f"{iso3}.json"
                if out.exists():
                    continue  # resumable: skip already-downloaded

                log.info("year=%d reporter=%s (%s)", year, iso3, c.get("text"))
                data = fetch_year_reporter(client, year, reporter_code)
                if data is None:
                    log_failure(year, iso3, "fetch_failed")
                else:
                    out.write_text(json.dumps(data))
                time.sleep(REQ_SLEEP_SECONDS)

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Smoke-test against one year/one country**

Don't run a full year-by-year fetch yet — that's 30+ minutes. Instead, edit `YEARS = [2020]` temporarily and limit reporters to a single test:

```bash
cd scripts/coffee-trade && uv run python -c "
import httpx, json
from download_comtrade import fetch_reporters, fetch_year_reporter
with httpx.Client() as c:
    reps = fetch_reporters(c)
    bra = next(r for r in reps if r.get('isoAlpha3') == 'BRA')
    data = fetch_year_reporter(c, 2020, str(bra['id']))
    print(type(data), 'records:' , len(data.get('data', [])) if data else None)
"
```

Expected: prints a dict with hundreds of records for Brazil 2020. If the response is empty or the URL has shifted, see the docs link at the top of the file and adjust the URL builder.

- [ ] **Step 3: Run the full job**

```bash
cd scripts/coffee-trade && uv run python download_comtrade.py
```

Expected: ~30 minutes of `INFO year=... reporter=...` lines. Resumable — Ctrl-C is safe. After completion, expect ~200 JSON files per year under `data/raw/comtrade/{year}/`.

- [ ] **Step 4: Inspect output**

```bash
ls scripts/coffee-trade/data/raw/comtrade/2020/ | head
wc -l scripts/coffee-trade/data/raw/failures.csv 2>/dev/null || echo "no failures"
```

Expected: ~150–200 JSON files in `2020/`. `failures.csv` is either missing or contains only a small number of countries (typically tiny territories Comtrade doesn't cover).

- [ ] **Step 5: Commit**

```bash
git add scripts/coffee-trade/download_comtrade.py
git commit -m "Add resumable Comtrade downloader for HS 0901 family"
```

---

### Task A4: `transform.py`

**Files:**
- Create: `scripts/coffee-trade/transform.py`

- [ ] **Step 1: Write the transformer**

```python
"""Normalize raw Comtrade + ICO into parquet for build_viz_data.py.

Run: uv run python transform.py
Output:
  data/processed/flows.parquet    one row per (year, source_iso3, target_iso3, hs_code)
  data/processed/nodes.parquet    one row per (year, iso3) with total exports/imports
"""
from __future__ import annotations
import logging
import sys
from pathlib import Path
import duckdb

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
REFERENCE = ROOT / "data" / "reference"
log = logging.getLogger("transform")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    PROCESSED.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")

    # --- Load reference tables ---
    con.execute(f"""
        CREATE TABLE iso AS
        SELECT * FROM read_csv_auto('{REFERENCE / "iso_3166.csv"}', header=true);
    """)
    con.execute(f"""
        CREATE TABLE centroids AS
        SELECT * FROM read_csv_auto('{REFERENCE / "country_centroids.csv"}', header=true);
    """)

    # --- Comtrade raw -> normalized flows ---
    # Comtrade records have fields: refYear, reporterISO, partnerISO, cmdCode,
    # flowCode ("M" import / "X" export), primaryValue (USD), netWgt (kg).
    log.info("Loading Comtrade raw JSON")
    con.execute(f"""
        CREATE TABLE comtrade_raw AS
        SELECT
            CAST(refYear AS INTEGER)        AS year,
            UPPER(reporterISO)              AS reporter,
            UPPER(partnerISO)               AS partner,
            CAST(cmdCode AS VARCHAR)        AS hs_code,
            flowCode                        AS flow,
            CAST(primaryValue AS DOUBLE)    AS value_usd,
            CAST(netWgt AS DOUBLE)          AS quantity_kg
        FROM read_json_auto(
            '{RAW / "comtrade"}/**/*.json',
            format = 'array',
            filename = true,
            union_by_name = true,
            maximum_object_size = 268435456
        )
        WHERE primaryValue IS NOT NULL
          AND primaryValue > 0
          AND partnerISO IS NOT NULL
          AND partnerISO <> 'W00'  -- 'World' aggregate
          AND length(reporterISO) = 3
          AND length(partnerISO) = 3;
    """)
    n = con.execute("SELECT COUNT(*) FROM comtrade_raw").fetchone()[0]
    log.info("Comtrade raw rows: %d", n)

    # --- Use importer-side report when available, else exporter-side ---
    # For a Brazil -> USA flow, USA reports it as flow='M' (import from BRA).
    # Brazil reports it as flow='X' (export to USA). Importer reports are
    # generally more accurate; we prefer them and fall back to exporter.
    con.execute("""
        CREATE TABLE imports AS
        SELECT
            year,
            partner   AS source,   -- exporter
            reporter  AS target,   -- importer (the reporting side)
            hs_code, value_usd, quantity_kg
        FROM comtrade_raw
        WHERE flow = 'M';

        CREATE TABLE exports AS
        SELECT
            year,
            reporter  AS source,   -- exporter (the reporting side)
            partner   AS target,   -- importer
            hs_code, value_usd, quantity_kg
        FROM comtrade_raw
        WHERE flow = 'X';
    """)

    # Combine: prefer imports rows, supplement with exports rows where the
    # (year, source, target, hs_code) is not already present in imports.
    con.execute("""
        CREATE TABLE flows_comtrade AS
        SELECT * FROM imports
        UNION ALL
        SELECT e.* FROM exports e
        LEFT JOIN imports i USING (year, source, target, hs_code)
        WHERE i.year IS NULL;
    """)

    # --- ICO fallback for country pairs Comtrade doesn't cover ---
    # ICO CSVs are wide-format (years as columns) and aggregated by country.
    # For the prototype we use ICO only for total exports/imports totals
    # (it does not provide partner-level pairs at this level). This means
    # ICO contributes to `nodes.parquet` but not `flows.parquet`.
    # If a later refinement adds ICO partner pairs, extend this section.

    # --- Aggregate per-flow rows ---
    con.execute("""
        CREATE TABLE flows AS
        SELECT
            year,
            source,
            target,
            hs_code,
            SUM(value_usd)    AS value_usd,
            SUM(quantity_kg)  AS quantity_kg
        FROM flows_comtrade
        WHERE source <> target           -- no self-flows
        GROUP BY year, source, target, hs_code;
    """)

    # --- Nodes: per-(year, country) total exports / imports ---
    con.execute("""
        CREATE TABLE nodes AS
        SELECT
            year,
            iso3,
            COALESCE(exports_usd, 0)  AS exports_usd,
            COALESCE(imports_usd, 0)  AS imports_usd
        FROM (
            SELECT DISTINCT year, source AS iso3 FROM flows
            UNION
            SELECT DISTINCT year, target AS iso3 FROM flows
        ) c
        LEFT JOIN (
            SELECT year, source AS iso3, SUM(value_usd) AS exports_usd
            FROM flows GROUP BY year, source
        ) e USING (year, iso3)
        LEFT JOIN (
            SELECT year, target AS iso3, SUM(value_usd) AS imports_usd
            FROM flows GROUP BY year, target
        ) i USING (year, iso3);
    """)

    con.execute(f"COPY flows TO '{PROCESSED / 'flows.parquet'}' (FORMAT PARQUET);")
    con.execute(f"COPY nodes TO '{PROCESSED / 'nodes.parquet'}' (FORMAT PARQUET);")
    log.info("Wrote flows.parquet (%d) and nodes.parquet (%d)",
             con.execute("SELECT COUNT(*) FROM flows").fetchone()[0],
             con.execute("SELECT COUNT(*) FROM nodes").fetchone()[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run it**

```bash
cd scripts/coffee-trade && uv run python transform.py
```

Expected: logs `Comtrade raw rows: <hundreds-of-thousands>` and `Wrote flows.parquet (<tens-of-thousands>) and nodes.parquet (~1000)`. Runs in 5–15 seconds.

- [ ] **Step 3: Eyeball the output**

```bash
cd scripts/coffee-trade && uv run python -c "
import duckdb
con = duckdb.connect(':memory:')
print('FLOWS TOP 5:')
print(con.execute(\"SELECT * FROM read_parquet('data/processed/flows.parquet') ORDER BY value_usd DESC LIMIT 5\").df())
print('NODES TOP EXPORTERS 2020:')
print(con.execute(\"SELECT * FROM read_parquet('data/processed/nodes.parquet') WHERE year = 2020 ORDER BY exports_usd DESC LIMIT 5\").df())
"
```

Expected: Brazil should top exports for 2020; flows top-5 should be familiar trade lanes (BRA→USA, BRA→DEU, VNM→USA, COL→USA, etc.). If numbers look off (e.g. self-flows present, or USA appearing as a top exporter), debug the SQL.

- [ ] **Step 4: Commit**

```bash
git add scripts/coffee-trade/transform.py
git commit -m "Transform raw Comtrade JSON to flows/nodes parquet via DuckDB"
```

---

### Task A5: `build_viz_data.py`

**Files:**
- Create: `scripts/coffee-trade/build_viz_data.py`

- [ ] **Step 1: Write the JSON builder**

```python
"""Convert flows/nodes parquet into per-year JSON files for viz/coffee-trade/.

Run: uv run python build_viz_data.py
Output:
  ../../viz/coffee-trade/data/meta.json
  ../../viz/coffee-trade/data/{year}-{type}.json   for type in {all, green, roasted}
"""
from __future__ import annotations
import json
import logging
import sys
from datetime import date
from pathlib import Path
import duckdb

ROOT = Path(__file__).parent
PROCESSED = ROOT / "data" / "processed"
REFERENCE = ROOT / "data" / "reference"
VIZ_DATA = ROOT.parent.parent / "viz" / "coffee-trade" / "data"

GREEN_HS = ("090111", "090112")
ROASTED_HS = ("090121", "090122")
TOP_NODE_COUNT = 30   # top-tier node cap
TOP_EDGE_CAP = 100    # top-tier edge cap

log = logging.getLogger("build_viz")


def query_year_type(con, year: int, type_filter: str) -> tuple[list[dict], list[dict]]:
    """Return (nodes, edges) for a single (year, type)."""
    if type_filter == "all":
        hs_predicate = "TRUE"
    elif type_filter == "green":
        hs_predicate = f"hs_code IN {GREEN_HS}"
    else:  # roasted
        hs_predicate = f"hs_code IN {ROASTED_HS}"

    edges_df = con.execute(f"""
        SELECT source, target,
               SUM(value_usd)   AS value_usd,
               SUM(quantity_kg) AS quantity_kg
        FROM read_parquet('{PROCESSED / "flows.parquet"}')
        WHERE year = {year} AND {hs_predicate}
        GROUP BY source, target
        ORDER BY value_usd DESC
    """).df()

    if edges_df.empty:
        return [], []

    # Build node totals from the edges
    nodes_df = con.execute(f"""
        WITH e AS (
            SELECT source, target, value_usd
            FROM read_parquet('{PROCESSED / "flows.parquet"}')
            WHERE year = {year} AND {hs_predicate}
        ),
        union_nodes AS (
            SELECT source AS iso3 FROM e UNION
            SELECT target AS iso3 FROM e
        )
        SELECT u.iso3,
               COALESCE(ex.value, 0) AS exports_usd,
               COALESCE(im.value, 0) AS imports_usd
        FROM union_nodes u
        LEFT JOIN (SELECT source AS iso3, SUM(value_usd) AS value FROM e GROUP BY source) ex
            ON u.iso3 = ex.iso3
        LEFT JOIN (SELECT target AS iso3, SUM(value_usd) AS value FROM e GROUP BY target) im
            ON u.iso3 = im.iso3
        ORDER BY (COALESCE(ex.value, 0) + COALESCE(im.value, 0)) DESC
    """).df()

    nodes = [
        {"id": r.iso3, "exports_usd": float(r.exports_usd), "imports_usd": float(r.imports_usd)}
        for r in nodes_df.itertuples(index=False)
    ]
    edges = [
        {"source": r.source, "target": r.target,
         "value_usd": float(r.value_usd), "quantity_kg": float(r.quantity_kg or 0)}
        for r in edges_df.itertuples(index=False)
    ]
    return nodes, edges


def compute_tiers(nodes: list[dict], edges: list[dict]) -> dict:
    """Return {top: {node_ids, edge_indices}, full: {node_ids, edge_indices}}."""
    top_node_ids = [n["id"] for n in nodes[:TOP_NODE_COUNT]]
    top_set = set(top_node_ids)
    top_edge_indices: list[int] = []
    for i, e in enumerate(edges):
        if e["source"] in top_set and e["target"] in top_set:
            top_edge_indices.append(i)
        if len(top_edge_indices) >= TOP_EDGE_CAP:
            break
    return {
        "top":  {"node_ids": top_node_ids,             "edge_indices": top_edge_indices},
        "full": {"node_ids": [n["id"] for n in nodes], "edge_indices": list(range(len(edges)))},
    }


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    VIZ_DATA.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")
    centroids = con.execute(
        f"SELECT * FROM read_csv_auto('{REFERENCE / 'country_centroids.csv'}', header=true)"
    ).df()
    centroids_by_iso3 = {
        r.iso3: {"name": r.name, "lat": float(r.lat), "lon": float(r.lon), "region": r.region}
        for r in centroids.itertuples(index=False)
    }

    years = sorted(
        con.execute(f"SELECT DISTINCT year FROM read_parquet('{PROCESSED / 'flows.parquet'}')")
        .df()["year"].tolist()
    )
    log.info("Years available: %s", years)

    # Determine which countries appear anywhere, write centroid subset to meta
    iso3_used = set(
        con.execute(f"""
            SELECT DISTINCT source AS iso3 FROM read_parquet('{PROCESSED / 'flows.parquet'}')
            UNION
            SELECT DISTINCT target AS iso3 FROM read_parquet('{PROCESSED / 'flows.parquet'}')
        """).df()["iso3"].tolist()
    )
    countries_meta = {
        iso3: centroids_by_iso3[iso3] for iso3 in sorted(iso3_used)
        if iso3 in centroids_by_iso3
    }
    missing = iso3_used - set(centroids_by_iso3)
    if missing:
        log.warning("No centroid for %d ISO codes: %s", len(missing), sorted(missing))

    meta = {
        "version": date.today().isoformat(),
        "years": years,
        "countries": countries_meta,
    }
    (VIZ_DATA / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))

    for year in years:
        for type_filter in ("all", "green", "roasted"):
            nodes, edges = query_year_type(con, year, type_filter)
            payload = {
                "year": year,
                "type": type_filter,
                "nodes": nodes,
                "edges": edges,
                "tier": compute_tiers(nodes, edges),
            }
            out = VIZ_DATA / f"{year}-{type_filter}.json"
            out.write_text(json.dumps(payload, separators=(",", ":")))
        log.info("Wrote %d * 3 files for year %d", 1, year)

    log.info("Done. meta.json + %d year files", len(years) * 3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run it**

```bash
cd scripts/coffee-trade && uv run python build_viz_data.py
```

Expected: logs each year processed; finishes in 2–10 seconds. Output: `viz/coffee-trade/data/` with `meta.json` plus 3 files per year (9 years × 3 = 27 year-files).

- [ ] **Step 3: Inspect output**

```bash
ls viz/coffee-trade/data/
du -h viz/coffee-trade/data/* | head
python3 -c "
import json
m = json.load(open('viz/coffee-trade/data/meta.json'))
print('years:', m['years'])
print('countries:', len(m['countries']))
print('BRA:', m['countries'].get('BRA'))

d = json.load(open('viz/coffee-trade/data/2020-all.json'))
print('2020-all: nodes=%d edges=%d top_nodes=%d top_edges=%d' % (
    len(d['nodes']), len(d['edges']),
    len(d['tier']['top']['node_ids']),
    len(d['tier']['top']['edge_indices'])))
print('top exporter:', d['nodes'][0])
"
```

Expected: ~150 countries in meta; Brazil at top of 2020-all nodes; per-file size ~30–80 KB.

- [ ] **Step 4: Commit (pipeline output committed alongside the script)**

```bash
git add scripts/coffee-trade/build_viz_data.py viz/coffee-trade/data/
git commit -m "Build per-year JSON files for coffee-trade viz"
```

---

## Phase B — Frontend viz

### Task B1: Page shell + skeleton CSS

**Files:**
- Create: `viz/coffee-trade/index.html`
- Create: `viz/coffee-trade/style.css`
- Create: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Klapen · Coffee Trade</title>
    <meta name="description" content="Animated global coffee trade flows, 2015–2023." />
    <link rel="icon" href="/favicon.ico" />
  </head>
  <body class="bg-neutral-950 text-neutral-100 min-h-screen antialiased">
    <header class="border-b border-neutral-800">
      <div class="max-w-6xl mx-auto px-6 py-6 flex items-start justify-between gap-4">
        <div>
          <a href="/" class="text-sm text-neutral-400 hover:text-brand"
             data-en="← Back to gallery" data-es="← Volver a la galería">← Back to gallery</a>
          <h1 class="text-2xl font-bold tracking-tight mt-2"
              data-en="Global coffee trade" data-es="Comercio global de café">Global coffee trade</h1>
          <p class="text-neutral-400 text-sm mt-1"
             data-en="Animated trade flows from UN Comtrade + ICO"
             data-es="Flujos comerciales animados — UN Comtrade + ICO">
             Animated trade flows from UN Comtrade + ICO
          </p>
        </div>
        <div class="flex items-center gap-1 text-sm" role="group" aria-label="Language">
          <button data-lang="en" class="lang-btn px-2 py-1 rounded cursor-pointer" aria-pressed="false">EN</button>
          <span class="text-neutral-700" aria-hidden="true">·</span>
          <button data-lang="es" class="lang-btn px-2 py-1 rounded cursor-pointer" aria-pressed="false">ES</button>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-6 py-6">
      <div id="chart" class="relative w-full rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden">
        <!-- SVG + Canvas inserted here by main.js -->
      </div>

      <div id="controls" class="mt-4 flex flex-wrap items-center gap-4">
        <button id="play-btn" class="px-3 py-1 rounded border border-neutral-700 bg-neutral-900 text-sm hover:border-brand"
                aria-label="Play / pause"
                data-en="Play" data-es="Reproducir">Play</button>

        <div class="flex-1 min-w-[200px] flex items-center gap-2">
          <input id="year-slider" type="range" min="0" max="0" step="1" value="0"
                 class="flex-1 accent-brand cursor-pointer" />
          <output id="year-label" class="text-sm tabular-nums text-neutral-300 w-12 text-right">—</output>
        </div>

        <select id="type-select" class="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 text-sm">
          <option value="all" data-en="All coffee" data-es="Todo el café">All coffee</option>
          <option value="green" data-en="Green" data-es="Verde">Green</option>
          <option value="roasted" data-en="Roasted" data-es="Tostado">Roasted</option>
        </select>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span class="text-neutral-500" data-en="Detail:" data-es="Detalle:">Detail:</span>
        <button data-tier="top" class="tier-btn px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:border-brand"
                data-en="Top flows" data-es="Flujos principales">Top flows</button>
        <button data-tier="full" class="tier-btn px-2 py-1 rounded border border-neutral-700 bg-neutral-900 hover:border-brand"
                data-en="All countries" data-es="Todos los países">All countries</button>
      </div>

      <ul id="legend" class="mt-4 flex flex-wrap gap-3 text-xs text-neutral-400"></ul>
    </main>

    <div id="tooltip" class="pointer-events-none fixed z-10 hidden rounded border border-neutral-700 bg-neutral-900/95 px-2 py-1 text-xs shadow-lg"></div>

    <script type="module" src="./main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `style.css`** (tiny, palette helpers; Tailwind covers most)

```css
#chart { aspect-ratio: 16 / 10; max-height: 720px; }
#chart svg, #chart canvas { display: block; width: 100%; height: 100%; position: absolute; inset: 0; }
#tooltip { font-variant-numeric: tabular-nums; }
.lang-btn[aria-pressed="true"] { color: var(--color-brand); font-weight: 600; }
```

- [ ] **Step 3: Write minimal `main.js`** (just imports CSS + logs to confirm wiring)

```js
import '../../src/styles/main.css'
import './style.css'

console.log('coffee-trade boot')
```

- [ ] **Step 4: Run dev server and load the page**

```bash
npm run dev
```

Open `http://localhost:5173/viz/coffee-trade/` in a browser.

Expected: dark page with the header, an empty chart frame at 16:10 aspect, controls row with disabled-looking slider, type/tier buttons. Console prints `coffee-trade boot`. No JS errors.

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/index.html viz/coffee-trade/style.css viz/coffee-trade/main.js
git commit -m "Scaffold coffee-trade page shell and controls markup"
```

---

### Task B2: state + data-loader + i18n + scales

**Files:**
- Create: `viz/coffee-trade/modules/state.js`
- Create: `viz/coffee-trade/modules/data-loader.js`
- Create: `viz/coffee-trade/modules/i18n.js`
- Create: `viz/coffee-trade/modules/scales.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/state.js`**

```js
// 30-line pub/sub. setState merges partial; subscribe fires on every change.
const listeners = new Set()
let state = {
  year: null,         // set from meta.years.at(-1) at boot
  type: 'all',        // 'all' | 'green' | 'roasted'
  tier: 'top',        // 'top' | 'full'
  playing: false,
  hoveredId: null,    // ISO3 of hovered node or null
  pinnedId: null,     // ISO3 of pinned node
  lang: 'en',         // 'en' | 'es'
}

export function getState() { return state }

export function setState(patch) {
  const prev = state
  state = { ...state, ...patch }
  for (const fn of listeners) fn(state, prev)
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
```

- [ ] **Step 2: Write `modules/data-loader.js`**

```js
const cache = new Map()  // key -> Promise<file>

export async function loadMeta() {
  const r = await fetch('./data/meta.json')
  if (!r.ok) throw new Error(`meta.json: ${r.status}`)
  return r.json()
}

export function loadYear(year, type) {
  const key = `${year}-${type}`
  if (!cache.has(key)) {
    cache.set(key, fetch(`./data/${key}.json`).then(r => {
      if (!r.ok) throw new Error(`${key}: ${r.status}`)
      return r.json()
    }))
  }
  return cache.get(key)
}
```

- [ ] **Step 3: Write `modules/i18n.js`**

```js
const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

export function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'en'
}

export function applyLang(lang) {
  document.documentElement.lang = lang
  for (const el of document.querySelectorAll(`[data-${lang}]`)) {
    const text = el.dataset[lang]
    if (text != null) el.textContent = text
  }
  for (const btn of document.querySelectorAll('.lang-btn')) {
    const active = btn.dataset.lang === lang
    btn.setAttribute('aria-pressed', active)
  }
  localStorage.setItem(STORAGE_KEY, lang)
}
```

- [ ] **Step 4: Write `modules/scales.js`**

```js
import * as d3 from 'd3'

export const REGION_COLOR = {
  'South America': '#ff7a59',
  'Africa':        '#f5c451',
  'Asia':          '#5ac6c0',
  'Europe':        '#9b8cff',
  'North America': '#ff6ec7',
}
export const FALLBACK_COLOR = '#8b8b95'

export function colorFor(meta, iso3) {
  const c = meta.countries[iso3]
  return (c && REGION_COLOR[c.region]) || FALLBACK_COLOR
}

export function buildScales(nodes, edges, { w, h }) {
  const maxNodeTotal = d3.max(nodes, n => n.exports_usd + n.imports_usd) || 1
  const maxEdgeValue = d3.max(edges, e => e.value_usd) || 1
  return {
    nodeRadius: d3.scaleSqrt().domain([0, maxNodeTotal]).range([3, Math.min(w, h) / 18]),
    linkWidth:  d3.scaleSqrt().domain([0, maxEdgeValue]).range([0.5, 4]),
    particleR:  d3.scaleSqrt().domain([0, maxEdgeValue]).range([1.2, 2.5]),
  }
}
```

- [ ] **Step 5: Wire it all up in `main.js`**

```js
import '../../src/styles/main.css'
import './style.css'

import { getState, setState, subscribe } from './modules/state.js'
import { loadMeta, loadYear } from './modules/data-loader.js'
import { detectLang, applyLang } from './modules/i18n.js'

async function boot() {
  const lang = detectLang()
  setState({ lang })
  applyLang(lang)

  const meta = await loadMeta()
  console.log('meta loaded:', meta.years.length, 'years', Object.keys(meta.countries).length, 'countries')

  const initialYear = meta.years.at(-1)
  setState({ year: initialYear })

  const first = await loadYear(initialYear, 'all')
  console.log('first year file:', first.nodes.length, 'nodes', first.edges.length, 'edges',
    'top:', first.tier.top.node_ids.length, 'top edges:', first.tier.top.edge_indices.length)

  // Language toggle wiring (controls.js will take this over later)
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.lang
      setState({ lang: next })
      applyLang(next)
    })
  }

  // Stub: bind year slider just so the page isn't dead
  const slider = document.getElementById('year-slider')
  const label = document.getElementById('year-label')
  slider.min = 0
  slider.max = meta.years.length - 1
  slider.value = meta.years.length - 1
  label.textContent = initialYear
}

boot().catch(err => console.error('coffee-trade boot failed', err))
```

- [ ] **Step 6: Load in the browser**

`npm run dev` is still running. Reload `/viz/coffee-trade/`.

Expected:
- Console logs `meta loaded: 9 years 150 countries` (approx) and `first year file: …`
- The year label shows e.g. `2023`
- Slider has 9 stops (0..8)
- EN/ES toggle still works (clicking changes header strings)

- [ ] **Step 7: Commit**

```bash
git add viz/coffee-trade/modules/ viz/coffee-trade/main.js
git commit -m "Add state, data-loader, i18n, scales for coffee-trade"
```

---

### Task B3: Force simulation + SVG top-tier renderer (static, no transitions)

**Files:**
- Create: `viz/coffee-trade/modules/force-sim.js`
- Create: `viz/coffee-trade/modules/renderer-svg.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/force-sim.js`**

```js
import * as d3 from 'd3'

export function buildSimulation(nodes, edges, { w, h }) {
  return d3.forceSimulation(nodes)
    .force('link',    d3.forceLink(edges).id(d => d.id)
                         .distance(d => 80 + 200 / Math.sqrt(Math.max(1, d.weight))))
    .force('charge',  d3.forceManyBody().strength(-300))
    .force('center',  d3.forceCenter(w / 2, h / 2))
    .force('collide', d3.forceCollide().radius(d => (d.radius || 6) + 4))
    .alphaTarget(0.01)   // gentle always-on drift
}
```

- [ ] **Step 2: Write `modules/renderer-svg.js`**

```js
import * as d3 from 'd3'
import { colorFor } from './scales.js'

export function createSvgRenderer(container, meta, { w, h }) {
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const linkG = svg.append('g').attr('class', 'links')
  const nodeG = svg.append('g').attr('class', 'nodes')
  const labelG = svg.append('g').attr('class', 'labels')

  let linkSel = linkG.selectAll('line')
  let nodeSel = nodeG.selectAll('circle')
  let labelSel = labelG.selectAll('text')

  function update(nodes, edges, scales) {
    // Annotate nodes with display radius for forceCollide
    for (const n of nodes) n.radius = scales.nodeRadius(n.exports_usd + n.imports_usd)

    linkSel = linkG.selectAll('line')
      .data(edges, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join('line')
        .attr('stroke', d => colorFor(meta, d.source.id || d.source))
        .attr('stroke-opacity', 0.18)
        .attr('stroke-width', d => scales.linkWidth(d.value_usd))

    nodeSel = nodeG.selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
        .attr('r', d => d.radius)
        .attr('fill', d => colorFor(meta, d.id))
        .attr('fill-opacity', 0.85)
        .attr('stroke', '#0a0a0b')
        .attr('stroke-width', 0.6)

    labelSel = labelG.selectAll('text')
      .data(nodes, d => d.id)
      .join('text')
        .text(d => (meta.countries[d.id]?.name || d.id))
        .attr('font-size', 11)
        .attr('fill', '#d4d4d8')
        .attr('text-anchor', 'middle')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#0a0a0b')
        .attr('stroke-width', 3)
        .attr('pointer-events', 'none')
  }

  function tick() {
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
    nodeSel
      .attr('cx', d => d.x).attr('cy', d => d.y)
    labelSel
      .attr('x', d => d.x).attr('y', d => d.y - d.radius - 4)
  }

  function destroy() { svg.remove() }

  function resize(next) {
    svg.attr('viewBox', `0 0 ${next.w} ${next.h}`)
  }

  return { update, tick, destroy, resize, root: svg }
}
```

- [ ] **Step 3: Subset helpers in `main.js`**

Add a small utility at the top of `main.js` (after imports) to materialize the active tier from a raw file:

```js
function buildActiveSet(file, tier) {
  const sel = file.tier[tier]
  const nodes = sel.node_ids.map(id => file.nodes.find(n => n.id === id))
  const edges = sel.edge_indices.map(i => ({ ...file.edges[i] }))
  return { nodes, edges }
}
```

- [ ] **Step 4: Wire renderer + sim into `boot()` in `main.js`**

Replace the slider-stub block with:

```js
import { buildSimulation } from './modules/force-sim.js'
import { createSvgRenderer } from './modules/renderer-svg.js'
import { buildScales } from './modules/scales.js'

// ... inside boot() ...
const chartEl = document.getElementById('chart')
const w = 1080, h = 660   // temporary; Task B7 replaces with breakpoint-driven values

const { nodes, edges } = buildActiveSet(first, 'top')
const scales = buildScales(nodes, edges, { w, h })

const renderer = createSvgRenderer(chartEl, meta, { w, h })
renderer.update(nodes, edges, scales)

const sim = buildSimulation(nodes, edges, { w, h })
sim.on('tick', renderer.tick)
```

(Replace `buildSimulation`/`createSvgRenderer`/`buildScales` imports as a single `import` block at the top of the file.)

- [ ] **Step 5: Reload and verify visually**

Open the dev URL. Expected:
- A force-directed graph fills the chart frame.
- ~30 country nodes float into a stable arrangement.
- Links are colored by exporter (warm coral lines from Brazil, amber from Ethiopia, etc.).
- Labels show country names above each node.
- The graph keeps gently breathing (because of `alphaTarget(0.01)`).
- No JS errors in console.

- [ ] **Step 6: Commit**

```bash
git add viz/coffee-trade/modules/force-sim.js viz/coffee-trade/modules/renderer-svg.js viz/coffee-trade/main.js
git commit -m "Render top-tier coffee-trade force graph in SVG"
```

---

### Task B4: Particle animation on Canvas overlay

**Files:**
- Create: `viz/coffee-trade/modules/particles.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/particles.js`**

```js
export function createParticleLayer(container, { w, h, dpr }) {
  const canvas = document.createElement('canvas')
  canvas.style.pointerEvents = 'none'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  function resize(next) {
    canvas.width  = next.w * next.dpr
    canvas.height = next.h * next.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(next.dpr, next.dpr)
  }
  resize({ w, h, dpr })

  let particles = []  // [{ edgeIndex, t, speed }]
  let currentEdges = []
  let currentScales = null

  function rebuild(edges, scales) {
    currentEdges = edges
    currentScales = scales
    // ~3 particles per top-tier edge, capped
    const target = Math.min(edges.length * 3, 600)
    particles = new Array(target).fill(0).map((_, i) => {
      const edgeIndex = i % edges.length
      const e = edges[edgeIndex]
      // Speed proportional to flow magnitude; normalize to [0.0015, 0.012] per frame
      const norm = Math.sqrt(e.value_usd) / Math.sqrt(scales.maxEdgeValue || 1)
      return {
        edgeIndex,
        t: Math.random(),
        speed: 0.0015 + 0.0105 * norm,
      }
    })
  }

  let lastTime = 0
  let running = false
  let reducedMotion = false

  function setReducedMotion(v) { reducedMotion = v }

  function frame(now) {
    if (!running) return
    const dt = Math.min(50, now - lastTime) || 16
    lastTime = now

    const cw = canvas.width / window.devicePixelRatio
    const ch = canvas.height / window.devicePixelRatio
    ctx.clearRect(0, 0, cw, ch)

    if (!reducedMotion && currentScales) {
      for (const p of particles) {
        const e = currentEdges[p.edgeIndex]
        const sx = e.source.x, sy = e.source.y
        const tx = e.target.x, ty = e.target.y
        if (sx == null || tx == null) continue
        p.t += p.speed * (dt / 16)
        if (p.t > 1) p.t -= 1
        const x = sx + (tx - sx) * p.t
        const y = sy + (ty - sy) * p.t
        ctx.beginPath()
        ctx.fillStyle = e._color || '#ffffff'
        ctx.globalAlpha = 0.7
        const r = currentScales.particleR(e.value_usd)
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    requestAnimationFrame(frame)
  }

  function start() {
    if (running) return
    running = true
    lastTime = performance.now()
    requestAnimationFrame(frame)
  }

  function stop() { running = false }

  function destroy() {
    stop()
    canvas.remove()
  }

  return { rebuild, resize, start, stop, destroy, setReducedMotion, canvas }
}
```

- [ ] **Step 2: Wire it in `main.js`**

After `renderer.update(...)` and before `sim.on('tick', ...)`, add:

```js
import { createParticleLayer } from './modules/particles.js'
import { colorFor } from './modules/scales.js'

// ... inside boot() ...

// Annotate edges with cached color (avoid recomputing in the rAF loop)
for (const e of edges) e._color = colorFor(meta, e.source.id || e.source)

const dpr = window.devicePixelRatio || 1
const particles = createParticleLayer(chartEl, { w, h, dpr })
scales.maxEdgeValue = Math.max(...edges.map(e => e.value_usd))
particles.rebuild(edges, scales)
particles.start()

if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  particles.setReducedMotion(true)
  sim.alphaTarget(0)   // freeze the always-on drift
  sim.stop()           // stop further ticks; the static positions remain
}
```

- [ ] **Step 3: Reload and verify**

Expected: same force graph as before, but now particles travel along each link from source to target. Bigger trade flows (BRA→USA, BRA→DEU) have brighter, faster particles. If `prefers-reduced-motion: reduce` is set in your OS, particles vanish AND the graph freezes (no more breathing) — the static layout remains.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/particles.js viz/coffee-trade/main.js
git commit -m "Animate trade flows with Canvas particle overlay"
```

---

### Task B5: Controls — slider, play, type, tier toggles

**Files:**
- Create: `viz/coffee-trade/modules/controls.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/controls.js`**

```js
import { getState, setState, subscribe } from './state.js'

const YEAR_STEP_MS = 1200  // play-mode tick

export function wireControls(meta, onYearChange, onTypeChange, onTierChange) {
  const slider = document.getElementById('year-slider')
  const label = document.getElementById('year-label')
  const play = document.getElementById('play-btn')
  const typeSelect = document.getElementById('type-select')
  const tierButtons = document.querySelectorAll('.tier-btn')

  slider.min = 0
  slider.max = meta.years.length - 1
  const initialIndex = meta.years.length - 1
  slider.value = initialIndex
  label.textContent = meta.years[initialIndex]

  let scrubTimer = null
  slider.addEventListener('input', e => {
    const idx = +e.target.value
    label.textContent = meta.years[idx]
    clearTimeout(scrubTimer)
    scrubTimer = setTimeout(() => {
      setState({ year: meta.years[idx] })
    }, 80)
  })

  let playInterval = null
  function setPlaying(playing) {
    setState({ playing })
    play.textContent = playing
      ? (getState().lang === 'es' ? 'Pausar' : 'Pause')
      : (getState().lang === 'es' ? 'Reproducir' : 'Play')
    if (playing) {
      playInterval = setInterval(() => {
        const cur = +slider.value
        const next = (cur + 1) % meta.years.length
        slider.value = next
        slider.dispatchEvent(new Event('input', { bubbles: true }))
      }, YEAR_STEP_MS)
    } else {
      clearInterval(playInterval)
      playInterval = null
    }
  }
  play.addEventListener('click', () => setPlaying(!getState().playing))

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
    if (e.code === 'Space') {
      e.preventDefault()
      setPlaying(!getState().playing)
    } else if (e.code === 'Escape') {
      setState({ pinnedId: null, hoveredId: null })
    }
  })

  typeSelect.addEventListener('change', e => setState({ type: e.target.value }))

  function reflectTier() {
    const tier = getState().tier
    for (const b of tierButtons) {
      const active = b.dataset.tier === tier
      b.setAttribute('aria-pressed', active)
      b.classList.toggle('border-brand', active)
    }
  }
  for (const b of tierButtons) {
    b.addEventListener('click', () => setState({ tier: b.dataset.tier }))
  }

  // React to state changes
  subscribe((next, prev) => {
    if (next.year !== prev.year) onYearChange(next.year)
    if (next.type !== prev.type) onTypeChange(next.type)
    if (next.tier !== prev.tier) { onTierChange(next.tier); reflectTier() }
    if (next.lang !== prev.lang && next.playing) {
      // Re-label the play button to match new language
      setPlaying(true)
    }
  })

  reflectTier()
}
```

- [ ] **Step 2: Refactor `main.js` to wire controls properly**

Reorganize `boot()` so the renderer/sim/particles are reusable across year/type/tier changes. Full file:

```js
import '../../src/styles/main.css'
import './style.css'

import * as d3 from 'd3'
import { getState, setState, subscribe } from './modules/state.js'
import { loadMeta, loadYear } from './modules/data-loader.js'
import { detectLang, applyLang } from './modules/i18n.js'
import { buildScales, colorFor } from './modules/scales.js'
import { buildSimulation } from './modules/force-sim.js'
import { createSvgRenderer } from './modules/renderer-svg.js'
import { createParticleLayer } from './modules/particles.js'
import { wireControls } from './modules/controls.js'

const W = 1080, H = 660  // temporary canonical size; Task B7 replaces with breakpoints

let meta, renderer, particles, sim
let chartEl

function buildActiveSet(file, tier) {
  const sel = file.tier[tier]
  const nodes = sel.node_ids.map(id => file.nodes.find(n => n.id === id))
  const edges = sel.edge_indices.map(i => ({ ...file.edges[i] }))
  return { nodes, edges }
}

async function applyYearType(year, type, tier) {
  const file = await loadYear(year, type)
  const { nodes, edges } = buildActiveSet(file, tier)
  for (const e of edges) e._color = colorFor(meta, e.source.id || e.source)
  const scales = buildScales(nodes, edges, { w: W, h: H })
  scales.maxEdgeValue = Math.max(...edges.map(e => e.value_usd), 1)

  renderer.update(nodes, edges, scales)

  if (sim) sim.stop()
  sim = buildSimulation(nodes, edges, { w: W, h: H })
  sim.on('tick', renderer.tick)
  // d3-force mutates source/target to objects after first tick — wait one frame
  requestAnimationFrame(() => particles.rebuild(edges, scales))
}

async function boot() {
  chartEl = document.getElementById('chart')

  const lang = detectLang()
  setState({ lang })
  applyLang(lang)
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.lang
      setState({ lang: next })
      applyLang(next)
    })
  }

  meta = await loadMeta()
  const initialYear = meta.years.at(-1)
  setState({ year: initialYear })

  renderer = createSvgRenderer(chartEl, meta, { w: W, h: H })
  particles = createParticleLayer(chartEl, {
    w: W, h: H, dpr: window.devicePixelRatio || 1,
  })
  particles.start()

  await applyYearType(initialYear, getState().type, getState().tier)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    particles.setReducedMotion(true)
    sim.alphaTarget(0)
    sim.stop()
  }

  wireControls(
    meta,
    async year => { await applyYearType(year, getState().type, getState().tier) },
    async type => { await applyYearType(getState().year, type, getState().tier) },
    async tier => { await applyYearType(getState().year, getState().type, tier) },
  )
}

boot().catch(err => console.error('coffee-trade boot failed', err))
```

- [ ] **Step 3: Reload and verify**

- Slider scrubs through years 2015..2023; the graph updates within ~100 ms after release.
- Play button cycles through years on a 1.2 s tick; button text flips Play ↔ Pause.
- Spacebar toggles play/pause (when focus is outside form fields).
- "Green" / "Roasted" / "All" in the dropdown swap the visible data (Brazil dominates green; Italy and Germany become visible top exporters in roasted).
- "Top flows" / "All countries" buttons swap node sets (full tier shows ~150 nodes but with the same SVG renderer — busy but functional).
- Esc clears any pinned/hovered state.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/controls.js viz/coffee-trade/main.js
git commit -m "Wire slider, play, type, and tier controls for coffee-trade"
```

---

### Task B6: Tooltip + hover/click highlighting

**Files:**
- Create: `viz/coffee-trade/modules/tooltip.js`
- Modify: `viz/coffee-trade/modules/renderer-svg.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/tooltip.js`**

```js
const el = document.getElementById('tooltip')

const NUMBER_FORMAT = {
  en: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
  es: new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }),
}

function fmtUsd(v, lang) {
  if (v >= 1e9) return '$' + NUMBER_FORMAT[lang].format(v / 1e9) + (lang === 'es' ? ' mil M' : 'B')
  if (v >= 1e6) return '$' + NUMBER_FORMAT[lang].format(v / 1e6) + 'M'
  return '$' + NUMBER_FORMAT[lang].format(v)
}

export function showNode(node, meta, lang, evt) {
  const c = meta.countries[node.id]
  const name = c?.name || node.id
  el.innerHTML = `
    <div class="font-medium text-neutral-100">${name}</div>
    <div class="text-neutral-300">${lang === 'es' ? 'Exporta' : 'Exports'}: ${fmtUsd(node.exports_usd, lang)}</div>
    <div class="text-neutral-300">${lang === 'es' ? 'Importa' : 'Imports'}: ${fmtUsd(node.imports_usd, lang)}</div>
  `
  position(evt)
}

export function showEdge(edge, meta, lang, evt) {
  const sName = meta.countries[edge.source.id || edge.source]?.name || edge.source.id || edge.source
  const tName = meta.countries[edge.target.id || edge.target]?.name || edge.target.id || edge.target
  el.innerHTML = `
    <div class="font-medium text-neutral-100">${sName} → ${tName}</div>
    <div class="text-neutral-300">${fmtUsd(edge.value_usd, lang)} · ${NUMBER_FORMAT[lang].format(edge.quantity_kg)} kg</div>
  `
  position(evt)
}

export function hide() { el.classList.add('hidden') }

function position(evt) {
  el.classList.remove('hidden')
  const pad = 12
  const x = Math.min(window.innerWidth - el.offsetWidth - pad, evt.clientX + pad)
  const y = Math.min(window.innerHeight - el.offsetHeight - pad, evt.clientY + pad)
  el.style.left = x + 'px'
  el.style.top = y + 'px'
}
```

- [ ] **Step 2: Add hover handlers to SVG renderer**

Modify `modules/renderer-svg.js`. Inside `update()`, after building `nodeSel` and `linkSel`, add:

```js
    nodeSel
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => onHover('node', d, event))
      .on('mousemove',  (event, d) => onHover('node', d, event))
      .on('mouseleave', () => onHover(null))
      .on('click',      (event, d) => onPin(d.id))

    linkSel
      .on('mouseenter', (event, d) => onHover('edge', d, event))
      .on('mousemove',  (event, d) => onHover('edge', d, event))
      .on('mouseleave', () => onHover(null))
```

And change the renderer signature to accept callbacks:

```js
export function createSvgRenderer(container, meta, { w, h }, { onHover, onPin } = {}) {
```

with safe defaults:

```js
  onHover = onHover || (() => {})
  onPin   = onPin   || (() => {})
```

(Add immediately after the parameter destructuring.)

Also add a `highlight(focusId)` method on the returned object that fades unrelated elements:

```js
  function highlight(focusId) {
    if (!focusId) {
      linkSel.attr('stroke-opacity', 0.18)
      nodeSel.attr('fill-opacity', 0.85).attr('stroke-width', 0.6)
      labelSel.attr('fill', '#d4d4d8')
      return
    }
    linkSel.attr('stroke-opacity', d =>
      (d.source.id === focusId || d.target.id === focusId) ? 0.9 : 0.04)
    nodeSel.attr('fill-opacity', d => d.id === focusId ? 1 : 0.18)
    nodeSel.attr('stroke-width', d => d.id === focusId ? 2 : 0.6)
    labelSel.attr('fill', d => d.id === focusId ? '#ffffff' : '#d4d4d8')
  }

  return { update, tick, destroy, highlight, root: svg }
```

- [ ] **Step 3: Wire tooltip + highlight in `main.js`**

Inside `boot()`, before creating the renderer, set up callbacks:

```js
import * as Tooltip from './modules/tooltip.js'

function handleHover(kind, datum, evt) {
  const focusId = getState().pinnedId
  if (focusId) return  // pinned takes precedence
  if (!kind) {
    setState({ hoveredId: null })
    Tooltip.hide()
    return
  }
  if (kind === 'node') {
    setState({ hoveredId: datum.id })
    Tooltip.showNode(datum, meta, getState().lang, evt)
  } else {
    Tooltip.showEdge(datum, meta, getState().lang, evt)
  }
}

function handlePin(id) {
  const cur = getState().pinnedId
  setState({ pinnedId: cur === id ? null : id })
}

document.getElementById('chart').addEventListener('click', e => {
  if (e.target.tagName === 'svg' || e.target.id === 'chart') {
    setState({ pinnedId: null })
  }
})
```

Update the renderer creation:

```js
renderer = createSvgRenderer(chartEl, meta, { w: W, h: H }, {
  onHover: handleHover,
  onPin: handlePin,
})
```

Subscribe to highlight changes:

```js
subscribe((next, prev) => {
  const focus = next.pinnedId || next.hoveredId
  if (focus !== (prev.pinnedId || prev.hoveredId)) {
    renderer.highlight(focus)
  }
})
```

- [ ] **Step 4: Reload and verify**

- Hover a node: it pops, unrelated edges fade, tooltip shows country + exports + imports.
- Hover an edge: tooltip shows `Exporter → Importer · $X · Y kg`.
- Click a node: highlight pins (stays after mouse leave).
- Click empty chart area or press Esc: unpin.
- Tooltip text flips EN/ES when language toggle changes.

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/modules/tooltip.js viz/coffee-trade/modules/renderer-svg.js viz/coffee-trade/main.js
git commit -m "Add tooltip and hover/click highlighting"
```

---

### Task B7: Breakpoint-driven responsive sizing

**Files:**
- Create: `viz/coffee-trade/modules/responsive.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/responsive.js`**

```js
export const BREAKPOINTS = [
  { name: 'lg', minWidth: 1200, w: 1280, h: 720 },
  { name: 'md', minWidth:  900, w: 1080, h: 660 },
  { name: 'sm', minWidth:  600, w:  720, h: 480 },
  { name: 'xs', minWidth:    0, w:  480, h: 420 },
]

export function pickBreakpoint(containerWidth) {
  return BREAKPOINTS.find(bp => containerWidth >= bp.minWidth)
}

export function debounce(fn, ms) {
  let t = null
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export function observeBreakpoint(container, onChange) {
  let current = pickBreakpoint(container.clientWidth)
  onChange(current, null)
  const handler = debounce(() => {
    const next = pickBreakpoint(container.clientWidth)
    if (next.name === current.name) return
    const prev = current
    current = next
    onChange(next, prev)
  }, 150)
  const ro = new ResizeObserver(handler)
  ro.observe(container)
  return () => ro.disconnect()
}
```

- [ ] **Step 2: Use breakpoints in `main.js`**

Replace the `W = 1080, H = 660` constants with a mutable `current` object. Refactor `boot()`:

```js
import { observeBreakpoint } from './modules/responsive.js'

let current = { w: 1080, h: 660 }  // overwritten by first ResizeObserver fire

function rebuildLayout(next) {
  current = { w: next.w, h: next.h }
  const dpr = window.devicePixelRatio || 1

  // Renderer (SVG or Canvas) — both expose resize(next)
  renderer.resize({ w: current.w, h: current.h, dpr })

  // Particle canvas backing buffer
  particles.resize({ w: current.w, h: current.h, dpr })

  // Recenter the force layout if it exists
  if (sim) {
    sim.force('center').x(current.w / 2).y(current.h / 2)
    sim.alpha(0.3).restart()
  }
}

// Inside boot(), AFTER renderer/particles are created and the first applyYearType()
// has resolved, install the observer:
observeBreakpoint(chartEl, (next, prev) => {
  // Lock to top tier on xs
  if (next.name === 'xs' && getState().tier !== 'top') {
    setState({ tier: 'top' })  // triggers normal tier-change flow
  }
  // Hide the All-countries tier button entirely on xs
  for (const b of document.querySelectorAll('.tier-btn[data-tier="full"]')) {
    b.style.display = next.name === 'xs' ? 'none' : ''
  }
  if (!prev) {
    // First fire — set initial canonical size before any rendering happened
    current = { w: next.w, h: next.h }
    return
  }
  rebuildLayout(next)
})
```

Update `applyYearType` and the initial renderer/particles creation to use `current.w` / `current.h` instead of the constants `W` / `H`. Same for `buildScales` calls.

- [ ] **Step 3: Reload and verify resize behavior**

- At a wide window (≥1200 px), graph uses full-size canonical layout.
- Drag the browser narrower past each threshold (1200 → 900 → 600 → 360). Each time you cross, the SVG viewBox snaps to the new canonical size and the force layout settles into the new bounds. Between thresholds, the SVG just scales fluidly via CSS.
- At `xs` (<600 px), the "All countries" button is hidden; if it was selected, the viz auto-falls back to top tier.
- Particles stay crisp on a HiDPI screen at each breakpoint.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/responsive.js viz/coffee-trade/main.js
git commit -m "Add breakpoint-driven responsive sizing"
```

---

### Task B8: Canvas renderer for full tier

**Files:**
- Create: `viz/coffee-trade/modules/renderer-canvas.js`
- Modify: `viz/coffee-trade/main.js`

- [ ] **Step 1: Write `modules/renderer-canvas.js`**

```js
import * as d3 from 'd3'
import { colorFor } from './scales.js'

export function createCanvasRenderer(container, meta, { w, h, dpr }) {
  const canvas = document.createElement('canvas')
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  function resize(next) {
    canvas.width  = next.w * next.dpr
    canvas.height = next.h * next.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(next.dpr, next.dpr)
  }
  resize({ w, h, dpr })

  let _nodes = [], _edges = [], _scales = null
  let _quadtree = null
  let _highlight = null

  function update(nodes, edges, scales) {
    for (const n of nodes) n.radius = scales.nodeRadius(n.exports_usd + n.imports_usd)
    _nodes = nodes
    _edges = edges
    _scales = scales
  }

  function highlight(focusId) { _highlight = focusId }

  function tick() {
    if (!_scales) return
    const cw = canvas.width / window.devicePixelRatio
    const ch = canvas.height / window.devicePixelRatio
    ctx.clearRect(0, 0, cw, ch)

    // Links
    for (const e of _edges) {
      const sx = e.source.x, sy = e.source.y, tx = e.target.x, ty = e.target.y
      if (sx == null) continue
      const dim = _highlight && (e.source.id !== _highlight && e.target.id !== _highlight)
      ctx.globalAlpha = dim ? 0.03 : 0.18
      ctx.strokeStyle = e._color || colorFor(meta, e.source.id || e.source)
      ctx.lineWidth = _scales.linkWidth(e.value_usd)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Nodes
    for (const n of _nodes) {
      if (n.x == null) continue
      const dim = _highlight && n.id !== _highlight
      ctx.beginPath()
      ctx.globalAlpha = dim ? 0.15 : 0.9
      ctx.fillStyle = colorFor(meta, n.id)
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Labels — top 15 by total trade
    const topLabels = [..._nodes].sort(
      (a, b) => (b.exports_usd + b.imports_usd) - (a.exports_usd + a.imports_usd)
    ).slice(0, 15)
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const n of topLabels) {
      if (n.x == null) continue
      const name = meta.countries[n.id]?.name || n.id
      ctx.strokeStyle = '#0a0a0b'
      ctx.lineWidth = 3
      ctx.strokeText(name, n.x, n.y - n.radius - 4)
      ctx.fillStyle = '#d4d4d8'
      ctx.fillText(name, n.x, n.y - n.radius - 4)
    }
  }

  function pointAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width)
    const y = (clientY - rect.top)  * (canvas.height / window.devicePixelRatio / rect.height)
    if (!_quadtree || _quadtree.staleAt !== _nodes) {
      _quadtree = d3.quadtree().x(d => d.x).y(d => d.y).addAll(_nodes.filter(n => n.x != null))
      _quadtree.staleAt = _nodes
    }
    return _quadtree.find(x, y, 30)
  }

  canvas.addEventListener('mousemove', evt => {
    const n = pointAt(evt.clientX, evt.clientY)
    if (n) options.onHover?.('node', n, evt)
    else options.onHover?.(null)
  })
  canvas.addEventListener('click', evt => {
    const n = pointAt(evt.clientX, evt.clientY)
    if (n) options.onPin?.(n.id)
    else options.onPin?.(null)
  })

  let options = {}
  function setHandlers(opts) { options = opts }

  function destroy() { canvas.remove() }

  return { update, tick, highlight, resize, setHandlers, destroy, root: canvas }
}
```

- [ ] **Step 2: Renderer switching in `main.js`**

Introduce a helper that builds the right renderer based on the current tier:

```js
import { createCanvasRenderer } from './modules/renderer-canvas.js'

function makeRenderer(tier) {
  if (tier === 'full') {
    const r = createCanvasRenderer(chartEl, meta, {
      w: current.w, h: current.h, dpr: window.devicePixelRatio || 1,
    })
    r.setHandlers({ onHover: handleHover, onPin: handlePin })
    return r
  }
  return createSvgRenderer(chartEl, meta, { w: current.w, h: current.h },
    { onHover: handleHover, onPin: handlePin })
}
```

Then in `applyYearType`, if the tier changed (compared to whatever the renderer currently expects), tear down the old renderer and build the new one before calling `.update()`. Keep a module-level `currentTier` to track:

```js
let currentTier = null

async function applyYearType(year, type, tier) {
  if (tier !== currentTier) {
    if (renderer) renderer.destroy()
    renderer = makeRenderer(tier)
    currentTier = tier
  }
  // ... rest unchanged
}
```

Also note: the SVG renderer's `tick` updates DOM elements; the Canvas renderer's `tick` redraws the whole frame. Both connect via `sim.on('tick', renderer.tick)` identically.

- [ ] **Step 3: Reload and verify tier swap**

- Default: "Top flows" / SVG → ~30 nodes, sharp labels, particles.
- Click "All countries" → Canvas takes over, ~150 nodes pack in, labels only on top 15. Particles still animate against the new edges.
- Toggle back: clean teardown, top tier renders again.
- Hover over a node in the full tier: quadtree picks it up, tooltip appears, highlight dims the rest.

- [ ] **Step 4: Commit**

```bash
git add viz/coffee-trade/modules/renderer-canvas.js viz/coffee-trade/main.js
git commit -m "Add Canvas renderer for full-tier coffee-trade view"
```

---

### Task B9: Region legend + click-to-filter

**Files:**
- Modify: `viz/coffee-trade/main.js`
- Modify: `viz/coffee-trade/modules/renderer-svg.js`
- Modify: `viz/coffee-trade/modules/renderer-canvas.js`

- [ ] **Step 1: Populate the legend at boot**

Add to `main.js`, called once during `boot()`:

```js
function renderLegend() {
  const ul = document.getElementById('legend')
  ul.replaceChildren()
  const items = [
    { region: 'South America', en: 'South America', es: 'Suramérica' },
    { region: 'Africa',        en: 'Africa',        es: 'África' },
    { region: 'Asia',          en: 'Asia',          es: 'Asia' },
    { region: 'Europe',        en: 'Europe',        es: 'Europa' },
    { region: 'North America', en: 'North America', es: 'Norteamérica' },
  ]
  for (const it of items) {
    const li = document.createElement('li')
    li.className = 'flex items-center gap-1.5 cursor-pointer hover:text-neutral-200'
    li.dataset.region = it.region
    li.dataset.en = it.en
    li.dataset.es = it.es
    li.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full" style="background:${REGION_COLOR[it.region]}"></span>
      <span>${it.en}</span>
    `
    li.addEventListener('click', () => {
      const cur = getState().regionFilter
      setState({ regionFilter: cur === it.region ? null : it.region })
    })
    ul.appendChild(li)
  }
  applyLang(getState().lang)  // re-translate fresh children
}
```

(Add `REGION_COLOR` to the imports from `./modules/scales.js`.)

Add `regionFilter: null` to the initial state in `state.js`.

- [ ] **Step 2: React to region filter**

In `main.js`, subscribe and update visual emphasis:

```js
subscribe((next, prev) => {
  if (next.regionFilter !== prev.regionFilter) {
    renderer.highlight(null)        // clear any node-level highlight
    renderer.setRegionFilter?.(next.regionFilter)
    for (const li of document.querySelectorAll('#legend li')) {
      const active = li.dataset.region === next.regionFilter
      li.classList.toggle('text-neutral-100', active)
    }
  }
})
```

- [ ] **Step 3: Add `setRegionFilter` to both renderers**

In `renderer-svg.js`, expose:

```js
  let _regionFilter = null
  function setRegionFilter(region) {
    _regionFilter = region
    nodeSel.attr('fill-opacity', d =>
      !_regionFilter || meta.countries[d.id]?.region === _regionFilter ? 0.85 : 0.12)
    linkSel.attr('stroke-opacity', d => {
      if (!_regionFilter) return 0.18
      const sr = meta.countries[d.source.id || d.source]?.region
      const tr = meta.countries[d.target.id || d.target]?.region
      return (sr === _regionFilter || tr === _regionFilter) ? 0.3 : 0.03
    })
    labelSel.attr('opacity', d =>
      !_regionFilter || meta.countries[d.id]?.region === _regionFilter ? 1 : 0.3)
  }
```

…and add `setRegionFilter` to the returned object.

In `renderer-canvas.js`, store `_regionFilter` and inside `tick()` check it for each node/edge when picking `globalAlpha` (alongside the existing `_highlight` check). Expose `setRegionFilter(region)` that just records the value.

- [ ] **Step 4: Reload and verify**

- Legend appears below tier controls with 5 colored dots.
- Clicking "South America" dims everything else; clicking it again clears the filter.
- Filter survives year / type / tier changes.
- EN/ES toggle renames the legend items.

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/main.js viz/coffee-trade/modules/renderer-svg.js viz/coffee-trade/modules/renderer-canvas.js viz/coffee-trade/modules/state.js
git commit -m "Add region legend with click-to-filter"
```

---

### Task B10: Year-change transitions + always-on drift + runtime assert

**Files:**
- Modify: `viz/coffee-trade/main.js`
- Modify: `viz/coffee-trade/modules/renderer-svg.js`
- Modify: `viz/coffee-trade/modules/data-loader.js`

- [ ] **Step 1: Ease node radii on year/type change (SVG renderer only)**

Edit `renderer-svg.js`'s `update()` so size/width transitions are explicit:

```js
    nodeSel = nodeG.selectAll('circle')
      .data(nodes, d => d.id)
      .join(
        enter => enter.append('circle')
          .attr('r', 0)
          .attr('fill', d => colorFor(meta, d.id))
          .attr('fill-opacity', 0.85)
          .attr('stroke', '#0a0a0b')
          .attr('stroke-width', 0.6)
          .call(sel => sel.transition().duration(600).attr('r', d => d.radius)),
        update => update
          .call(sel => sel.transition().duration(600).attr('r', d => d.radius)),
        exit => exit
          .call(sel => sel.transition().duration(300).attr('r', 0).remove())
      )

    linkSel = linkG.selectAll('line')
      .data(edges, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join(
        enter => enter.append('line')
          .attr('stroke', d => colorFor(meta, d.source.id || d.source))
          .attr('stroke-opacity', 0)
          .attr('stroke-width', d => scales.linkWidth(d.value_usd))
          .call(sel => sel.transition().duration(600).attr('stroke-opacity', 0.18)),
        update => update
          .call(sel => sel.transition().duration(600).attr('stroke-width', d => scales.linkWidth(d.value_usd))),
        exit => exit
          .call(sel => sel.transition().duration(300).attr('stroke-opacity', 0).remove())
      )
```

(Keep the existing event handlers/classes/attributes; the change above replaces the previous `.join(...)` calls.)

- [ ] **Step 2: Soft sim restart, not full rebuild**

In `main.js`'s `applyYearType`, replace `if (sim) sim.stop(); sim = buildSimulation(...)` with:

```js
if (!sim) {
  sim = buildSimulation(nodes, edges, current)
  sim.on('tick', renderer.tick)
} else {
  // Reuse existing simulation, replace its nodes/links
  sim.nodes(nodes)
  sim.force('link').links(edges)
  sim.alpha(0.4).restart()
}
```

This keeps existing nodes' positions, so on year change the graph "morphs" rather than re-settling from scratch.

- [ ] **Step 3: Runtime schema guard**

In `modules/data-loader.js`, after parsing each year file:

```js
export function loadYear(year, type) {
  const key = `${year}-${type}`
  if (!cache.has(key)) {
    cache.set(key, fetch(`./data/${key}.json`).then(async r => {
      if (!r.ok) throw new Error(`${key}: ${r.status}`)
      const data = await r.json()
      console.assert(
        data && Number.isInteger(data.year) &&
        Array.isArray(data.nodes) && Array.isArray(data.edges) &&
        data.tier?.top?.node_ids,
        `coffee-trade: bad payload shape for ${key}`)
      return data
    }))
  }
  return cache.get(key)
}
```

- [ ] **Step 4: Reload and verify**

- Slider scrub or play mode causes node radii to ease over 600 ms — feels alive.
- New edges fade in; departing edges fade out. No flicker.
- Sim stays warm: nodes don't teleport, they slide toward new equilibria.
- Console shows no assertion warnings.

- [ ] **Step 5: Commit**

```bash
git add viz/coffee-trade/main.js viz/coffee-trade/modules/renderer-svg.js viz/coffee-trade/modules/data-loader.js
git commit -m "Animate year transitions; soft sim restart; runtime payload guard"
```

---

### Task B11: Mobile control-strip wrap + final responsive polish

**Files:**
- Modify: `viz/coffee-trade/index.html`
- Modify: `viz/coffee-trade/style.css`

- [ ] **Step 1: Wrap controls at small widths**

Edit `style.css` to add:

```css
@media (max-width: 600px) {
  #controls { flex-wrap: wrap; }
  #controls > .flex-1 { order: 1; flex-basis: 100%; }
  #controls > #play-btn { order: 2; }
  #controls > #type-select { order: 3; }
}
```

(The existing `flex-wrap` on `#controls` already allows this; the order rules push the slider to its own row at small widths.)

- [ ] **Step 2: Verify on real and emulated mobile**

In the dev server: open browser devtools, switch to iPhone preset (~390 × 844). Confirm:

- Slider takes a full row above the buttons.
- Legend wraps to two rows if needed.
- Tier "All countries" button is hidden (handled in Task B7).
- Particles still animate.
- Hover/tap on a node shows the tooltip.

- [ ] **Step 3: Commit**

```bash
git add viz/coffee-trade/style.css
git commit -m "Wrap controls on narrow viewports for coffee-trade"
```

---

## Phase C — Documentation + gallery integration

### Task C1: Viz README + gallery card + top-level README

**Files:**
- Create: `viz/coffee-trade/README.md`
- Modify: `README.md`
- Modify: `index.html`
- Create: `src/public/img/coffee-trade.webp` (placeholder thumbnail)

- [ ] **Step 1: Write `viz/coffee-trade/README.md`**

```markdown
# Coffee trade

Animated global coffee trade flows, 2015–2023. Force-directed graph with
particle animation along trade links. Year slider, play/pause, type filter
(green / roasted), tier toggle (top flows / all countries).

Data: UN Comtrade + ICO. See `scripts/coffee-trade/` for the data pipeline.

## Dev

From repo root:

    npm run dev
    # then open http://localhost:5173/viz/coffee-trade/
```

- [ ] **Step 2: Add a line in the top-level `README.md`**

Find the existing `## Layout` tree and insert a line:

```diff
 charts-d3/
+├── scripts/coffee-trade/  # Python ETL for viz/coffee-trade/ (manual, ~yearly)
 ├── index.html              # Landing page (gallery)
 ├── src/
```

- [ ] **Step 3: Add the gallery card to top-level `index.html`**

Inside `<div id="grid">`, insert a new card following the existing pattern (e.g. between the IPC and presupuesto cards):

```html
<a href="/viz/coffee-trade/" data-viz-card data-title="coffee café trade comercio"
   data-tags="economics,maps"
   class="group block bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-brand focus:outline-none focus:ring-2 focus:ring-brand transition">
  <img src="/img/coffee-trade.webp" alt="Coffee trade" class="aspect-video w-full object-cover" loading="lazy" />
  <div class="p-4">
    <h3 class="font-semibold group-hover:text-brand transition"
        data-en="Coffee trade" data-es="Comercio de café">Coffee trade</h3>
    <p class="text-sm text-neutral-400 mt-1"
       data-en="Animated global coffee flows · UN Comtrade + ICO"
       data-es="Flujos globales de café · UN Comtrade + ICO">Animated global coffee flows · UN Comtrade + ICO</p>
  </div>
</a>
```

- [ ] **Step 4: Add a thumbnail**

Create a placeholder webp at `src/public/img/coffee-trade.webp`. For the prototype, take a screenshot of the running viz (dev server, ~1200 px wide window, 2023-all view) and convert via:

```bash
# After taking the screenshot as coffee-trade.png in the project root:
ffmpeg -i coffee-trade.png -vf scale=800:-1 -quality 75 src/public/img/coffee-trade.webp
rm coffee-trade.png
```

(If ffmpeg/webp is unavailable, use any image you have lying around; the alt text is the important part — the image is replaceable later.)

- [ ] **Step 5: Verify integration in the gallery**

Run `npm run dev`. Open `http://localhost:5173/`. Expected:
- New "Coffee trade" card appears in the gallery grid with the thumbnail.
- Filter buttons "Economics" and "Maps" both include it.
- Search "coffee" or "café" surfaces it.
- Click → navigates to the viz page. EN/ES toggle on the gallery persists into the viz.

- [ ] **Step 6: Commit**

```bash
git add viz/coffee-trade/README.md README.md index.html src/public/img/coffee-trade.webp
git commit -m "Add coffee-trade card to gallery and update top-level README"
```

---

### Task C2: Build + smoke-test

**Files:**
- (no source changes)

- [ ] **Step 1: Production build**

```bash
npm run build
```

Expected: Vite emits to `dist/` with no warnings about missing assets. The coffee-trade viz folder should appear under `dist/viz/coffee-trade/` with `data/`, `modules/`, `index.html`, etc.

- [ ] **Step 2: Preview the built site locally**

```bash
npm run preview
```

Open the preview URL. Click into Coffee trade. Verify:
- Data files load (network tab shows `data/meta.json`, `data/2023-all.json`, etc.)
- Graph renders identically to dev mode.
- Slider, play, type, tier, legend, hover, click, language toggle all behave the same.
- Resize through breakpoints — segment jumps happen cleanly.
- No console errors.

If the data files 404 in preview (common cause: Vite needs an explicit copy for non-imported assets), inspect `vite.config.js` and confirm that `viz/coffee-trade/data/` is being copied. The existing setup already mirrors `src/public/` into the build; ensure the data lives under that path or is included via Vite's `publicDir`.

- [ ] **Step 3: Commit any final fixups**

If anything needed adjusting (e.g. asset paths), make those edits and commit:

```bash
git add <whatever>
git commit -m "Adjust coffee-trade asset paths for production build"
```

(If nothing needed adjusting, skip the commit.)

---

## Done criteria

The viz is complete when, from a fresh clone:
1. `npm install && npm run dev` brings the gallery up with a "Coffee trade" card.
2. Clicking it loads the viz, defaults to 2023 / all / top, and shows ~30 country nodes with particles flowing on the strongest trade links.
3. Slider, play, type, tier, region legend, hover/tooltip, click-to-pin, language toggle, and Esc shortcut all work.
4. Resizing across 1200 / 900 / 600 / 360 px triggers clean breakpoint-driven rebuilds.
5. `prefers-reduced-motion: reduce` disables particles and freezes the always-on drift.
6. `npm run build && npm run preview` produces an identical experience from the built output.
7. The Python pipeline can be re-run end-to-end (`uv sync && uv run python download_comtrade.py && … && build_viz_data.py`) and produces updated JSON files.

No automated tests are part of the done criteria — verification is the manual checklist above.
