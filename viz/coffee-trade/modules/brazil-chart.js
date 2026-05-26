import * as d3 from 'd3'
import { getState, subscribe } from './state.js'
import { loadBrazilMonthly } from './data-loader.js'

const CATEGORIES = ['arabica_natural', 'robusta_medium', 'processed', 'arabica_diff', 'robusta_diff']
const COLORS = {
  arabica_natural: '#a16a3d',
  robusta_medium:  '#4a6878',
  processed:       '#737373',
  arabica_diff:    '#d4a96a',
  robusta_diff:    '#7ba6c4',
}
const LABELS = {
  en: {
    arabica_natural: 'Arabica natural',
    arabica_diff:    'Arabica differentiated',
    robusta_medium:  'Robusta medium',
    robusta_diff:    'Robusta differentiated',
    processed:       'Processed (soluble + R&G)',
    total:           'Total',
    bags:            'bags',
  },
  es: {
    arabica_natural: 'Arábica natural',
    arabica_diff:    'Arábica diferenciada',
    robusta_medium:  'Robusta media',
    robusta_diff:    'Robusta diferenciada',
    processed:       'Procesado (soluble + T&M)',
    total:           'Total',
    bags:            'sacas',
  },
}

let root        // <div id="brazil-chart-canvas">
let data        // loaded JSON payload
let svg         // d3 selection of root <svg>
let hasBooted = false
let viewMode = 'bags'    // 'bags' | 'share'
let xScale, innerH, parsedMonths

export function wireBrazilChart() {
  root = document.getElementById('brazil-chart-canvas')
  if (!root) return

  const ro = new ResizeObserver(entries => {
    requestAnimationFrame(() => {
      const w = entries[0].contentRect.width
      if (!hasBooted && w > 0) {
        hasBooted = true
        boot()
      } else if (hasBooted) {
        render()
      }
    })
  })
  ro.observe(root)

  // Wire toggle buttons (in #brazil-chart-toggle, sibling of canvas).
  const toggle = document.getElementById('brazil-chart-toggle')
  if (toggle) {
    toggle.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mode]')
      if (!btn) return
      const next = btn.dataset.mode
      if (next === viewMode) return
      viewMode = next
      for (const b of toggle.querySelectorAll('button[data-mode]')) {
        const active = b.dataset.mode === viewMode
        b.setAttribute('aria-pressed', active ? 'true' : 'false')
        b.classList.toggle('text-neutral-200', active)
        b.classList.toggle('text-neutral-400', !active)
      }
      if (hasBooted) render()
    })
  }

  subscribe((next, prev) => {
    if (!hasBooted) return
    // Will be implemented in Tasks 12 and 14.
  })
}

async function boot() {
  data = await loadBrazilMonthly()
  parsedMonths = data.months.map(s => {
    const [y, m] = s.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  render()
}

function render() {
  // Implemented in Task 10.
}
