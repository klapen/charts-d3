import '../../src/styles/main.css'
import './style.css'

import { getState, setState, subscribe } from './modules/state.js'
import { loadMeta, loadYear } from './modules/data-loader.js'
import { detectLang, applyLang } from './modules/i18n.js'
import { buildScales } from './modules/scales.js'
import { buildSimulation } from './modules/force-sim.js'
import { createSvgRenderer } from './modules/renderer-svg.js'

function buildActiveSet(file, tier) {
  const sel = file.tier[tier]
  const nodes = sel.node_ids.map(id => file.nodes.find(n => n.id === id))
  const edges = sel.edge_indices.map(i => ({ ...file.edges[i] }))
  return { nodes, edges }
}

async function boot() {
  const lang = detectLang()
  setState({ lang })
  applyLang(lang)

  const meta = await loadMeta()
  console.log('meta loaded:', meta.years.length, 'years', Object.keys(meta.countries).length, 'countries')

  const initialYear = meta.years.at(-1)
  setState({ year: initialYear })

  const first = await loadYear(initialYear, 'all')
  console.log('first year file:', first.nodes.length, 'nodes', first.edges.length, 'edges',
    'top:', first.tier.top.node_ids.length, 'top edges:', first.tier.top.edge_indices.length)

  // Language toggle wiring (controls.js will take this over later)
  for (const btn of document.querySelectorAll('.lang-btn')) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.lang
      setState({ lang: next })
      applyLang(next)
    })
  }

  // Stub: bind year slider just so the page isn't dead
  const slider = document.getElementById('year-slider')
  const label = document.getElementById('year-label')
  slider.min = 0
  slider.max = meta.years.length - 1
  slider.value = meta.years.length - 1
  label.textContent = initialYear

  // Render top-tier force graph
  const chartEl = document.getElementById('chart')
  const w = 1080, h = 660   // temporary; Task B7 replaces with breakpoint-driven values

  const { nodes, edges } = buildActiveSet(first, 'top')
  const scales = buildScales(nodes, edges, { w, h })

  const renderer = createSvgRenderer(chartEl, meta, { w, h })
  renderer.update(nodes, edges, scales)

  const sim = buildSimulation(nodes, edges, { w, h })
  sim.on('tick', renderer.tick)
}

boot().catch(err => console.error('coffee-trade boot failed', err))
