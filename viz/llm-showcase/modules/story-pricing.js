// §03 Renting instead — $/Mtok input price as horizontal bars (sqrt scale so
// sub-dollar prices stay visible), output price annotated. $0 = free providers.

import { onEnter, REDUCED } from './scroll.js';

export function mountPricing(models, hwState) {
  const host = document.getElementById('chart-pricing');
  const data = models
    .filter(m => m.pricing_hosted.input_per_mtok_usd != null)
    .sort((a, b) => a.pricing_hosted.input_per_mtok_usd - b.pricing_hosted.input_per_mtok_usd);
  const max = Math.max(...data.map(m => m.pricing_hosted.input_per_mtok_usd));

  const note = document.createElement('p');
  note.className = 'chart-note';
  note.textContent = `${data.length} of ${models.length} models have hosted pricing. Bar length uses a square-root scale.`;
  host.appendChild(note);

  const rows = data.map(m => {
    const p = m.pricing_hosted.input_per_mtok_usd;
    const out = m.pricing_hosted.output_per_mtok_usd;
    const width = p === 0 ? 2 : Math.max(4, Math.sqrt(p / max) * 100);
    const row = document.createElement('div');
    row.className = 'hbar-row';
    row.innerHTML = `
      <span class="nm">${m.name}</span>
      <div class="track">
        <div class="fill" style="width:0%">${p === 0 ? '<span class="size-tag">FREE</span>' : ''}</div>
      </div>
      <span class="pct">${p === 0 ? '$0' : '$' + p.toFixed(2)}<span class="out">${out != null ? ' / $' + out.toFixed(2) + ' out' : ''}</span></span>`;
    host.appendChild(row);
    return { m, fill: row.querySelector('.fill'), target: width };
  });

  hwState.subscribe(v => {
    rows.forEach(r => r.fill.classList.toggle('fit', r.m.vram_estimate_gb.q4 <= v));
  });

  onEnter(host, () => {
    rows.forEach((r, i) => {
      r.fill.style.transitionDelay = REDUCED ? '0ms' : `${i * 60}ms`;
      r.fill.style.width = `${r.target}%`;
    });
  });
}
