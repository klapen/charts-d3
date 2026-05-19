import * as d3 from 'd3'

// Natural Earth projection fitted to the chart viewBox. Returns a function
// that maps a country meta entry (with lon/lat) to [x, y] in chart space.
export function createProjection({ w, h, padding = 20 }) {
  const projection = d3.geoNaturalEarth1()
    .fitExtent([[padding, padding], [w - padding, h - padding]], { type: 'Sphere' })

  return function project(country) {
    if (!country || country.lon == null || country.lat == null) return null
    return projection([country.lon, country.lat])
  }
}
