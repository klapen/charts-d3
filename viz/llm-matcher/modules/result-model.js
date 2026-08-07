import { minOptimal, estimateToksPerSec, speedBadge } from './fit.js';
import { referenceLabel } from './references.js';

function rigText(rig) {
  if (rig.datacenter) return '🏭 data center';
  return rig.count > 1 ? `${rig.count}× ${rig.gpu.name}` : rig.gpu.name;
}
function card(title, part, model) {
  const lbl = referenceLabel(part.neededGb);
  let speed = '';
  if (!part.rig.datacenter) {
    const t = estimateToksPerSec(model, part.rig.gpu.mem_bandwidth_gbps, part.quant);
    const b = speedBadge(t);
    speed = `<div class="hw-speed">≈ ${t < 10 ? t.toFixed(1) : Math.round(t)} tok/s ${b.emoji} ${b.label}</div>`;
  }
  return `<div class="hw-card">
    <div class="hw-title">${title}</div>
    <div class="hw-quant">${part.quant} · ${part.neededGb.toFixed(0)} GB ≈</div>
    <div class="hw-rig">${rigText(part.rig)}</div>
    ${speed}
    <div class="hw-ref">${lbl.emoji} ${lbl.text}</div>
  </div>`;
}
export function mountResultModel(el, store, models, gpus) {
  store.subscribe(s => {
    if (s.mode !== 'model') return;
    const m = models.find(x => x.model_id === s.selectedModelId);
    if (!m) { el.innerHTML = `<p class="hint">Pick a model to see the hardware it needs.</p>`; return; }
    const mo = minOptimal(m, gpus, s.contextTokens);
    el.innerHTML = `<h2 class="res-name">${m.name}</h2>
      <div class="hw-cards">${card('MIN (cheapest)', mo.min, m)}${card('OPTIMAL (comfy)', mo.optimal, m)}</div>
      <p class="hint">≈ estimates — weights + KV cache at short/long context.</p>`;
  });
}
