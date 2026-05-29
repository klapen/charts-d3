// LMArena adapter — uses fboulnois mirror's lmarena_text.csv for broad coverage.
// Originally targeted oolong-tea-2026/arena-ai-leaderboards (top-20 only); fboulnois
// publishes ~200 rows daily-updated which gives us coverage for more open-weight models.

export const id = 'lmarena';
export const url = 'https://raw.githubusercontent.com/fboulnois/llm-leaderboard-csv/main/csv/lmarena_text.csv';

const ENDPOINT = url;

export async function fetch_() {
  const res = await fetch(ENDPOINT);
  if (!res.ok) throw new Error(`lmarena: HTTP ${res.status}`);
  const csv = await res.text();
  const rows = parseCsv(csv);

  return rows.map(row => ({
    source_model_id: row['Model'] || row['model'] || row['name'] || '',
    fields: {
      'quality.arena_elo': numOrNull(row['arena_score'] ?? row['Arena Score'] ?? row['Score'] ?? row['Elo'] ?? row['arena_elo']),
    },
  })).filter(r => r.source_model_id);
}

export { fetch_ as fetch };

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
