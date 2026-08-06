import { moneyFor, USAGE } from './money.js';
import { minOptimal } from './fit.js';

const usd = n => n == null ? '—' : `$${n.toLocaleString(undefined,{maximumFractionDigits: n<10?2:0})}`;
const rigLabel = rig => rig.datacenter ? '🏭 data center'
  : (rig.count>1 ? `${rig.count}× ${rig.gpu.name}` : rig.gpu.name);

export function mountMoneyPanel(el, store, models, gpus, meta = {}) {
  const syncedDate = meta.datasetSynced ? new Date(meta.datasetSynced).toISOString().slice(0, 10) : 'n/a';
  store.subscribe(s => {
    const wasOpen = el.querySelector('.money-src')?.open;
    const m = models.find(x => x.model_id === s.focusModelId);
    if (!m) { el.innerHTML = `<p class="hint">Select a model to compare buy vs rent.</p>`; return; }
    const mo = minOptimal(m, gpus, s.contextTokens);
    const rig = s.targetRig === 'optimal' ? mo.optimal.rig : mo.min.rig;
    const money = moneyFor(m, rig, s.usagePreset);
    const hrs = USAGE[s.usagePreset];

    const own = money.datacenter
      ? `🛒 OWN IT <b>🙅 ~$480k — don't</b>`
      : `🛒 OWN IT <b>${usd(money.buyUsd)}</b> upfront + ~${usd(money.powerMo)}/mo power`;
    const rent = money.datacenter
      ? `☁️ RENT RIG <b>cloud cluster</b> — see providers`
      : `☁️ RENT RIG <b>${usd(money.rentHr)}/hr</b> ≈ ${usd(money.rentMo)}/mo at ${hrs}h/day`;
    const api = money.api
      ? `🔌 API <b>${usd(money.api.in)}</b> in / <b>${usd(money.api.out)}</b> out per 1M tok`
      : `🔌 API <b>self-host only</b> (no public API yet)`;
    const be = money.breakEvenHours
      ? `⚖️ Owning beats renting the rig after ≈ ${Math.round(money.breakEvenHours)} h of use — heavy daily? buy. bursty? rent. light? API.`
      : `⚖️ Renting/API is the sensible path at this scale.`;

    el.innerHTML = `
      <div class="money-head">💰 BUY vs RENT — ${m.name}
        <span class="money-controls">
          <button data-rig="min" class="${s.targetRig==='min'?'active':''}">min</button>
          <button data-rig="optimal" class="${s.targetRig==='optimal'?'active':''}">optimal</button>
          <select class="usage">${Object.keys(USAGE).map(k =>
            `<option value="${k}" ${k===s.usagePreset?'selected':''}>${k}</option>`).join('')}</select>
          <span class="hint">target: ${rigLabel(rig)}</span>
        </span></div>
      <div class="money-rows"><span>${own}</span><span>${rent}</span><span>${api}</span></div>
      <div class="money-be">${be}</div>
      <details class="money-src"><summary>sources & assumptions</summary>
        <p class="hint">GPU buy prices: approx. street prices (gpu-catalog, updated ${meta.gpuUpdated}). Rental: cloud on-demand (Jarvislabs/Lambda/getdeploying, Aug 2026). API: from ai-llm-dataset.json (synced ${syncedDate}). Assumes $0.15/kWh, additive multi-GPU VRAM, bucketed KV — all ≈ estimates.</p>
      </details>`;
    if (wasOpen) el.querySelector('.money-src').open = true;
    el.querySelectorAll('button[data-rig]').forEach(b =>
      b.addEventListener('click', () => store.set({ targetRig: b.dataset.rig })));
    el.querySelector('.usage').addEventListener('change', e =>
      store.set({ usagePreset: e.target.value }));
  });
}
