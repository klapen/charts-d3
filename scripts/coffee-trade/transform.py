"""Normalize raw Comtrade into parquet for build_viz_data.py.

Run: uv run python transform.py
Output:
  data/processed/flows.parquet    one row per (year, source_iso3, target_iso3, hs_code)
  data/processed/nodes.parquet    one row per (year, iso3) with total exports/imports
"""
from __future__ import annotations
import json
import logging
import sys
from pathlib import Path
import duckdb

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
REFERENCE = ROOT / "data" / "reference"
log = logging.getLogger("transform")


def build_reporter_lookup(con: duckdb.DuckDBPyConnection) -> None:
    """Load reporters.json into a DuckDB table mapping reporter_code -> iso3.

    The free Comtrade API returns null for reporterISO/partnerISO, so we have to
    resolve numeric codes to 3-letter ISO codes ourselves.
    """
    reporters_path = RAW / "reporters.json"
    if not reporters_path.exists():
        log.warning("No reporters.json yet; transform will skip the code->iso3 join "
                    "and produce empty parquet. Run download_comtrade.py first.")
        # Create an empty table so subsequent SQL doesn't fail
        con.execute("CREATE TABLE reporters (code INTEGER, iso3 VARCHAR)")
        return
    entries = json.loads(reporters_path.read_text())
    rows = [
        (int(e["id"]), e["reporterCodeIsoAlpha3"])
        for e in entries
        if e.get("reporterCodeIsoAlpha3") and len(e["reporterCodeIsoAlpha3"]) == 3
    ]
    log.info("Loaded %d reporter codes from reporters.json", len(rows))
    con.execute("CREATE TABLE reporters (code INTEGER, iso3 VARCHAR)")
    con.executemany("INSERT INTO reporters VALUES (?, ?)", rows)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    PROCESSED.mkdir(parents=True, exist_ok=True)

    con = duckdb.connect(":memory:")

    # --- Reference tables ---
    con.execute(f"""
        CREATE TABLE iso AS
        SELECT * FROM read_csv_auto('{REFERENCE / "iso_3166.csv"}', header=true);
    """)
    con.execute(f"""
        CREATE TABLE centroids AS
        SELECT * FROM read_csv_auto('{REFERENCE / "country_centroids.csv"}', header=true);
    """)

    # --- Reporter code -> iso3 lookup, built from data/raw/reporters.json ---
    build_reporter_lookup(con)

    # --- Comtrade raw -> normalized flows ---
    comtrade_glob = str(RAW / "comtrade" / "**" / "*.json")
    have_raw = any((RAW / "comtrade").glob("**/*.json"))
    if not have_raw:
        log.warning(
            "No raw Comtrade JSON files found under %s. "
            "Writing empty parquet outputs. Run download_comtrade.py first.",
            RAW / "comtrade",
        )
        con.execute("""
            CREATE TABLE flows (year INTEGER, source VARCHAR, target VARCHAR,
                                hs_code VARCHAR, value_usd DOUBLE, quantity_kg DOUBLE);
            CREATE TABLE nodes (year INTEGER, iso3 VARCHAR,
                                exports_usd DOUBLE, imports_usd DOUBLE);
        """)
    else:
        log.info("Loading Comtrade raw JSON from %s", comtrade_glob)
        con.execute(f"""
            CREATE TABLE comtrade_raw AS
            SELECT
                CAST(refYear AS INTEGER)        AS year,
                CAST(reporterCode AS INTEGER)   AS reporter_code,
                CAST(partnerCode AS INTEGER)    AS partner_code,
                CAST(cmdCode AS VARCHAR)        AS hs_code,
                flowCode                        AS flow,
                CAST(primaryValue AS DOUBLE)    AS value_usd,
                CAST(netWgt AS DOUBLE)          AS quantity_kg
            FROM read_json_auto(
                '{comtrade_glob}',
                format = 'array',
                filename = true,
                union_by_name = true,
                maximum_object_size = 268435456
            )
            WHERE primaryValue IS NOT NULL
              AND primaryValue > 0
              AND partnerCode IS NOT NULL
              AND partnerCode <> 0;    -- 0 = World aggregate
        """)
        n = con.execute("SELECT COUNT(*) FROM comtrade_raw").fetchone()[0]
        log.info("Comtrade raw rows after filters: %d", n)

        # Resolve numeric codes to ISO3
        con.execute("""
            CREATE TABLE comtrade_iso AS
            SELECT
                c.year,
                r1.iso3 AS reporter,
                r2.iso3 AS partner,
                c.hs_code, c.flow, c.value_usd, c.quantity_kg
            FROM comtrade_raw c
            JOIN reporters r1 ON c.reporter_code = r1.code
            JOIN reporters r2 ON c.partner_code  = r2.code;
        """)
        log.info("Comtrade rows after iso3 resolution: %d",
                 con.execute("SELECT COUNT(*) FROM comtrade_iso").fetchone()[0])

        # Prefer importer-side report when available
        # For Brazil -> USA, USA reports flow='M' (imports from BRA); Brazil reports flow='X'.
        # Importer reports are generally more accurate; fall back to exporter.
        con.execute("""
            CREATE TABLE imports AS
            SELECT
                year,
                partner  AS source,   -- exporter
                reporter AS target,   -- importer (the reporting side)
                hs_code, value_usd, quantity_kg
            FROM comtrade_iso
            WHERE flow = 'M';

            CREATE TABLE exports AS
            SELECT
                year,
                reporter AS source,   -- exporter (the reporting side)
                partner  AS target,   -- importer
                hs_code, value_usd, quantity_kg
            FROM comtrade_iso
            WHERE flow = 'X';
        """)

        # Imports rows win; exports fill where importer didn't report
        con.execute("""
            CREATE TABLE flows_raw AS
            SELECT * FROM imports
            UNION ALL
            SELECT e.* FROM exports e
            LEFT JOIN imports i USING (year, source, target, hs_code)
            WHERE i.year IS NULL;
        """)

        # Aggregate within each (year, source, target, hs_code)
        con.execute("""
            CREATE TABLE flows AS
            SELECT
                year, source, target, hs_code,
                SUM(value_usd)   AS value_usd,
                SUM(quantity_kg) AS quantity_kg
            FROM flows_raw
            WHERE source <> target
            GROUP BY year, source, target, hs_code;
        """)

        # Per-(year, iso3) totals
        con.execute("""
            CREATE TABLE nodes AS
            SELECT
                year,
                iso3,
                COALESCE(exports_usd, 0) AS exports_usd,
                COALESCE(imports_usd, 0) AS imports_usd
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
    log.info("Wrote flows.parquet (%d rows) and nodes.parquet (%d rows)",
             con.execute("SELECT COUNT(*) FROM flows").fetchone()[0],
             con.execute("SELECT COUNT(*) FROM nodes").fetchone()[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
