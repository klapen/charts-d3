// Loads /ai-llm-dataset.json and produces:
//   - models (original nested shape, used by detail cards)
//   - flatModels (flat key paths like "quality.coding.humaneval" -> value, used by views)
//   - dimensions, sources, syncedAt (metadata)

const DATASET_URL = '/ai-llm-dataset.json';

export async function loadDataset() {
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`Failed to load dataset: HTTP ${res.status}`);
  const json = await res.json();

  const flatModels = json.models.map(m => {
    const flat = { __raw: m, model_id: m.model_id, name: m.name, family: m.family, vendor: m.vendor };
    walk(m, [], (path, value) => {
      if (path.length === 0) return;
      flat[path.join('.')] = value;
    });
    return flat;
  });

  return {
    models:      json.models,
    flatModels,
    dimensions:  json.dimensions,
    sources:     json.sources,
    syncedAt:    json.synced_at,
  };
}

// Walk an object tree, calling cb on every leaf path.
function walk(node, path, cb) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    cb(path, node);
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path.concat(k), cb);
    return;
  }
  cb(path, node);
}
