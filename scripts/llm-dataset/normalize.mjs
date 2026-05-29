// Joins ground-truth models with source rows, computes derived fields,
// produces the final dataset object that gets written to JSON.
//
// Conflict precedence: models.yaml (applied first into `base`) beats all sources;
// among sources, iteration order in sync.mjs's SOURCES array decides (first wins).
// Currently: hf_leaderboard > artificial_analysis > lmarena.

/**
 * @param {{models: Array, licenses: Object}} ground
 * @param {Array<{id: string, rows: Array<{source_model_id, fields}>, syncedAt: string, recordCount: number, error?: string}>} sourceResults
 * @returns {{dataset: Object, report: Object}}
 */
export function normalize(ground, sourceResults) {
  const conflicts = [];
  const sourcesMeta = {};

  for (const sr of sourceResults) {
    sourcesMeta[sr.id] = {
      url: sr.url,
      synced_at: sr.syncedAt,
      record_count: sr.recordCount,
      error: sr.error || undefined,
    };
  }

  const models = ground.models.map(g => {
    const license = ground.licenses[g.license] || {
      name: g.license, osi_approved: false, url: null,
    };
    const base = {
      model_id: g.model_id,
      name: g.name,
      family: g.family,
      vendor: g.vendor,
      release_date: g.release_date,
      license: { id: g.license, name: license.name, osi_approved: license.osi_approved, url: license.url },
      params: g.params,
      context_window: g.context_window,
      modalities: g.modalities || { input: ['text'], output: ['text'] },
      vram_estimate_gb: estimateVram(g.params.total_b),
      quality: { arena_elo: null, composite_score: null,
                 reasoning: { gpqa: null, mmlu_pro: null },
                 coding: { humaneval: null, livecodebench: null, swe_bench: null },
                 multilingual_score: null },
      performance: { latency_ttft_ms: null, throughput_tok_s: null },
      pricing_hosted: { input_per_mtok_usd: null, output_per_mtok_usd: null, provider_count: null },
      model_card_url: g.model_card_url,
      sources_used: [],
      missing_fields: [],
    };

    // Enrich from each source by precedence order.
    for (const sr of sourceResults) {
      if (sr.error) continue;
      const match = matchSourceRow(g, sr.rows);
      if (!match) continue;
      base.sources_used.push(sr.id);
      for (const [path, value] of Object.entries(match.fields)) {
        if (value === null || value === undefined) continue;
        const current = getPath(base, path);
        if (current === null || current === undefined) {
          setPath(base, path, value);
        } else if (current !== value) {
          conflicts.push({ model: g.model_id, path, kept: current, rejected: value, rejected_from: sr.id });
        }
      }
    }

    base.quality.composite_score = compositeScore(base);
    base.missing_fields = scanMissing(base);
    return base;
  });

  const dataset = {
    schema_version: '1.0.0',
    synced_at: new Date().toISOString(),
    sources: sourcesMeta,
    dimensions: dimensionsManifest(),
    models,
  };

  const report = {
    sourceResults,
    conflicts,
    model_count: models.length,
    missing_field_avg: avg(models.map(m => m.missing_fields.length)),
  };

  return { dataset, report };
}

// VRAM estimate in GB at q4, q8, fp16. Overhead 1.2× for KV cache + activations.
function estimateVram(totalB) {
  if (!totalB) return { q4: null, q8: null, fp16: null };
  const factor = 1.2;
  return {
    q4:   round1(totalB * 0.5 * factor),   // 4 bits = 0.5 byte/param
    q8:   round1(totalB * 1.0 * factor),
    fp16: round1(totalB * 2.0 * factor),
  };
}

const round1 = n => Math.round(n * 10) / 10;

// Match a source row to a ground-truth entry by longest-alias-wins.
function matchSourceRow(ground, rows) {
  const aliases = (ground.aliases || []).concat([ground.model_id, ground.name]).map(a => a.toLowerCase());
  let best = null; let bestLen = 0;
  for (const r of rows) {
    const sid = (r.source_model_id || '').toLowerCase();
    if (!sid) continue;
    for (const a of aliases) {
      if (sid === a || sid.includes(a)) {
        if (a.length > bestLen) { best = r; bestLen = a.length; }
      }
    }
  }
  return best;
}

function compositeScore(m) {
  // Direction-aware mean of normalized arena_elo, GPQA, MMLU-Pro, HumanEval.
  const ARENA_MIN = 1000, ARENA_MAX = 1400;  // typical Elo range
  const parts = [
    norm(m.quality.arena_elo,        ARENA_MIN, ARENA_MAX),
    m.quality.reasoning.gpqa,
    m.quality.reasoning.mmlu_pro,
    m.quality.coding.humaneval,
  ];
  const present = parts.filter(v => v !== null && v !== undefined);
  if (present.length < 2) return null;  // >50% missing
  return round1(present.reduce((a, b) => a + b, 0) / present.length * 100) / 100;
}

function norm(v, lo, hi) {
  if (v === null || v === undefined) return null;
  return Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
}

function scanMissing(m) {
  const watch = [
    'quality.arena_elo', 'quality.reasoning.gpqa', 'quality.reasoning.mmlu_pro',
    'quality.coding.humaneval', 'quality.coding.livecodebench', 'quality.coding.swe_bench',
    'quality.multilingual_score',
    'performance.latency_ttft_ms', 'performance.throughput_tok_s',
    'pricing_hosted.input_per_mtok_usd', 'pricing_hosted.output_per_mtok_usd',
  ];
  return watch.filter(p => {
    const v = getPath(m, p);
    return v === null || v === undefined;
  });
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10;
}

function dimensionsManifest() {
  return {
    'quality.arena_elo':                   { label: 'Arena Elo',           unit: null,      direction: 'higher_better', source: 'lmarena' },
    'quality.composite_score':             { label: 'Composite',           unit: null,      direction: 'higher_better', source: 'derived' },
    'quality.reasoning.gpqa':              { label: 'GPQA',                unit: null,      direction: 'higher_better', source: 'hf_leaderboard' },
    'quality.reasoning.mmlu_pro':          { label: 'MMLU-Pro',            unit: null,      direction: 'higher_better', source: 'hf_leaderboard' },
    'quality.coding.humaneval':            { label: 'HumanEval',           unit: null,      direction: 'higher_better', source: 'bigcode_leaderboard' },
    'quality.coding.livecodebench':        { label: 'LiveCodeBench',       unit: null,      direction: 'higher_better', source: 'hf_leaderboard' },
    'quality.coding.swe_bench':            { label: 'SWE-bench',           unit: null,      direction: 'higher_better', source: 'hf_leaderboard' },
    'quality.multilingual_score':          { label: 'Multilingual',        unit: null,      direction: 'higher_better', source: 'hf_leaderboard' },
    'performance.latency_ttft_ms':         { label: 'Latency (TTFT)',      unit: 'ms',      direction: 'lower_better',  source: 'artificial_analysis' },
    'performance.throughput_tok_s':        { label: 'Throughput',          unit: 'tok/s',   direction: 'higher_better', source: 'artificial_analysis' },
    'pricing_hosted.input_per_mtok_usd':   { label: '$/M in',              unit: 'USD',     direction: 'lower_better',  source: 'artificial_analysis' },
    'pricing_hosted.output_per_mtok_usd':  { label: '$/M out',             unit: 'USD',     direction: 'lower_better',  source: 'artificial_analysis' },
    'context_window':                      { label: 'Context',             unit: 'tokens',  direction: 'higher_better', source: 'models_yaml' },
    'vram_estimate_gb.q4':                 { label: 'VRAM @ q4',           unit: 'GB',      direction: 'lower_better',  source: 'derived' },
    'vram_estimate_gb.q8':                 { label: 'VRAM @ q8',           unit: 'GB',      direction: 'lower_better',  source: 'derived' },
    'vram_estimate_gb.fp16':               { label: 'VRAM @ fp16',         unit: 'GB',      direction: 'lower_better',  source: 'derived' },
    'params.total_b':                      { label: 'Params (total)',      unit: 'B',       direction: 'informational', source: 'models_yaml' },
    'params.active_b':                     { label: 'Params (active)',     unit: 'B',       direction: 'informational', source: 'models_yaml' },
  };
}
