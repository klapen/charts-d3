// Tabbed detail cards — one tab per selected model, one card visible at a time.
// Click ✕ → deselect.

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24'];

export function mountDetailCards(container, store, { toggleSelection }) {
  let activeIdx = 0;

  render();
  store.subscribe(s => ({ sel: s.exploreSelectedIds, ready: !!s.data, dash: s.activeDashboard }), render);

  function render() {
    const s = store.get();
    if (!s.data) { container.innerHTML = ''; return; }
    const all = s.data.flatModels;
    const selected = s.exploreSelectedIds.map(id => all.find(m => m.model_id === id)).filter(Boolean);

    if (selected.length === 0) { container.innerHTML = ''; activeIdx = 0; return; }
    if (activeIdx >= selected.length) activeIdx = selected.length - 1;

    const tabs = selected.map((m, i) => `
      <button class="detail-tab${i === activeIdx ? ' on' : ''}" data-tab-idx="${i}" style="--c:${COLORS[i]}">${escape(m.__raw.name)}</button>
    `).join('');

    container.innerHTML = `<div class="detail-tabs">${tabs}</div>${cardHtml(selected[activeIdx], COLORS[activeIdx])}`;

    container.querySelectorAll('[data-tab-idx]').forEach(el => {
      el.addEventListener('click', () => { activeIdx = Number(el.dataset.tabIdx); render(); });
    });
    container.querySelectorAll('[data-close-id]').forEach(el => {
      el.addEventListener('click', () => toggleSelection(el.dataset.closeId));
    });
  }

  function cardHtml(m, color) {
    const raw = m.__raw;
    return `
      <div class="detail-card" style="border-left-color:${color}">
        <h4>
          <span>${escape(raw.name)}</span>
          <button class="text-neutral-500 hover:text-neutral-200" data-close-id="${raw.model_id}" aria-label="Close">✕</button>
        </h4>
        <div class="grid">
          <span class="k">family</span><span>${escape(raw.family || '—')} · ${escape(raw.vendor || '—')}</span>
          <span class="k">license</span><span>${escape(raw.license.name)}${raw.license.osi_approved ? ' (OSI)' : ''}</span>
          <span class="k">params</span><span>${fmtParams(raw.params)}</span>
          <span class="k">context</span><span>${fmtNum(raw.context_window)} tokens</span>
          <span class="k">vram q4 / q8 / fp16</span><span>${fmtVram(raw.vram_estimate_gb)}</span>
          <span class="k">arena elo</span><span>${raw.quality.arena_elo ?? '—'}</span>
          <span class="k">composite</span><span>${raw.quality.composite_score?.toFixed(2) ?? '—'}</span>
          <span class="k">coding (HumanEval)</span><span>${pct(raw.quality.coding.humaneval)}</span>
          <span class="k">multilingual</span><span>${pct(raw.quality.multilingual_score)}</span>
          <span class="k">latency (TTFT)</span><span>${raw.performance.latency_ttft_ms ?? '—'} ms</span>
          <span class="k">throughput</span><span>${raw.performance.throughput_tok_s ?? '—'} tok/s</span>
          <span class="k">$/Mtok in/out</span><span>${dollar(raw.pricing_hosted.input_per_mtok_usd)} / ${dollar(raw.pricing_hosted.output_per_mtok_usd)}</span>
          <span class="k">sources</span><span>${raw.sources_used.join(' · ') || '—'}</span>
          <span class="k">missing</span><span>${raw.missing_fields.length} fields</span>
        </div>
        <a class="block text-xs text-blue-400 underline mt-2" href="${raw.model_card_url}" target="_blank" rel="noopener">model card →</a>
      </div>
    `;
  }

  function fmtParams(p) {
    if (!p) return '—';
    return p.is_moe
      ? `${p.total_b}B total · ${p.active_b}B active (MoE)`
      : `${p.total_b}B (dense)`;
  }
  function fmtVram(v) {
    if (!v) return '—';
    return [v.q4, v.q8, v.fp16].map(x => x == null ? '—' : `${x}`).join(' / ') + ' GB';
  }
  function fmtNum(n) { return n == null ? '—' : n.toLocaleString('en-US'); }
  function pct(n) { return n == null ? '—' : (n * 100).toFixed(0) + '%'; }
  function dollar(n) { return n == null ? '—' : '$' + n.toFixed(2); }
  function escape(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
}
