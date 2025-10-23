import https from 'https'
import { Disruption } from '../../store/disruptions'
import { ckanRateLimiter } from '../utils/rate-limiter.js'

/**
 * TTC Service Alerts ETL Service
 * Fetches GTFS-Realtime service alerts from Toronto Open Data CKAN API
 * 
 * Data Source: Toronto Open Data - TTC Service Alerts
 * Package ID: 9ab4c9af-652f-4a84-abac-afcf40aae882
 * API: CKAN package_show endpoint
 * 
 * Documentation:
 * - CKAN API: https://docs.ckan.org/en/latest/api/
 * - GTFS Realtime: https://gtfs.org/realtime/reference/
 */

const PACKAGE_ID = '9ab4c9af-652f-4a84-abac-afcf40aae882'
const BASE_URL = 'https://ckan0.cf.opendata.inter.prod-toronto.ca'

interface CKANResource {
  id: string
  name: string
  format: string
  url: string
  datastore_active: boolean
  last_modified: string
}

interface CKANPackage {
  id: string
  name: string
  title: string
  metadata_modified: string
  resources: CKANResource[]
}

/**
 * Fetch package metadata from CKAN API (with rate limiting)
 */
const getPackageMetadata = (): Promise<CKANPackage> => {
  return ckanRateLimiter.executeQueued(() => {
    return new Promise((resolve, reject) => {
      const url = `${BASE_URL}/api/3/action/package_show?id=${PACKAGE_ID}`
      
      https.get(url, (response) => {
      const dataChunks: Buffer[] = []
      
      response
        .on('data', (chunk: Buffer) => {
          dataChunks.push(chunk)
        })
        .on('end', () => {
          try {
            const data = Buffer.concat(dataChunks)
            const result = JSON.parse(data.toString())
            
            if (!result.success) {
              reject(new Error('CKAN API returned success=false'))
              return
            }
            
            resolve(result.result as CKANPackage)
          } catch (error) {
            reject(error)
          }
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  })
  })
}

/**
 * Fetch resource data from URL (with rate limiting)
 */
const fetchResourceData = (url: string): Promise<any> => {
  return ckanRateLimiter.executeQueued(() => {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : require('http')
      
      protocol.get(url, (response: any) => {
        const dataChunks: Buffer[] = []
        
        response
          .on('data', (chunk: Buffer) => {
            dataChunks.push(chunk)
          })
          .on('end', () => {
            try {
              const data = Buffer.concat(dataChunks)
              const jsonData = JSON.parse(data.toString())
              resolve(jsonData)
            } catch (error) {
              reject(error)
            }
          })
          .on('error', (error: Error) => {
            reject(error)
          })
      })
    })
  })
}

/**
 * Geocode TTC stops to approximate coordinates
 * Uses major station locations and district fallbacks
 */
const geocodeTTCStop = (stopIds?: string[], routeId?: string, description?: string): { lat: number; lng: number } | undefined => {
  // Major TTC stations with coordinates
  const majorStations: Record<string, { lat: number; lng: number }> = {
    // Subway stations (Line 1 - Yonge)
    'finch': { lat: 43.7258, lng: -79.3957 },
    'bloor-yonge': { lat: 43.6707, lng: -79.3957 },
    'dundas-subway': { lat: 43.6643, lng: -79.3957 },
    'queen-subway': { lat: 43.6426, lng: -79.3957 },
    'king-subway': { lat: 43.6426, lng: -79.3957 },
    'union': { lat: 43.6426, lng: -79.3772 },
    'st-george': { lat: 43.6629, lng: -79.3957 },
    
    // Subway stations (Line 2 - Bloor)
    'kipling': { lat: 43.6629, lng: -79.4644 },
    'dundas-west': { lat: 43.6629, lng: -79.4194 },
    'bathurst-subway': { lat: 43.6629, lng: -79.4067 },
    'spadina-subway': { lat: 43.6629, lng: -79.3957 },
    'bay': { lat: 43.6629, lng: -79.3872 },
    'bay-bloor': { lat: 43.6707, lng: -79.3872 },
    'wellesley': { lat: 43.6549, lng: -79.3872 },
    
    // Subway stations (Line 3 - Bloor-Danforth)
    'bloor-danforth': { lat: 43.6707, lng: -79.3000 },
    'chester': { lat: 43.6833, lng: -79.3140 },
    'broadview': { lat: 43.6707, lng: -79.3611 },
    
    // Subway stations (Line 4 - Sheppard)
    'sheppard': { lat: 43.7615, lng: -79.4111 },
    'yonge-sheppard': { lat: 43.7615, lng: -79.3957 },
    
    // Streetcar main lines
    'king-streetcar': { lat: 43.6426, lng: -79.3833 },
    'queen-streetcar': { lat: 43.6500, lng: -79.3833 },
    'dundas-streetcar': { lat: 43.6556, lng: -79.3833 },
    'college': { lat: 43.6600, lng: -79.3900 },
    'carlton': { lat: 43.6629, lng: -79.3833 },
    'spadina-streetcar': { lat: 43.6667, lng: -79.4000 },
    'bathurst-streetcar': { lat: 43.6667, lng: -79.4100 },
    '505': { lat: 43.6426, lng: -79.3833 }, // King streetcar
    '501': { lat: 43.6500, lng: -79.3833 }, // Queen streetcar
  }
  
  // Try to match from stop IDs
  if (stopIds && stopIds.length > 0) {
    for (const stopId of stopIds) {
      const normalized = stopId.toLowerCase().replace(/-/g, '_')
      for (const [key, coords] of Object.entries(majorStations)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return coords
        }
      }
    }
  }
  
  // Try to parse from route ID or description
  if (routeId) {
    const routeNum = routeId.replace(/[a-z]/gi, '').substring(0, 3)
    // TTC bus route general areas (simplified)
    const routeBase = parseInt(routeNum)
    if (routeBase > 0 && routeBase < 600) {
      // Use simplified bus location model based on route number ranges
      if (routeBase < 100) {
        // Downtown/central routes
        return { lat: 43.6629, lng: -79.3957 }
      } else if (routeBase < 200) {
        // North routes
        return { lat: 43.7258, lng: -79.3957 }
      } else if (routeBase < 300) {
        // East routes
        return { lat: 43.6833, lng: -79.3000 }
      } else if (routeBase < 400) {
        // West routes
        return { lat: 43.6629, lng: -79.4644 }
      }
    }
  }
  
  // Default to Toronto downtown center
  return { lat: 43.6629, lng: -79.3957 }
}

/**
 * Parse GTFS-Realtime alert to Disruption format
 */
const parseGTFSAlert = (alert: any, sourceUrl: string): Disruption | null => {
  try {
    // Extract header text (title)
    const headerText = alert.header_text?.translation?.[0]?.text || 
                      alert.alert?.header_text?.translation?.[0]?.text
    
    // Extract description text
    const descriptionText = alert.description_text?.translation?.[0]?.text ||
                           alert.alert?.description_text?.translation?.[0]?.text
    
    // Extract URL for more info
    const url = alert.url?.translation?.[0]?.text ||
                alert.alert?.url?.translation?.[0]?.text
    
    if (!headerText) {
      console.warn('⚠️ Alert missing header_text, skipping:', alert.id)
      return null
    }

    // Extract affected entities (routes/lines)
    const informedEntity = alert.informed_entity || alert.alert?.informed_entity || []
    const affectedLines = informedEntity
      .map((entity: any) => entity.route_id)
      .filter(Boolean)
      .map(String)

    // Extract stop IDs
    const stopIds = informedEntity
      .map((entity: any) => entity.stop_id)
      .filter(Boolean)
      .map(String)

    // Determine type based on route ID
    let type: Disruption['type'] = 'subway'
    if (affectedLines.length > 0) {
      const firstLine = affectedLines[0]
      if (['1', '2', '3', '4'].includes(firstLine)) {
        type = 'subway'
      } else if (firstLine.startsWith('5')) {
        type = 'streetcar'
      } else {
        type = 'bus'
      }
    }

    // Determine severity from effect
    const effect = alert.effect || alert.alert?.effect
    const causeValue = alert.cause || alert.alert?.cause
    
    let severity: Disruption['severity'] = 'moderate'
    if (effect === 'NO_SERVICE' || causeValue === 'ACCIDENT') {
      severity = 'severe'
    } else if (effect === 'SIGNIFICANT_DELAYS' || effect === 'DETOUR') {
      severity = 'moderate'
    } else {
      severity = 'minor'
    }

    // Map GTFS cause to our cause enum
    let cause: Disruption['cause'] | undefined
    switch (causeValue) {
      case 'CONSTRUCTION':
      case 'MAINTENANCE':
        cause = 'maintenance'
        break
      case 'WEATHER':
        cause = 'weather'
        break
      case 'MEDICAL_EMERGENCY':
        cause = 'medical'
        break
      case 'TECHNICAL_PROBLEM':
      case 'TECHNICAL':
        cause = 'mechanical'
        break
      case 'POLICE_ACTIVITY':
      case 'ACCIDENT':
        cause = 'investigation'
        break
      default:
        // Check description for keywords
        const desc = (descriptionText || headerText).toLowerCase()
        if (desc.includes('maintenance') || desc.includes('repair')) {
          cause = 'maintenance'
        } else if (desc.includes('weather') || desc.includes('storm')) {
          cause = 'weather'
        } else if (desc.includes('medical') || desc.includes('injury')) {
          cause = 'medical'
        } else if (desc.includes('mechanical') || desc.includes('technical')) {
          cause = 'mechanical'
        } else if (desc.includes('police') || desc.includes('investigation')) {
          cause = 'investigation'
        } else {
          cause = 'other'
        }
    }

    // Extract active period
    const activePeriod = alert.active_period?.[0] || alert.alert?.active_period?.[0]
    let activePeriodData: Disruption['activePeriod'] | undefined
    if (activePeriod) {
      activePeriodData = {
        start: activePeriod.start ? Number(activePeriod.start) * 1000 : undefined,
        end: activePeriod.end ? Number(activePeriod.end) * 1000 : undefined,
      }
    }

    // Determine direction from informed entities or description
    let direction: Disruption['direction'] | undefined
    const firstEntity = informedEntity[0]
    if (firstEntity?.direction_id !== undefined) {
      // GTFS uses 0 and 1 for direction
      direction = firstEntity.direction_id === 0 ? 'northbound' : 'southbound'
    } else {
      // Try to parse from description
      const desc = (descriptionText || headerText).toLowerCase()
      if (desc.includes('eastbound') || desc.includes('east bound')) {
        direction = 'eastbound'
      } else if (desc.includes('westbound') || desc.includes('west bound')) {
        direction = 'westbound'
      } else if (desc.includes('northbound') || desc.includes('north bound')) {
        direction = 'northbound'
      } else if (desc.includes('southbound') || desc.includes('south bound')) {
        direction = 'southbound'
      } else if (desc.includes('both directions') || desc.includes('all directions')) {
        direction = 'bidirectional'
      }
    }

    // Generate external ID - use alert.id directly if available
    // Alert IDs from GTFS-RT may or may not have "ttc-" prefix
    const alertId = alert.id || alert.alert?.id
    const externalId = alertId 
      ? `ttc-${alertId}`.replace(/^ttc-ttc-/, 'ttc-') // Prevent double "ttc-" prefix
      : `ttc-generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Geocode TTC stop if available
    const coordinates = geocodeTTCStop(stopIds, affectedLines[0], descriptionText || headerText)

    return {
      id: externalId,
      type,
      severity,
      title: headerText.trim(),
      description: descriptionText?.trim() || headerText.trim(),
      affectedLines,
      timestamp: Date.now(),
      cause,
      activePeriod: activePeriodData,
      stopIds: stopIds.length > 0 ? stopIds : undefined,
      direction,
      url,
      coordinates,
      sourceApi: 'Toronto Open Data - TTC Service Alerts',
      sourceUrl,
      rawData: alert,
      lastFetchedAt: Date.now(),
    }
  } catch (error) {
    console.error('Error parsing GTFS alert:', error, alert)
    return null
  }
}

/**
 * Fetch and parse all TTC service alerts
 */
export const fetchTTCServiceAlerts = async (): Promise<{
  disruptions: Disruption[]
  metadata: {
    source: string
    packageId: string
    fetchedAt: string
    resourceCount: number
  }
}> => {
  try {
    console.log('🚇 Fetching TTC Service Alerts from Toronto Open Data...')
    
    // Get package metadata
    const pkg = await getPackageMetadata()
    console.log(`📦 Package: ${pkg.title}`)
    console.log(`📁 Resources: ${pkg.resources.length}`)

    // Find the latest service alerts resource
    // Look for JSON or GTFS-RT format
    const alertResources = pkg.resources.filter(
      (r) => r.format === 'JSON' || 
             r.format === 'GTFS-RT' || 
             r.name.toLowerCase().includes('alert') ||
             r.name.toLowerCase().includes('service')
    )

    if (alertResources.length === 0) {
      console.warn('⚠️ No alert resources found in package')
      return {
        disruptions: [],
        metadata: {
          source: 'Toronto Open Data - TTC Service Alerts',
          packageId: PACKAGE_ID,
          fetchedAt: new Date().toISOString(),
          resourceCount: 0,
        },
      }
    }

    // Fetch data from the most recent resource
    const latestResource = alertResources.sort(
      (a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime()
    )[0]

    console.log(`📥 Fetching resource: ${latestResource.name} (${latestResource.format})`)
    console.log(`🔗 URL: ${latestResource.url}`)

    const resourceData = await fetchResourceData(latestResource.url)
    
    // Parse alerts
    let alerts: any[] = []
    
    // Handle different response formats
    if (resourceData.entity) {
      // GTFS-RT format with entity array
      alerts = resourceData.entity.map((e: any) => e.alert).filter(Boolean)
    } else if (resourceData.alerts) {
      // Direct alerts array
      alerts = resourceData.alerts
    } else if (Array.isArray(resourceData)) {
      // Already an array
      alerts = resourceData
    } else {
      console.warn('⚠️ Unknown data format:', Object.keys(resourceData))
    }

    console.log(`📊 Found ${alerts.length} raw alerts`)

    // Parse to Disruption format
    const disruptions = alerts
      .map((alert) => parseGTFSAlert(alert, latestResource.url))
      .filter((d): d is Disruption => d !== null)

    console.log(`✅ Parsed ${disruptions.length} TTC service alerts`)

    return {
      disruptions,
      metadata: {
        source: 'Toronto Open Data - TTC Service Alerts',
        packageId: PACKAGE_ID,
        fetchedAt: new Date().toISOString(),
        resourceCount: alerts.length,
      },
    }
  } catch (error) {
    console.error('❌ Error fetching TTC service alerts:', error)
    throw error
  }
}
