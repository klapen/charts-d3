const KWH_USD = 0.15;
export const USAGE = { hobby: 1, daily: 4, always: 24 };

export function moneyFor(model, rig, usagePreset) {
  const hrsDay = USAGE[usagePreset] ?? USAGE.daily;
  const api = model.pricing_hosted?.input_per_mtok_usd != null
    ? { in: model.pricing_hosted.input_per_mtok_usd, out: model.pricing_hosted.output_per_mtok_usd }
    : null;

  if (rig?.datacenter || !rig?.gpu) {
    return { datacenter: true, buyUsd: null, powerHr: null, powerMo: null, rentHr: null, rentMo: null, api, breakEvenHours: null };
  }

  const { gpu, count, buyUsd } = rig;
  const powerHr = (gpu.watts * count * KWH_USD) / 1000;         // $/hr to run owned rig
  const powerMo = powerHr * hrsDay * 30;
  const rentHr = gpu.rent_usd_hr * count;                        // cloud rental
  const rentMo = rentHr * hrsDay * 30;
  // Own beats renting the rig once upfront cost is amortized past the rental
  // premium over your own power. Null if renting isn't cheaper per hour.
  const breakEvenHours = rentHr > powerHr ? buyUsd / (rentHr - powerHr) : null;

  return { datacenter: false, buyUsd, powerHr, powerMo, rentHr, rentMo, api, breakEvenHours };
}

export const HORIZON_HOURS = 2 * 365 * 24;   // 17520 — fixed 2-year, 24/7 window

// Fixed 2-year @ 24/7 total cost. OWN = upfront + power; RENT = cloud hourly;
// API = generate non-stop at tokPerSec, priced on OUTPUT tokens (an intentional
// worst case — API bills only while generating). Legs are null when N/A.
export function tco2yr(money, tokPerSec, opts = {}) {
  const H = opts.horizonHours ?? HORIZON_HOURS;
  const ownUsd  = money.datacenter ? null : money.buyUsd + money.powerHr * H;
  const rentUsd = money.datacenter ? null : money.rentHr * H;
  const apiUsd  = (money.api && isFinite(money.api.out) && tokPerSec != null && isFinite(tokPerSec))
    ? (tokPerSec * 3600 * H / 1e6) * money.api.out
    : null;
  const legs = { OWN: ownUsd, RENT: rentUsd, API: apiUsd };
  const defined = Object.entries(legs).filter(([, v]) => v != null);
  const cheapest = defined.length ? defined.sort((a, b) => a[1] - b[1])[0][0] : null;
  return { ownUsd, rentUsd, apiUsd, cheapest };
}
