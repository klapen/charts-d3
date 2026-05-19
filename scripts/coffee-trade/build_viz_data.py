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

    log.info("Done. meta.json + %d year files", len(years) * 3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
