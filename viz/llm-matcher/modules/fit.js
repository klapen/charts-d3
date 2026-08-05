export const BYTES_PER_PARAM = { q4: 0.5, q8: 1.0, fp16: 2.0 };

// KV cache grows with context; rate (GB per 1K tokens, fp16) is bucketed by the
// model's attention scale (active params for MoE, total for dense). Coarse — a
// tier-level estimate, not exact. See spec §3.1.
export function kvCacheGb(model, ctxTokens) {
  const scaleB = model.params.is_moe ? model.params.active_b : model.params.total_b;
  const ratePer1k = scaleB <= 8 ? 0.06 : scaleB <= 34 ? 0.13 : scaleB <= 80 ? 0.24 : 0.40;
  return (ctxTokens / 1000) * ratePer1k;
}

// Weights+overhead come from the dataset (agrees with the showcase at short ctx);
// KV cache is added on top. See spec §3.1.
export function neededGb(model, quant, ctxTokens) {
  const weights = model.vram_estimate_gb[quant];
  return weights + kvCacheGb(model, ctxTokens);
}

export function availVram(pc, gpu) {
  if (gpu.unified) return pc.ramGb * 0.75;      // Apple: unified memory, ~75% usable
  return gpu.vram_gb * pc.gpuCount;
}

export function availTotal(pc, gpu) {
  // On unified memory the RAM IS the GPU pool, so CPU offload adds nothing.
  return gpu.unified ? availVram(pc, gpu) : availVram(pc, gpu) + pc.ramGb;
}

// Cheapest rig (by total buy price) whose VRAM clears `need`. Single GPU first,
// then N of the cheapest adequate card (cap 8), else data center.
export function smallestRigThatFits(need, gpus) {
  const singles = gpus
    .filter(g => !g.unified && g.vram_gb >= need)
    .sort((a, b) => a.buy_usd - b.buy_usd);
  if (singles.length) {
    const gpu = singles[0];
    return { gpu, count: 1, totalVram: gpu.vram_gb, buyUsd: gpu.buy_usd };
  }
  const multi = gpus
    .filter(g => !g.unified)
    .map(g => ({ gpu: g, count: Math.ceil(need / g.vram_gb) }))
    .filter(r => r.count <= 8)
    .map(r => ({ ...r, totalVram: r.gpu.vram_gb * r.count, buyUsd: r.gpu.buy_usd * r.count }))
    .sort((a, b) => a.buyUsd - b.buyUsd);
  return multi.length ? multi[0] : { datacenter: true };
}

export function minOptimal(model, gpus, ctxTokens) {
  const minNeed = neededGb(model, 'q4', ctxTokens);
  const optQuant = model.params.total_b <= 13 ? 'fp16' : 'q8';
  const optNeed = neededGb(model, optQuant, ctxTokens) * 1.2;   // headroom
  return {
    min:     { quant: 'q4',     neededGb: minNeed, rig: smallestRigThatFits(minNeed, gpus) },
    optimal: { quant: optQuant, neededGb: optNeed, rig: smallestRigThatFits(optNeed, gpus) },
  };
}

// Bucket a model against a specific PC at the user's chosen quant. See spec §3.3.
export function classify(model, pc, gpu, ctxTokens, gpus) {
  const quant = pc.quant || 'q4';
  const vram = availVram(pc, gpu);
  const total = availTotal(pc, gpu);
  const need = neededGb(model, quant, ctxTokens);
  if (need <= vram) return { bucket: 'runs' };

  if (quant !== 'q4' && neededGb(model, 'q4', ctxTokens) <= vram)
    return { bucket: 'almost', fix: 'drop to q4' };
  if (need <= total)
    return { bucket: 'almost', fix: 'runs but slow — CPU offload' };
  if (need <= vram * 1.15)
    return { bucket: 'almost', fix: `needs ~${Math.ceil(need - vram)} GB more VRAM` };

  const rig = smallestRigThatFits(neededGb(model, 'q4', ctxTokens), gpus);
  return { bucket: 'buy', rig };
}
