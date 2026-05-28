import { createStore }  from './modules/store.js';
import { loadDataset }  from './modules/data.js';
import { applyFilters } from './modules/filters.js';
import { PRESETS, getPreset } from './modules/presets.js';
import { mountRankedList } from './modules/ranked-list.js';
import { mountParcoords } from './modules/parcoords.js';

const store = createStore({
  data: null,
  filters: {},
  selectedIds: [],
  activePreset: null,
  osiOnly: false,
  scatterAxes: { x: 'pricing_hosted.input_per_mtok_usd', y: 'quality.composite_score',
                 size: 'params.total_b', color: 'license.id' },
});

// Filtered model list, derived from store on demand (cheap for ~50 models).
function filtered(s = store.get()) {
  if (!s.data) return [];
  return applyFilters(s.data.flatModels, s.filters, s.osiOnly);
}

const $ = id => document.getElementById(id);

bootstrap();

async function bootstrap() {
  try {
    const data = await loadDataset();
    store.set({ data });
    renderSyncStrip(data);
    renderPresets();
    bindOsiToggle();
    mountRankedList(
      document.getElementById('view-ranked'),
      store,
      { filtered, toggleSelection, isSelected, sortByForPreset }
    );
    mountParcoords(
      document.getElementById('view-parcoords'),
      store,
      { filtered, isSelected }
    );
  } catch (err) {
    console.error(err);
    $('sync-stamp').textContent = `Error: ${err.message}`;
    $('stat-line').textContent  = 'Could not load /ai-llm-dataset.json — try opening it directly.';
    return;
  }

  store.subscribe(s => s.filters,      renderAll);
  store.subscribe(s => s.selectedIds,  renderStatLine);
  store.subscribe(s => s.osiOnly,      renderAll);
  store.subscribe(s => s.activePreset, renderPresets);
  renderAll();
}

function renderAll() {
  renderStatLine();
  // Views are mounted once in bootstrap; they self-subscribe.
}

function renderSyncStrip(data) {
  const when = new Date(data.syncedAt);
  const fmt  = when.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  $('sync-stamp').textContent = `⟳ Last synced: ${fmt}`;
  $('sync-sources').textContent = 'sources: ' + Object.keys(data.sources).map(prettySrc).join(' · ');
}

function prettySrc(id) {
  return { hf_leaderboard: 'HF', artificial_analysis: 'Artificial Analysis', lmarena: 'LMArena' }[id] || id;
}

function renderPresets() {
  const host = $('presets');
  host.innerHTML = '';
  const active = store.get().activePreset;
  for (const p of PRESETS) {
    const el = document.createElement('button');
    el.className = 'chip' + (active === p.id ? ' on' : '');
    el.textContent = p.label;
    el.dataset.preset = p.id;
    el.setAttribute('aria-pressed', active === p.id ? 'true' : 'false');
    el.addEventListener('click', () => togglePreset(p.id));
    host.appendChild(el);
  }
}

function togglePreset(id) {
  const s = store.get();
  if (s.activePreset === id) {
    store.set({ activePreset: null, filters: {} });
  } else {
    const p = getPreset(id);
    store.set({ activePreset: id, filters: { ...p.filters } });
  }
}

function bindOsiToggle() {
  $('osi-toggle').addEventListener('change', e => {
    store.set({ osiOnly: e.target.checked });
  });
}

function toggleSelection(id) {
  const s = store.get();
  const cur = s.selectedIds;
  let next;
  if (cur.includes(id)) {
    next = cur.filter(x => x !== id);
  } else if (cur.length >= 3) {
    next = cur.slice(1).concat(id);  // FIFO eviction
  } else {
    next = cur.concat(id);
  }
  store.set({ selectedIds: next });
}

function isSelected(id) { return store.get().selectedIds.includes(id); }

function sortByForPreset(presetId) {
  return presetId ? (getPreset(presetId)?.sortBy ?? null) : null;
}

function renderStatLine() {
  const s = store.get();
  if (!s.data) return;
  const total    = s.data.models.length;
  const visible  = filtered(s).length;
  const selected = s.selectedIds.length;
  $('stat-line').textContent = `${total} models · ${visible} visible · ${selected} selected`;
}
