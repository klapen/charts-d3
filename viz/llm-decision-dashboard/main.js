import { createStore }  from './modules/store.js';
import { loadDataset }  from './modules/data.js';

const store = createStore({
  data: null,
  filters: {},
  selectedIds: [],
  activePreset: null,
  osiOnly: false,
  scatterAxes: { x: 'pricing_hosted.input_per_mtok_usd', y: 'quality.composite_score',
                 size: 'params.total_b', color: 'license.id' },
});

const $ = id => document.getElementById(id);

bootstrap();

async function bootstrap() {
  try {
    const data = await loadDataset();
    store.set({ data });
    renderSyncStrip(data);
    renderStatLine();
  } catch (err) {
    console.error(err);
    $('sync-stamp').textContent = `Error: ${err.message}`;
    $('stat-line').textContent  = 'Could not load /ai-llm-dataset.json — try opening it directly.';
  }

  store.subscribe(s => s.filters, renderStatLine);
  store.subscribe(s => s.selectedIds, renderStatLine);
}

function renderSyncStrip(data) {
  const when = new Date(data.syncedAt);
  const fmt = when.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  $('sync-stamp').textContent = `⟳ Last synced: ${fmt}`;
  $('sync-sources').textContent = 'sources: ' + Object.keys(data.sources).map(prettySrc).join(' · ');
}

function prettySrc(id) {
  return { hf_leaderboard: 'HF', artificial_analysis: 'Artificial Analysis', lmarena: 'LMArena' }[id] || id;
}

function renderStatLine() {
  const s = store.get();
  if (!s.data) return;
  const total    = s.data.models.length;
  const visible  = total;  // filters wired in Phase 3
  const selected = s.selectedIds.length;
  $('stat-line').textContent = `${total} models · ${visible} visible · ${selected} selected`;
}
