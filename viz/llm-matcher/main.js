async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

function boot({ models, gpus, gpuUpdated }) {
  // Module mounts added in later tasks.
  document.getElementById('result-slot').innerHTML =
    `<p class="hint">Loaded ${models.length} models · ${gpus.length} GPUs.</p>`;
}

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
