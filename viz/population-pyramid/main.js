import '../../src/styles/main.css'
import * as Plot from '@observablehq/plot'
import raw from './data.json'

const STORAGE_KEY = 'klapen.lang'
const SUPPORTED = ['en', 'es']

const AGE_GROUPS = [
  '0-4', '5-9', '10-14', '15-19', '20-24', '25-29',
  '30-34', '35-39', '40-44', '45-49', '50-54', '55-59',
  '60-64', '65-69', '70-74', '75-79', '80 Y MÁS',
]
const AGE_LABELS_EN = { '80 Y MÁS': '80+' }

const MIN_YEAR = 1985
const MAX_YEAR = 2020

const i18n = {
  en: { male: 'Men', female: 'Women', share: 'Share of total population' },
  es: { male: 'Hombres', female: 'Mujeres', share: 'Porcentaje de la población total' },
}

const byYear = new Map(raw.map((row) => [row.Year, row.TotalNacional[0]]))

function rowsForYear(year) {
  const entry = byYear.get(Number(year))
  if (!entry) return []
  const { Hombres, Mujeres } = entry
  const total = AGE_GROUPS.reduce((s, g) => s + Hombres[g] + Mujeres[g], 0)
  return AGE_GROUPS.flatMap((g) => [
    { group: g, sex: 'male', share: -Hombres[g] / total, raw: Hombres[g] },
    { group: g, sex: 'female', share: Mujeres[g] / total, raw: Mujeres[g] },
  ])
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
  document.getElementById('ttl_year').textContent = year
  render()
}

const chartEl = document.getElementById('chart')
const slider = document.getElementById('slider')
const yearLabel = () => document.getElementById('ttl_year')

let year = Number(slider.value)
let lang = detectLang()

const fmtPct = (d) => `${(Math.abs(d) * 100).toFixed(1)}%`

function render() {
  const data = rowsForYear(year)
  const t = i18n[lang]
  const ageLabel = (g) => (lang === 'en' && AGE_LABELS_EN[g]) || g

  chartEl.replaceChildren(
    Plot.plot({
      width: Math.min(chartEl.clientWidth || 800, 900),
      height: 480,
      marginLeft: 80,
      marginRight: 24,
      marginTop: 24,
      marginBottom: 36,
      x: {
        label: t.share,
        labelAnchor: 'center',
        tickFormat: fmtPct,
        domain: [-0.07, 0.07],
        grid: true,
      },
      y: {
        domain: [...AGE_GROUPS].reverse(),
        label: null,
        tickFormat: ageLabel,
      },
      color: {
        domain: ['male', 'female'],
        range: ['#4f7cac', '#c0392b'],
        legend: true,
        tickFormat: (k) => t[k],
      },
      marks: [
        Plot.barX(data, {
          y: 'group',
          x: 'share',
          fill: 'sex',
          fillOpacity: 0.7,
          channels: { Count: 'raw' },
          tip: {
            format: {
              x: fmtPct,
              y: ageLabel,
              fill: (k) => t[k],
              Count: (n) => n.toLocaleString(lang === 'en' ? 'en-US' : 'es-CO'),
            },
          },
        }),
        Plot.text(data, {
          y: 'group',
          x: 'share',
          text: (d) => `${(Math.abs(d.share) * 100).toFixed(2)}%`,
          textAnchor: (d) => (d.sex === 'male' ? 'start' : 'end'),
          dx: (d) => (d.sex === 'male' ? 4 : -4),
          fill: '#f5f5f5',
          fontSize: 10,
        }),
        Plot.ruleX([0], { stroke: 'currentColor', strokeOpacity: 0.5 }),
      ],
      style: {
        background: 'transparent',
        color: '#a3a3a3',
        fontSize: '12px',
      },
    }),
  )
}

function setYear(y) {
  const clamped = Math.max(MIN_YEAR, Math.min(MAX_YEAR, Number(y)))
  if (clamped === year) return
  year = clamped
  slider.value = String(year)
  yearLabel().textContent = year
  render()
}

slider.addEventListener('input', (e) => setYear(e.target.value))

document.addEventListener('keydown', (e) => {
  if (e.target?.tagName === 'INPUT' && e.target.type !== 'range') return
  if (e.key === 'ArrowLeft') setYear(year - 1)
  else if (e.key === 'ArrowRight') setYear(year + 1)
})

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang
    applyLang(lang)
  })
})

window.addEventListener('resize', render)

applyLang(lang)
