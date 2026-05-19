import { getState, subscribe } from './state.js'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  notation: 'compact', maximumFractionDigits: 1,
})

const STRINGS = {
  summaryTitle:    { en: 'Global summary',     es: 'Resumen global' },
  totalFlow:       { en: 'Total trade',        es: 'Comercio total' },
  countries:       { en: 'Countries trading',  es: 'Países comerciando' },
  topExporters:    { en: 'Top exporters',      es: 'Principales exportadores' },
  topImporters:    { en: 'Top importers',      es: 'Principales importadores' },
  exports:         { en: 'Exports',            es: 'Exportaciones' },
  imports:         { en: 'Imports',            es: 'Importaciones' },
  topPartners:     { en: 'Top partners',       es: 'Principales socios' },
  outflow:         { en: '→',                  es: '→' },
  inflow:          { en: '←',                  es: '←' },
  clickHint:       { en: 'Click a country marble to focus.',
                     es: 'Haz clic en un país para enfocar.' },
}

const TOP_LIST_LEN = 5
const TOP_PARTNER_COUNT = 6

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
  }

  function renderSummary() {
    const lang = getState().lang
    if (!currentNodes.length) {
      root.innerHTML = `<p class="text-neutral-500">${STRINGS.clickHint[lang]}</p>`
      return
    }

    const totalFlow = currentEdges.reduce((s, e) => s + (e.value_usd || 0), 0)
    const countries = currentNodes.length

    const exporters = [...currentNodes]
      .filter(n => n.exports_usd > 0)
      .sort((a, b) => b.exports_usd - a.exports_usd)
      .slice(0, TOP_LIST_LEN)

    const importers = [...currentNodes]
      .filter(n => n.imports_usd > 0)
      .sort((a, b) => b.imports_usd - a.imports_usd)
      .slice(0, TOP_LIST_LEN)

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

      <div class="text-xs uppercase tracking-wide text-neutral-500 mb-1">${STRINGS.topExporters[lang]}</div>
      <ul class="mb-3">${renderTopList(exporters, 'exports_usd')}</ul>

      <div class="text-xs uppercase tracking-wide text-neutral-500 mb-1">${STRINGS.topImporters[lang]}</div>
      <ul class="mb-3">${renderTopList(importers, 'imports_usd')}</ul>

      <p class="text-xs text-neutral-500 mt-3">${STRINGS.clickHint[lang]}</p>
    `
  }

  function renderTopList(nodes, valueField) {
    return nodes.map(n => {
      const name = meta.countries[n.id]?.name || n.id
      return `<li class="flex items-center justify-between gap-3 py-0.5">
        <span class="text-neutral-300 truncate">${escapeHtml(name)}</span>
        <span class="text-neutral-400 tabular-nums">${USD.format(n[valueField])}</span>
      </li>`
    }).join('')
  }

  function renderCountry(pinnedId) {
    const lang = getState().lang
    const node = currentNodes.find(n => n.id === pinnedId)
    const country = meta.countries[pinnedId]
    if (!node || !country) {
      renderSummary()
      return
    }

    const exports = []
    const imports = []
    for (const e of currentEdges) {
      const src = e.source.id || e.source
      const tgt = e.target.id || e.target
      if (src === pinnedId) exports.push({ other: tgt, value: e.value_usd })
      else if (tgt === pinnedId) imports.push({ other: src, value: e.value_usd })
    }
    exports.sort((a, b) => b.value - a.value)
    imports.sort((a, b) => b.value - a.value)

    const partners = [
      ...exports.slice(0, TOP_PARTNER_COUNT).map(p => ({ ...p, dir: 'out' })),
      ...imports.slice(0, TOP_PARTNER_COUNT).map(p => ({ ...p, dir: 'in' })),
    ].sort((a, b) => b.value - a.value).slice(0, TOP_PARTNER_COUNT)

    const partnerRows = partners.map(p => {
      const name = meta.countries[p.other]?.name || p.other
      const arrow = p.dir === 'out' ? STRINGS.outflow[lang] : STRINGS.inflow[lang]
      return `<li class="flex items-center justify-between gap-3 py-0.5">
        <span class="text-neutral-300 truncate">${arrow} ${escapeHtml(name)}</span>
        <span class="text-neutral-400 tabular-nums">${USD.format(p.value)}</span>
      </li>`
    }).join('')

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
        <div class="mt-3 text-xs uppercase tracking-wide text-neutral-500 mb-1">${STRINGS.topPartners[lang]}</div>
        <ul>${partnerRows}</ul>
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
