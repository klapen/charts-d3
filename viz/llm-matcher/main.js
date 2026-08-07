import { createStore } from './modules/store.js';
import { mountModeToggle } from './modules/mode-toggle.js';
import { mountContextSlider } from './modules/context-slider.js';
import { mountModelPicker } from './modules/model-picker.js';
import { mountResultModel } from './modules/result-model.js';
import { mountPcForm } from './modules/pc-form.js';
import { mountResultPc } from './modules/result-pc.js';
import { mountMoneyPanel } from './modules/money-panel.js';

async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

function boot({ models, gpus, gpuUpdated, datasetSynced }) {
  const store = createStore({
    mode: 'model', selectedModelId: null,
    pc: { gpuId: gpus[0].id, gpuCount: 1, ramGb: 32, quant: 'q4' },
    contextTokens: 8192, focusModelId: null, targetRig: 'min', usagePreset: 'daily',
  });
  mountModeToggle(document.getElementById('mode-slot'), store);
  mountContextSlider(document.getElementById('ctx-slot'), store);
  const inputSlot = document.getElementById('input-slot');
  const resultSlot = document.getElementById('result-slot');

  // Per-mode child containers: model-first pair (#in-model/#res-model) and
  // pc-first pair (#in-pc/#res-pc) both mount up front; visibility toggles
  // with `mode` below so each module's own store.subscribe keeps working.
  inputSlot.innerHTML = `<div id="in-model"></div><div id="in-pc"></div>`;
  resultSlot.innerHTML = `<div id="res-model"></div><div id="res-pc"></div>`;
  const inModel = document.getElementById('in-model');
  const inPc = document.getElementById('in-pc');
  const resModel = document.getElementById('res-model');
  const resPc = document.getElementById('res-pc');

  mountModelPicker(inModel, store, models);
  mountPcForm(inPc, store, gpus);
  mountResultModel(resModel, store, models, gpus);
  mountResultPc(resPc, store, models, gpus);
  mountMoneyPanel(document.getElementById('money-slot'), store, models, gpus, { gpuUpdated, datasetSynced });

  store.subscribe(s => {
    const isModel = s.mode === 'model';
    inModel.hidden = !isModel;
    resModel.hidden = !isModel;
    inPc.hidden = isModel;
    resPc.hidden = isModel;
  });

  // Module scripts don't leak top-level names to window; expose boot for
  // manual console verification only in dev — dropped from the production
  // bundle (see brief Step 4).
  if (import.meta.env.DEV) {
    window.boot = boot;
    boot.ctx = { store, models, gpus, gpuUpdated };
  }
}

(async () => {
  try {
    const [dataset, catalog] = await Promise.all([
      loadJSON('/ai-llm-dataset.json'),
      loadJSON('/gpu-catalog.json'),
    ]);
    boot({ models: dataset.models, gpus: catalog.gpus, gpuUpdated: catalog.updated, datasetSynced: dataset.synced_at });
  } catch (e) {
    console.error(e);
    const strip = document.getElementById('error-strip');
    strip.hidden = false;
  }
})();
