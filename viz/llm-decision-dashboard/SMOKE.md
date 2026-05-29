# Pre-deploy smoke checklist

Run before every `npm run deploy`. ~5 minutes in a desktop browser.

Test URL (local): `http://localhost:5173/viz/llm-decision-dashboard/`
Test URL (prod):  `https://klapen.com.co/viz/llm-decision-dashboard/`

## Load
- [ ] Page loads, no console errors
- [ ] Sync strip shows "Last synced: …" with a date matching `npm run sync:llm` time
- [ ] Sync strip lists 3 sources (HF · Artificial Analysis · LMArena)
- [ ] `/ai-llm-dataset.json` link in the sync strip opens raw JSON
- [ ] `<meta name="robots" content="noindex,nofollow">` present in page source

## Header
- [ ] 5 preset chips visible: Laptop, 24GB GPU, Best coding, Cheapest API, Best multilingual
- [ ] Click each preset → it highlights, "visible" count drops, ranked list reorders
- [ ] Click an active preset again → it clears
- [ ] Toggle "OSI-approved only" → non-OSI rows (Llama-CC, Qwen License, Gemma, DeepSeek License, Mistral Research, CC-BY-NC) disappear

## Views
- [ ] View 1 ranked list: top 25, sortable bars, chips
- [ ] View 2 parcoords: 6 axes with labels and lines
- [ ] Brush a parcoord axis → all views update, preset chip clears
- [ ] View 3 scatter: 4 dropdowns work, plot rerenders
- [ ] View 4 radar: empty by default, fills with selection polygons

## Selection
- [ ] Click 1st model → highlighted in ranked + parcoords + scatter, radar polygon, detail card appears
- [ ] Click 2nd, 3rd → cards stack (green/blue/amber)
- [ ] Click 4th → oldest selection swaps out (FIFO)
- [ ] Click ✕ on card → model deselects, polygon disappears

## Spot checks
- [ ] "Laptop" preset → Phi-3.5-mini, Llama-3.2-3B, Phi-4 are top results
- [ ] "Best coding" preset → Qwen2.5-Coder-32B, DeepSeek-R1 are top results
- [ ] "Cheapest API" preset → only models with `$/M in ≤ 1.0` visible

## Dataset link
- [ ] /ai-llm-dataset.json contains today's synced_at
- [ ] /ai-llm-dataset.schema.json loads
