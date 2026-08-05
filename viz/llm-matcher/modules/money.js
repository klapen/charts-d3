const KWH_USD = 0.15;
export const USAGE = { hobby: 1, daily: 4, always: 24 };

export function moneyFor(model, rig, usagePreset) {
  const hrsDay = USAGE[usagePreset] ?? USAGE.daily;
  const api = model.pricing_hosted?.input_per_mtok_usd != null
    ? { in: model.pricing_hosted.input_per_mtok_usd, out: model.pricing_hosted.output_per_mtok_usd }
    : null;

  if (rig?.datacenter || !rig?.gpu) {
    return { datacenter: true, buyUsd: null, powerMo: null, rentHr: null, rentMo: null, api, breakEvenHours: null };
  }

  const { gpu, count, buyUsd } = rig;
  const powerHr = (gpu.watts * count * KWH_USD) / 1000;         // $/hr to run owned rig
  const powerMo = powerHr * hrsDay * 30;
  const rentHr = gpu.rent_usd_hr * count;                        // cloud rental
  const rentMo = rentHr * hrsDay * 30;
  // Own beats renting the rig once upfront cost is amortized past the rental
  // premium over your own power. Null if renting isn't cheaper per hour.
  const breakEvenHours = rentHr > powerHr ? buyUsd / (rentHr - powerHr) : null;

  return { datacenter: false, buyUsd, powerMo, rentHr, rentMo, api, breakEvenHours };
}
