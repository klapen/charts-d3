// Named filter snapshots. Add/edit/remove freely.
// Each preset has: id, label, filters, sortBy (used by the ranked list).

export const PRESETS = [
  {
    id: 'laptop',
    label: 'Laptop',
    filters: {
      'vram_estimate_gb.q4': { max: 16 },
      'params.total_b':      { max: 14 },
    },
    sortBy: 'quality.composite_score',
  },
  {
    id: '24gb',
    label: '24GB GPU',
    filters: {
      'vram_estimate_gb.q4': { max: 24 },
    },
    sortBy: 'quality.composite_score',
  },
  {
    id: 'best-coding',
    label: 'Best coding',
    filters: {
      'quality.coding.humaneval': { min: 0.6 },
    },
    sortBy: 'quality.coding.humaneval',
  },
  {
    id: 'cheapest-api',
    label: 'Cheapest API',
    filters: {
      'pricing_hosted.input_per_mtok_usd': { max: 1.0 },
    },
    sortBy: 'quality.composite_score',
  },
  {
    id: 'best-multilingual',
    label: 'Best multilingual',
    filters: {
      'quality.multilingual_score': { min: 0.5 },
    },
    sortBy: 'quality.multilingual_score',
  },
];

export function getPreset(id) { return PRESETS.find(p => p.id === id); }
