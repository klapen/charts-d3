import * as d3 from 'd3';

// View 2 — Parallel coordinates (D3 v7). Hover-only: no brush, no zoom.
// All axes go low-at-bottom, high-at-top. ↑/↓ on the label tells direction of "better".

const DEFAULT_AXES = [
  'quality.arena_elo',
  'quality.coding.humaneval',
  'pricing_hosted.input_per_mtok_usd',
  'vram_estimate_gb.q4',
  'context_window',
  'params.total_b',
];

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24'];

export function mountParcoords(container, store, { filtered, isSelected }) {
  render();
  store.subscribe(s => ({ filters: s.filters, osi: s.osiOnly, sel: s.compareSelectedIds, ready: !!s.data, dash: s.activeDashboard }), render);

  function render() {
    const s = store.get();
    if (!s.data) return;
    const dims = s.data.dimensions;
    const allModels = s.data.flatModels;
    const axes = DEFAULT_AXES.filter(p => dims[p] && allModels.some(d => d[p] != null));
    const data = filtered(s);

    const selectionIdx = {};
    s.compareSelectedIds.forEach((id, i) => { selectionIdx[id] = i; });
    const selectedModels = s.compareSelectedIds.map(id => data.find(d => d.model_id === id)).filter(Boolean);
    const legend = selectedModels.length
      ? selectedModels.map(m => `<span class="parcoord-legend" style="--c:${COLORS[selectionIdx[m.model_id]]}">${escapeHtml(m.name)}</span>`).join('')
      : '<span class="text-neutral-600">click a model in any other view to highlight its line</span>';

    container.innerHTML = `
      <div class="text-sm text-neutral-200 font-medium mb-1">View 2 — Parallel coordinates</div>
      <div class="text-xs text-neutral-400 leading-relaxed mb-2">
        Compare every model across many metrics at once. <b>Each line is one model</b>; <b>each vertical axis is one metric</b>.
        Axes are scaled so <b>up = bigger number</b>; the <b>↑ / ↓</b> beside the axis name tells which direction is "better".
        A model that stays high on ↑ axes and low on ↓ axes is well-rounded.
        <span class="text-neutral-500">Hover a line for that model's values; hover an axis label to compare the selected models.</span>
      </div>
      <div class="text-xs flex gap-2 flex-wrap items-center mb-2">${legend}</div>
      <div class="parcoord-wrap"></div>
    `;

    const wrap = container.querySelector('.parcoord-wrap');
    const W = wrap.clientWidth || container.clientWidth || 800;
    const H = 240;
    const margin = { top: 30, right: 20, bottom: 30, left: 30 };
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const svg = d3.select(wrap).append('svg')
      .attr('width', W).attr('height', H)
      .attr('viewBox', `0 0 ${W} ${H}`);

    const tooltip = d3.select(wrap).append('div')
      .attr('class', 'parcoord-tooltip')
      .style('display', 'none');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint().domain(axes).range([0, w]);
    const y = {};
    for (const ax of axes) {
      const ext = d3.extent(data, d => d[ax]);
      const [lo, hi] = ext[0] == null ? [0, 1] : ext;
      const domain = lo === hi ? [lo - 1, hi + 1] : [lo, hi];
      y[ax] = d3.scaleLinear().domain(domain).range([h, 0]);
    }

    const unsel = data.filter(d => selectionIdx[d.model_id] == null);
    const sel = data.filter(d => selectionIdx[d.model_id] != null);

    g.append('g').selectAll('path').data(unsel).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', '#6b7280')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3)
      .style('cursor', 'crosshair')
      .attr('d', d => linePath(d, axes, x, y))
      .on('mouseenter', (e, d) => showLineTooltip(e, d))
      .on('mousemove', moveTooltip)
      .on('mouseleave', hideTooltip);

    g.append('g').selectAll('path').data(sel).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', d => COLORS[selectionIdx[d.model_id]])
      .attr('stroke-width', 2.5)
      .attr('opacity', 1)
      .style('cursor', 'crosshair')
      .attr('d', d => linePath(d, axes, x, y))
      .on('mouseenter', (e, d) => showLineTooltip(e, d))
      .on('mousemove', moveTooltip)
      .on('mouseleave', hideTooltip);

    const axisG = g.append('g').selectAll('g').data(axes).enter().append('g')
      .attr('transform', a => `translate(${x(a)})`);

    axisG.each(function (a) {
      d3.select(this).call(d3.axisLeft(y[a]).ticks(4).tickFormat(v => fmtTick(a, v)))
        .selectAll('text').attr('fill', '#888').attr('font-size', 9);
      d3.select(this).selectAll('path,line').attr('stroke', '#555');
    });

    axisG.append('text')
      .attr('y', -12).attr('text-anchor', 'middle')
      .attr('fill', '#aaa').attr('font-size', 10)
      .style('cursor', 'help')
      .text(a => `${dims[a].label} ${dims[a].direction === 'lower_better' ? '↓' : '↑'}`)
      .on('mouseenter', (e, a) => showAxisTooltip(e, a))
      .on('mousemove', moveTooltip)
      .on('mouseleave', hideTooltip);

    function showLineTooltip(event, d) {
      const swatch = selectionIdx[d.model_id] != null
        ? `<span class="parcoord-swatch" style="--c:${COLORS[selectionIdx[d.model_id]]}"></span>`
        : '';
      const rows = axes.map(ax =>
        `<div class="row"><span class="k">${escapeHtml(dims[ax].label)}</span><span>${d[ax] == null ? '—' : fmtValue(ax, d[ax])}</span></div>`
      ).join('');
      tooltip.html(`<h5>${swatch}${escapeHtml(d.name)}</h5>${rows}`).style('display', 'block');
      moveTooltip(event);
    }

    function showAxisTooltip(event, ax) {
      const dir = dims[ax].direction === 'lower_better' ? '↓ lower better' : '↑ higher better';
      let body;
      if (selectedModels.length === 0) {
        body = '<div class="row" style="color:#777">click a model to compare values here</div>';
      } else {
        body = selectedModels.map(m => `
          <div class="row">
            <span class="parcoord-swatch" style="--c:${COLORS[selectionIdx[m.model_id]]}"></span>
            <span class="k">${escapeHtml(m.name)}</span>
            <span>${m[ax] == null ? '—' : fmtValue(ax, m[ax])}</span>
          </div>
        `).join('');
      }
      tooltip.html(`<h5>${escapeHtml(dims[ax].label)} <span class="dir">${dir}</span></h5>${body}`).style('display', 'block');
      moveTooltip(event);
    }

    function moveTooltip(event) {
      const [mx, my] = d3.pointer(event, wrap);
      const ttEl = tooltip.node();
      const ttW = ttEl.offsetWidth;
      const wrapW = wrap.clientWidth;
      const left = mx + ttW + 16 > wrapW ? mx - ttW - 8 : mx + 12;
      tooltip.style('left', Math.max(0, left) + 'px').style('top', (my + 12) + 'px');
    }

    function hideTooltip() {
      tooltip.style('display', 'none');
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  }

  function fmtTick(ax, v) {
    if (v == null) return '';
    if (ax === 'context_window') return v >= 1000 ? `${Math.round(v / 1000)}k` : String(v);
    if (ax === 'quality.arena_elo') return String(Math.round(v));
    if (ax.startsWith('pricing_hosted.')) return v < 1 ? v.toFixed(2) : v.toFixed(1);
    if (Math.abs(v) >= 100) return d3.format('.2s')(v).replace('G', 'B');
    if (Math.abs(v) >= 1) return v.toFixed(1);
    return v.toFixed(2);
  }

  function fmtValue(ax, v) {
    if (ax === 'context_window') return v.toLocaleString('en-US');
    if (ax.startsWith('pricing_hosted.')) return '$' + v.toFixed(3) + ' / Mtok';
    if (ax === 'vram_estimate_gb.q4') return v.toFixed(1) + ' GB';
    if (ax === 'params.total_b') return v + 'B';
    if (ax === 'quality.arena_elo') return String(Math.round(v));
    if (ax === 'quality.coding.humaneval' || ax === 'quality.multilingual_score') return (v * 100).toFixed(0) + '%';
    return String(v);
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
