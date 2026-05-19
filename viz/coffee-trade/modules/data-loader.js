const cache = new Map()  // key -> Promise<file>

export async function loadMeta() {
  const r = await fetch('./data/meta.json')
  if (!r.ok) throw new Error(`meta.json: ${r.status}`)
  return r.json()
}

export function loadYear(year, type) {
  const key = `${year}-${type}`
  if (!cache.has(key)) {
    const p = fetch(`./data/${key}.json`).then(r => {
      if (!r.ok) throw new Error(`${key}: ${r.status}`)
      return r.json()
    })
    // Don't poison the cache on transient failures — let the next call retry.
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return cache.get(key)
}
