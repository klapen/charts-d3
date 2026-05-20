import '../../src/styles/main.css'
import './style.css'

import * as d3 from 'd3'
import { getState, setState, subscribe } from './modules/state.js'
import { loadMeta, loadYear } from './modules/data-loader.js'
import { detectLang, applyLang } from './modules/i18n.js'
import { buildScales, colorFor } from './modules/scales.js'
import { buildSimulation } from './modules/force-sim.js'
import { createSvgRenderer } from './modules/renderer-svg.js'
import { createCanvasRenderer } from './modules/renderer-canvas.js'
import { createParticleLayer } from './modules/particles.js'
import { wireControls } from './modules/controls.js'
import { createProjection } from './modules/geo.js'
import { createInfoPanel } from './modules/info-panel.js'
import { observeBreakpoint, pickBreakpoint } from './modules/responsive.js'
import { renderLegend } from './modules/legend.js'
import { createViewport } from './modules/viewport.js'

// Canonical drawing size; rebuilt at each breakpoint snap.
let current = { w: 1080, h: 660 }
const ZOOM_ON_PIN = 1.8

let meta, renderer, particles, sim, project, infoPanel, viewport
let chartEl
let currentTier = null
let currentNodes = []

function makeRenderer(tier) {
  if (tier === 'full') {
    return createCanvasRenderer(chartEl, meta, viewport, {
      w: current.w, h: current.h, dpr: window.devicePixelRatio || 1,
    })
  }
  return createSvgRenderer(chartEl, meta, viewport, { w: current.w, h: current.h })
}

// Send the pinned country to the viewBox center at a fixed zoom. When
// nothing is pinned, snap back to the identity transform.
function refreshZoom() {
  const { pinnedId } = getState()
  if (!pinnedId) {
    viewport.setTarget({ tx: 0, ty: 0, scale: 1 })
    return
  }
  const n = currentNodes.find(x => x.id === pinnedId)
  if (!n) {
    viewport.setTarget({ tx: 0, ty: 0, scale: 1 })
    return
  }
  viewport.setTarget({
    tx: current.w / 2 - ZOOM_ON_PIN * n.x,
    ty: current.h / 2 - ZOOM_ON_PIN * n.y,
    scale: ZOOM_ON_PIN,
  })
}

function buildActiveSet(file, tier) {
  const sel = file.tier[tier]
  const nodes = sel.node_ids.map(id => file.nodes.find(n => n.id === id))
  const edges = sel.edge_indices.map(i => ({ ...file.edges[i] }))
  return { nodes, edges }
}

// TODO: this is racy on cold-network play-throughs — a fast slot can resolve
// before a slow earlier slot, and the older `await loadYear` resume then
// overwrites the newer renderer/sim state. Once the cache is warm (every
// subsequent visit) it's fine. Fix with an AbortController / sequence id.
async function applyYearType(year, type, tier) {
  // Swap renderer when the tier changes — SVG handles ~30 top nodes with crisp
  // labels/keyed joins; Canvas handles the full ~150-country tier where DOM
  // would be a tax.
  if (tier !== currentTier) {
    if (renderer) renderer.destroy()
    renderer = makeRenderer(tier)
    currentTier = tier
  }

  const file = await loadYear(year, type)
  const raw = buildActiveSet(file, tier)

  // Drop any node we don't have a centroid for — without one the projection
  // returns null, targetX/targetY stay undefined, and the simulation NaN's
  // their cx/cy. Also drop edges that reference a dropped endpoint.
  const validIds = new Set(raw.nodes.filter(n => meta.countries[n.id]).map(n => n.id))
  if (validIds.size !== raw.nodes.length) {
    const missing = raw.nodes.filter(n => !validIds.has(n.id)).map(n => n.id)
    console.warn('coffee-trade: dropping nodes without centroid:', missing)
  }
  const nodes = raw.nodes.filter(n => validIds.has(n.id))
  const edges = raw.edges.filter(e => {
    const s = e.source.id || e.source
    const t = e.target.id || e.target
    return validIds.has(s) && validIds.has(t)
  })

  for (const e of edges) e._color = colorFor(meta, e.source.id || e.source)
  const scales = buildScales(nodes, edges, { w: current.w, h: current.h })

  // Attract each node to its geographic centroid; forceCollide pushes
  // overlapping neighbors apart so dense regions stay readable. We don't
  // hard-pin (fx/fy) because that lets countries stack on top of each other.
  for (const n of nodes) {
    const xy = project(meta.countries[n.id])
    if (xy) {
      n.targetX = xy[0]
      n.targetY = xy[1]
      // Seed the starting position so nodes don't fly in from origin.
      if (n.x == null) n.x = xy[0]
      if (n.y == null) n.y = xy[1]
    }
  }

  currentNodes = nodes
  renderer.update(nodes, edges, scales)

  // Soft sim restart: reuse the existing simulation when possible so nodes
  // morph from their current positions instead of teleporting back to their
  // projected targets each year.
  if (!sim) {
    sim = buildSimulation(nodes, edges)
  } else {
    sim.nodes(nodes)
    sim.force('link').links(edges)
  }
  // Re-bind every call so a fresh tier-swap renderer receives ticks.
  sim.on('tick', renderer.tick)
  sim.alpha(0.4).restart()

  // d3-force mutates source/target to objects after first tick — wait one frame
  requestAnimationFrame(() => {
    particles.rebuild(edges, scales)
    infoPanel.setData(nodes, edges)
    // The viewport target depends on the pinned node's position, which may
    // have just been re-seeded in the new viewBox space. Snap to the new
    // target so reflow/year-change zooms still land on the right country.
    refreshZoom()
  })
}

async function boot() {
  chartEl = document.getElementById('chart')

  const lang = detectLang()
  setState({ lang })
  applyLang(lang)
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.lang
      setState({ lang: next })
      applyLang(next)
    })
  }

  meta = await loadMeta()
  const initialYear = meta.years.at(-1)
  setState({ year: initialYear })

  // Pick the right canonical size BEFORE we create anything that bakes it in.
  const bp = pickBreakpoint(chartEl.clientWidth)
  current = { w: bp.w, h: bp.h }

  project = createProjection({ w: current.w, h: current.h })
  viewport = createViewport()
  infoPanel = createInfoPanel(meta)
  renderLegend()
  particles = createParticleLayer(chartEl, meta, viewport, {
    w: current.w, h: current.h, dpr: window.devicePixelRatio || 1,
  })
  particles.start()

  // Pin changes drive the zoom target. The viewport's internal rAF loop
  // does the actual easing; we just point it at the new destination.
  subscribe((next, prev) => {
    if (next.pinnedId !== prev.pinnedId) refreshZoom()
  })

  await applyYearType(initialYear, getState().type, getState().tier)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // TODO: the sim warms up briefly inside applyYearType before this freezes
    // it — reduced-motion users still see a frame of motion. Better to pass
    // a flag into buildSimulation so it starts at alphaTarget(0).
    particles.setReducedMotion(true)
    sim.alphaTarget(0)
    sim.stop()
  }

  wireControls(
    meta,
    async year => { await applyYearType(year, getState().type, getState().tier) },
    async type => { await applyYearType(getState().year, type, getState().tier) },
    async tier => { await applyYearType(getState().year, getState().type, tier) },
  )

  // Clear-all button: wipe every filter back to defaults including the
  // info panel's per-list sort. Year/type/tier are intentional view choices
  // and stay put.
  const clearBtn = document.getElementById('clear-filters-btn')
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      setState({ pinnedId: null, regionFilter: null, flow: 'both' })
      infoPanel.reset()
    })
  }

  // Snap canonical size + reflow when the chart container crosses a threshold.
  observeBreakpoint(chartEl, (next, prev) => {
    // On xs, lock to top tier and hide the "All countries" button.
    const onXs = next.name === 'xs'
    if (onXs && getState().tier !== 'top') setState({ tier: 'top' })
    for (const b of document.querySelectorAll('.tier-btn[data-tier="full"]')) {
      b.style.display = onXs ? 'none' : ''
    }
    if (!prev) return  // first fire — boot already used the picked size
    reflow(next)
  })
}

function reflow(next) {
  current = { w: next.w, h: next.h }
  const dpr = window.devicePixelRatio || 1

  // Rebuild the projection + resize the render surfaces in the new canonical
  // space. Then re-run applyYearType so scales (which depend on w/h) and the
  // per-node radius bake-in get refreshed cleanly. loadYear is cached so this
  // costs basically nothing beyond rebuilding the simulation.
  project = createProjection({ w: current.w, h: current.h })
  renderer.resize({ w: current.w, h: current.h })
  particles.resize({ w: current.w, h: current.h, dpr })

  const { year, type, tier } = getState()
  applyYearType(year, type, tier).catch(err => console.error('reflow failed', err))
}

boot().catch(err => console.error('coffee-trade boot failed', err))
