import { getState, subscribe } from './state.js'

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  notation: 'compact', maximumFractionDigits: 1,
})

const STRINGS = {
  empty:    { en: 'Click a country to see its trade partners.',
              es: 'Haz clic en un país para ver sus socios comerciales.' },
  exports:  { en: 'Exports',   es: 'Exportaciones' },
  imports:  { en: 'Imports',   es: 'Importaciones' },
  partners: { en: 'Top partners (this view)',
              es: 'Principales socios (esta vista)' },
  outflow:  { en: '→',         es: '→' },
  inflow:   { en: '←',         es: '←' },
}

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
    const { pinnedId, lang } = getState()
    if (!pinnedId) {
      root.innerHTML = `<p class="text-neutral-500">${STRINGS.empty[lang]}</p>`
      return
    }

    const node = currentNodes.find(n => n.id === pinnedId)
    const country = meta.countries[pinnedId]
    if (!node || !country) {
      root.innerHTML = `<p class="text-neutral-500">${STRINGS.empty[lang]}</p>`
      return
    }

    // Collect this country's edges, separated by direction.
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
        <span class="text-neutral-300">${arrow} ${escapeHtml(name)}</span>
        <span class="text-neutral-400 tabular-nums">${USD.format(p.value)}</span>
      </li>`
    }).join('')

    root.innerHTML = `
      <header class="flex items-baseline justify-between gap-3 mb-3">
        <h2 class="text-base font-semibold text-neutral-100">${escapeHtml(country.name)}</h2>
        <span class="text-xs text-neutral-500">${escapeHtml(country.region || '')}</span>
      </header>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <dt class="text-neutral-500">${STRINGS.exports[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${USD.format(node.exports_usd || 0)}</dd>
        <dt class="text-neutral-500">${STRINGS.imports[lang]}</dt>
        <dd class="text-neutral-200 tabular-nums text-right">${USD.format(node.imports_usd || 0)}</dd>
      </dl>
      ${partners.length ? `
        <div class="mt-3 text-xs text-neutral-500">${STRINGS.partners[lang]}</div>
        <ul class="mt-1 text-sm">${partnerRows}</ul>
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
