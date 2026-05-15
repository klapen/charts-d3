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

No API key is needed — the pipeline uses the free public Comtrade endpoint.

Then `git status` should show new/updated files only under `viz/coffee-trade/data/`.
Commit those.

## Adding a year

Edit `YEARS = range(2015, 2024)` at the top of `download_comtrade.py`. Re-run
all four steps. The downloader skips years already on disk under `raw/comtrade/`.

## Refreshing a single year

Delete `raw/comtrade/{year}/` and re-run. Everything else stays cached.

## Notes

- `uv.lock` is committed so a yearly re-run resolves to the same dependency versions. Delete and re-run `uv sync` if you want to refresh.
