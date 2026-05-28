// Artificial Analysis adapter (via fboulnois/llm-leaderboard-csv mirror).
// Pulls latency/throughput/price keyed by model name.

export const id = 'artificial_analysis';
export const url = 'https://raw.githubusercontent.com/fboulnois/llm-leaderboard-csv/main/csv/lmarena.csv';

// The fboulnois mirror updates daily. We pull both csv files and merge:
// - lmarena.csv: Arena Elo (we re-use the data; lmarena.mjs also fetches this)
// - artificial-analysis.csv: latency, throughput, $/Mtok
const ENDPOINT = 'https://raw.githubusercontent.com/fboulnois/llm-leaderboard-csv/main/csv/artificial-analysis.csv';

export async function fetch_() {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`artificial_analysis: HTTP ${res.status}`);
  const csv = await res.text();
  const rows = parseCsv(csv);

  return rows.map(row => ({
    source_model_id: row['Model'] || row['model'] || '',
    fields: {
      'performance.latency_ttft_ms':         numOrNull(row['Latency (TTFT, s)'], v => v * 1000),
      'performance.throughput_tok_s':        numOrNull(row['Throughput (tok/s)']),
      'pricing_hosted.input_per_mtok_usd':   numOrNull(row['Input Price ($/M)']),
      'pricing_hosted.output_per_mtok_usd':  numOrNull(row['Output Price ($/M)']),
    },
  })).filter(r => r.source_model_id);
}

export { fetch_ as fetch };

function numOrNull(v, transform) {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) return null;
  return transform ? transform(n) : n;
}

// Minimal CSV parser — handles quoted fields with commas. NOT full RFC 4180.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
}

function splitCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}
