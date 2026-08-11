"""Convert flows/nodes parquet into per-year JSON files for viz/coffee-trade/.

Run: uv run python build_viz_data.py
Output:
  ../../src/public/viz/coffee-trade/data/meta.json
  ../../src/public/viz/coffee-trade/data/{year}-{type}.json   for type in {all, green, roasted}
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
VIZ_DATA = ROOT.parent.parent / "src" / "public" / "viz" / "coffee-trade" / "data"

GREEN_HS = ("090111", "090112")
ROASTED_HS = ("090121", "090122")
TOP_NODE_COUNT = 30
TOP_EDGE_CAP = 100

log = logging.getLogger("build_viz")


def _sql_path(p: Path) -> str:
    return str(p).replace("'", "''")


def query_year_type(
    con: duckdb.DuckDBPyConnection, year: int, type_filter: str
) -> tuple[list[dict], list[dict]]:
    """Return (nodes, edges) for one (year, type) slice. Edges are sorted DESC by value_usd."""
    if type_filter == "all":
        hs_predicate = "TRUE"
    elif type_filter == "green":
        hs_predicate = f"hs_code IN {GREEN_HS}"
    elif type_filter == "roasted":
        hs_predicate = f"hs_code IN {ROASTED_HS}"
    else:
        raise ValueError(f"unknown type_filter: {type_filter!r}")

    edges_df = con.execute(f"""
        SELECT source, target,
               COALESCE(SUM(value_usd), 0)   AS value_usd,
               COALESCE(SUM(quantity_kg), 0) AS quantity_kg
        FROM read_parquet('{_sql_path(PROCESSED / "flows.parquet")}')
        WHERE year = {year} AND {hs_predicate}
        GROUP BY source, target
        ORDER BY value_usd DESC
    """).df()

    if edges_df.empty:
        return [], []

    nodes_df = con.execute(f"""
        WITH e AS (
            SELECT source, target, value_usd
            FROM read_parquet('{_sql_path(PROCESSED / "flows.parquet")}')
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
         "value_usd": float(r.value_usd), "quantity_kg": float(r.quantity_kg)}
        for r in edges_df.itertuples(index=False)
    ]
    return nodes, edges


def compute_tiers(nodes: list[dict], edges: list[dict]) -> dict:
    """Return SVG-tier (top ~30 nodes, top ~100 edges by value) and Canvas-tier (all) index sets.

    Edges are assumed pre-sorted DESC by value_usd, so the first TOP_EDGE_CAP that
    land entirely inside the top-node set are the highest-value ones.
    """
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


def build_mexico() -> None:
    """Emit mexico.json for the Mexico story tab.

    Two views feed one chart: (a) the competitive split of Mexico's coffee
    imports by source, green vs roasted, over the most recent 3 years; and
    (b) Colombia's coffee exports to Mexico by year. Plus unit values for the
    strategy tables. Green = HS 0901.11/12, roasted = HS 0901.21/22.
    """
    flows = PROCESSED / "flows.parquet"
    if not flows.exists():
        log.warning("Skipping mexico.json: %s not found", flows)
        return
    con = duckdb.connect(":memory:")
    years = con.execute(
        f"SELECT DISTINCT year FROM read_parquet('{_sql_path(flows)}') ORDER BY year"
    ).df()["year"].tolist()
    if not years:
        log.warning("Skipping mexico.json: no flows")
        return
    recent = [int(y) for y in years[-3:]]
    recent_sql = ",".join(str(y) for y in recent)
    green = "('090111','090112')"
    roasted = "('090121','090122')"

    sources_df = con.execute(f"""
        SELECT source AS iso3,
            SUM(CASE WHEN hs_code IN {green}   THEN value_usd ELSE 0 END) AS green,
            SUM(CASE WHEN hs_code IN {roasted} THEN value_usd ELSE 0 END) AS roasted
        FROM read_parquet('{_sql_path(flows)}')
        WHERE target = 'MEX' AND year IN ({recent_sql})
        GROUP BY source
        ORDER BY (green + roasted) DESC
        LIMIT 10
    """).df()
    sources = [
        {"iso3": r.iso3, "green": float(r.green), "roasted": float(r.roasted)}
        for r in sources_df.itertuples(index=False)
    ]

    col_df = con.execute(f"""
        SELECT year,
            SUM(CASE WHEN hs_code IN {green}   THEN value_usd ELSE 0 END) AS green,
            SUM(CASE WHEN hs_code IN {roasted} THEN value_usd ELSE 0 END) AS roasted
        FROM read_parquet('{_sql_path(flows)}')
        WHERE source = 'COL' AND target = 'MEX'
        GROUP BY year ORDER BY year
    """).df()

    def unit_value(where: str) -> float | None:
        row = con.execute(f"""
            SELECT SUM(value_usd) AS v, SUM(quantity_kg) AS q
            FROM read_parquet('{_sql_path(flows)}')
            WHERE {where} AND year IN ({recent_sql})
        """).fetchone()
        return float(row[0] / row[1]) if row and row[1] else None

    payload = {
        "recent_window": recent,
        "sources": sources,
        "colombia": {
            "years":   [int(y) for y in col_df["year"].tolist()],
            "green":   [float(v) for v in col_df["green"].tolist()],
            "roasted": [float(v) for v in col_df["roasted"].tolist()],
        },
        "unit_values": {
            "green_import":   unit_value(f"target = 'MEX' AND hs_code IN {green}"),
            "roasted_import": unit_value(f"target = 'MEX' AND hs_code IN {roasted}"),
            "green_export":   unit_value(f"source = 'MEX' AND hs_code IN {green}"),
            "roasted_export": unit_value(f"source = 'MEX' AND hs_code IN {roasted}"),
        },
    }
    (VIZ_DATA / "mexico.json").write_text(json.dumps(payload, separators=(",", ":")))
    log.info("Wrote mexico.json (%d sources, %d COL years)",
             len(sources), len(payload["colombia"]["years"]))


def build_panama() -> None:
    """Emit panama.json for the Panama story tab.

    Panama's angle is quality, not volume: its imports are premiumizing and
    Colombia already owns the tariff-preferred roasted niche. Three views feed
    one chart: (a) import sources green vs roasted; (b) a unit-value ladder of
    green suppliers ($/kg, a quality-tier proxy) that puts Colombia in the
    premium band above the Nicaragua/Brazil commodity tier; (c) Colombia's
    exports to Panama by year. Green = HS 0901.11/12, roasted = HS 0901.21/22.
    """
    flows = PROCESSED / "flows.parquet"
    if not flows.exists():
        log.warning("Skipping panama.json: %s not found", flows)
        return
    con = duckdb.connect(":memory:")
    years = con.execute(
        f"SELECT DISTINCT year FROM read_parquet('{_sql_path(flows)}') ORDER BY year"
    ).df()["year"].tolist()
    if not years:
        log.warning("Skipping panama.json: no flows")
        return
    recent = [int(y) for y in years[-3:]]
    recent_sql = ",".join(str(y) for y in recent)
    green = "('090111','090112')"
    roasted = "('090121','090122')"

    sources_df = con.execute(f"""
        SELECT source AS iso3,
            SUM(CASE WHEN hs_code IN {green}   THEN value_usd ELSE 0 END) AS green,
            SUM(CASE WHEN hs_code IN {roasted} THEN value_usd ELSE 0 END) AS roasted
        FROM read_parquet('{_sql_path(flows)}')
        WHERE target = 'PAN' AND year IN ({recent_sql})
        GROUP BY source
        ORDER BY (green + roasted) DESC
        LIMIT 10
    """).df()
    sources = [
        {"iso3": r.iso3, "green": float(r.green), "roasted": float(r.roasted)}
        for r in sources_df.itertuples(index=False)
    ]

    # Green suppliers ranked by unit value = a proxy for quality tier. The 20 t
    # floor drops thin, noisy shipments whose $/kg swings wildly.
    tiers_df = con.execute(f"""
        SELECT source AS iso3,
            SUM(value_usd) / NULLIF(SUM(quantity_kg), 0) AS usd_per_kg,
            SUM(quantity_kg) AS kg
        FROM read_parquet('{_sql_path(flows)}')
        WHERE target = 'PAN' AND year IN ({recent_sql}) AND hs_code IN {green}
        GROUP BY source
        HAVING SUM(quantity_kg) > 20000
        ORDER BY usd_per_kg DESC
    """).df()
    price_tiers = [
        {"iso3": r.iso3, "usd_per_kg": float(r.usd_per_kg), "kg": float(r.kg)}
        for r in tiers_df.itertuples(index=False)
    ]

    col_df = con.execute(f"""
        SELECT year,
            SUM(CASE WHEN hs_code IN {green}   THEN value_usd ELSE 0 END) AS green,
            SUM(CASE WHEN hs_code IN {roasted} THEN value_usd ELSE 0 END) AS roasted
        FROM read_parquet('{_sql_path(flows)}')
        WHERE source = 'COL' AND target = 'PAN'
        GROUP BY year ORDER BY year
    """).df()

    def unit_value(where: str) -> float | None:
        row = con.execute(f"""
            SELECT SUM(value_usd) AS v, SUM(quantity_kg) AS q
            FROM read_parquet('{_sql_path(flows)}')
            WHERE {where} AND year IN ({recent_sql})
        """).fetchone()
        return float(row[0] / row[1]) if row and row[1] else None

    payload = {
        "recent_window": recent,
        "sources": sources,
        "price_tiers": price_tiers,
        "colombia": {
            "years":   [int(y) for y in col_df["year"].tolist()],
            "green":   [float(v) for v in col_df["green"].tolist()],
            "roasted": [float(v) for v in col_df["roasted"].tolist()],
        },
        "unit_values": {
            "green_import":   unit_value(f"target = 'PAN' AND hs_code IN {green}"),
            "roasted_import": unit_value(f"target = 'PAN' AND hs_code IN {roasted}"),
            "green_export":   unit_value(f"source = 'PAN' AND hs_code IN {green}"),
            "roasted_export": unit_value(f"source = 'PAN' AND hs_code IN {roasted}"),
        },
    }
    (VIZ_DATA / "panama.json").write_text(json.dumps(payload, separators=(",", ":")))
    log.info("Wrote panama.json (%d sources, %d tiers, %d COL years)",
             len(sources), len(price_tiers), len(payload["colombia"]["years"]))


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    VIZ_DATA.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")

    centroids_df = con.execute(
        f"SELECT * FROM read_csv_auto('{_sql_path(REFERENCE / 'country_centroids.csv')}', header=true)"
    ).df()
    centroids_by_iso3 = {
        r.iso3: {"name": r.name, "lat": float(r.lat), "lon": float(r.lon), "region": r.region}
        for r in centroids_df.itertuples(index=False)
    }

    years_rows = con.execute(
        f"SELECT DISTINCT year FROM read_parquet('{_sql_path(PROCESSED / 'flows.parquet')}') ORDER BY year"
    ).df()
    years = years_rows["year"].tolist()
    log.info("Years available: %s", years)

    if years:
        iso3_used = set(
            con.execute(f"""
                SELECT DISTINCT source AS iso3 FROM read_parquet('{_sql_path(PROCESSED / 'flows.parquet')}')
                UNION
                SELECT DISTINCT target AS iso3 FROM read_parquet('{_sql_path(PROCESSED / 'flows.parquet')}')
            """).df()["iso3"].tolist()
        )
    else:
        iso3_used = set()

    countries_meta = {
        iso3: centroids_by_iso3[iso3] for iso3 in sorted(iso3_used)
        if iso3 in centroids_by_iso3
    }
    missing = iso3_used - set(centroids_by_iso3)
    if missing:
        log.warning("No centroid for %d ISO codes: %s", len(missing), sorted(missing))

    meta = {
        "version": date.today().isoformat(),
        "years": [int(y) for y in years],
        "countries": countries_meta,
    }
    (VIZ_DATA / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    log.info("Wrote meta.json with %d years, %d countries", len(years), len(countries_meta))

    for year in years:
        for type_filter in ("all", "green", "roasted"):
            nodes, edges = query_year_type(con, int(year), type_filter)
            payload = {
                "year": int(year),
                "type": type_filter,
                "nodes": nodes,
                "edges": edges,
                "tier": compute_tiers(nodes, edges),
            }
            (VIZ_DATA / f"{int(year)}-{type_filter}.json").write_text(
                json.dumps(payload, separators=(",", ":"))
            )
        log.info("Wrote 3 files for year %d", year)

    build_colombia_monthly()
    build_brazil_monthly()
    build_mexico()
    build_panama()

    log.info("Done. meta.json + %d year files", len(years) * 3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
