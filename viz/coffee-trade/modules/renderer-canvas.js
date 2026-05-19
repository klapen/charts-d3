import * as d3 from 'd3'
import { colorFor } from './scales.js'
import { getState, setState, subscribe } from './state.js'

const DIM_OPACITY = 0.08
const FOCUS_LINK_OPACITY = 0.7
const BASE_LINK_OPACITY = 0.18
const NODE_OPACITY = 1
const TOP_LABEL_COUNT = 15

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

  function tick() {
    if (!_scales) return
    const cw = canvas.width / currentDpr
    const ch = canvas.height / currentDpr
    ctx.clearRect(0, 0, cw, ch)

    const { pinnedId } = getState()
    const connected = pinnedId ? collectConnected(pinnedId) : null

    // Links
    for (const e of _edges) {
      const sx = e.source.x, sy = e.source.y, tx = e.target.x, ty = e.target.y
      if (sx == null || tx == null) continue
      const incident = pinnedId && (srcId(e) === pinnedId || tgtId(e) === pinnedId)
      ctx.globalAlpha = pinnedId ? (incident ? FOCUS_LINK_OPACITY : DIM_OPACITY * 0.4) : BASE_LINK_OPACITY
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
      const dim = pinnedId && !connected.has(n.id)
      ctx.beginPath()
      ctx.globalAlpha = dim ? DIM_OPACITY : NODE_OPACITY
      ctx.fillStyle = colorFor(meta, n.id)
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = '#0a0a0b'
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Labels — top N by total trade, plus the pinned country if it's outside that set
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
      const dim = pinnedId && !connected.has(n.id)
      ctx.globalAlpha = dim ? DIM_OPACITY : 1
      const name = meta.countries[n.id]?.name || n.id
      ctx.strokeStyle = '#0a0a0b'
      ctx.lineWidth = 3
      ctx.strokeText(name, n.x, n.y - n.radius - 4)
      ctx.fillStyle = '#d4d4d8'
      ctx.fillText(name, n.x, n.y - n.radius - 4)
    }
    ctx.globalAlpha = 1
  }

  function collectConnected(pinnedId) {
    const ids = new Set([pinnedId])
    for (const e of _edges) {
      if (srcId(e) === pinnedId) ids.add(tgtId(e))
      else if (tgtId(e) === pinnedId) ids.add(srcId(e))
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

  // Force a redraw the next tick when the pin changes. The simulation runs
  // perpetually so a fresh tick is at most one frame away.
  const unsubscribe = subscribe((next, prev) => {
    if (next.pinnedId !== prev.pinnedId) tick()
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
