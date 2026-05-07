import '../../src/styles/main.css'
import * as Plot from '@observablehq/plot'
import raw from './data/labour.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const METRICS = ['TGP', 'TO', 'TD']
const METRIC_COLOR = { TGP: '#ff6b35', TO: '#5ec5ee', TD: '#ff5f7a' }
const METRIC_LABEL = {
  en: { TGP: 'Participation (TGP)', TO: 'Employment (TO)', TD: 'Unemployment (TD)' },
  es: { TGP: 'Participación (TGP)', TO: 'Ocupación (TO)', TD: 'Desempleo (TD)' },
}
const i18n = {
  en: { rate: 'Rate (%)', date: 'Date' },
  es: { rate: 'Tasa (%)', date: 'Fecha' },
}

const series = []
for (const yearRow of raw.TotalNacional) {
  for (const m of yearRow.Months) {
    const date = new Date(yearRow.Year, m.Month - 1, 1)
    for (const k of METRICS) {
      series.push({ date, year: yearRow.Year, metric: k, value: m[k] / 100 })
    }
  }
}

const minYear = Math.min(...raw.TotalNacional.map((y) => y.Year))
const maxYear = Math.max(...raw.TotalNacional.map((y) => y.Year))

const yearBands = []
for (let y = minYear; y <= maxYear; y++) {
  if ((y - minYear) % 2 === 0) {
    yearBands.push({ x1: new Date(y, 0, 1), x2: new Date(y + 1, 0, 1) })
  }
}

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
    if (text != null) el.textContent = text
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

const chartEl = document.getElementById('chart')
let lang = detectLang()
const active = new Set(METRICS)

const fmtPct = (v) => `${(v * 100).toFixed(1)}%`
const fmtMonth = (lang) =>
  new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-CO', {
    month: 'short',
    year: 'numeric',
  })

function render() {
  const data = series.filter((d) => active.has(d.metric))
  const domains = [...active]
  const colors = domains.map((m) => METRIC_COLOR[m])
  const t = i18n[lang]
  const monthFmt = fmtMonth(lang)

  chartEl.replaceChildren(
    Plot.plot({
      width: Math.min(chartEl.clientWidth || 900, 1000),
      height: 460,
      marginLeft: 56,
      marginRight: 24,
      marginTop: 24,
      marginBottom: 40,
      x: { type: 'time', label: null, grid: false },
      y: {
        label: t.rate,
        labelAnchor: 'top',
        tickFormat: (v) => `${(v * 100).toFixed(0)}%`,
        grid: true,
        domain: [0, 0.7],
      },
      color: {
        domain: domains,
        range: colors,
        legend: false,
      },
      marks: [
        Plot.rectX(yearBands, {
          x1: 'x1',
          x2: 'x2',
          fill: '#ffffff',
          fillOpacity: 0.025,
        }),
        Plot.ruleY([0], { stroke: 'currentColor', strokeOpacity: 0.4 }),
        Plot.lineY(data, {
          x: 'date',
          y: 'value',
          stroke: 'metric',
          strokeWidth: 1.75,
          curve: 'monotone-x',
        }),
        Plot.dot(
          data,
          Plot.pointerX({
            x: 'date',
            y: 'value',
            stroke: 'metric',
            fill: 'metric',
            r: 3.5,
          }),
        ),
        Plot.tip(
          data,
          Plot.pointerX({
            x: 'date',
            y: 'value',
            stroke: 'metric',
            channels: {
              series: { value: (d) => METRIC_LABEL[lang][d.metric], label: '' },
              [t.date]: { value: (d) => monthFmt.format(d.date), label: t.date },
            },
            format: { x: null, y: fmtPct, stroke: false, metric: false },
          }),
        ),
      ],
      style: {
        background: 'transparent',
        color: '#a3a3a3',
        fontSize: '12px',
      },
    }),
  )
}

function syncMetricButtons() {
  document.querySelectorAll('.metric-btn').forEach((btn) => {
    const m = btn.dataset.metric
    const on = active.has(m)
    btn.setAttribute('aria-pressed', on)
    btn.classList.toggle('border-brand', on && m === 'TGP')
    btn.classList.toggle('opacity-40', !on)
  })
}

document.querySelectorAll('.metric-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const m = btn.dataset.metric
    if (active.has(m)) {
      if (active.size === 1) return
      active.delete(m)
    } else {
      active.add(m)
    }
    syncMetricButtons()
    render()
  })
})

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang
    applyLang(lang)
    render()
  })
})

window.addEventListener('resize', render)

applyLang(lang)
syncMetricButtons()
render()
