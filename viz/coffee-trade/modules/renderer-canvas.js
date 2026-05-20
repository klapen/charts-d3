import * as d3 from 'd3'
import { colorFor } from './scales.js'
import { getState, setState, subscribe } from './state.js'

const DIM_OPACITY = 0.08
const FOCUS_LINK_OPACITY = 0.7
const BASE_LINK_OPACITY = 0.18
const NODE_OPACITY = 1
const TOP_LABEL_COUNT = 15
const REGION_DIM_NODE = 0.12
const REGION_LINK_INSIDE = 0.3
const REGION_LINK_OUTSIDE = 0.03

export function createCanvasRenderer(container, meta, { w, h, dpr }) {
  const canvas = document.createElement('canvas')
  canvas.style.cursor = 'pointer'
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  let currentDpr = dpr
  function resize(next) {
    canvas.width  = next.w * next.dpr
    canvas.height = next.h * next.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(next.dpr, next.dpr)
    currentDpr = next.dpr
  }
  resize({ w, h, dpr })

  let _nodes = [], _edges = [], _scales = null
  let _quadtree = null

  function srcId(e) { return e.source.id || e.source }
  function tgtId(e) { return e.target.id || e.target }

  function update(nodes, edges, scales) {
    for (const n of nodes) n.radius = scales.nodeRadius(n.exports_usd + n.imports_usd)
    _nodes = nodes
    _edges = edges
    _scales = scales
    _quadtree = null  // rebuild lazily on next pointAt
  }

  function regionOf(id) { return meta.countries[id]?.region }

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

  function tick() {
    if (!_scales) return
    const cw = canvas.width / currentDpr
    const ch = canvas.height / currentDpr
    ctx.clearRect(0, 0, cw, ch)

    const { pinnedId, regionFilter, flow } = getState()
    const connected = pinnedId ? collectConnected(pinnedId, flow) : null

    // Helpers: pin wins over region filter when both are set.
    const nodeAlpha = id => {
      if (pinnedId) return connected.has(id) ? NODE_OPACITY : DIM_OPACITY
      if (regionFilter) return regionOf(id) === regionFilter ? NODE_OPACITY : REGION_DIM_NODE
      return NODE_OPACITY
    }
    const linkAlpha = e => {
      if (pinnedId) {
        if (!edgePassesFlow(e, flow, pinnedId, regionFilter)) return DIM_OPACITY * 0.4
        return (srcId(e) === pinnedId || tgtId(e) === pinnedId)
          ? FOCUS_LINK_OPACITY : DIM_OPACITY * 0.4
      }
      if (regionFilter) {
        if (!edgePassesFlow(e, flow, pinnedId, regionFilter)) return REGION_LINK_OUTSIDE
        return (regionOf(srcId(e)) === regionFilter || regionOf(tgtId(e)) === regionFilter)
          ? REGION_LINK_INSIDE : REGION_LINK_OUTSIDE
      }
      return BASE_LINK_OPACITY
    }

    // Links
    for (const e of _edges) {
      const sx = e.source.x, sy = e.source.y, tx = e.target.x, ty = e.target.y
      if (sx == null || tx == null) continue
      ctx.globalAlpha = linkAlpha(e)
      ctx.strokeStyle = e._color || colorFor(meta, srcId(e))
      ctx.lineWidth = _scales.linkWidth(e.value_usd)
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Nodes
    for (const n of _nodes) {
      if (n.x == null) continue
      ctx.beginPath()
      ctx.globalAlpha = nodeAlpha(n.id)
      ctx.fillStyle = colorFor(meta, n.id)
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = '#0a0a0b'
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Labels — top N by total trade, plus the pinned country if outside that set
    const topNodes = [..._nodes]
      .sort((a, b) => (b.exports_usd + b.imports_usd) - (a.exports_usd + a.imports_usd))
      .slice(0, TOP_LABEL_COUNT)
    const labelSet = new Map(topNodes.map(n => [n.id, n]))
    if (pinnedId) {
      const pinned = _nodes.find(n => n.id === pinnedId)
      if (pinned && !labelSet.has(pinnedId)) labelSet.set(pinnedId, pinned)
    }
    ctx.font = '11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    for (const n of labelSet.values()) {
      if (n.x == null) continue
      ctx.globalAlpha = nodeAlpha(n.id)
      const name = meta.countries[n.id]?.name || n.id
      ctx.strokeStyle = '#0a0a0b'
      ctx.lineWidth = 3
      ctx.strokeText(name, n.x, n.y - n.radius - 4)
      ctx.fillStyle = '#d4d4d8'
      ctx.fillText(name, n.x, n.y - n.radius - 4)
    }
    ctx.globalAlpha = 1
  }

  function collectConnected(pinnedId, flow) {
    const ids = new Set([pinnedId])
    for (const e of _edges) {
      const s = srcId(e), t = tgtId(e)
      if (flow === 'exports') { if (s === pinnedId) ids.add(t) }
      else if (flow === 'imports') { if (t === pinnedId) ids.add(s) }
      else {
        if (s === pinnedId) ids.add(t)
        else if (t === pinnedId) ids.add(s)
      }
    }
    return ids
  }

  function pointAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect()
    const cw = canvas.width / currentDpr
    const ch = canvas.height / currentDpr
    const x = (clientX - rect.left) * (cw / rect.width)
    const y = (clientY - rect.top)  * (ch / rect.height)
    if (!_quadtree) {
      _quadtree = d3.quadtree().x(d => d.x).y(d => d.y)
        .addAll(_nodes.filter(n => n.x != null))
    }
    return _quadtree.find(x, y, 30)
  }

  canvas.addEventListener('click', evt => {
    const n = pointAt(evt.clientX, evt.clientY)
    const cur = getState().pinnedId
    if (n) setState({ pinnedId: cur === n.id ? null : n.id })
    else if (cur) setState({ pinnedId: null })
  })

  // Force a redraw when pin or region filter changes. The simulation runs
  // perpetually so the next tick already handles it, but force one in case
  // alpha has settled below the tick threshold.
  const unsubscribe = subscribe((next, prev) => {
    if (
      next.pinnedId !== prev.pinnedId
      || next.regionFilter !== prev.regionFilter
      || next.flow !== prev.flow
    ) tick()
  })

  function destroy() {
    unsubscribe()
    canvas.remove()
    _nodes = []
    _edges = []
    _scales = null
    _quadtree = null
  }

  return { update, tick, resize, destroy, root: canvas }
}
