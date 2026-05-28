import * as d3 from 'd3';

// View 2 — Parallel coordinates (D3 v7).
// Brush any axis to filter (writes to store.filters).

const DEFAULT_AXES = [
  'quality.arena_elo',
  'quality.coding.humaneval',
  'pricing_hosted.input_per_mtok_usd',
  'vram_estimate_gb.q4',
  'context_window',
  'params.total_b',
];

export function mountParcoords(container, store, { filtered, isSelected }) {
  render();
  store.subscribe(s => ({ filters: s.filters, osi: s.osiOnly, sel: s.selectedIds, ready: !!s.data }), render);

  function render() {
    const s = store.get();
    if (!s.data) return;
    const dims = s.data.dimensions;
    const axes = DEFAULT_AXES.filter(p => dims[p]);  // skip if dimension missing
    const data = filtered(s);

    container.innerHTML = `<div class="text-xs text-neutral-500 mb-2">View 2 — Parallel coordinates · brush axis to filter</div>`;

    const W = container.clientWidth || 800;
    const H = 220;
    const margin = { top: 30, right: 20, bottom: 30, left: 20 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const svg = d3.select(container).append('svg')
      .attr('width', W).attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().domain(axes).range([0, w]);
    const y = {};
    for (const ax of axes) {
      const ext = d3.extent(data, d => d[ax]);
      const dir = dims[ax].direction === 'lower_better' ? 'inverted' : 'normal';
      y[ax] = d3.scaleLinear()
        .domain(ext[0] == null ? [0, 1] : ext)
        .range(dir === 'inverted' ? [0, h] : [h, 0])
        .nice();
    }

    // Lines
    g.append('g').selectAll('path').data(data).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', d => isSelected(d.model_id) ? '#4ade80' : '#60a5fa')
      .attr('stroke-width', d => isSelected(d.model_id) ? 2 : 1)
      .attr('opacity', d => isSelected(d.model_id) ? 1 : 0.45)
      .attr('d', d => linePath(d, axes, x, y));

    // Axes
    const axisG = g.append('g').selectAll('g').data(axes).enter().append('g')
      .attr('transform', a => `translate(${x(a)})`);

    axisG.each(function (a) {
      d3.select(this).call(d3.axisLeft(y[a]).ticks(4))
        .selectAll('text').attr('fill', '#888').attr('font-size', 9);
      d3.select(this).selectAll('path,line').attr('stroke', '#555');
    });

    axisG.append('text')
      .attr('y', -10).attr('text-anchor', 'middle')
      .attr('fill', '#aaa').attr('font-size', 10)
      .text(a => dims[a].label);

    // Brushes
    const brushH = h;
    axisG.append('g').each(function (ax) {
      const brush = d3.brushY()
        .extent([[-10, 0], [10, brushH]])
        .on('end', (event) => onBrushEnd(event, ax));
      d3.select(this).call(brush);
    });

    function onBrushEnd(event, axisPath) {
      const filters = { ...store.get().filters };
      if (!event.selection) {
        delete filters[axisPath];
      } else {
        const [y0, y1] = event.selection;
        const yScale = y[axisPath];
        const v0 = yScale.invert(y0);
        const v1 = yScale.invert(y1);
        filters[axisPath] = { min: Math.min(v0, v1), max: Math.max(v0, v1) };
      }
      store.set({ filters, activePreset: null });  // user brushing clears preset
    }
  }

  function linePath(d, axes, x, y) {
    const pts = axes.map(a => {
      const v = d[a];
      if (v == null) return null;
      return [x(a), y[a](v)];
    });
    const segs = [];
    let cur = [];
    for (const p of pts) {
      if (p == null) {
        if (cur.length) { segs.push(cur); cur = []; }
      } else cur.push(p);
    }
    if (cur.length) segs.push(cur);
    return segs.map(s => 'M' + s.map(([a, b]) => `${a},${b}`).join('L')).join(' ');
  }
}
