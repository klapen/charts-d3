// BigCode Models Leaderboard adapter — public CSV from the HF Space.
// 61 rows of coding models with HumanEval (Python) + per-language scores.

export const id = 'bigcode_leaderboard';
export const url = 'https://huggingface.co/spaces/bigcode/bigcode-models-leaderboard/resolve/main/data/code_eval_board.csv';

export async function fetch_() {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`bigcode_leaderboard: HTTP ${res.status}`);
  const csv = await res.text();
  const rows = parseCsv(csv);

  return rows.map(row => ({
    source_model_id: row['Model'] || '',
    fields: {
      // CSV scores are 0–100, schema wants 0–1.
      'quality.coding.humaneval': pctToFraction(row['humaneval-python']),
    },
  })).filter(r => r.source_model_id);
}

export { fetch_ as fetch };

function pctToFraction(v) {
  const n = numOrNull(v);
  return n == null ? null : n / 100;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '' || v === 'N/A') return null;
  const n = Number(String(v).replace(/[,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

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
