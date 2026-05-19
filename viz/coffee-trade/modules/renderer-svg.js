import * as d3 from 'd3'
import { colorFor } from './scales.js'

export function createSvgRenderer(container, meta, { w, h }) {
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  const linkG = svg.append('g').attr('class', 'links')
  const nodeG = svg.append('g').attr('class', 'nodes')
  const labelG = svg.append('g').attr('class', 'labels')

  let linkSel = linkG.selectAll('line')
  let nodeSel = nodeG.selectAll('circle')
  let labelSel = labelG.selectAll('text')

  function update(nodes, edges, scales) {
    // Annotate nodes with display radius for forceCollide
    for (const n of nodes) n.radius = scales.nodeRadius(n.exports_usd + n.imports_usd)

    linkSel = linkG.selectAll('line')
      .data(edges, d => `${d.source.id || d.source}-${d.target.id || d.target}`)
      .join('line')
        .attr('stroke', d => colorFor(meta, d.source.id || d.source))
        .attr('stroke-opacity', 0.18)
        .attr('stroke-width', d => scales.linkWidth(d.value_usd))

    nodeSel = nodeG.selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
        .attr('r', d => d.radius)
        .attr('fill', d => colorFor(meta, d.id))
        .attr('fill-opacity', 0.85)
        .attr('stroke', '#0a0a0b')
        .attr('stroke-width', 0.6)

    labelSel = labelG.selectAll('text')
      .data(nodes, d => d.id)
      .join('text')
        .text(d => (meta.countries[d.id]?.name || d.id))
        .attr('font-size', 11)
        .attr('fill', '#d4d4d8')
        .attr('text-anchor', 'middle')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#0a0a0b')
        .attr('stroke-width', 3)
        .attr('pointer-events', 'none')
  }

  function tick() {
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
    nodeSel
      .attr('cx', d => d.x).attr('cy', d => d.y)
    labelSel
      .attr('x', d => d.x).attr('y', d => d.y - d.radius - 4)
  }

  function destroy() { svg.remove() }

  function resize(next) {
    svg.attr('viewBox', `0 0 ${next.w} ${next.h}`)
  }

  return { update, tick, destroy, resize, root: svg }
}
