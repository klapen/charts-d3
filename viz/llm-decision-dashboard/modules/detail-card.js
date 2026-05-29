// Tabbed detail aside. "Metrics" tab is always first (default view); each selected
// model adds its own tab with full metadata. Click ✕ on a card → deselect.

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24'];

export function mountDetailCards(container, store, { toggleSelection }) {
  let activeIdx = -1;          // -1 = Metrics; 0..N-1 = selected[idx]
  let lastSelectedId = null;

  render();
  store.subscribe(s => ({ sel: s.exploreSelectedIds, ready: !!s.data, dash: s.activeDashboard }), render);

  function render() {
    const s = store.get();
    if (!s.data) { container.innerHTML = ''; return; }
    const all = s.data.flatModels;
    const selected = s.exploreSelectedIds.map(id => all.find(m => m.model_id === id)).filter(Boolean);

    // Auto-focus the newest model when selection actually changes.
    const lastId = selected.length ? selected[selected.length - 1].model_id : null;
    if (lastId !== lastSelectedId && selected.length > 0) {
      activeIdx = selected.length - 1;
    } else if (selected.length === 0) {
      activeIdx = -1;
    } else if (activeIdx >= selected.length) {
      activeIdx = selected.length - 1;
    }
    lastSelectedId = lastId;

    const tabs = [
      `<button class="detail-tab${activeIdx === -1 ? ' on' : ''}" data-tab-idx="-1" style="--c:#a3a3a3">Metrics</button>`,
      ...selected.map((m, i) =>
        `<button class="detail-tab${i === activeIdx ? ' on' : ''}" data-tab-idx="${i}" style="--c:${COLORS[i]}">${escape(m.__raw.name)}</button>`
      ),
    ].join('');

    const body = activeIdx === -1
      ? metricsHtml(s.data.dimensions)
      : cardHtml(selected[activeIdx], COLORS[activeIdx]);

    container.innerHTML = `<div class="detail-tabs">${tabs}</div>${body}`;

    container.querySelectorAll('[data-tab-idx]').forEach(el => {
      el.addEventListener('click', () => { activeIdx = Number(el.dataset.tabIdx); render(); });
    });
    container.querySelectorAll('[data-close-id]').forEach(el => {
      el.addEventListener('click', () => toggleSelection(el.dataset.closeId));
    });
  }

  function metricsHtml() {
    return `
      <div class="detail-card metrics-card" style="border-left-color:#a3a3a3">
        <h4><span>Metrics reference</span></h4>
        <p class="text-xs text-neutral-500 mb-2">What you can pick in the X / Y / Size dropdowns.</p>
        <div class="metric-group">Quality (↑ better)</div>
        <div class="metric-row"><span class="m-name">Arena Elo</span><span class="m-desc">LMArena Elo from blind human votes.</span></div>
        <div class="metric-row"><span class="m-name">Composite</span><span class="m-desc">Mean of normalized Arena Elo, GPQA, MMLU-Pro, HumanEval. 0–1.</span></div>
        <div class="metric-row"><span class="m-name">GPQA</span><span class="m-desc">Graduate-level science reasoning.</span></div>
        <div class="metric-row"><span class="m-name">MMLU-Pro</span><span class="m-desc">Hardened broad-knowledge benchmark.</span></div>

        <div class="metric-group">Cost (↓ better)</div>
        <div class="metric-row"><span class="m-name">$/M in</span><span class="m-desc">USD per million input tokens (cheapest hosted offering).</span></div>
        <div class="metric-row"><span class="m-name">$/M out</span><span class="m-desc">USD per million output tokens.</span></div>

        <div class="metric-group">Local-deploy fit</div>
        <div class="metric-row"><span class="m-name">Context</span><span class="m-desc">Max prompt window in tokens. ↑ better.</span></div>
        <div class="metric-row"><span class="m-name">VRAM q4 / q8</span><span class="m-desc">GPU memory to run locally at 4- / 8-bit. ↓ better.</span></div>
        <div class="metric-row"><span class="m-name">Params total</span><span class="m-desc">Total parameter count in billions.</span></div>
        <div class="metric-row"><span class="m-name">Params active</span><span class="m-desc">For MoE: params compute per token. Memory still scales with total.</span></div>

        <p class="text-xs text-neutral-500 mt-3">Full glossary in the <b>Reference</b> tab at the top.</p>
      </div>
    `;
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
