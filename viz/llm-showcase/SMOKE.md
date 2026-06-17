# LLM Showcase — pre-deploy smoke checklist

Open /viz/llm-showcase/ (dev: http://localhost:5173/viz/llm-showcase/)

## Load
- [ ] Page loads dark with JetBrains Mono; no console errors
- [ ] noindex,nofollow meta present in page source
- [ ] Sync date shows in hero footnote; /ai-llm-dataset.json link works

## Hero
- [ ] 5 GPU chips; RTX 4090 24GB selected by default; counter shows fit count
- [ ] 19 fit bars sorted by GB; fitting ones green full-width
- [ ] Slider drags 4–200; value label, plane, counter, bars all track it
- [ ] 3D: dots orbit; plane glides on selection; newly fitting dots pulse
- [ ] Hover a dot → "name · N GB at q4" tooltip (desktop)
- [ ] Scene pauses when scrolled off-screen (CPU drops)

## Story
- [ ] §01: 13 dots stagger in; "your machine" line tracks selection; fit dots glow
- [ ] §02: 5 bars, CodeQwen 7B (87%) first; size tags on bars
- [ ] §03: 12 bars cheap→expensive; FREE tags on $0 entries; in/out prices
- [ ] §04: "5 of 19" in sub; 5 OSI tiles green-first; rest amber RESTRICTED
- [ ] CTA button opens /viz/llm-decision-dashboard/

## Cross-cutting
- [ ] Rail: 6 dots, active tracks scroll, click scrolls to section
- [ ] GPU selection persists: §01–§03 re-color when changed in hero
- [ ] 375px: panes stack, no horizontal scroll, chips tappable, rail hidden
- [ ] Reduced motion: static hero SVG, instant reveals/bars/tiles, everything readable
- [ ] Block dataset request → error strip, no crash
- [ ] Landing page (/) does NOT link to this page
