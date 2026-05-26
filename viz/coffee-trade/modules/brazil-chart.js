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

const MARGIN = { top: 8, right: 8, bottom: 18, left: 48 }

function dims() {
  const w = root.clientWidth
  const h = root.clientHeight
  return {
    w,
    h,
    innerW: Math.max(0, w - MARGIN.left - MARGIN.right),
    innerH: Math.max(0, h - MARGIN.top - MARGIN.bottom),
  }
}

function stackedData() {
  const stack = d3.stack()
    .keys(CATEGORIES)
    .order(d3.stackOrderNone)
    .offset(viewMode === 'share' ? d3.stackOffsetExpand : d3.stackOffsetNone)
  return stack(data.months.map((_, i) => {
    const row = { i }
    for (const c of CATEGORIES) row[c] = data[c][i]
    return row
  }))
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
  if (!data) return
  const { w, h, innerW, innerH: ih } = dims()
  if (innerW === 0 || ih === 0) return
  innerH = ih

  if (!svg) {
    svg = d3.select(root)
      .append('svg')
      .attr('class', 'block w-full h-full')
    svg.append('g').attr('class', 'plot')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
    svg.append('g').attr('class', 'x-axis')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top + ih})`)
    svg.append('g').attr('class', 'y-axis')
       .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
  }
  svg.attr('viewBox', `0 0 ${w} ${h}`)

  xScale = d3.scaleTime()
    .domain(d3.extent(parsedMonths))
    .range([0, innerW])

  const stacked = stackedData()
  const yMax = d3.max(stacked, layer => d3.max(layer, d => d[1]))
  const yScale = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([ih, 0])

  const area = d3.area()
    .x((_, i) => xScale(parsedMonths[i]))
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveMonotoneX)

  const plot = svg.select('g.plot')
  const layers = plot.selectAll('path.layer').data(stacked, d => d.key)
  layers.enter()
    .append('path')
    .attr('class', 'layer')
    .merge(layers)
    .attr('fill', d => COLORS[d.key])
    .attr('d', area)
  layers.exit().remove()

  renderLegend()

  const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeYear.every(1))
    .tickFormat(d3.timeFormat('%Y'))
    .tickSize(4)
  svg.select('g.x-axis')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top + ih})`)
    .call(xAxis)
    .call(g => g.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10))
    .call(g => g.selectAll('line, path').attr('stroke', '#404040'))

  const yAxis = d3.axisLeft(yScale)
    .ticks(5)
    .tickFormat(viewMode === 'share'
      ? d3.format('.0%')
      : v => `${(v / 1e6).toFixed(1)}M`)
    .tickSize(4)
  svg.select('g.y-axis')
    .call(yAxis)
    .call(g => g.selectAll('text').attr('fill', '#a3a3a3').attr('font-size', 10))
    .call(g => g.selectAll('line, path').attr('stroke', '#404040'))
}

function renderLegend() {
  if (!root) return
  let legend = root.parentElement.querySelector('.brazil-legend')
  if (!legend) {
    legend = document.createElement('div')
    legend.className = 'brazil-legend flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-neutral-400'
    root.after(legend)
  }
  const lang = getState().lang || 'en'
  legend.innerHTML = CATEGORIES.slice().reverse().map(c => `
    <span class="inline-flex items-center gap-1.5">
      <span class="inline-block w-2.5 h-2.5" style="background:${COLORS[c]}"></span>
      ${LABELS[lang][c]}
    </span>`).join('')
}
