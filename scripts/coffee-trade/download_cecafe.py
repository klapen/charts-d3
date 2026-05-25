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
