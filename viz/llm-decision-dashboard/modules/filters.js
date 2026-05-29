// Filter shapes:
//   { min, max }       — numeric range; null on either end = unbounded
//   { eq: value }      — equality
//   { values: [...] }  — IN
// All filters AND together.

export function applyFilters(flatModels, filters, osiOnly) {
  return flatModels.filter(m => {
    if (osiOnly && m['license.osi_approved'] !== true) return false;
    for (const [path, spec] of Object.entries(filters || {})) {
      const v = m[path];
      if (!matches(v, spec)) return false;
    }
    return true;
  });
}

function matches(v, spec) {
  if (spec == null) return true;
  if ('eq' in spec) return v === spec.eq;
  if ('values' in spec) return spec.values.includes(v);
  if ('min' in spec || 'max' in spec) {
    if (v === null || v === undefined) return false;
    if (spec.min != null && v < spec.min) return false;
    if (spec.max != null && v > spec.max) return false;
    return true;
  }
  return true;
}
