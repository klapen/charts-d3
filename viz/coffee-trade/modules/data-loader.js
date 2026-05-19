const cache = new Map()  // key -> Promise<file>

export async function loadMeta() {
  const r = await fetch('./data/meta.json')
  if (!r.ok) throw new Error(`meta.json: ${r.status}`)
  return r.json()
}

export function loadYear(year, type) {
  const key = `${year}-${type}`
  if (!cache.has(key)) {
    cache.set(key, fetch(`./data/${key}.json`).then(r => {
      if (!r.ok) throw new Error(`${key}: ${r.status}`)
      return r.json()
    }))
  }
  return cache.get(key)
}
