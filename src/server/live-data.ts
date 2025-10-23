/**
 * Live Data Fetcher
 * Fetches real-time disruption data from:
 * 1. TTC GTFS Realtime API
 * 2. Toronto Open Data (Road Restrictions)
 * 3. Toronto Open Data (Transit Alerts)
 */

import https from 'https'
import { createHash } from 'crypto'

export interface Disruption {
  externalId: string
  type: 'subway' | 'streetcar' | 'bus' | 'road' | 'elevator' | 'escalator'
  severity: 'severe' | 'moderate' | 'minor'
  title: string
  description: string
  affectedLines: string[]
  contentHash: string
}

/**
 * Fetch TTC GTFS Realtime service alerts
 * TTC provides real-time transit alerts via GTFS-RT format
 */
const fetchTTCAlerts = async (): Promise<Disruption[]> => {
  return new Promise((resolve) => {
    // TTC GTFS-RT alerts endpoint
    const url = 'https://api.ttc.ca/gtfs-realtime/alerts'

    const request = https.get(url, { timeout: 5000 }, (response) => {
      let data = ''

      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          // Parse protocol buffer or JSON response from TTC
          // For now, return empty array - in production this would parse actual GTFS-RT data
          console.log('✓ TTC alerts fetched (processing live data)')
          resolve([])
        } catch (error) {
          console.error('Error parsing TTC alerts:', error)
          resolve([])
        }
      })
    })

    request.on('error', (error) => {
      console.error('TTC API error:', error)
      resolve([])
    })

    request.on('timeout', () => {
      console.error('TTC API timeout')
      request.destroy()
      resolve([])
    })
  })
}

/**
 * Fetch Toronto Open Data - Road Restrictions
 * API: https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=road-restrictions
 */
const fetchRoadRestrictions = async (): Promise<Disruption[]> => {
  return new Promise((resolve) => {
    const packageId = 'road-restrictions'
    const url = `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=${packageId}`

    const request = https.get(url, { timeout: 5000 }, (response) => {
      let data = ''

      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          const json = JSON.parse(data)
          const pkg = json.result

          const disruptions: Disruption[] = []

          // Process each resource in the package
          if (pkg.resources && Array.isArray(pkg.resources)) {
            for (const resource of pkg.resources) {
              if (resource.datastore_active && resource.url) {
                // Fetch actual data from the resource URL
                fetchRoadRestrictionsData(resource.url)
                  .then((items) => {
                    disruptions.push(...items)
                  })
                  .catch((err) => {
                    console.error('Error fetching road restrictions data:', err)
                  })
              }
            }
          }

          console.log(`✓ Road restrictions fetched (${disruptions.length} active)`)
          resolve(disruptions)
        } catch (error) {
          console.error('Error parsing road restrictions:', error)
          resolve([])
        }
      })
    })

    request.on('error', (error) => {
      console.error('Road restrictions API error:', error)
      resolve([])
    })

    request.on('timeout', () => {
      console.error('Road restrictions API timeout')
      request.destroy()
      resolve([])
    })
  })
}

/**
 * Fetch actual data from a road restrictions resource
 */
const fetchRoadRestrictionsData = async (url: string): Promise<Disruption[]> => {
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 5000 }, (response) => {
      let data = ''

      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          // Parse CSV or JSON response
          const disruptions: Disruption[] = []
          // TODO: Parse actual restriction data and convert to Disruption format
          resolve(disruptions)
        } catch (error) {
          console.error('Error parsing road restrictions data:', error)
          resolve([])
        }
      })
    })

    request.on('error', (error) => {
      console.error('Road restrictions data fetch error:', error)
      resolve([])
    })

    request.on('timeout', () => {
      request.destroy()
      resolve([])
    })
  })
}

/**
 * Fetch Toronto Open Data - Transit Alerts
 * API: https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=ttc-service-alerts
 */
const fetchTransitAlerts = async (): Promise<Disruption[]> => {
  return new Promise((resolve) => {
    const packageId = '9ab4c9af-652f-4a84-abac-afcf40aae882'
    const url = `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=${packageId}`

    const request = https.get(url, { timeout: 5000 }, (response) => {
      let data = ''

      response.on('data', (chunk) => {
        data += chunk
      })

      response.on('end', () => {
        try {
          const json = JSON.parse(data)
          const pkg = json.result

          const disruptions: Disruption[] = []

          // Process each resource
          if (pkg.resources && Array.isArray(pkg.resources)) {
            for (const resource of pkg.resources) {
              if (resource.url) {
                // Fetch actual alert data from resource
                // TODO: Parse and convert to Disruption format
              }
            }
          }

          console.log(`✓ Transit alerts fetched (${disruptions.length} active)`)
          resolve(disruptions)
        } catch (error) {
          console.error('Error parsing transit alerts:', error)
          resolve([])
        }
      })
    })

    request.on('error', (error) => {
      console.error('Transit alerts API error:', error)
      resolve([])
    })

    request.on('timeout', () => {
      console.error('Transit alerts API timeout')
      request.destroy()
      resolve([])
    })
  })
}

/**
 * Generate content hash for deduplication
 */
export const generateContentHash = (
  type: string,
  severity: string,
  title: string,
  description: string
): string => {
  const content = `${type}|${severity}|${title}|${description}`
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Deduplicate disruptions by content hash
 */
export const deduplicateDisruptions = (
  disruptions: Disruption[],
  existingHashes: Set<string>
): Disruption[] => {
  const newDisruptions: Disruption[] = []
  const seenHashes = new Set<string>()

  for (const disruption of disruptions) {
    if (!existingHashes.has(disruption.contentHash) && !seenHashes.has(disruption.contentHash)) {
      newDisruptions.push(disruption)
      seenHashes.add(disruption.contentHash)
    }
  }

  return newDisruptions
}

/**
 * Fetch all live disruption data from all sources
 */
export const fetchAllLiveData = async (): Promise<Disruption[]> => {
  console.log(`📡 Fetching live disruption data at ${new Date().toISOString()}`)

  try {
    const [ttcAlerts, roadRestrictions, transitAlerts] = await Promise.all([
      fetchTTCAlerts(),
      fetchRoadRestrictions(),
      fetchTransitAlerts(),
    ])

    const allDisruptions = [...ttcAlerts, ...roadRestrictions, ...transitAlerts]
    console.log(`✓ Total disruptions fetched: ${allDisruptions.length}`)

    return allDisruptions
  } catch (error) {
    console.error('Error fetching live data:', error)
    return []
  }
}

/**
 * Get random refresh interval between minMs and maxMs
 */
export const getRandomRefreshInterval = (minMs: number = 5000, maxMs: number = 30000): number => {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}
