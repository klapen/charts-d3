import { getState, setState, subscribe } from './state.js'
import { REGION_COLOR } from './scales.js'
import { applyLang } from './i18n.js'

const REGIONS = [
  { region: 'South America', en: 'South America', es: 'Suramérica' },
  { region: 'Africa',        en: 'Africa',        es: 'África' },
  { region: 'Asia',          en: 'Asia',          es: 'Asia' },
  { region: 'Europe',        en: 'Europe',        es: 'Europa' },
  { region: 'North America', en: 'North America', es: 'Norteamérica' },
]

export function renderLegend() {
  const ul = document.getElementById('legend')
  ul.replaceChildren()

  for (const it of REGIONS) {
    const li = document.createElement('li')
    li.className = 'flex items-center gap-1.5 cursor-pointer hover:text-neutral-200 select-none transition-colors'
    li.dataset.region = it.region
    li.dataset.en = it.en
    li.dataset.es = it.es
    li.setAttribute('role', 'button')
    li.setAttribute('aria-pressed', 'false')
    li.innerHTML = `
      <span class="w-2.5 h-2.5 rounded-full ring-1 ring-neutral-700" style="background:${REGION_COLOR[it.region]}"></span>
      <span>${it.en}</span>
    `
    li.addEventListener('click', () => {
      const cur = getState().regionFilter
      setState({ regionFilter: cur === it.region ? null : it.region })
    })
    ul.appendChild(li)
  }

  applyLang(getState().lang)  // translate the freshly added children

  // Reflect the current selection in the legend's own visual state.
  function reflect() {
    const active = getState().regionFilter
    for (const li of ul.querySelectorAll('li')) {
      const on = li.dataset.region === active
      li.classList.toggle('text-neutral-100', on)
      li.setAttribute('aria-pressed', String(on))
    }
  }
  reflect()

  subscribe((next, prev) => {
    if (next.regionFilter !== prev.regionFilter) reflect()
    if (next.lang !== prev.lang) applyLang(next.lang)
  })
}
