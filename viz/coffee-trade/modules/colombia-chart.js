import * as d3 from 'd3'
import { getState, subscribe } from './state.js'
import { loadColombiaMonthly } from './data-loader.js'

const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 }

export function wireColombiaChart() {
  const root = document.getElementById('colombia-chart-canvas')
  if (!root) return

  let data = null
  let svg = null
  let dims = { width: 0, height: 0 }
  let hasBooted = false

  const ro = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect
    if (width === 0) return
    dims = { width, height }
    if (!hasBooted) {
      hasBooted = true
      loadColombiaMonthly().then(d => { data = d; render() })
    } else if (data) {
      render()
    }
  })
  ro.observe(root)

  function render() {
    // populated in Task 8
    console.log('[colombia-chart] render', dims, data?.months?.length)
  }

  subscribe((next, prev) => {
    // populated in Tasks 9 and 11
  })
}
