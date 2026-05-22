import * as d3 from 'd3'
import { getState, subscribe } from './state.js'
import { loadColombiaMonthly } from './data-loader.js'

const MARGIN = { top: 8, right: 16, bottom: 24, left: 48 }

export function wireColombiaChart() {
  const root = document.getElementById('colombia-chart-canvas')
  if (!root) return

  const tooltip = document.createElement('div')
  tooltip.className = 'absolute pointer-events-none rounded bg-neutral-900/95 ' +
    'border border-neutral-700 text-neutral-100 text-xs px-2 py-1 ' +
    'shadow-lg tabular-nums'
  tooltip.style.display = 'none'
  root.appendChild(tooltip)

  let data = null
  let svg = null
  let dims = { width: 0, height: 0 }
  let hasBooted = false
  let xScale = null
  let innerH = 0

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
    const { width, height } = dims
    if (!data || width === 0) return

    const innerW = Math.max(0, width  - MARGIN.left - MARGIN.right)
    innerH = Math.max(0, height - MARGIN.top  - MARGIN.bottom)

    const dates = data.months.map(m => new Date(m + '-01'))
    xScale = d3.scaleTime().domain(d3.extent(dates)).range([0, innerW])
    const yMax   = d3.max(data.production)
    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

    // Build the SVG only once; on later renders, reuse selections.
    if (!svg) {
      svg = d3.select(root)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .style('display', 'block')

      const g = svg.append('g').attr('class', 'plot')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
      g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`)
      g.append('g').attr('class', 'y-axis')
      g.append('rect').attr('class', 'year-band').attr('fill', '#ffffff').attr('fill-opacity', 0.08).attr('pointer-events', 'none')
      g.append('path').attr('class', 'exports-line').attr('fill', 'none')
        .attr('stroke', 'rgb(163 163 163)').attr('stroke-dasharray', '4 4').attr('stroke-width', 1.5)
      g.append('path').attr('class', 'production-line').attr('fill', 'none')
        .attr('stroke', 'var(--color-brand)').attr('stroke-width', 1.75)
      g.append('line').attr('class', 'hover-guide')
        .attr('stroke', 'rgb(212 212 212)').attr('stroke-width', 1).attr('stroke-dasharray', '2 3')
        .style('display', 'none')
      g.append('rect').attr('class', 'hover-capture')
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
    }

    const g = svg.select('g.plot')
    svg.attr('viewBox', `0 0 ${width} ${height}`)
    g.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    g.select('.x-axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat('%Y')))
      .call(sel => sel.selectAll('text').attr('fill', 'rgb(163 163 163)'))
      .call(sel => sel.selectAll('line, path').attr('stroke', 'rgb(82 82 82)'))

    g.select('.y-axis')
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(v => `${(v / 1_000_000).toFixed(1)}M`))
      .call(sel => sel.selectAll('text').attr('fill', 'rgb(163 163 163)'))
      .call(sel => sel.selectAll('line, path').attr('stroke', 'rgb(82 82 82)'))

    const line = d3.line()
      .x((_, i) => xScale(dates[i]))
      .y(v => yScale(v))
      .curve(d3.curveMonotoneX)

    g.select('.production-line').attr('d', line(data.production))
    g.select('.exports-line').attr('d', line(data.exports))

    updateBand()

    const capture = g.select('rect.hover-capture')
      .attr('width', innerW).attr('height', innerH)

    capture.on('pointermove', (event) => {
      const [mx] = d3.pointer(event)
      const dateAtCursor = xScale.invert(mx)
      // Nearest-month snap
      const idx = d3.leastIndex(dates, d => Math.abs(d - dateAtCursor))
      if (idx == null) return
      const x = xScale(dates[idx])
      g.select('.hover-guide')
        .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
        .style('display', null)
      const prod = data.production[idx]
      const exp  = data.exports[idx]
      const pct  = prod > 0 ? Math.round((exp / prod) * 100) : 0
      const lang = getState().lang
      const labels = lang === 'es'
        ? { prod: 'Producción', exp: 'Exportaciones', pctOf: 'Exportado' }
        : { prod: 'Production', exp: 'Exports',       pctOf: 'Exported'  }
      tooltip.innerHTML = `<div>${data.months[idx]}</div>
        <div>${labels.prod}: ${prod.toLocaleString()}</div>
        <div>${labels.exp}: ${exp.toLocaleString()}</div>
        <div>${labels.pctOf}: ${pct}%</div>`
      tooltip.style.display = 'block'
      // Position: 12px to the right of the cursor, inside root
      const rect = root.getBoundingClientRect()
      const px = Math.min(rect.width  - tooltip.offsetWidth  - 8, x + MARGIN.left + 12)
      tooltip.style.left = `${px}px`
      tooltip.style.top  = `8px`
    })

    capture.on('pointerleave', () => {
      g.select('.hover-guide').style('display', 'none')
      tooltip.style.display = 'none'
    })
  }

  function updateBand() {
    const { year } = getState()
    if (!year || !svg || !xScale) return
    const x0 = xScale(new Date(`${year}-01-01`))
    const x1 = xScale(new Date(`${year}-12-31`))
    svg.select('rect.year-band')
      .attr('x', x0)
      .attr('y', 0)
      .attr('width', Math.max(0, x1 - x0))
      .attr('height', innerH)
  }

  subscribe((next, prev) => {
    if (next.year !== prev.year) updateBand()
  })
}
