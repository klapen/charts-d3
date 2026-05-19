import { getState, setState, subscribe } from './state.js'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  notation: 'compact', maximumFractionDigits: 1,
})

const STRINGS = {
  summaryTitle:    { en: 'Global summary',     es: 'Resumen global' },
  totalFlow:       { en: 'Total trade',        es: 'Comercio total' },
  countries:       { en: 'Countries trading',  es: 'Países comerciando' },
  exportersHeader: { en: 'Exporters',          es: 'Exportadores' },
  importersHeader: { en: 'Importers',          es: 'Importadores' },
  exports:         { en: 'Exports',            es: 'Exportaciones' },
  imports:         { en: 'Imports',            es: 'Importaciones' },
  partnersHeader:  { en: 'Partners',           es: 'Socios' },
  outflow:         { en: '→',                  es: '→' },
  inflow:          { en: '←',                  es: '←' },
  clickHint:       { en: 'Click a row or a marble to focus a country.',
                     es: 'Haz clic en una fila o un país para enfocarlo.' },
}

// Each scrollable list caps at this height so the side panel stays usable
// in a sticky lg sidebar but is also free to take more space on mobile.
const LIST_MAX_H_CLASS = 'max-h-56 overflow-y-auto'

export function createInfoPanel(meta) {
  const root = document.getElementById('info-panel')

  let currentNodes = []
  let currentEdges = []

  function setData(nodes, edges) {
    currentNodes = nodes
    currentEdges = edges
    render()
  }

  function render() {
    const { pinnedId } = getState()
    if (pinnedId) renderCountry(pinnedId)
    else renderSummary()
    wireRowClicks()
  }

  function wireRowClicks() {
    for (const li of root.querySelectorAll('li[data-iso3]')) {
      li.addEventListener('click', () => {
        const id = li.dataset.iso3
        const cur = getState().pinnedId
        setState({ pinnedId: cur === id ? null : id })
      })
    }
  }

  function renderRow(id, value, { arrow = '', pinnedId }) {
    const name = meta.countries[id]?.name || id
    const active = id === pinnedId
    const cls = [
      'flex items-center justify-between gap-3 py-0.5 px-1.5 rounded cursor-pointer',
      active ? 'bg-neutral-800 text-neutral-50' : 'hover:bg-neutral-800/60 text-neutral-300',
    ].join(' ')
    return `<li data-iso3="${escapeHtml(id)}" class="${cls}">
      <span class="truncate">${arrow ? `<span class="text-neutral-500 mr-1">${arrow}</span>` : ''}${escapeHtml(name)}</span>
      <span class="${active ? 'text-neutral-100' : 'text-neutral-400'} tabular-nums shrink-0">${USD.format(value)}</span>
    </li>`
  }

  function renderSummary() {
    const lang = getState().lang
    if (!currentNodes.length) {
      root.innerHTML = `<p class="text-neutral-500">${STRINGS.clickHint[lang]}</p>`
      return
    }

    const totalFlow = currentEdges.reduce((s, e) => s + (e.value_usd || 0), 0)
    const countries = currentNodes.length

    const exporters = currentNodes
      .filter(n => n.exports_usd > 0)
      .sort((a, b) => b.exports_usd - a.exports_usd)

    const importers = currentNodes
      .filter(n => n.imports_usd > 0)
      .sort((a, b) => b.imports_usd - a.imports_usd)

    const opts = { pinnedId: null }   // no pin in summary view
    const expRows = exporters.map(n => renderRow(n.id, n.exports_usd, opts)).join('')
    const impRows = importers.map(n => renderRow(n.id, n.imports_usd, opts)).join('')

    root.innerHTML = `
      <header class="mb-3">
        <h2 class="text-base font-semibold text-neutral-100">${STRINGS.summaryTitle[lang]}</h2>
      </header>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
        <dt class="text-neutral-500">${STRINGS.totalFlow[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${USD.format(totalFlow)}</dd>
        <dt class="text-neutral-500">${STRINGS.countries[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${countries}</dd>
      </dl>

      <div class="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex justify-between">
        <span>${STRINGS.exportersHeader[lang]}</span>
        <span class="text-neutral-600 normal-case tracking-normal">${exporters.length}</span>
      </div>
      <ul class="mb-3 ${LIST_MAX_H_CLASS}">${expRows}</ul>

      <div class="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex justify-between">
        <span>${STRINGS.importersHeader[lang]}</span>
        <span class="text-neutral-600 normal-case tracking-normal">${importers.length}</span>
      </div>
      <ul class="mb-3 ${LIST_MAX_H_CLASS}">${impRows}</ul>

      <p class="text-xs text-neutral-500 mt-3">${STRINGS.clickHint[lang]}</p>
    `
  }

  function renderCountry(pinnedId) {
    const lang = getState().lang
    const node = currentNodes.find(n => n.id === pinnedId)
    const country = meta.countries[pinnedId]
    if (!node || !country) {
      renderSummary()
      return
    }

    const partners = []
    for (const e of currentEdges) {
      const src = e.source.id || e.source
      const tgt = e.target.id || e.target
      if (src === pinnedId) partners.push({ other: tgt, value: e.value_usd, dir: 'out' })
      else if (tgt === pinnedId) partners.push({ other: src, value: e.value_usd, dir: 'in' })
    }
    partners.sort((a, b) => b.value - a.value)

    const opts = { pinnedId }
    const rows = partners.map(p =>
      renderRow(p.other, p.value, {
        ...opts,
        arrow: p.dir === 'out' ? STRINGS.outflow[lang] : STRINGS.inflow[lang],
      }),
    ).join('')

    root.innerHTML = `
      <header class="flex items-baseline justify-between gap-3 mb-3">
        <h2 class="text-base font-semibold text-neutral-100 truncate">${escapeHtml(country.name)}</h2>
        <span class="text-xs text-neutral-500 shrink-0">${escapeHtml(country.region || '')}</span>
      </header>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt class="text-neutral-500">${STRINGS.exports[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${USD.format(node.exports_usd || 0)}</dd>
        <dt class="text-neutral-500">${STRINGS.imports[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${USD.format(node.imports_usd || 0)}</dd>
      </dl>

      ${partners.length ? `
        <div class="mt-3 text-xs uppercase tracking-wide text-neutral-500 mb-1 flex justify-between">
          <span>${STRINGS.partnersHeader[lang]}</span>
          <span class="text-neutral-600 normal-case tracking-normal">${partners.length}</span>
        </div>
        <ul class="${LIST_MAX_H_CLASS}">${rows}</ul>
      ` : ''}
    `
  }

  subscribe((next, prev) => {
    if (next.pinnedId !== prev.pinnedId || next.lang !== prev.lang) render()
  })

  return { setData, render }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
