# LLM Matcher — pre-deploy smoke checklist

Open /viz/llm-matcher/ (dev: http://localhost:5173/viz/llm-matcher/)

## Load
- [ ] Page loads dark with JetBrains Mono; no console errors
- [ ] noindex,nofollow meta present in page source
- [ ] Both modes render: "I have a model" (default) shows the search list + empty-state hint; "I have a PC" shows the GPU/RAM/quant form + bucket lists

## Mode toggle & persistence
- [ ] Pick a model in model-first mode, switch to "I have a PC" and back — the same model stays selected/searched
- [ ] In PC-first mode, change GPU / # GPUs / RAM / quant, switch to model-first and back — the PC config is unchanged (GPU, count, RAM, quant selects all reflect the store, not just GPU+RAM)
- [ ] Money panel keeps showing the last focused model across both mode switches

## Context slider — both modes
- [ ] Model-first: dragging the context slider changes the min/optimal VRAM figures and target rig for the selected model
- [ ] PC-first: dragging the context slider re-buckets models between "Runs now" / "Almost" / "Buy to run" for the selected PC

## Classification — 1× RTX 4090 24GB, q4
- [ ] Qwen3 32B → "Runs now"
- [ ] Qwen3 72B → "Almost" (CPU offload)
- [ ] Inkling and Qwen 3.8 Max → "Buy to run"

## Min / optimal, incl. data-center case
- [ ] A mid-size model (e.g. Qwen3 32B) shows sane min (cheapest, q4) vs optimal (comfy, q8) rigs with different GPUs
- [ ] Qwen 3.8 Max at high context (~256K) shows 🏭 "data center" for both min and optimal, with "you need a data center" hint — no crash, numbers scale with context (min/optimal VRAM both increase as the slider moves)

## Money panel
- [ ] OWN IT / RENT RIG / API figures populate for a selected model; 🏭 data-center case shows "🙅 ~$480k — don't" for OWN IT and "cloud cluster — see providers" for RENT RIG
- [ ] min/optimal toggle buttons change the target rig and recompute money figures
- [ ] Break-even line reads sensibly (hours to break even, or "renting/API is the sensible path")
- [ ] "sources & assumptions" `<details>` expands and shows the assumptions text (GPU prices, rental, API, kWh rate)
- [ ] Usage preset (hobby / daily / always) changes power/mo and rent/mo proportionally to hours/day

## Apple unified path
- [ ] Selecting an Apple Silicon (unified) GPU in PC-first mode shows "≈ N GB usable (unified memory)" (≈75% of system RAM) instead of a VRAM-total figure, and buckets recompute accordingly

## Cross-cutting
- [ ] 375px: `.app-body` collapses to one column, `.money-rows` stack to one column, header wraps (title / mode toggle / context slider), no horizontal scroll anywhere on the page
- [ ] Reduced motion (`prefers-reduced-motion: reduce`): all CSS transitions/animations are suppressed; page remains fully usable
- [ ] Keyboard: Tab through buttons/selects/inputs shows a visible accent (#34d399) `:focus-visible` outline
- [ ] Block/rename gpu-catalog.json → reload → `#error-strip` shows "Could not load data — try opening /ai-llm-dataset.json directly." and the app does not throw an uncaught error; restore the file and reload to confirm normal load
