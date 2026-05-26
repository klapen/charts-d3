const cache = new Map()  // key -> Promise<file>

export async function loadMeta() {
  const r = await fetch('./data/meta.json')
  if (!r.ok) throw new Error(`meta.json: ${r.status}`)
  return r.json()
}

export function loadYear(year, type) {
  const key = `${year}-${type}`
  if (!cache.has(key)) {
    const p = fetch(`./data/${key}.json`).then(async r => {
      if (!r.ok) throw new Error(`${key}: ${r.status}`)
      const data = await r.json()
      // Cheap shape guard so a pipeline regression shows up immediately
      // instead of cascading into a NaN-rendering simulation.
      console.assert(
        data
        && Number.isInteger(data.year)
        && Array.isArray(data.nodes)
        && Array.isArray(data.edges)
        && data.tier?.top?.node_ids
        && data.tier?.full?.node_ids,
        `coffee-trade: bad payload shape for ${key}`,
      )
      return data
    })
    // Don't poison the cache on transient failures — let the next call retry.
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return cache.get(key)
}

let colombiaMonthlyPromise = null

export function loadColombiaMonthly() {
  if (!colombiaMonthlyPromise) {
    colombiaMonthlyPromise = fetch('./data/colombia-monthly.json').then(async r => {
      if (!r.ok) throw new Error(`colombia-monthly: ${r.status}`)
      const data = await r.json()
      console.assert(
        Array.isArray(data.months)
          && Array.isArray(data.production)
          && Array.isArray(data.exports)
          && data.months.length === data.production.length
          && data.months.length === data.exports.length,
        'coffee-trade: bad colombia-monthly shape',
      )
      return data
    })
    colombiaMonthlyPromise.catch(() => { colombiaMonthlyPromise = null })
  }
  return colombiaMonthlyPromise
}

let brazilMonthlyPromise = null

export function loadBrazilMonthly() {
  if (!brazilMonthlyPromise) {
    brazilMonthlyPromise = fetch('./data/brazil-monthly.json').then(async r => {
      if (!r.ok) throw new Error(`brazil-monthly: ${r.status}`)
      const data = await r.json()
      const series = ['arabica_natural', 'arabica_diff', 'robusta_medium', 'robusta_diff', 'processed']
      console.assert(
        Array.isArray(data.months)
          && data.months.length > 0
          && typeof data.start_month === 'string'
          && typeof data.end_month === 'string'
          && series.every(k => Array.isArray(data[k]) && data[k].length === data.months.length),
        'coffee-trade: bad brazil-monthly shape',
      )
      return data
    })
    brazilMonthlyPromise.catch(() => { brazilMonthlyPromise = null })
  }
  return brazilMonthlyPromise
}
