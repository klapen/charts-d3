import { classify, smallestRigThatFits, neededGb } from './fit.js';

const rigLabel = rig => rig.datacenter ? '🏭 data center'
  : (rig.count>1 ? `${rig.count}× ${rig.gpu.name}` : rig.gpu.name);

export function mountResultPc(el, store, models, gpus) {
  store.subscribe(s => {
    if (s.mode !== 'pc') return;
    const gpu = gpus.find(g => g.id === s.pc.gpuId);
    const buckets = { runs: [], almost: [], buy: [] };
    for (const m of models) {
      const r = classify(m, s.pc, gpu, s.contextTokens, gpus);
      buckets[r.bucket].push({ m, r });
    }
    const row = ({ m, r }) =>
      `<li data-id="${m.model_id}">${m.name}${r.fix ? ` <span class="fix">— ${r.fix}</span>` : ''}</li>`;
    el.innerHTML = `
      <div class="bucket runs"><h3>✅ Runs now (${buckets.runs.length})</h3><ul>${buckets.runs.map(row).join('')||'<li class="hint">none</li>'}</ul></div>
      <div class="bucket almost"><h3>⚠️ Almost (${buckets.almost.length})</h3><ul>${buckets.almost.map(row).join('')||'<li class="hint">none</li>'}</ul></div>
      <div class="bucket buy"><h3>❌ Buy to run (${buckets.buy.length})</h3><ul>${buckets.buy.map(row).join('')||'<li class="hint">none</li>'}</ul></div>`;
    el.querySelectorAll('li[data-id]').forEach(li =>
      li.addEventListener('click', () => store.set({ focusModelId: li.dataset.id })));

    const need = buckets.buy.map(({m}) => neededGb(m, 'q4', s.contextTokens));
    if (need.length) {
      const target = Math.min(...need);
      const rig = smallestRigThatFits(target, gpus);
      const label = rig.datacenter ? 'a data center' : rigLabel(rig);
      el.insertAdjacentHTML('beforeend',
        `<p class="upgrade hint">⬆ Upgrade toward <b>${label}</b> to unlock the cheapest "buy" model.</p>`);
    }
  });
}
