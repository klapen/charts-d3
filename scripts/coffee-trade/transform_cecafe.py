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

# Every June PDF carries TWO copies of the differentiated-coffees table: one
# titled "... - ANO-SAFRA" (crop-year-to-date, Jul→Jun) and one with calendar
# YTD (Jan→Jun). We MUST use the calendar one — otherwise July monthly deltas
# become huge negatives when the calendar reset clashes with the safra figures.
SAFRA_MARKER = re.compile(r"ANO[-\s]*SAFRA", re.IGNORECASE)

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
        # Pick the LAST body page whose text matches SECTION_HEADER but ALSO
        # excludes ANO-SAFRA. The TOC on page 1 also matches, but body pages
        # always come later. June PDFs contain both a safra and a calendar-YTD
        # section — we explicitly skip the safra one so July monthly deltas
        # don't go negative.
        target_page = None
        for page in pdf.pages:
            text = page.extract_text() or ""
            if not SECTION_HEADER.search(text):
                continue
            # June PDFs publish two copies of this section: a calendar-YTD one
            # ("Período: janeiro a junho") and a crop-year one ("Período
            # (ano-safra): ..."). We MUST pick the calendar copy. Two layout
            # variants:
            #   - 2017-2023: "1.N. ... DIFERENCIADOS - ANO-SAFRA" in title line.
            #   - 2024+: title is identical; safra marker is on the next line.
            # Strategy: for each "1.N. ... DIFERENCIADOS" header line in the
            # page, inspect that line PLUS the next 3 lines (Período sits there).
            # A page qualifies if at least one such block lacks the SAFRA marker.
            calendar_header_present = False
            lines = text.split("\n")
            for idx, line in enumerate(lines):
                m = re.match(r"\s*1\.\d+\.\s*EXPORTA[ÇC][ÕO]ES\s+BRASILEIRAS\s+DE\s+CAF[ÉE]S\s+DIFERENCIADOS",
                             line, re.IGNORECASE)
                if not m:
                    continue
                block = "\n".join(lines[idx:idx + 4])
                if not SAFRA_MARKER.search(block):
                    calendar_header_present = True
                    break
            if calendar_header_present:
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
    # Months whose YTD we couldn't read (Cecafé occasionally omits the
    # differentiated-coffees section in a given month, e.g. 2021-10). For each,
    # we'll later interpolate by splitting the gap to the next-known YTD evenly.
    skipped: list[tuple[int, int]] = []
    for path in pdfs:
        m = re.match(r"(\d{4})-(\d{2})\.pdf", path.name)
        if not m:
            log.warning("skipping unexpected filename: %s", path.name)
            continue
        year, month = int(m[1]), int(m[2])
        try:
            cats = parse_pdf(path)
        except ValueError as e:
            msg = str(e)
            if "section 1.X differentiated-coffee page not found" in msg:
                log.warning("SKIP %s: section omitted in this issue — will interpolate", path.name)
                skipped.append((year, month))
                continue
            log.error("FAIL %s: %s", path.name, e)
            return 2
        except Exception as e:
            log.error("FAIL %s: %s", path.name, e)
            return 2
        for cat, bags in cats.items():
            ytd_rows.append({"year": year, "month": month, "category": cat, "ytd_bags": bags})
        log.info("ok %s: %s", path.name, {k: cats[k] for k in sorted(cats)})

    # Interpolate YTD for skipped months. For a missing (year, M) with known
    # YTD at (year, M-1) and (year, M+1), set ytd[M] = (ytd[M-1] + ytd[M+1]) / 2,
    # which splits the two-month delta evenly. Only handles single-month gaps
    # bounded by known months on both sides within the same year.
    if skipped:
        existing = {(r["year"], r["month"], r["category"]): r["ytd_bags"] for r in ytd_rows}
        for (year, month) in skipped:
            interpolated: dict[str, int] = {}
            for cat in EXPECTED:
                prev_ytd = existing.get((year, month - 1, cat), 0 if month == 1 else None)
                next_ytd = existing.get((year, month + 1, cat))
                if prev_ytd is None or next_ytd is None:
                    log.error("cannot interpolate %d-%02d %s: missing neighbor YTD",
                              year, month, cat)
                    return 2
                interpolated[cat] = (int(prev_ytd) + int(next_ytd)) // 2
            log.warning("interpolated %d-%02d: %s", year, month,
                        {k: interpolated[k] for k in sorted(interpolated)})
            for cat, bags in interpolated.items():
                ytd_rows.append({"year": year, "month": month, "category": cat, "ytd_bags": bags})

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
    # Cecafé occasionally REVISES a prior-month YTD downward (typically by a few
    # hundred to ~20K bags out of millions — a small administrative correction).
    # We tolerate revisions ≤ 50_000 bags by clipping to 0 with a warning, and
    # fail loudly on anything larger (which would indicate a parser bug).
    REVISION_TOLERANCE = 50_000
    for c in cats:
        bad = monthly[monthly[c] < 0]
        if bad.empty:
            continue
        large = bad[bad[c] < -REVISION_TOLERANCE]
        if not large.empty:
            log.error("negative monthly deltas in %s exceed tolerance:\n%s", c, large)
            return 3
        # Clip small negatives to zero.
        for _, row in bad.iterrows():
            log.warning("YTD revision %d-%02d %s: %d bags clipped to 0",
                        int(row["year"]), int(row["month"]), c, int(row[c]))
        monthly.loc[monthly[c] < 0, c] = 0

    # December YTD must equal the year's monthly sum (within REVISION_TOLERANCE
    # to absorb the small revision-clipping done above).
    for year, group in wide.groupby("year"):
        if 12 not in set(group["month"]):
            continue
        dec_ytd = group[group["month"] == 12].iloc[0]
        msum = monthly[monthly["year"] == year][cats].sum()
        for c in cats:
            diff = int(msum[c]) - int(dec_ytd[c])
            if abs(diff) > REVISION_TOLERANCE:
                log.error("year %d %s: dec YTD=%d but monthly sum=%d (diff=%d)",
                          year, c, int(dec_ytd[c]), int(msum[c]), diff)
                return 4

    monthly.to_parquet(PROCESSED / "cecafe-monthly.parquet", index=False)
    log.info("wrote %d monthly rows across %d years",
             len(monthly), monthly["year"].nunique())
    return 0


if __name__ == "__main__":
    sys.exit(main())
