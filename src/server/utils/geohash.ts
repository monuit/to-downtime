/**
 * Geohash Implementation
 * 
 * Encodes lat/lng coordinates into a geohash string for spatial indexing
 * without requiring PostGIS or other extensions.
 * 
 * Precision levels:
 * - 5: ±2.4km  (good for city-level)
 * - 6: ±610m   (good for neighborhood)
 * - 7: ±76m    (good for street-level) ← DEFAULT
 * - 8: ±19m    (good for building-level)
 * - 9: ±2.4m   (very precise)
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

/**
 * Encode latitude and longitude into a geohash
 */
export function encode(latitude: number, longitude: number, precision: number = 7): string {
  let idx = 0
  let bit = 0
  let evenBit = true
  let geohash = ''

  let latMin = -90
  let latMax = 90
  let lonMin = -180
  let lonMax = 180

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude
      const lonMid = (lonMin + lonMax) / 2
      if (longitude > lonMid) {
        idx = (idx << 1) + 1
        lonMin = lonMid
      } else {
        idx = idx << 1
        lonMax = lonMid
      }
    } else {
      // latitude
      const latMid = (latMin + latMax) / 2
      if (latitude > latMid) {
        idx = (idx << 1) + 1
        latMin = latMid
      } else {
        idx = idx << 1
        latMax = latMid
      }
    }

    evenBit = !evenBit

    if (++bit === 5) {
      geohash += BASE32[idx]
      bit = 0
      idx = 0
    }
  }

  return geohash
}

/**
 * Decode a geohash into lat/lng bounds
 * Returns { latitude: [min, max], longitude: [min, max] }
 */
export function decode(geohash: string): {
  latitude: [number, number]
  longitude: [number, number]
  lat: number
  lon: number
} {
  let evenBit = true
  let latMin = -90
  let latMax = 90
  let lonMin = -180
  let lonMax = 180

  for (const char of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(char)
    if (idx === -1) throw new Error(`Invalid geohash character: ${char}`)

    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1

      if (evenBit) {
        // longitude
        const lonMid = (lonMin + lonMax) / 2
        if (bitN === 1) {
          lonMin = lonMid
        } else {
          lonMax = lonMid
        }
      } else {
        // latitude
        const latMid = (latMin + latMax) / 2
        if (bitN === 1) {
          latMin = latMid
        } else {
          latMax = latMid
        }
      }

      evenBit = !evenBit
    }
  }

  return {
    latitude: [latMin, latMax],
    longitude: [lonMin, lonMax],
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2,
  }
}

/**
 * Get the 8 neighboring geohashes
 * Used for proximity searches
 */
export function neighbors(geohash: string): string[] {
  const decoded = decode(geohash)
  const lat = decoded.lat
  const lon = decoded.lon
  const precision = geohash.length

  // Calculate approximate cell dimensions
  const latHeight = decoded.latitude[1] - decoded.latitude[0]
  const lonWidth = decoded.longitude[1] - decoded.longitude[0]

  // Generate neighbors by encoding points around the center
  const result: string[] = []
  
  // N, NE, E, SE, S, SW, W, NW
  const offsets = [
    [latHeight, 0],        // N
    [latHeight, lonWidth], // NE
    [0, lonWidth],         // E
    [-latHeight, lonWidth], // SE
    [-latHeight, 0],       // S
    [-latHeight, -lonWidth], // SW
    [0, -lonWidth],        // W
    [latHeight, -lonWidth], // NW
  ]

  for (const [latOffset, lonOffset] of offsets) {
    const neighborHash = encode(lat + latOffset, lon + lonOffset, precision)
    if (neighborHash !== geohash && !result.includes(neighborHash)) {
      result.push(neighborHash)
    }
  }

  return result
}

/**
 * Get geohash and all neighbors for proximity searches
 * Returns array of 9 geohashes (center + 8 neighbors)
 */
export function withNeighbors(latitude: number, longitude: number, precision: number = 7): string[] {
  const center = encode(latitude, longitude, precision)
  const neighbor = neighbors(center)
  return [center, ...neighbor]
}

/**
 * Extract center point from a GeoJSON geometry
 * Supports Point, LineString, and Polygon
 */
export function extractCenterFromGeometry(geometry: any): { lat: number; lon: number } | null {
  if (!geometry || !geometry.type) return null

  switch (geometry.type) {
    case 'Point':
      return { lon: geometry.coordinates[0], lat: geometry.coordinates[1] }

    case 'LineString':
      // Use midpoint of line
      const coords = geometry.coordinates
      if (!coords || coords.length === 0) return null
      const midIdx = Math.floor(coords.length / 2)
      return { lon: coords[midIdx][0], lat: coords[midIdx][1] }

    case 'MultiLineString':
      // Use first line's midpoint
      const firstLine = geometry.coordinates[0]
      if (!firstLine || firstLine.length === 0) return null
      const mid = Math.floor(firstLine.length / 2)
      return { lon: firstLine[mid][0], lat: firstLine[mid][1] }

    case 'Polygon':
      // Calculate centroid of outer ring
      const ring = geometry.coordinates[0]
      if (!ring || ring.length === 0) return null
      
      let sumLat = 0
      let sumLon = 0
      for (const [lon, lat] of ring) {
        sumLon += lon
        sumLat += lat
      }
      return { lon: sumLon / ring.length, lat: sumLat / ring.length }

    default:
      return null
  }
}
