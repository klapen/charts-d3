import '../../src/styles/main.css';
import { createStore }  from './modules/store.js';
import { loadDataset }  from './modules/data.js';
import { applyFilters } from './modules/filters.js';
import { PRESETS, getPreset } from './modules/presets.js';
import { mountRankedList } from './modules/ranked-list.js';
import { mountParcoords } from './modules/parcoords.js';
import { mountScatter } from './modules/scatter.js';
import { mountRadar } from './modules/radar.js';
import { mountDetailCards } from './modules/detail-card.js';

const store = createStore({
  data: null,
  filters: {},
  compareSelectedIds: [],   // Dashboard 1: ranked + parcoords + radar
  exploreSelectedIds: [],   // Dashboard 2: scatter + detail cards (independent)
  activeDashboard: 'compare',
  activePreset: null,
  osiOnly: false,
  scatterAxes: { x: 'pricing_hosted.input_per_mtok_usd', y: 'quality.arena_elo',
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
    bindDashTabs();
    mountRankedList(
      document.getElementById('view-ranked'),
      store,
      { filtered, toggleSelection: toggleCompare, isSelected: isCompareSelected, sortByForPreset }
    );
    mountParcoords(
      document.getElementById('view-parcoords'),
      store,
      { filtered, isSelected: isCompareSelected }
    );
    mountRadar(
      document.getElementById('view-radar'),
      store,
      { filtered }
    );
    mountScatter(
      document.getElementById('view-scatter'),
      store,
      { filtered, isSelected: isExploreSelected, toggleSelection: toggleExplore }
    );
    mountDetailCards(
      document.getElementById('detail-cards'),
      store,
      { toggleSelection: toggleExplore }
    );
  } catch (err) {
    console.error(err);
    $('sync-stamp').textContent = `Error: ${err.message}`;
    $('stat-line').textContent  = 'Could not load /ai-llm-dataset.json — try opening it directly.';
    return;
  }

  store.subscribe(s => s.filters,             renderAll);
  store.subscribe(s => s.compareSelectedIds,  renderStatLine);
  store.subscribe(s => s.exploreSelectedIds,  renderStatLine);
  store.subscribe(s => s.osiOnly,             renderAll);
  store.subscribe(s => s.activePreset,        renderPresets);
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

function bindDashTabs() {
  document.querySelectorAll('[data-dash-tab]').forEach(el => {
    el.addEventListener('click', () => setActiveDashboard(el.dataset.dashTab));
  });
}

function setActiveDashboard(name) {
  // Toggle visibility FIRST so containers have non-zero clientWidth before render fires.
  document.querySelectorAll('[data-dash-tab]').forEach(el => {
    const active = el.dataset.dashTab === name;
    el.classList.toggle('on', active);
    el.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('[data-dash-section]').forEach(el => {
    el.hidden = el.dataset.dashSection !== name;
  });
  store.set({ activeDashboard: name });
}

function fifoToggle(arr, id) {
  if (arr.includes(id)) return arr.filter(x => x !== id);
  if (arr.length >= 3) return arr.slice(1).concat(id);
  return arr.concat(id);
}

function toggleCompare(id) {
  store.set({ compareSelectedIds: fifoToggle(store.get().compareSelectedIds, id) });
}
function isCompareSelected(id) { return store.get().compareSelectedIds.includes(id); }

function toggleExplore(id) {
  store.set({ exploreSelectedIds: fifoToggle(store.get().exploreSelectedIds, id) });
}
function isExploreSelected(id) { return store.get().exploreSelectedIds.includes(id); }

function sortByForPreset(presetId) {
  return presetId ? (getPreset(presetId)?.sortBy ?? null) : null;
}

function renderStatLine() {
  const s = store.get();
  if (!s.data) return;
  const total   = s.data.models.length;
  const visible = filtered(s).length;
  const cmp     = s.compareSelectedIds.length;
  const exp     = s.exploreSelectedIds.length;
  $('stat-line').textContent = `${total} models · ${visible} visible · Compare: ${cmp}/3 · Explore: ${exp}/3`;
}
