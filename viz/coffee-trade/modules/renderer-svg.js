import * as d3 from 'd3'
import { colorFor } from './scales.js'
import { getState, setState, subscribe } from './state.js'

const DIM_OPACITY = 0.08
const FOCUS_LINK_OPACITY = 0.7
const REGION_DIM_NODE = 0.12
const REGION_LINK_INSIDE = 0.3
const REGION_LINK_OUTSIDE = 0.03

export function createSvgRenderer(container, meta, { w, h }) {
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  // Background click clears the pin.
  svg.on('click', () => {
    if (getState().pinnedId) setState({ pinnedId: null })
  })

  const linkG = svg.append('g').attr('class', 'links')
  const nodeG = svg.append('g').attr('class', 'nodes')
  const labelG = svg.append('g').attr('class', 'labels')

  let linkSel = linkG.selectAll('line')
  let nodeSel = nodeG.selectAll('circle')
  let labelSel = labelG.selectAll('text')
  let currentEdges = []

  function srcId(e) { return e.source.id || e.source }
  function tgtId(e) { return e.target.id || e.target }

  function update(nodes, edges, scales) {
    currentEdges = edges
    // Annotate nodes with display radius for forceCollide
    for (const n of nodes) n.radius = scales.nodeRadius(n.exports_usd + n.imports_usd)

    linkSel = linkG.selectAll('line')
      .data(edges, d => `${srcId(d)}-${tgtId(d)}`)
      .join('line')
        .attr('stroke', d => colorFor(meta, srcId(d)))
        .attr('stroke-width', d => scales.linkWidth(d.value_usd))

    nodeSel = nodeG.selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
        .attr('r', d => d.radius)
        .attr('fill', d => colorFor(meta, d.id))
        .attr('stroke', '#0a0a0b')
        .attr('stroke-width', 1.25)
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation()
          const cur = getState().pinnedId
          setState({ pinnedId: cur === d.id ? null : d.id })
        })

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

    applyHighlight()
  }

  function regionOf(id) { return meta.countries[id]?.region }

  function applyHighlight() {
    const { pinnedId, regionFilter } = getState()

    // Pin wins over region: a pinned country shows only its incident network.
    if (pinnedId) {
      const connected = new Set([pinnedId])
      for (const e of currentEdges) {
        if (srcId(e) === pinnedId) connected.add(tgtId(e))
        else if (tgtId(e) === pinnedId) connected.add(srcId(e))
      }
      nodeSel
        .attr('fill-opacity', d => (connected.has(d.id) ? 1 : DIM_OPACITY))
        .attr('stroke-opacity', d => (connected.has(d.id) ? 1 : DIM_OPACITY))
      labelSel.attr('opacity', d => (connected.has(d.id) ? 1 : DIM_OPACITY))
      linkSel.attr('stroke-opacity', d => (
        (srcId(d) === pinnedId || tgtId(d) === pinnedId) ? FOCUS_LINK_OPACITY : DIM_OPACITY * 0.4
      ))
      return
    }

    if (regionFilter) {
      const inRegion = id => regionOf(id) === regionFilter
      nodeSel
        .attr('fill-opacity', d => (inRegion(d.id) ? 1 : REGION_DIM_NODE))
        .attr('stroke-opacity', d => (inRegion(d.id) ? 1 : REGION_DIM_NODE))
      labelSel.attr('opacity', d => (inRegion(d.id) ? 1 : REGION_DIM_NODE))
      linkSel.attr('stroke-opacity', d => (
        (inRegion(srcId(d)) || inRegion(tgtId(d))) ? REGION_LINK_INSIDE : REGION_LINK_OUTSIDE
      ))
      return
    }

    // No filter: defaults.
    nodeSel.attr('fill-opacity', 1).attr('stroke-opacity', 1)
    labelSel.attr('opacity', 1)
    linkSel.attr('stroke-opacity', 0.18)
  }

  // Subscribe so click → state → re-style happens automatically.
  const unsubscribe = subscribe((next, prev) => {
    if (next.pinnedId !== prev.pinnedId || next.regionFilter !== prev.regionFilter) {
      applyHighlight()
    }
  })

  function tick() {
    linkSel
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y)
    nodeSel
      .attr('cx', d => d.x).attr('cy', d => d.y)
    labelSel
      .attr('x', d => d.x).attr('y', d => d.y - d.radius - 4)
  }

  function destroy() { unsubscribe(); svg.remove() }

  function resize(next) {
    svg.attr('viewBox', `0 0 ${next.w} ${next.h}`)
  }

  return { update, tick, destroy, resize, root: svg }
}
