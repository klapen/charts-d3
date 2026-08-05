const RAM_OPTS = [8,16,32,64,128,256];
export function mountPcForm(el, store, gpus) {
  el.className = 'pc-form';
  el.innerHTML = `
    <label>GPU <select class="pf-gpu">${gpus.map(g =>
      `<option value="${g.id}">${g.name}</option>`).join('')}</select></label>
    <label># GPUs <select class="pf-count">${[1,2,4,8].map(n =>
      `<option>${n}</option>`).join('')}</select></label>
    <label>System RAM <select class="pf-ram">${RAM_OPTS.map(n =>
      `<option value="${n}">${n} GB</option>`).join('')}</select></label>
    <label>quant <select class="pf-quant">
      <option value="q4">q4 (smallest)</option><option value="q8">q8</option><option value="fp16">fp16 (best)</option>
    </select></label>
    <p class="pf-vram hint"></p>`;
  const read = () => {
    const gpuId = el.querySelector('.pf-gpu').value;
    const gpu = gpus.find(g => g.id === gpuId);
    const pc = {
      gpuId,
      gpuCount: +el.querySelector('.pf-count').value,
      ramGb: +el.querySelector('.pf-ram').value,
      quant: el.querySelector('.pf-quant').value,
    };
    store.set({ pc });
    el.querySelector('.pf-vram').textContent = gpu.unified
      ? `≈ ${Math.round(pc.ramGb*0.75)} GB usable (unified memory)`
      : `≈ ${gpu.vram_gb * pc.gpuCount} GB VRAM total`;
  };
  el.addEventListener('change', read);
  // reflect initial store.pc into the controls, then compute once:
  const s = store.get();
  el.querySelector('.pf-gpu').value = s.pc.gpuId;
  el.querySelector('.pf-ram').value = String(s.pc.ramGb);
  read();
}
