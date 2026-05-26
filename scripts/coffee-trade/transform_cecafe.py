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
    # Cecafé sometimes truncates the closing paren in the cell ("Industrializado
    # (Solúvel e T&M"), so we match by prefix.
    "industrializado (soluvel e t&m": "processed",
}
EXPECTED = set(ROW_LABELS.values())

# Page-detection regex: matches the section header for the differentiated-coffee
# table. Section number varies by report (1.6 / 1.7 / 1.10 / 1.11 / etc.), so we
# accept any "1.N." prefix. Required because the table-of-contents on page 1
# also contains the same phrase.
SECTION_HEADER = re.compile(
    r"1\.\d+\.\s*EXPORTA[ÇC][ÕO]ES\s+BRASILEIRAS\s+DE\s+CAF[ÉE]S\s+DIFERENCIADOS",
    re.IGNORECASE,
)

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
        # Pick the LAST page whose text matches SECTION_HEADER. The TOC on page 1
        # also matches (it lists the section title), but the actual data page
        # always comes later in the document.
        target_page = None
        for page in pdf.pages:
            text = page.extract_text() or ""
            if SECTION_HEADER.search(text):
                target_page = page
        if target_page is None:
            raise ValueError(f"{path.name}: section 1.X differentiated-coffee page not found")

        found: dict[str, int] = {}
        for table in target_page.extract_tables() or []:
            for row in table:
                if not row or row[0] is None:
                    continue
                key = _norm(row[0])
                # Prefix match: handles "Industrializado (Solúvel e T&M" (truncated)
                # as well as the full "Industrializado (Solúvel e T&M)" form.
                category = None
                for label, cat in ROW_LABELS.items():
                    if key.startswith(label):
                        category = cat
                        break
                if category is None:
                    continue
                # First non-empty cell after the label is the YTD bag count.
                # A literal "-" means zero exports for that category.
                for cell in row[1:]:
                    if cell is None:
                        continue
                    stripped = cell.strip()
                    if not stripped:
                        continue
                    if stripped == "-":
                        found[category] = 0
                        break
                    if re.search(r"\d", stripped):
                        found[category] = _parse_bags(stripped)
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
