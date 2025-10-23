import https from 'https'

/**
 * ETL Module for Toronto Transit Disruptions Data
 * Fetches from Toronto Open Data CKAN API and GTFS-RT feeds
 */

export interface RawDisruptionData {
  id: string
  type: string
  severity: string
  title: string
  description: string
  affectedLines?: string[]
  timestamp: number
}

// Package IDs from Toronto Open Data portal
const GTFS_RT_PACKAGE_ID = '9ab4c9af-652f-4a84-abac-afcf40aae882'
const ROAD_RESTRICTIONS_PACKAGE_ID = '2265bfca-e845-4613-b341-70ee2ac73fbe'
const CKAN_BASE_URL = 'https://ckan0.cf.opendata.inter.prod-toronto.ca'

/**
 * Fetch package metadata from CKAN API
 */
const fetchCkanPackage = (packageId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const url = `${CKAN_BASE_URL}/api/3/action/package_show?id=${packageId}`

    https
      .get(url, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json.result)
          } catch (error) {
            reject(error)
          }
        })

        response.on('error', reject)
      })
      .on('error', reject)
  })
}

/**
 * Fetch actual data from a resource URL
 */
const fetchResourceData = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          resolve(data)
        })

        response.on('error', reject)
      })
      .on('error', reject)
  })
}

/**
 * Parse and normalize disruption data from various sources
 */
export const transformData = (rawData: any[]): RawDisruptionData[] => {
  const disruptions: RawDisruptionData[] = []

  // Add GTFS-RT disruptions
  if (Array.isArray(rawData)) {
    rawData.forEach((item, index) => {
      disruptions.push({
        id: `disruption-${index}`,
        type: item.type || 'bus',
        severity: item.severity || 'minor',
        title: item.title || 'Service Advisory',
        description: item.description || 'No additional details',
        affectedLines: item.lines || [],
        timestamp: Date.now(),
      })
    })
  }

  return disruptions
}

/**
 * Main ETL function - fetch, transform, load
 */
export const fetchAndTransformDisruptionData = async (): Promise<RawDisruptionData[]> => {
  try {
    console.log('Fetching GTFS-RT package metadata...')
    const gtfsPackage = await fetchCkanPackage(GTFS_RT_PACKAGE_ID)

    console.log('GTFS-RT Package found with', gtfsPackage.resources.length, 'resources')

    // Get the first resource (usually the main data feed)
    const resource = gtfsPackage.resources[0]

    if (resource && resource.url) {
      console.log('Fetching resource data from:', resource.url)
      const data = await fetchResourceData(resource.url)

      // Parse based on format (JSON, XML, etc.)
      let parsed: any[] = []
      if (resource.format?.toLowerCase() === 'json') {
        parsed = JSON.parse(data)
      } else {
        // For other formats, return mock data
        console.log('Resource format not JSON, using mock data')
        parsed = generateMockDisruptions()
      }

      return transformData(parsed)
    }

    console.log('No resource found, using mock data')
    return generateMockDisruptions()
  } catch (error) {
    console.error('Error fetching disruption data:', error)
    // Return mock data on error
    return generateMockDisruptions()
  }
}

/**
 * Generate mock disruption data for demo/fallback
 */
export const generateMockDisruptions = (): RawDisruptionData[] => {
  const types = ['subway', 'streetcar', 'bus', 'road', 'elevator', 'escalator']
  const severities = ['severe', 'moderate', 'minor']
  const lines = ['Line 1 Yonge-University', 'Line 2 Bloor-Danforth', 'Line 3 Scarborough', 'Line 4 Sheppard', 'Spadina Line', 'Bloor-Danforth']
  const titles = ['Service Suspended', 'Delays Expected', 'Bypass Operation', 'Road Closure', 'Early Closure', 'Reduced Speed Zone', 'Elevator Out of Service', 'Station Closed']

  const count = Math.floor(Math.random() * 12) + 2

  return Array.from({ length: count }).map((_, i) => ({
    id: `mock-disruption-${Date.now()}-${i}`,
    type: types[Math.floor(Math.random() * types.length)] as any,
    severity: severities[Math.floor(Math.random() * severities.length)] as any,
    title: titles[Math.floor(Math.random() * titles.length)],
    description: 'This is a demonstration disruption for the real-time status display.',
    affectedLines: [
      lines[Math.floor(Math.random() * lines.length)],
      lines[Math.floor(Math.random() * lines.length)],
    ].filter((v, i, a) => a.indexOf(v) === i),
    timestamp: Date.now(),
  }))
}

/**
 * In-memory cache with TTL
 */
interface CacheEntry {
  data: RawDisruptionData[]
  timestamp: number
  ttl: number
}

let cache: CacheEntry | null = null

export const getCachedOrFetchData = async (ttlMs: number = 30000): Promise<RawDisruptionData[]> => {
  const now = Date.now()

  if (cache && now - cache.timestamp < cache.ttl) {
    console.log('Returning cached data')
    return cache.data
  }

  console.log('Cache miss or expired, fetching fresh data')
  const data = await fetchAndTransformDisruptionData()

  cache = {
    data,
    timestamp: now,
    ttl: ttlMs,
  }

  return data
}
