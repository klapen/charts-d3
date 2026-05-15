import '../../src/styles/main.css'
import * as d3 from 'd3'
import raw from './data/budget.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const BANDS = [
  { id: 'huge-up', test: (v) => v == null || v > 0.3, color: '#16a34a', label: { en: '> +30%', es: '> +30%' } },
  { id: 'mid-up', test: (v) => v > 0.15, color: '#4ade80', label: { en: '+15% to +30%', es: '+15% a +30%' } },
  { id: 'low-up', test: (v) => v > 0.02, color: '#a7f3d0', label: { en: '+2% to +15%', es: '+2% a +15%' } },
  { id: 'neutral', test: (v) => v >= -0.02, color: '#b3b3b3', label: { en: '−2% to +2%', es: '−2% a +2%' } },
  { id: 'low-down', test: (v) => v > -0.15, color: '#fdba74', label: { en: '−15% to −2%', es: '−15% a −2%' } },
  { id: 'mid-down', test: (v) => v > -0.3, color: '#fb923c', label: { en: '−30% to −15%', es: '−30% a −15%' } },
  { id: 'huge-down', test: () => true, color: '#dc2626', label: { en: '< −30%', es: '< −30%' } },
]

function bandFor(variation) {
  for (const b of BANDS) if (b.test(variation)) return b
  return BANDS[BANDS.length - 1]
}

const i18n = {
  en: {
    sectorTotal: 'Sector share of total:',
    selectSector: 'Select a sector…',
    selectedAmount: 'Amount',
    selectedShare: 'Share of total',
    selectedVar: 'YoY variation',
    movilidadShare: 'Movilidad is %{p} of the total budget',
    noVariation: 'No 2014 baseline',
    labels: {
      sector: 'Sector', entity: 'Entity', subgroup: 'Expense type',
      account: 'Major account', plan: 'Aux. / Plan', objective: 'Aux. / Objective',
      program: 'Program', project: 'Project',
    },
    abbr: { 'T': 'T COP', 'B': 'B COP', 'M': 'M COP' },
  },
  es: {
    sectorTotal: 'Participación del sector:',
    selectSector: 'Selecciona un sector…',
    selectedAmount: 'Monto',
    selectedShare: 'Participación',
    selectedVar: 'Variación 2014→2015',
    movilidadShare: 'Movilidad es el %{p} del presupuesto total',
    noVariation: 'Sin línea base 2014',
    labels: {
      sector: 'Sector', entity: 'Entidad', subgroup: 'Tipo de gasto',
      account: 'Cuenta mayor', plan: 'Aux. / Plan', objective: 'Aux. / Objetivo',
      program: 'Programa', project: 'Proyecto',
    },
    abbr: { 'T': 'billones', 'B': 'mil millones', 'M': 'millones' },
  },
}
const DETAIL_KEYS = ['sector', 'entity', 'subgroup', 'account', 'plan', 'objective', 'program', 'project']

const totalValue = d3.sum(raw, (d) => d.value)
const sectors = [...new Set(raw.map((d) => d.sector))].sort()
const movilidadSum = d3.sum(raw, (d) => (d.sector === 'Movilidad' ? d.value : 0))
const movilidadShare = movilidadSum / totalValue

const nodes = raw.map((d, i) => ({ ...d, id: i, band: bandFor(d.variation) }))

const width = 760
const height = 600
const margin = { top: 20, right: 20, bottom: 20, left: 20 }
const innerW = width - margin.left - margin.right
const innerH = height - margin.top - margin.bottom

const rScale = d3.scaleSqrt()
  .domain([0, d3.max(nodes, (d) => d.value)])
  .range([2, 28])

nodes.forEach((n) => (n.radius = Math.max(2, rScale(n.value))))

const bandY = new Map()
const bandStep = innerH / (BANDS.length + 0.5)
BANDS.forEach((b, i) => bandY.set(b.id, margin.top + bandStep * (i + 0.75)))

function detectLang() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'en'
}

function applyLang(lang) {
  document.documentElement.lang = lang
  document.querySelectorAll(`[data-${lang}]`).forEach((el) => {
    const text = el.dataset[lang]
    if (text != null) el.innerHTML = text
  })
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const active = btn.dataset.lang === lang
    btn.setAttribute('aria-pressed', active)
    btn.classList.toggle('text-brand', active)
    btn.classList.toggle('font-semibold', active)
    btn.classList.toggle('text-neutral-500', !active)
  })
  localStorage.setItem(STORAGE_KEY, lang)
}

function fmtAmount(v, lang) {
  const ab = i18n[lang].abbr
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2).replace('.', lang === 'en' ? '.' : ',')} ${ab.T}`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2).replace('.', lang === 'en' ? '.' : ',')} ${ab.B}`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2).replace('.', lang === 'en' ? '.' : ',')} ${ab.M}`
  return `$${v.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO')} COP`
}

function fmtPct(v, lang) {
  if (Math.abs(v) < 0.001) return (v * 100).toFixed(2) + '%'
  return (v * 100).toFixed(1) + '%'
}

const chartEl = document.getElementById('chart')
const detailEl = document.getElementById('detail')
const legendEl = document.getElementById('legend')
const sectorSelect = document.getElementById('sector-select')
const modeStat = document.getElementById('mode-stat')

let lang = detectLang()
let mode = 'total'
let selectedSector = null
let selectedNode = null

const svg = d3
  .select(chartEl)
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .attr('width', '100%')
  .attr('height', 'auto')
  .style('display', 'block')

const bandLabels = svg
  .append('g')
  .attr('text-anchor', 'start')
  .attr('font-size', 10)
  .attr('fill', '#525252')
  .selectAll('text')
  .data(BANDS)
  .join('text')
  .attr('x', margin.left + 4)
  .attr('y', (b) => bandY.get(b.id) - bandStep / 2 + 12)
  .text((b) => b.label.es)

const circles = svg
  .append('g')
  .selectAll('circle')
  .data(nodes, (d) => d.id)
  .join('circle')
  .attr('r', (d) => d.radius)
  .attr('fill', (d) => d.band.color)
  .attr('fill-opacity', 0.85)
  .attr('stroke', '#0a0a0a')
  .attr('stroke-width', 0.5)
  .style('cursor', 'pointer')
  .on('click', (event, d) => {
    selectedNode = d
    renderDetail()
    circles
      .attr('stroke', (n) => (n.id === d.id ? '#ff6b35' : '#0a0a0a'))
      .attr('stroke-width', (n) => (n.id === d.id ? 2 : 0.5))
  })
  .on('mouseover', function (event, d) {
    d3.select(this).attr('stroke', '#ff6b35').attr('stroke-width', 2)
  })
  .on('mouseout', function (event, d) {
    if (selectedNode && selectedNode.id === d.id) return
    d3.select(this).attr('stroke', '#0a0a0a').attr('stroke-width', 0.5)
  })

circles.append('title').text((d) => `${d.entity} — ${d.sector}`)

const targetX = (d) => {
  if (mode === 'total') return innerW / 2 + margin.left
  if (mode === 'movilidad') {
    return d.sector === 'Movilidad'
      ? innerW * 0.75 + margin.left
      : innerW * 0.3 + margin.left
  }
  if (mode === 'sector') {
    if (!selectedSector) return innerW / 2 + margin.left
    return d.sector === selectedSector ? innerW / 2 + margin.left : -200
  }
  return innerW / 2 + margin.left
}

const targetY = (d) => bandY.get(d.band.id)

const simulation = d3
  .forceSimulation(nodes)
  .force('x', d3.forceX(targetX).strength(0.12))
  .force('y', d3.forceY(targetY).strength(0.18))
  .force(
    'collide',
    d3.forceCollide((d) => d.radius + 1).iterations(2),
  )
  .alpha(1)
  .alphaDecay(0.025)
  .on('tick', () => {
    circles.attr('cx', (d) => d.x).attr('cy', (d) => d.y)
  })

function setMode(next) {
  mode = next
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    const active = btn.dataset.mode === mode
    btn.setAttribute('aria-pressed', active)
    btn.classList.toggle('border-brand', active)
    btn.classList.toggle('bg-neutral-800', active)
    btn.classList.toggle('bg-neutral-900', !active)
  })
  sectorSelect.classList.toggle('hidden', mode !== 'sector')

  if (mode === 'movilidad') {
    modeStat.textContent =
      i18n[lang].movilidadShare.replace('%{p}', fmtPct(movilidadShare, lang))
    circles.transition().duration(300).attr('fill-opacity', 0.85)
  } else if (mode === 'sector') {
    if (!selectedSector) selectedSector = sectors[0]
    sectorSelect.value = selectedSector
    updateSectorStat()
    circles.transition().duration(300).attr('fill-opacity', (d) =>
      d.sector === selectedSector ? 0.9 : 0,
    )
  } else {
    modeStat.textContent = ''
    circles.transition().duration(300).attr('fill-opacity', 0.85)
  }
  simulation.force('x', d3.forceX(targetX).strength(0.12)).alpha(0.6).restart()
}

function updateSectorStat() {
  const sum = d3.sum(nodes, (d) => (d.sector === selectedSector ? d.value : 0))
  modeStat.textContent = `${i18n[lang].sectorTotal} ${fmtPct(sum / totalValue, lang)}`
}

function renderDetail() {
  if (!selectedNode) return
  const d = selectedNode
  const t = i18n[lang]
  const wrap = document.createElement('div')
  wrap.className = 'space-y-2 text-sm'

  const pill = document.createElement('div')
  pill.className = 'inline-block px-2 py-1 rounded text-xs font-semibold text-black'
  pill.style.background = d.band.color
  pill.textContent = d.variation == null
    ? t.noVariation
    : `${t.selectedVar}: ${fmtPct(d.variation, lang)}`
  wrap.appendChild(pill)

  const amount = document.createElement('div')
  amount.className = 'text-base font-semibold text-neutral-100'
  amount.textContent = fmtAmount(d.value, lang)
  wrap.appendChild(amount)

  const share = document.createElement('div')
  share.className = 'text-xs text-neutral-500'
  share.textContent = `${t.selectedShare}: ${fmtPct(d.value / totalValue, lang)}`
  wrap.appendChild(share)

  const sep = document.createElement('hr')
  sep.className = 'border-neutral-800'
  wrap.appendChild(sep)

  for (const key of DETAIL_KEYS) {
    if (!d[key]) continue
    const row = document.createElement('div')
    const dt = document.createElement('div')
    dt.className = 'text-[10px] uppercase tracking-wider text-neutral-500'
    dt.textContent = t.labels[key]
    const dd = document.createElement('div')
    dd.className = 'text-xs text-neutral-200'
    dd.textContent = d[key]
    row.appendChild(dt)
    row.appendChild(dd)
    wrap.appendChild(row)
  }
  detailEl.replaceChildren(wrap)
}

function renderLegend() {
  legendEl.replaceChildren()
  for (const b of BANDS) {
    const li = document.createElement('li')
    li.className = 'flex items-center gap-2'
    const dot = document.createElement('span')
    dot.className = 'inline-block w-3 h-3 rounded-full flex-shrink-0'
    dot.style.background = b.color
    li.appendChild(dot)
    const label = document.createElement('span')
    label.textContent = b.label[lang]
    li.appendChild(label)
    legendEl.appendChild(li)
  }
}

function renderBandLabels() {
  bandLabels.text((b) => b.label[lang])
}

function populateSectorSelect() {
  sectorSelect.replaceChildren()
  const placeholder = document.createElement('option')
  placeholder.disabled = true
  placeholder.textContent = i18n[lang].selectSector
  sectorSelect.appendChild(placeholder)
  for (const s of sectors) {
    const opt = document.createElement('option')
    opt.value = s
    opt.textContent = s
    sectorSelect.appendChild(opt)
  }
  if (selectedSector) sectorSelect.value = selectedSector
}

sectorSelect.addEventListener('change', (e) => {
  selectedSector = e.target.value
  updateSectorStat()
  circles.transition().duration(300).attr('fill-opacity', (d) =>
    d.sector === selectedSector ? 0.9 : 0,
  )
  simulation.force('x', d3.forceX(targetX).strength(0.12)).alpha(0.6).restart()
})

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => setMode(btn.dataset.mode))
})

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang
    applyLang(lang)
    renderBandLabels()
    renderLegend()
    populateSectorSelect()
    if (mode === 'movilidad') {
      modeStat.textContent =
        i18n[lang].movilidadShare.replace('%{p}', fmtPct(movilidadShare, lang))
    } else if (mode === 'sector' && selectedSector) {
      updateSectorStat()
    }
    if (selectedNode) renderDetail()
  })
})

applyLang(lang)
renderBandLabels()
renderLegend()
populateSectorSelect()
setMode('total')
