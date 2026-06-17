// GPU preset chips + VRAM slider + fit counter + per-model fit bars.
// Pure DOM; hwState is the single source of truth.

import { gsap } from 'gsap';

const GPUS = [
  { label: 'RTX 3060 · 12GB', vram: 12 },
  { label: 'RTX 4070 · 16GB', vram: 16 },
  { label: 'RTX 4090 · 24GB', vram: 24 },
  { label: 'M3 Max · 96GB',   vram: 96 },
  { label: '2× A100 · 160GB', vram: 160 },
];

export function mountHeroControls(models, hwState) {
  const chipsEl = document.getElementById('gpu-chips');
  const range   = document.getElementById('vram-range');
  const val     = document.getElementById('vram-val');
  const countEl = document.getElementById('fit-count');
  const barsEl  = document.getElementById('fit-bars');
  document.getElementById('fit-total').textContent = `/${models.length}`;

  GPUS.forEach(g => {
    const b = document.createElement('button');
    b.className = 'gpu-chip';
    b.textContent = g.label;
    b.dataset.vram = g.vram;
    b.addEventListener('click', () => hwState.set(g.vram));
    chipsEl.appendChild(b);
  });
  range.addEventListener('input', () => hwState.set(Number(range.value)));

  const sorted = models.slice().sort((a, b) => a.vram_estimate_gb.q4 - b.vram_estimate_gb.q4);
  const rows = sorted.map(m => {
    const row = document.createElement('div');
    row.className = 'fit-row';
    row.innerHTML = `
      <span class="nm">${m.name}</span>
      <span class="gb">${m.vram_estimate_gb.q4} GB</span>
      <div class="track"><div class="fill"></div></div>`;
    barsEl.appendChild(row);
    return { m, fill: row.querySelector('.fill') };
  });

  const counter = { v: 0 };
  hwState.subscribe(v => {
    val.textContent = `${v} GB`;
    if (Number(range.value) !== Math.min(v, 200)) range.value = Math.min(v, 200);
    chipsEl.querySelectorAll('.gpu-chip').forEach(c =>
      c.classList.toggle('on', Number(c.dataset.vram) === v));
    const n = models.filter(m => m.vram_estimate_gb.q4 <= v).length;
    gsap.to(counter, {
      v: n, duration: 0.6, ease: 'power2.out', overwrite: true,
      onUpdate: () => { countEl.textContent = Math.round(counter.v); },
    });
    rows.forEach((r, i) => {
      const fits = r.m.vram_estimate_gb.q4 <= v;
      r.fill.style.transitionDelay = `${i * 25}ms`;
      r.fill.classList.toggle('fit', fits);
    });
  });
}
