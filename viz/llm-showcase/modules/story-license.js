// §04 The fine print — one tile per model, OSI-approved glowing green,
// everything else amber "restricted". Tiles cascade in on enter.

import { onEnter, REDUCED } from './scroll.js';

export function mountLicense(models) {
  const host = document.getElementById('chart-license');
  const osiCount = models.filter(m => m.license.osi_approved).length;
  document.getElementById('osi-count').textContent = `${osiCount}`;

  const sorted = models.slice().sort((a, b) =>
    Number(b.license.osi_approved) - Number(a.license.osi_approved) || a.name.localeCompare(b.name));

  const grid = document.createElement('div');
  grid.className = 'license-grid';
  sorted.forEach(m => {
    const tile = document.createElement('div');
    tile.className = 'license-tile' + (m.license.osi_approved ? ' osi' : '');
    tile.innerHTML = `
      <span class="nm">${m.name}</span>
      <span class="lic">${m.license.name}</span>
      <span class="badge">${m.license.osi_approved ? 'OSI APPROVED' : 'RESTRICTED'}</span>`;
    grid.appendChild(tile);
  });
  host.appendChild(grid);

  onEnter(host, () => {
    grid.querySelectorAll('.license-tile').forEach((t, i) => {
      t.style.transitionDelay = REDUCED ? '0ms' : `${i * 40}ms`;
      t.classList.add('in');
    });
  });
}
