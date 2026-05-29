"""Normalize FNC XLSX files into a long-format parquet.

Run: uv run python transform_fnc.py
Input:
  data/raw/fnc/produccion.xlsx     (combined "Precios, area y produccion" workbook)
  data/raw/fnc/exportaciones.xlsx
Output:
  data/processed/colombia_monthly.parquet

Schema: year_month (str YYYY-MM) | production_bags (int) | exports_bags (int)
Clipped to 2015-01 .. 2023-12.

Layout discovered in Step 1
---------------------------
Both workbooks share the same simple layout on the sheets we care about:

produccion.xlsx
  sheet: "8. Producción mensual"
  rows 1..5  -> title block ("Producción registrada - Mensual",
                "Miles de sacos de 60 Kg de café verde equivalente ", source, blank)
  row  6     -> header: (None, None, None, "Mes", "Producción", None, None)
  rows 7+    -> data, col D = first-of-month datetime, col E = thousand-bags float
  data runs from 1956-01 through 2026-04 (no footer totals row).

exportaciones.xlsx
  sheet: "1. Total_Volumen"
  rows 1..6  -> title block ("Volumen de las exportaciones colombianas de cafe - mensual",
                "Miles de sacos de 60 Kg de cafe verde equivalente ",
                "Informacion definitiva", source, "Volver" navigation cell)
  row  7     -> header: (None, None, None, "MES", "Total Exportaciones", None, None, None)
  rows 8+    -> data, col D = first-of-month datetime, col E = thousand-bags float
  data runs from 1958-01 through 2026-03 with trailing empty rows.

Both files quote values in "Miles de sacos" (thousands of 60kg green-equivalent
bags), so we multiply by 1000 to get raw bags.
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


def load_long(
    xlsx_path: Path,
    sheet_name: str,
    value_col: str,
    header_row: int,
    date_col: str,
    source_value_col: str,
) -> pd.DataFrame:
    """Read an FNC XLSX into long format with columns: year_month, {value_col}.

    The two FNC sheets we use share the same shape: a small title block, one
    header row, then two relevant columns - a first-of-month date column and a
    monthly value column expressed in thousands of 60kg bags.

    Parameters
    ----------
    xlsx_path
        Workbook to read.
    sheet_name
        Sheet name inside the workbook.
    value_col
        Output column name (e.g. ``"production_bags"``).
    header_row
        0-indexed row number of the header (passed to ``pandas.read_excel`` as
        ``header=...``).
    date_col, source_value_col
        Names of the columns inside the sheet (as parsed by pandas) holding
        the month-start date and the thousand-bags value.
    """
    raw = pd.read_excel(
        xlsx_path,
        sheet_name=sheet_name,
        engine="openpyxl",
        header=header_row,
    )

    # Keep only the two columns we care about and drop blank / footer rows.
    df = raw[[date_col, source_value_col]].copy()
    df = df.dropna(subset=[date_col, source_value_col])

    # Coerce date column to a real Timestamp (it usually already is).
    df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=[date_col])

    df["year_month"] = df[date_col].dt.strftime("%Y-%m")

    # Source values are in thousands of bags -> convert to bags.
    df[value_col] = (df[source_value_col].astype(float) * 1000).round().astype("int64")

    df = df[["year_month", value_col]]
    # Defensive: if the workbook somehow has duplicate months, sum them.
    df = df.groupby("year_month", as_index=False)[value_col].sum()
    return df


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    PROCESSED.mkdir(parents=True, exist_ok=True)

    prod = load_long(
        RAW_DIR / "produccion.xlsx",
        sheet_name="8. Producción mensual",
        value_col="production_bags",
        header_row=5,  # row index 5 in 0-based terms = the "Mes / Producción" header
        date_col="Mes",
        source_value_col="Producción",
    )
    exp = load_long(
        RAW_DIR / "exportaciones.xlsx",
        sheet_name="1. Total_Volumen",
        value_col="exports_bags",
        header_row=6,  # row index 6 = "MES / Total Exportaciones" header
        date_col="MES",
        source_value_col="Total Exportaciones",
    )

    df = prod.merge(exp, on="year_month", how="outer").sort_values("year_month")
    df = df[(df["year_month"] >= START) & (df["year_month"] <= END)].reset_index(drop=True)
    df["production_bags"] = df["production_bags"].fillna(0).astype("int64")
    df["exports_bags"] = df["exports_bags"].fillna(0).astype("int64")

    log.info(
        "Rows: %d, range: %s..%s",
        len(df),
        df["year_month"].iloc[0],
        df["year_month"].iloc[-1],
    )
    log.info("Production sum: %d bags", df["production_bags"].sum())
    log.info("Exports sum:    %d bags", df["exports_bags"].sum())
    log.info("Sample head:\n%s", df.head())
    log.info("Sample tail:\n%s", df.tail())

    # Sanity check: monthly exports should rarely exceed production (intra-month
    # they can, due to inventory carryover - just warn).
    over = df[df["exports_bags"] > df["production_bags"] * 1.5]
    if not over.empty:
        log.warning(
            "%d months where exports > 1.5x production (likely inventory carryover):\n%s",
            len(over),
            over,
        )

    out = PROCESSED / "colombia_monthly.parquet"
    df.to_parquet(out, index=False)
    log.info("Wrote %s", out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
