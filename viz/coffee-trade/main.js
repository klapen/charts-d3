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

const W = 1080, H = 660  // temporary canonical size; Task B7 replaces with breakpoints

let meta, renderer, particles, sim
let chartEl

function buildActiveSet(file, tier) {
  const sel = file.tier[tier]
  const nodes = sel.node_ids.map(id => file.nodes.find(n => n.id === id))
  const edges = sel.edge_indices.map(i => ({ ...file.edges[i] }))
  return { nodes, edges }
}

async function applyYearType(year, type, tier) {
  const file = await loadYear(year, type)
  const { nodes, edges } = buildActiveSet(file, tier)
  for (const e of edges) e._color = colorFor(meta, e.source.id || e.source)
  const scales = buildScales(nodes, edges, { w: W, h: H })

  renderer.update(nodes, edges, scales)

  if (sim) sim.stop()
  sim = buildSimulation(nodes, edges, { w: W, h: H })
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

  renderer = createSvgRenderer(chartEl, meta, { w: W, h: H })
  particles = createParticleLayer(chartEl, {
    w: W, h: H, dpr: window.devicePixelRatio || 1,
  })
  particles.start()

  await applyYearType(initialYear, getState().type, getState().tier)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
