import { createStore } from './modules/store.js';
import { mountModeToggle } from './modules/mode-toggle.js';
import { mountContextSlider } from './modules/context-slider.js';

async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

function boot({ models, gpus, gpuUpdated }) {
  const store = createStore({
    mode: 'model', selectedModelId: null,
    pc: { gpuId: gpus[0].id, gpuCount: 1, ramGb: 32, quant: 'q4' },
    contextTokens: 8192, focusModelId: null, targetRig: 'min', usagePreset: 'daily',
  });
  mountModeToggle(document.getElementById('mode-slot'), store);
  mountContextSlider(document.getElementById('ctx-slot'), store);
  // input/result/money mounts come in later tasks; keep refs for them:
  boot.ctx = { store, models, gpus, gpuUpdated };
}
// Module scripts don't leak top-level names to window; expose boot for
// manual console verification and later-task wiring (see brief Step 4).
window.boot = boot;

(async () => {
  try {
    const [dataset, catalog] = await Promise.all([
      loadJSON('/ai-llm-dataset.json'),
      loadJSON('/gpu-catalog.json'),
    ]);
    boot({ models: dataset.models, gpus: catalog.gpus, gpuUpdated: catalog.updated });
  } catch (e) {
    console.error(e);
    const strip = document.getElementById('error-strip');
    strip.hidden = false;
  }
})();
