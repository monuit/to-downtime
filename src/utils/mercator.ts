/**
 * Mercator Projection Utilities
 * Converts lat/lon → 2D plane coordinates for Toronto-centric map
 */

// Toronto coordinates (center focus)
export const TORONTO_LAT = 43.6535
export const TORONTO_LON = -79.3839

// Map bounds (GTA + surrounding ~250km)
export const MAP_BOUNDS = {
  north: 46.0,
  south: 41.0,
  east: -66.0,
  west: -94.0,
}

// Map plane dimensions
export const MAP_WIDTH = 4096
export const MAP_HEIGHT = 2048

/**
 * Convert lat/lon to Web Mercator projection (0-1 normalized)
 * Standard formula: x = (lon + 180) / 360
 * y = (180 - 180/π * ln(tan(π/4 + lat*π/360))) / 180
 */
export function latLonToMercator(lat: number, lon: number): { x: number; y: number } {
  // Normalize lon to 0-1
  const x = (lon + 180) / 360

  // Mercator projection formula
  const latRad = (lat * Math.PI) / 180
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + latRad / 2))) / 180
  const yNorm = (y + 1) / 2 // Normalize to 0-1

  return { x, y: yNorm }
}

/**
 * Convert normalized Mercator (0-1) to world plane coordinates
 * Centers on Toronto with scale
 */
export function mercatorToPlane(mercX: number, mercY: number): { x: number; y: number } {
  // Toronto in Mercator space
  const torontoMerc = latLonToMercator(TORONTO_LAT, TORONTO_LON)

  // Offset from Toronto center
  const offsetX = (mercX - torontoMerc.x) * MAP_WIDTH * 2
  const offsetY = (mercY - torontoMerc.y) * MAP_HEIGHT * 2

  return { x: offsetX, y: offsetY }
}

/**
 * Direct: lat/lon → plane coordinates
 */
export function latLonToPlane(lat: number, lon: number): { x: number; y: number } {
  const merc = latLonToMercator(lat, lon)
  return mercatorToPlane(merc.x, merc.y)
}

/**
 * Reverse: plane coordinates → lat/lon (for reference)
 */
export function planeToLatLon(x: number, y: number): { lat: number; lon: number } {
  const torontoMerc = latLonToMercator(TORONTO_LAT, TORONTO_LON)

  const mercX = torontoMerc.x + x / (MAP_WIDTH * 2)
  const mercY = torontoMerc.y + y / (MAP_HEIGHT * 2)

  // Inverse Mercator
  const lon = mercX * 360 - 180
  const latRad = 2 * Math.atan(Math.exp((1 - mercY * 2) * Math.PI)) - Math.PI / 2
  const lat = (latRad * 180) / Math.PI

  return { lat, lon }
}

/**
 * Approximate distance in km between two lat/lon points
 * Using Haversine formula
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Generate random lat/lon within radius (km) of center
 */
export function randomPointNearby(
  centerLat: number,
  centerLon: number,
  radiusKm: number
): { lat: number; lon: number } {
  // Rough km to degree conversion (varies with latitude)
  const latOffset = (radiusKm / 111) * (Math.random() - 0.5) * 2
  const lonOffset = (radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180))) * (Math.random() - 0.5) * 2

  return {
    lat: centerLat + latOffset,
    lon: centerLon + lonOffset,
  }
}

/**
 * Generate a grid of Mercator texture UVs for a tile source
 */
export function getMercatorUV(lat: number, lon: number): { u: number; v: number } {
  const { x, y } = latLonToMercator(lat, lon)
  return { u: x, v: 1 - y } // Flip V for texture coordinates
}
