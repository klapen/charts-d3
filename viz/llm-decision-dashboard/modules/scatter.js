import * as Plot from '@observablehq/plot';

// View 3 — Scatter (Observable Plot).
// X / Y / size / color are selectable from dropdowns in store.scatterAxes.

const NUMERIC_DIMS = [
  'quality.arena_elo', 'quality.composite_score',
  'quality.coding.humaneval', 'quality.coding.livecodebench', 'quality.coding.swe_bench',
  'quality.reasoning.gpqa', 'quality.reasoning.mmlu_pro',
  'quality.multilingual_score',
  'performance.latency_ttft_ms', 'performance.throughput_tok_s',
  'pricing_hosted.input_per_mtok_usd', 'pricing_hosted.output_per_mtok_usd',
  'context_window',
  'vram_estimate_gb.q4', 'vram_estimate_gb.q8',
  'params.total_b', 'params.active_b',
];
const CATEGORICAL_DIMS = ['license.id', 'family', 'vendor'];

export function mountScatter(container, store, { filtered, isSelected, toggleSelection }) {
  render();
  // Intentionally NOT subscribing to exploreSelectedIds — clicking a dot updates
  // the side detail panel but must not re-render this plot.
  store.subscribe(s => ({ filters: s.filters, osi: s.osiOnly, axes: s.scatterAxes, ready: !!s.data, dash: s.activeDashboard }), render);

  function render() {
    const s = store.get();
    if (!s.data) return;
    const dims = s.data.dimensions;
    const data = filtered(s);
    const ax = s.scatterAxes;

    container.innerHTML = `
      <div class="text-xs text-neutral-500 mb-2 flex items-center gap-2 flex-wrap">
        <span>View 3 — Scatter</span>
        ${selectHtml('x', ax.x, NUMERIC_DIMS, dims)}
        ${selectHtml('y', ax.y, NUMERIC_DIMS, dims)}
        ${selectHtml('size', ax.size, NUMERIC_DIMS, dims)}
        ${selectHtml('color', ax.color, CATEGORICAL_DIMS, dims)}
      </div>
      <div id="scatter-plot"></div>
    `;

    container.querySelectorAll('select[data-axis]').forEach(sel => {
      sel.addEventListener('change', e => {
        store.set({ scatterAxes: { ...ax, [e.target.dataset.axis]: e.target.value } });
      });
    });

    const points = data.filter(d => d[ax.x] != null && d[ax.y] != null);

    const plot = Plot.plot({
      width: container.clientWidth - 30, height: 280,
      marginLeft: 56, marginBottom: 36,
      style: { background: 'transparent', color: '#aaa', fontSize: '10px' },
      x: { label: dims[ax.x]?.label ?? ax.x, grid: true },
      y: { label: dims[ax.y]?.label ?? ax.y, grid: true },
      r: { range: [3, 14] },
      color: { legend: true },
      marks: [
        Plot.dot(points, {
          x: ax.x, y: ax.y, r: ax.size, fill: ax.color,
          channels: { name: 'name' },
          tip: false,
        }),
      ],
    });

    plot.addEventListener('click', e => {
      // Map click position to nearest visible point.
      const target = e.target.closest('circle');
      if (!target) return;
      const idx = Array.from(plot.querySelectorAll('circle')).indexOf(target);
      const point = points[idx];
      if (point) toggleSelection(point.model_id);
    });

    container.querySelector('#scatter-plot').appendChild(plot);
  }

  function selectHtml(axis, current, options, dims) {
    return `
      <label class="text-xs text-neutral-500 flex items-center gap-1">
        ${axis}:
        <select data-axis="${axis}" class="bg-neutral-800 text-neutral-200 text-xs px-1 py-0.5 rounded">
          ${options.map(o => `<option value="${o}" ${o === current ? 'selected' : ''}>${dims[o]?.label || o}</option>`).join('')}
        </select>
      </label>
    `;
  }
}
