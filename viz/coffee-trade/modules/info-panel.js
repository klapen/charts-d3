import { getState, setState, subscribe } from './state.js'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  notation: 'compact', maximumFractionDigits: 1,
})

const STRINGS = {
  summaryTitle:    { en: 'Global summary',     es: 'Resumen global' },
  regionSummary:   { en: 'Region summary',     es: 'Resumen de la región' },
  totalFlow:       { en: 'Total trade',        es: 'Comercio total' },
  countries:       { en: 'Countries trading',  es: 'Países comerciando' },
  exportersHeader: { en: 'Exporters',          es: 'Exportadores' },
  importersHeader: { en: 'Importers',          es: 'Importadores' },
  exports:         { en: 'Exports',            es: 'Exportaciones' },
  imports:         { en: 'Imports',            es: 'Importaciones' },
  partnersHeader:  { en: 'Partners',           es: 'Socios' },
  partnersInRegion:{ en: 'Partners in region', es: 'Socios en la región' },
  outflow:         { en: '→',                  es: '→' },
  inflow:          { en: '←',                  es: '←' },
  clickHint:       { en: 'Click a row or a marble to focus a country.',
                     es: 'Haz clic en una fila o un país para enfocarlo.' },
}

const REGION_LABEL = {
  'South America': { en: 'South America', es: 'Suramérica' },
  'Africa':        { en: 'Africa',        es: 'África' },
  'Asia':          { en: 'Asia',          es: 'Asia' },
  'Europe':        { en: 'Europe',        es: 'Europa' },
  'North America': { en: 'North America', es: 'Norteamérica' },
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

  function inRegion(id, region) {
    if (!region) return true
    return meta.countries[id]?.region === region
  }

  function renderSummary() {
    const { lang, regionFilter, flow } = getState()
    if (!currentNodes.length) {
      root.innerHTML = `<p class="text-neutral-500">${STRINGS.clickHint[lang]}</p>`
      return
    }

    // When a region is active, scope every count and table row to that region.
    // The flow filter further narrows: with regionFilter + 'exports', we only
    // count edges where the region is the source; with 'imports', target.
    const scopedNodes = currentNodes.filter(n => inRegion(n.id, regionFilter))
    const scopedEdges = currentEdges.filter(e => {
      const sIn = inRegion(e.source.id || e.source, regionFilter)
      const tIn = inRegion(e.target.id || e.target, regionFilter)
      if (regionFilter) {
        if (flow === 'exports') return sIn
        if (flow === 'imports') return tIn
        return sIn || tIn
      }
      return true
    })

    const totalFlow = scopedEdges.reduce((s, e) => s + (e.value_usd || 0), 0)
    const countries = scopedNodes.length

    const exporters = scopedNodes
      .filter(n => n.exports_usd > 0)
      .sort((a, b) => b.exports_usd - a.exports_usd)

    const importers = scopedNodes
      .filter(n => n.imports_usd > 0)
      .sort((a, b) => b.imports_usd - a.imports_usd)

    const opts = { pinnedId: null }
    const expRows = exporters.map(n => renderRow(n.id, n.exports_usd, opts)).join('')
    const impRows = importers.map(n => renderRow(n.id, n.imports_usd, opts)).join('')

    const titleText = regionFilter
      ? REGION_LABEL[regionFilter][lang]
      : STRINGS.summaryTitle[lang]
    const subtitle = regionFilter
      ? `<span class="text-xs text-neutral-500 shrink-0">${STRINGS.regionSummary[lang]}</span>`
      : ''

    // The flow filter hides the table that doesn't apply: 'exports' hides the
    // importers list and vice-versa. 'both' keeps both visible.
    const showExporters = flow !== 'imports'
    const showImporters = flow !== 'exports'

    root.innerHTML = `
      <header class="flex items-baseline justify-between gap-3 mb-3">
        <h2 class="text-base font-semibold text-neutral-100">${escapeHtml(titleText)}</h2>
        ${subtitle}
      </header>
      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
        <dt class="text-neutral-500">${STRINGS.totalFlow[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${USD.format(totalFlow)}</dd>
        <dt class="text-neutral-500">${STRINGS.countries[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${countries}</dd>
      </dl>

      ${showExporters ? `
        <div class="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex justify-between">
          <span>${STRINGS.exportersHeader[lang]}</span>
          <span class="text-neutral-600 normal-case tracking-normal">${exporters.length}</span>
        </div>
        <ul class="mb-3 ${LIST_MAX_H_CLASS}">${expRows}</ul>
      ` : ''}

      ${showImporters ? `
        <div class="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex justify-between">
          <span>${STRINGS.importersHeader[lang]}</span>
          <span class="text-neutral-600 normal-case tracking-normal">${importers.length}</span>
        </div>
        <ul class="mb-3 ${LIST_MAX_H_CLASS}">${impRows}</ul>
      ` : ''}

      <p class="text-xs text-neutral-500 mt-3">${STRINGS.clickHint[lang]}</p>
    `
  }

  function renderCountry(pinnedId) {
    const { lang, regionFilter, flow } = getState()
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
    // Scope partners to the active region so the panel mirrors what's visible
    // in the chart. The pinned country itself stays even if it's outside the
    // region — that's the country the user explicitly asked to focus on.
    let scopedPartners = regionFilter
      ? partners.filter(p => inRegion(p.other, regionFilter))
      : partners
    // Apply flow: 'exports' keeps only outgoing partners ('out'); 'imports'
    // keeps only incoming ('in'); 'both' is a no-op.
    if (flow === 'exports') scopedPartners = scopedPartners.filter(p => p.dir === 'out')
    else if (flow === 'imports') scopedPartners = scopedPartners.filter(p => p.dir === 'in')
    scopedPartners.sort((a, b) => b.value - a.value)

    const opts = { pinnedId }
    const rows = scopedPartners.map(p =>
      renderRow(p.other, p.value, {
        ...opts,
        arrow: p.dir === 'out' ? STRINGS.outflow[lang] : STRINGS.inflow[lang],
      }),
    ).join('')

    const partnersHeader = regionFilter
      ? STRINGS.partnersInRegion[lang]
      : STRINGS.partnersHeader[lang]

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

      ${scopedPartners.length ? `
        <div class="mt-3 text-xs uppercase tracking-wide text-neutral-500 mb-1 flex justify-between">
          <span>${escapeHtml(partnersHeader)}</span>
          <span class="text-neutral-600 normal-case tracking-normal">${scopedPartners.length}</span>
        </div>
        <ul class="${LIST_MAX_H_CLASS}">${rows}</ul>
      ` : ''}
    `
  }

  subscribe((next, prev) => {
    if (
      next.pinnedId !== prev.pinnedId
      || next.lang !== prev.lang
      || next.regionFilter !== prev.regionFilter
      || next.flow !== prev.flow
    ) render()
  })

  return { setData, render }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
