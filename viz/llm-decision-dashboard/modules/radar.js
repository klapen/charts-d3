import * as d3 from 'd3';

// View 4 — Radar (D3 v7). Overlays 0-3 selected models.
// Direction-flipped so "good" is always outside.

const RADAR_AXES = [
  'quality.arena_elo',
  'quality.coding.humaneval',
  'context_window',
  'vram_estimate_gb.q4',
  'pricing_hosted.input_per_mtok_usd',
  'params.total_b',
];

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24'];

export function mountRadar(container, store, { filtered }) {
  render();
  store.subscribe(s => ({ sel: s.selectedIds, ready: !!s.data, filters: s.filters, osi: s.osiOnly }), render);

  function render() {
    const s = store.get();
    if (!s.data) return;
    const dims = s.data.dimensions;
    const all = s.data.flatModels;
    const selected = s.selectedIds.map(id => all.find(m => m.model_id === id)).filter(Boolean);

    container.innerHTML = `<div class="text-xs text-neutral-500 mb-2">View 4 — Radar · ${selected.length === 0 ? 'click a model anywhere to overlay it here' : `${selected.length} of 3`}</div>`;

    const W = container.clientWidth || 280;
    const H = 460;
    const cx = W / 2; const cy = H / 2 + 10; const R = Math.min(W, H) / 2 - 60;
    const svg = d3.select(container).append('svg').attr('width', W).attr('height', H);

    // Domain per axis from the FULL dataset (so polygons can be compared run-to-run).
    const domains = {};
    for (const ax of RADAR_AXES) {
      const ext = d3.extent(all, d => d[ax]);
      domains[ax] = ext[0] == null ? [0, 1] : ext;
    }

    const angle = i => (i / RADAR_AXES.length) * 2 * Math.PI - Math.PI / 2;

    // Concentric rings
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const pts = RADAR_AXES.map((_, i) => `${cx + Math.cos(angle(i)) * R * f},${cy + Math.sin(angle(i)) * R * f}`).join(' ');
      svg.append('polygon').attr('points', pts).attr('fill', 'none').attr('stroke', '#333');
    }

    // Axis labels
    RADAR_AXES.forEach((ax, i) => {
      const lx = cx + Math.cos(angle(i)) * (R + 12);
      const ly = cy + Math.sin(angle(i)) * (R + 12);
      svg.append('text').attr('x', lx).attr('y', ly)
        .attr('text-anchor', Math.abs(Math.cos(angle(i))) < 0.1 ? 'middle' : (Math.cos(angle(i)) > 0 ? 'start' : 'end'))
        .attr('fill', '#888').attr('font-size', 10).attr('dy', '0.32em')
        .text(dims[ax].label);
    });

    // Polygons for each selected model
    selected.forEach((m, idx) => {
      const color = COLORS[idx];
      const pts = RADAR_AXES.map((ax, i) => {
        const v = m[ax];
        const [lo, hi] = domains[ax];
        if (v == null || hi === lo) return [cx, cy];
        let norm = (v - lo) / (hi - lo);
        if (dims[ax].direction === 'lower_better') norm = 1 - norm;
        const r = R * norm;
        return [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
      });
      svg.append('polygon')
        .attr('points', pts.map(p => p.join(',')).join(' '))
        .attr('fill', color).attr('fill-opacity', 0.2)
        .attr('stroke', color).attr('stroke-width', 1.5);
    });

    // Legend
    const legend = svg.append('g').attr('transform', `translate(8,${H - 8 - selected.length * 14})`);
    selected.forEach((m, i) => {
      legend.append('rect').attr('x', 0).attr('y', i * 14 - 8).attr('width', 10).attr('height', 10).attr('fill', COLORS[i]);
      legend.append('text').attr('x', 16).attr('y', i * 14).attr('fill', '#ccc').attr('font-size', 11).text(m.name);
    });
  }
}
