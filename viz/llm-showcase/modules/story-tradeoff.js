// §01 The trade-off — Arena Elo vs VRAM needed (log x). A dashed vertical
// marker tracks the selected VRAM; dots left of it (q4 <= vram) are "yours".

import * as d3 from 'd3';
import { gsap } from 'gsap';
import { onEnter, REDUCED } from './scroll.js';

export function mountTradeoff(models, hwState) {
  const host = document.getElementById('chart-tradeoff');
  const data = models.filter(m => m.quality.arena_elo != null && m.vram_estimate_gb.q4 != null);

  const note = document.createElement('p');
  note.className = 'chart-note';
  note.textContent = `${data.length} of ${models.length} models shown — the rest have no Arena Elo score.`;
  host.appendChild(note);

  const W = Math.min(host.clientWidth || 800, 960);
  const H = 380;
  const mg = { top: 18, right: 30, bottom: 46, left: 56 };
  const x = d3.scaleLog().domain([1.5, 450]).range([mg.left, W - mg.right]);
  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.quality.arena_elo)).nice()
    .range([H - mg.bottom, mg.top]);

  const svg = d3.create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');

  svg.append('g').attr('transform', `translate(0,${H - mg.bottom})`)
    .call(d3.axisBottom(x).tickValues([2, 4, 8, 16, 24, 48, 96, 200, 400]).tickFormat(v => `${v}`));
  svg.append('g').attr('transform', `translate(${mg.left},0)`)
    .call(d3.axisLeft(y).ticks(5));
  svg.selectAll('.domain, .tick line').attr('stroke', '#233029');
  svg.selectAll('.tick text').attr('fill', '#5d6b66').attr('font-size', 10);

  svg.append('text').attr('x', W - mg.right).attr('y', H - 8).attr('text-anchor', 'end')
    .attr('fill', '#5d6b66').attr('font-size', 10).text('VRAM needed at q4 (GB, log) →');
  svg.append('text').attr('x', mg.left).attr('y', 12)
    .attr('fill', '#5d6b66').attr('font-size', 10).text('↑ Arena Elo');

  // your-machine marker (group translated on selection change)
  const marker = svg.append('g');
  marker.append('line').attr('y1', mg.top).attr('y2', H - mg.bottom)
    .attr('stroke', '#34d399').attr('stroke-dasharray', '3 4').attr('stroke-opacity', 0.8);
  marker.append('text').attr('y', mg.top + 10).attr('x', 6)
    .attr('fill', '#34d399').attr('font-size', 10).text('your machine');

  const dots = svg.append('g').selectAll('circle').data(data).join('circle')
    .attr('class', 'model')
    .attr('cx', d => x(d.vram_estimate_gb.q4))
    .attr('cy', d => y(d.quality.arena_elo))
    .attr('r', REDUCED ? 6 : 0);
  dots.append('title').text(d => `${d.name} · Elo ${d.quality.arena_elo} · ${d.vram_estimate_gb.q4} GB`);

  svg.append('g').selectAll('text').data(data).join('text')
    .attr('x', d => x(d.vram_estimate_gb.q4))
    .attr('y', d => y(d.quality.arena_elo) - 11)
    .attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', '#5d6b66')
    .text(d => d.name);

  host.appendChild(svg.node());

  let firstFire = true;
  hwState.subscribe(v => {
    const cx = x(Math.max(1.5, Math.min(450, v)));
    // Place instantly on the first (immediate) fire so the marker doesn't flash
    // in from x=0, and honor reduced-motion; tween on later selection changes.
    gsap.to(marker.node(), { x: cx, duration: firstFire || REDUCED ? 0 : 0.8, ease: 'power3.out' });
    firstFire = false;
    dots.classed('fit', d => d.vram_estimate_gb.q4 <= v);
  });

  onEnter(host, () => {
    if (REDUCED) return;
    gsap.to(dots.nodes(), { attr: { r: 6 }, duration: 0.7, ease: 'back.out(2)', stagger: 0.05 });
  });
}
