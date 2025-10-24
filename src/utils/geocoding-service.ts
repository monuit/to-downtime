/**
 * Geographic Geocoding Service
 * Dynamically geocodes locations from disruption descriptions using OpenStreetMap Nominatim
 */

import type { StationCoordinate } from '../data/ttc-locations'

interface GeocodingCache {
  [key: string]: StationCoordinate | null
}

// In-memory cache to avoid repeated API calls
const geocodingCache: GeocodingCache = {}

// Request queue for rate limiting
const requestQueue: Array<() => Promise<void>> = []
let isProcessingQueue = false
const RATE_LIMIT_DELAY = 1000 // 1 second between requests to respect Nominatim's usage policy
const MAX_CONCURRENT_REQUESTS = 1 // Process one request at a time

/**
 * Process the geocoding request queue with rate limiting
 */
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return
  
  isProcessingQueue = true
  
  while (requestQueue.length > 0) {
    const request = requestQueue.shift()
    if (request) {
      await request()
      // Wait before processing next request
      if (requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY))
      }
    }
  }
  
  isProcessingQueue = false
}

/**
 * Geocode a location string to coordinates using OpenStreetMap Nominatim
 * @param locationString - The location to geocode (e.g., "Bloor Station, Toronto" or "Simcoe and Bay, Toronto")
 * @returns Coordinates or null if not found
 */
export async function geocodeLocation(locationString: string): Promise<StationCoordinate | null> {
  // Check cache first
  const cacheKey = locationString.toLowerCase().trim()
  if (geocodingCache[cacheKey] !== undefined) {
    return geocodingCache[cacheKey]
  }

  // Return a promise that will be resolved when the request is processed
  return new Promise((resolve) => {
    const processRequest = async () => {
      try {
        // Add "Toronto, Ontario, Canada" to improve accuracy
        const searchQuery = locationString.includes('Toronto') 
          ? locationString 
          : `${locationString}, Toronto, Ontario, Canada`

        const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
          q: searchQuery,
          format: 'json',
          limit: '1',
          countrycodes: 'ca', // Canada only
        })

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'TorontoDowntime/1.0', // Nominatim requires User-Agent
          },
        })

        if (!response.ok) {
          geocodingCache[cacheKey] = null
          resolve(null)
          return
        }

        const results = await response.json()
        
        if (results.length === 0) {
          geocodingCache[cacheKey] = null
          resolve(null)
          return
        }

        const result = results[0]
        const coordinates: StationCoordinate = {
          name: result.display_name.split(',')[0], // First part is usually the specific location
          lat: parseFloat(result.lat),
          lon: parseFloat(result.lon),
        }

        // Cache the result
        geocodingCache[cacheKey] = coordinates
        console.log(`✅ Geocoded: "${locationString}" → ${coordinates.lat}, ${coordinates.lon}`)
        
        resolve(coordinates)
      } catch (error) {
        console.error(`Failed to geocode "${locationString}":`, error)
        geocodingCache[cacheKey] = null
        resolve(null)
      }
    }
    
    // Add to queue
    requestQueue.push(processRequest)
    processQueue()
  })
}

/**
 * Extract location queries from disruption title and description
 * Returns array of potential location strings to geocode
 */
export function extractLocationQueries(description: string, type: string, title?: string): string[] {
  const queries: string[] = []
  
  // Combine title and description for better extraction
  const fullText = [title, description].filter(Boolean).join(' ')
  
  // Station pattern (e.g., "Bloor Station", "Union Station")
  const stationMatch = fullText.match(/([\w\s-]+)\s+[Ss]tation/i)
  if (stationMatch) {
    const stationName = stationMatch[1].trim()
    queries.push(`${stationName} Station`)
    // Also try without "Station" for better geocoding
    if (stationName.length > 2) {
      queries.push(`${stationName} TTC Station, Toronto`)
    }
  }
  
  // "Between X and Y" pattern
  const betweenMatch = fullText.match(/between\s+([\w\s]+)\s+and\s+([\w\s]+)/i)
  if (betweenMatch) {
    const loc1 = betweenMatch[1].trim()
    const loc2 = betweenMatch[2].trim()
    // Try both as streets and the midpoint
    queries.push(`${loc1} and ${loc2}, Toronto`)
    queries.push(`${loc1} Street, Toronto`)
    queries.push(`${loc2} Street, Toronto`)
  }
  
  // "At X" pattern  
  const atMatch = fullText.match(/at\s+([\w\s-]+)/i)
  if (atMatch) {
    const location = atMatch[1].trim()
    // Remove common trailing words
    const cleaned = location.replace(/\s+(for|due|during|until|station)\s+.*$/i, '')
    if (cleaned.length > 2) {
      queries.push(`${cleaned}, Toronto`)
      if (type === 'elevator' || type === 'escalator') {
        queries.push(`${cleaned} Station, Toronto`)
        queries.push(`${cleaned} TTC Station, Toronto`)
      }
    }
  }
  
  // Intersection pattern (e.g., "King and Bay", "Yonge & Dundas")
  const intersectionMatch = fullText.match(/([\w\s]+)\s+(?:and|&)\s+([\w\s]+)/i)
  if (intersectionMatch && !betweenMatch) { // Avoid duplicates with betweenMatch
    const street1 = intersectionMatch[1].trim()
    const street2 = intersectionMatch[2].trim()
    queries.push(`${street1} and ${street2}, Toronto`)
  }
  
  // "On X Street" pattern
  const onStreetMatch = fullText.match(/on\s+([\w\s]+)\s+[Ss]treet/i)
  if (onStreetMatch) {
    queries.push(`${onStreetMatch[1].trim()} Street, Toronto`)
  }
  
  // For elevator/escalator, try parsing station name from title (e.g., "🛗 Bloor Station - Elevator")
  if ((type === 'elevator' || type === 'escalator') && title) {
    // Pattern: "emoji Station - description"
    const titleStationMatch = title.match(/[🛗🪜🚇🚊]\s*([\w\s-]+)\s+[Ss]tation/i)
    if (titleStationMatch) {
      const stationName = titleStationMatch[1].trim()
      queries.push(`${stationName} Station, Toronto`)
      queries.push(`${stationName} TTC Station, Toronto`)
    }
  }
  
  return [...new Set(queries)].filter(q => q.length > 0) // Remove duplicates
}

/**
 * Batch geocode multiple locations (with rate limiting)
 * Nominatim has a 1 request/second rate limit
 */
export async function batchGeocode(locationStrings: string[]): Promise<Map<string, StationCoordinate | null>> {
  const results = new Map<string, StationCoordinate | null>()
  
  for (let i = 0; i < locationStrings.length; i++) {
    const location = locationStrings[i]
    
    // Check if already cached
    const cacheKey = location.toLowerCase().trim()
    if (geocodingCache[cacheKey] !== undefined) {
      results.set(location, geocodingCache[cacheKey])
      continue
    }
    
    // Geocode with rate limiting (1 request per second)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    const coords = await geocodeLocation(location)
    results.set(location, coords)
  }
  
  return results
}

/**
 * Clear the geocoding cache (useful for testing or memory management)
 */
export function clearGeocodeCache(): void {
  Object.keys(geocodingCache).forEach(key => delete geocodingCache[key])
  console.log('🗑️ Geocoding cache cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: Object.keys(geocodingCache).length,
    entries: Object.keys(geocodingCache),
  }
}
