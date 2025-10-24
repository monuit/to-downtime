/**
 * Disruption Coordinate Mapper
 * Maps disruptions to geographic coordinates for map visualization
 */

import type { Disruption } from '../store/disruptions'
import {
  getStationsForLine,
  getPrimaryStationForLine,
  findStationByName,
  DOWNTOWN_TORONTO,
  type StationCoordinate,
} from '../data/ttc-locations'
import { geocodeLocation, extractLocationQueries } from './geocoding-service'

export interface DisruptionCoordinate {
  lat: number
  lon: number
  source: 'line' | 'description' | 'static' | 'geocoded' | 'fallback' | 'database' // How we determined the coordinate
  stationName?: string
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return null
}

interface CachedCoordinate {
  coordinate: DisruptionCoordinate | null
  freshnessKey?: number
}

const coordinateCache = new Map<string, CachedCoordinate>()
const MAX_DYNAMIC_GEOCODE_ATTEMPTS = 40
let remainingGeocodeAttempts = MAX_DYNAMIC_GEOCODE_ATTEMPTS

const getCacheKey = (disruption: Disruption): string | undefined => {
  return disruption.id || disruption.title || disruption.description
}

const getFreshnessKey = (disruption: Disruption): number | undefined => {
  return disruption.lastFetchedAt ?? disruption.timestamp
}

/**
 * Parse location information from disruption description
 * Looks for station names, intersections, or landmarks
 */
function parseLocationFromDescription(description: string): StationCoordinate | null {
  if (!description) return null
  
  const descLower = description.toLowerCase()
  
  // Common station name patterns
  const stationPatterns = [
    /at ([\w\s]+) station/i,
    /near ([\w\s]+) station/i,
    /([\w\s]+) station/i,
    /between ([\w\s]+) and/i,
    /from ([\w\s]+) to/i,
  ]
  
  for (const pattern of stationPatterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      const stationName = match[1].trim()
      const station = findStationByName(stationName)
      if (station) {
        return station
      }
    }
  }
  
  // Intersection patterns (e.g., "Dundas and Spadina", "King & Yonge")
  const intersectionPattern = /([\w\s]+)\s+(?:and|&)\s+([\w\s]+)/i
  const intersectionMatch = description.match(intersectionPattern)
  if (intersectionMatch) {
    const street1 = intersectionMatch[1].trim().toLowerCase()
    const street2 = intersectionMatch[2].trim().toLowerCase()
    
    // Try to find this intersection in our station database
    const searchTerm = `${street1} & ${street2}`
    const station = findStationByName(searchTerm)
    if (station) {
      return station
    }
    
    // Known downtown Toronto street intersections (for road disruptions)
    const knownIntersections: Record<string, StationCoordinate> = {
      'simcoe & bay': { name: 'Simcoe & Bay', lat: 43.6467, lon: -79.3863 },
      'bay & simcoe': { name: 'Bay & Simcoe', lat: 43.6467, lon: -79.3863 },
      'yonge & dundas': { name: 'Yonge & Dundas', lat: 43.6561, lon: -79.3802 },
      'yonge & bloor': { name: 'Yonge & Bloor', lat: 43.6708, lon: -79.3863 },
      'king & bay': { name: 'King & Bay', lat: 43.6487, lon: -79.3808 },
      'queen & bay': { name: 'Queen & Bay', lat: 43.6522, lon: -79.3806 },
      'king & yonge': { name: 'King & Yonge', lat: 43.6487, lon: -79.3772 },
      'queen & yonge': { name: 'Queen & Yonge', lat: 43.6532, lon: -79.3790 },
      'dundas & university': { name: 'Dundas & University', lat: 43.6555, lon: -79.3871 },
      'college & yonge': { name: 'College & Yonge', lat: 43.6613, lon: -79.3832 },
    }
    
    const key = `${street1} & ${street2}`
    if (knownIntersections[key]) {
      return knownIntersections[key]
    }
  }
  
  // "between X and Y" pattern for road disruptions
  const betweenMatch = description.match(/between\s+([\w\s]+)\s+and\s+([\w\s]+)/i)
  if (betweenMatch) {
    const loc1 = betweenMatch[1].trim().toLowerCase()
    const loc2 = betweenMatch[2].trim().toLowerCase()
    
    // Known street segments in downtown Toronto
    const knownSegments: Record<string, StationCoordinate> = {
      'simcoe & bay': { name: 'Between Simcoe & Bay', lat: 43.6467, lon: -79.3863 },
      'bay & yonge': { name: 'Between Bay & Yonge', lat: 43.6487, lon: -79.3790 },
      'university & yonge': { name: 'Between University & Yonge', lat: 43.6555, lon: -79.3836 },
    }
    
    const key = `${loc1} & ${loc2}`
    if (knownSegments[key]) {
      return knownSegments[key]
    }
  }
  
  return null
}

/**
 * Get geographic coordinates for a disruption
 * Strategy:
 * 1. Use affectedLines to get station coordinates
 * 2. Parse description for location hints (static known locations)
 * 3. Use dynamic geocoding service (OpenStreetMap Nominatim)
 * 4. Use downtown Toronto as fallback
 */
export async function getDisruptionCoordinates(disruption: Disruption): Promise<DisruptionCoordinate | null> {
  const cacheKey = getCacheKey(disruption)
  const freshnessKey = getFreshnessKey(disruption)

  if (cacheKey) {
    const cached = coordinateCache.get(cacheKey)
    if (cached) {
      if (cached.freshnessKey === freshnessKey) {
        return cached.coordinate
      }
      // Data was refreshed, drop the stale entry so we recompute
      coordinateCache.delete(cacheKey)
    }
  }

  const storeCoordinate = (coordinate: DisruptionCoordinate | null): DisruptionCoordinate | null => {
    if (cacheKey) {
      coordinateCache.set(cacheKey, { coordinate, freshnessKey })
    }
    return coordinate
  }

  const stationHint = disruption.geocodedName || disruption.addressFull

  // Strategy 0: Use coordinates already provided by the API/database
  const directCoords = disruption.coordinates
  if (directCoords) {
    const lat = toNumber(directCoords.lat)
    const lon = toNumber((directCoords as any).lon ?? directCoords.lng)

    if (lat !== null && lon !== null) {
      return storeCoordinate({
        lat,
        lon,
        source: 'database',
        stationName: stationHint,
      })
    }
  }

  const coordLat = toNumber(disruption.coordinatesLat)
  const coordLon = toNumber(disruption.coordinatesLng)
  if (coordLat !== null && coordLon !== null) {
    return storeCoordinate({
      lat: coordLat,
      lon: coordLon,
      source: 'database',
      stationName: stationHint,
    })
  }

  const geoLat = toNumber(disruption.geocodedLat)
  const geoLon = toNumber(disruption.geocodedLon)
  if (geoLat !== null && geoLon !== null) {
    return storeCoordinate({
      lat: geoLat,
      lon: geoLon,
      source: 'geocoded',
      stationName: disruption.geocodedName || stationHint,
    })
  }

  // Strategy 1: Use affectedLines
  if (disruption.affectedLines && disruption.affectedLines.length > 0) {
    const primaryLine = disruption.affectedLines[0]
    const primaryStation = getPrimaryStationForLine(primaryLine)
    
    if (primaryStation) {
      return storeCoordinate({
        lat: primaryStation.lat,
        lon: primaryStation.lon,
        source: 'line',
        stationName: primaryStation.name,
      })
    }
  }
  
  // Strategy 2: Parse description for static known locations
  const parsedLocation = parseLocationFromDescription(
    disruption.description || disruption.title
  )
  
  if (parsedLocation) {
    return storeCoordinate({
      lat: parsedLocation.lat,
      lon: parsedLocation.lon,
      source: 'static',
      stationName: parsedLocation.name,
    })
  }
  
  // Strategy 3: Dynamic geocoding
  if (remainingGeocodeAttempts > 0) {
    const locationQueries = extractLocationQueries(
      disruption.description || '',
      disruption.type,
      disruption.title // Pass title for better extraction
    )

    for (const query of locationQueries) {
      if (remainingGeocodeAttempts <= 0) break

      try {
        remainingGeocodeAttempts -= 1
        const geocoded = await geocodeLocation(query)
        if (geocoded) {
          return storeCoordinate({
            lat: geocoded.lat,
            lon: geocoded.lon,
            source: 'geocoded',
            stationName: geocoded.name,
          })
        }
      } catch (error) {
        console.warn(`Geocoding failed for "${query}":`, error)
      }
    }
  }
  
  // Strategy 4: Fallback to downtown Toronto
  // For transit types (subway/streetcar/bus) and road disruptions
  if (['subway', 'streetcar', 'bus', 'road'].includes(disruption.type)) {
    return storeCoordinate({
      lat: DOWNTOWN_TORONTO.lat,
      lon: DOWNTOWN_TORONTO.lon,
      source: 'fallback',
      stationName: 'Downtown Toronto',
    })
  }
  
  // No location available
  return storeCoordinate(null)
}

/**
 * Get coordinates for multiple disruptions
 * Filters out disruptions without valid coordinates
 */
export async function getDisruptionsWithCoordinates(
  disruptions: Disruption[]
): Promise<Array<Disruption & { coordinates: DisruptionCoordinate }>> {
  const results = await Promise.all(
    disruptions.map(async (disruption) => {
      const coordinates = await getDisruptionCoordinates(disruption)
      if (!coordinates) return null
      
      return {
        ...disruption,
        coordinates,
      }
    })
  )
  
  return results.filter((d): d is Disruption & { coordinates: DisruptionCoordinate } => d !== null)
}

/**
 * Calculate center point for multiple disruptions (for map centering)
 */
export function getDisruptionsCenter(
  disruptions: Array<{ coordinates: DisruptionCoordinate }>
): { lat: number; lon: number } {
  if (disruptions.length === 0) {
    return DOWNTOWN_TORONTO
  }
  
  const avgLat = disruptions.reduce((sum, d) => sum + d.coordinates.lat, 0) / disruptions.length
  const avgLon = disruptions.reduce((sum, d) => sum + d.coordinates.lon, 0) / disruptions.length
  
  return { lat: avgLat, lon: avgLon }
}

/**
 * Group disruptions by proximity (for clustering)
 * Returns disruptions grouped by location (within ~500m)
 */
export function groupDisruptionsByProximity(
  disruptions: Array<Disruption & { coordinates: DisruptionCoordinate }>,
  thresholdKm: number = 0.5
): Array<Array<Disruption & { coordinates: DisruptionCoordinate }>> {
  const groups: Array<Array<Disruption & { coordinates: DisruptionCoordinate }>> = []
  const visited = new Set<string>()
  
  disruptions.forEach((disruption) => {
    if (visited.has(disruption.id)) return
    
    const group: Array<Disruption & { coordinates: DisruptionCoordinate }> = [disruption]
    visited.add(disruption.id)
    
    // Find nearby disruptions
    disruptions.forEach((other) => {
      if (visited.has(other.id)) return
      
      const distance = getDistance(
        disruption.coordinates.lat,
        disruption.coordinates.lon,
        other.coordinates.lat,
        other.coordinates.lon
      )
      
      if (distance <= thresholdKm) {
        group.push(other)
        visited.add(other.id)
      }
    })
    
    groups.push(group)
  })
  
  return groups
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}
