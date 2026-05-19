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


class QuotaExceeded(Exception):
    """Raised when Comtrade's daily request quota is exhausted (HTTP 403).

    Treated as stop-the-world: continuing burns wall-clock time on requests
    that will all 403 until the quota resets. Re-run after midnight UTC.
    """


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
    REPORTERS_CACHE.parent.mkdir(parents=True, exist_ok=True)
    REPORTERS_CACHE.write_text(json.dumps(data))
    return data


def fetch_year_reporter(
    client: httpx.Client, year: int, reporter_code: str
) -> dict | None:
    """Fetch one (year, reporter) tuple covering all 4 HS codes."""
    # NOTE: The free-tier endpoint uses ?period= as a query param, not /year/ALL
    # in the path (the path form returns 404 as of 2026-05).
    url = (
        f"{BASE_URL}"
        f"?period={year}"
        f"&reporterCode={reporter_code}"
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
            if r.status_code == 403:
                raise QuotaExceeded(f"403 for {year}/{reporter_code}: {r.text[:200]}")
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
        # NOTE: The reporters JSON uses "reporterCodeIsoAlpha3", not "isoAlpha3".
        countries = [
            r for r in reporters
            if r.get("reporterCodeIsoAlpha3") and len(r["reporterCodeIsoAlpha3"]) == 3
        ]
        log.info("%d reporter countries", len(countries))

        try:
            for year in YEARS:
                year_dir = RAW_DIR / str(year)
                year_dir.mkdir(parents=True, exist_ok=True)

                for c in countries:
                    iso3 = c["reporterCodeIsoAlpha3"]
                    reporter_code = str(c["id"])  # Comtrade numeric code
                    out = year_dir / f"{iso3}.json"
                    if out.exists():
                        continue  # resumable: skip already-downloaded

                    log.info("year=%d reporter=%s (%s)", year, iso3, c.get("text"))
                    data = fetch_year_reporter(client, year, reporter_code)
                    if data is None:
                        log_failure(year, iso3, "fetch_failed")
                    else:
                        tmp = out.with_suffix(".tmp")
                        tmp.write_text(json.dumps(data))
                        tmp.replace(out)  # atomic on POSIX
                    time.sleep(REQ_SLEEP_SECONDS)
        except QuotaExceeded as exc:
            log.warning("Comtrade quota hit (%s). Re-run after quota resets; already-downloaded files will be skipped.", exc)
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
