// §02 The specialists — HumanEval pass rate as horizontal bars, parameter
// count badged on each bar. Bars animate in on enter; green = fits locally.

import { onEnter, REDUCED } from './scroll.js';

export function mountCoding(models, hwState) {
  const host = document.getElementById('chart-coding');
  const data = models
    .filter(m => m.quality.coding.humaneval != null)
    .sort((a, b) => b.quality.coding.humaneval - a.quality.coding.humaneval);

  const note = document.createElement('p');
  note.className = 'chart-note';
  note.textContent = `${data.length} of ${models.length} models have HumanEval scores — all of them coding specialists.`;
  host.appendChild(note);

  const rows = data.map(m => {
    const he = m.quality.coding.humaneval;
    const row = document.createElement('div');
    row.className = 'hbar-row';
    row.innerHTML = `
      <span class="nm">${m.name}</span>
      <div class="track">
        <div class="fill" style="width:0%"><span class="size-tag">${m.params.total_b}B</span></div>
      </div>
      <span class="pct">${(he * 100).toFixed(0)}%</span>`;
    host.appendChild(row);
    return { m, fill: row.querySelector('.fill'), target: he * 100 };
  });

  hwState.subscribe(v => {
    rows.forEach(r => r.fill.classList.toggle('fit', r.m.vram_estimate_gb.q4 <= v));
  });

  onEnter(host, () => {
    rows.forEach((r, i) => {
      r.fill.style.transitionDelay = REDUCED ? '0ms' : `${i * 90}ms`;
      r.fill.style.width = `${r.target}%`;
    });
  });
}
