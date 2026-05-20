import * as d3 from 'd3'
import { colorFor } from './scales.js'
import { getState, setState, subscribe } from './state.js'

// "Out of scope" elements are hidden entirely so the chart honors the active
// scope literally — clicking "All" with a region/pin shows only that scope's
// trade, not the global map dimmed.
const DIM_OPACITY = 0
const FOCUS_LINK_OPACITY = 0.7
const REGION_DIM_NODE = 0
const REGION_LINK_INSIDE = 0.3
const REGION_LINK_OUTSIDE = 0

export function createSvgRenderer(container, meta, viewport, { w, h }) {
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${w} ${h}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  // Background click clears the pin.
  svg.on('click', () => {
    if (getState().pinnedId) setState({ pinnedId: null })
  })

  // Single group that carries the zoom transform; nodes/links/labels live
  // inside it so they all scale together.
  const viewportG = svg.append('g').attr('class', 'viewport')
  const linkG = viewportG.append('g').attr('class', 'links')
  const nodeG = viewportG.append('g').attr('class', 'nodes')
  const labelG = viewportG.append('g').attr('class', 'labels')

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
      .join(
        enter => enter.append('line')
          .attr('stroke', d => colorFor(meta, srcId(d)))
          .attr('stroke-width', d => scales.linkWidth(d.value_usd)),
        update => update
          .call(sel => sel.transition().duration(600)
            .attr('stroke-width', d => scales.linkWidth(d.value_usd))),
        exit => exit.remove(),
      )

    nodeSel = nodeG.selectAll('circle')
      .data(nodes, d => d.id)
      .join(
        enter => enter.append('circle')
          .attr('r', 0)
          .attr('fill', d => colorFor(meta, d.id))
          .attr('stroke', '#0a0a0b')
          .attr('stroke-width', 1.25)
          .style('cursor', 'pointer')
          .on('click', (event, d) => {
            event.stopPropagation()
            const cur = getState().pinnedId
            setState({ pinnedId: cur === d.id ? null : d.id })
          })
          .call(sel => sel.transition().duration(600).attr('r', d => d.radius)),
        update => update
          .call(sel => sel.transition().duration(600).attr('r', d => d.radius)),
        exit => exit
          .call(sel => sel.transition().duration(300).attr('r', 0).remove()),
      )

    labelSel = labelG.selectAll('text')
      .data(nodes, d => d.id)
      .join(
        enter => enter.append('text')
          .text(d => (meta.countries[d.id]?.name || d.id))
          .attr('font-size', 11)
          .attr('fill', '#d4d4d8')
          .attr('text-anchor', 'middle')
          .attr('paint-order', 'stroke')
          .attr('stroke', '#0a0a0b')
          .attr('stroke-width', 3)
          .attr('pointer-events', 'none'),
        update => update.text(d => (meta.countries[d.id]?.name || d.id)),
        exit => exit.remove(),
      )

    applyHighlight()
  }

  function regionOf(id) { return meta.countries[id]?.region }

  // An edge "passes" the flow filter relative to the active scope (pinned
  // country, or region). With no scope, flow has no chart effect (per UX:
  // exports/imports doesn't narrow the global view, only the info panel).
  function edgePassesFlow(e, flow, pinnedId, regionFilter) {
    if (flow === 'both') return true
    if (pinnedId) {
      if (flow === 'exports') return srcId(e) === pinnedId
      if (flow === 'imports') return tgtId(e) === pinnedId
    }
    if (regionFilter) {
      if (flow === 'exports') return regionOf(srcId(e)) === regionFilter
      if (flow === 'imports') return regionOf(tgtId(e)) === regionFilter
    }
    return true
  }

  function applyHighlight() {
    const { pinnedId, regionFilter, flow } = getState()

    // Pin wins over region: a pinned country shows only its incident network.
    if (pinnedId) {
      // Connected set respects flow direction so e.g. "exports only" lights
      // up just the partners we ship coffee to.
      const connected = new Set([pinnedId])
      for (const e of currentEdges) {
        if (!edgePassesFlow(e, flow, pinnedId, regionFilter)) continue
        if (srcId(e) === pinnedId) connected.add(tgtId(e))
        else if (tgtId(e) === pinnedId) connected.add(srcId(e))
      }
      nodeSel
        .attr('fill-opacity', d => (connected.has(d.id) ? 1 : DIM_OPACITY))
        .attr('stroke-opacity', d => (connected.has(d.id) ? 1 : DIM_OPACITY))
      labelSel.attr('opacity', d => (connected.has(d.id) ? 1 : DIM_OPACITY))
      linkSel.attr('stroke-opacity', d => (
        edgePassesFlow(d, flow, pinnedId, regionFilter)
        && (srcId(d) === pinnedId || tgtId(d) === pinnedId)
          ? FOCUS_LINK_OPACITY
          : DIM_OPACITY * 0.4
      ))
      return
    }

    // No pin. Region (when set) acts as an in-scope filter; flow further
    // narrows by net trade role. "Exports" reveals net-exporter countries
    // (exports_usd > imports_usd) and the edges leaving them; "Imports"
    // reveals net-importer countries and the edges arriving at them.
    const isNetExporter = n => (n?.exports_usd || 0) > (n?.imports_usd || 0)
    const isNetImporter = n => (n?.imports_usd || 0) > (n?.exports_usd || 0)
    const inScope = id => !regionFilter || regionOf(id) === regionFilter

    const nodeVisible = d => {
      if (!inScope(d.id)) return false
      if (flow === 'exports') return isNetExporter(d)
      if (flow === 'imports') return isNetImporter(d)
      return true  // flow === 'both'
    }
    const edgeVisible = d => {
      if (flow === 'exports') return inScope(srcId(d)) && isNetExporter(d.source)
      if (flow === 'imports') return inScope(tgtId(d)) && isNetImporter(d.target)
      // 'both': region keeps touching edges; no region keeps all
      if (regionFilter) return inScope(srcId(d)) || inScope(tgtId(d))
      return true
    }

    const baseEdgeOpacity = regionFilter ? REGION_LINK_INSIDE : 0.18
    nodeSel
      .attr('fill-opacity', d => (nodeVisible(d) ? 1 : 0))
      .attr('stroke-opacity', d => (nodeVisible(d) ? 1 : 0))
    labelSel.attr('opacity', d => (nodeVisible(d) ? 1 : 0))
    linkSel.attr('stroke-opacity', d => (edgeVisible(d) ? baseEdgeOpacity : 0))
  }

  // Subscribe so click → state → re-style happens automatically.
  const unsubscribe = subscribe((next, prev) => {
    if (
      next.pinnedId !== prev.pinnedId
      || next.regionFilter !== prev.regionFilter
      || next.flow !== prev.flow
    ) {
      applyHighlight()
    }
  })

  function tick() {
    const t = viewport.value()
    viewportG.attr('transform', `translate(${t.tx},${t.ty}) scale(${t.scale})`)
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
