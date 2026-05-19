import '../../src/styles/main.css'
import './style.css'

import * as d3 from 'd3'
import { getState, setState, subscribe } from './modules/state.js'
import { loadMeta, loadYear } from './modules/data-loader.js'
import { detectLang, applyLang } from './modules/i18n.js'
import { buildScales, colorFor } from './modules/scales.js'
import { buildSimulation } from './modules/force-sim.js'
import { createSvgRenderer } from './modules/renderer-svg.js'
import { createParticleLayer } from './modules/particles.js'
import { wireControls } from './modules/controls.js'
import { createProjection } from './modules/geo.js'

const W = 1080, H = 660  // temporary canonical size; Task B7 replaces with breakpoints

let meta, renderer, particles, sim, project
let chartEl

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
  const file = await loadYear(year, type)
  const { nodes, edges } = buildActiveSet(file, tier)
  for (const e of edges) e._color = colorFor(meta, e.source.id || e.source)
  const scales = buildScales(nodes, edges, { w: W, h: H })

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

  renderer.update(nodes, edges, scales)

  if (sim) sim.stop()
  sim = buildSimulation(nodes, edges)
  sim.on('tick', renderer.tick)
  // d3-force mutates source/target to objects after first tick — wait one frame
  requestAnimationFrame(() => particles.rebuild(edges, scales))
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

  project = createProjection({ w: W, h: H })
  renderer = createSvgRenderer(chartEl, meta, { w: W, h: H })
  particles = createParticleLayer(chartEl, {
    w: W, h: H, dpr: window.devicePixelRatio || 1,
  })
  particles.start()

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
}

boot().catch(err => console.error('coffee-trade boot failed', err))
