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
# FNC republishes these workbooks monthly under new wp-content path slugs
# (year/month subdirs + occasionally renamed files), so these URLs are fragile
# and will need re-discovery each refresh — they are not stable permalinks.
#
# The "produccion.xlsx" entry points at the combined "Precios, area y produccion
# de cafe" workbook because FNC bundles production data inside it. Task 3's
# parser extracts the production tab only; the local filename is just our cache
# label and need not match FNC's filename.
SOURCES = {
    "produccion.xlsx":    "https://federaciondecafeteros.org/wp-content/uploads/2026/05/Precios-area-y-produccion-de-cafe-2026-2.xlsx",
    "exportaciones.xlsx": "https://federaciondecafeteros.org/wp-content/uploads/2026/04/Exportaciones-2026-2.xlsx",
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
            log.error("URL for %s not set - update SOURCES in this file", name)
            return 1
        fetch(url, RAW_DIR / name)
    log.info("Done. Files in %s", RAW_DIR)
    return 0


if __name__ == "__main__":
    sys.exit(main())
