import { Disruption } from '../store/disruptions'

/**
 * API Client for Frontend
 * 
 * Connects to Express API server (Railway deployment)
 * - Uses relative paths (same domain - no CORS issues)
 * - Fetches disruptions from Postgres database
 * - Data refreshed by background ETL scheduler (5-30s intervals)
 * 
 * NO MOCK DATA - All data from real Toronto Open Data via CKAN API
 */

const DEBUG = import.meta.env.VITE_DEBUG === 'true'

/**
 * Fetch all disruptions from database
 * Returns data stored by background ETL process
 */
export const fetchAllDisruptionData = async (): Promise<Disruption[]> => {
  try {
    // Use relative path in production (same Railway domain)
    // Override with VITE_API_URL in development if needed
    const apiUrl = import.meta.env.VITE_API_URL || '/api/disruptions'
    
    if (DEBUG) console.log(`📡 Fetching disruptions from ${apiUrl}...`)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    
    if (!result.success) {
      throw new Error(result.error || 'API returned success=false')
    }

    if (DEBUG) console.log(`✅ Fetched ${result.count} disruptions from database`)
    
    // Map database format to frontend Disruption type
    // API now returns camelCase field names, so we can use them directly
    return result.data.map((d: any) => {
      const normalizeNumeric = (value: unknown): number | undefined => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value
        }
        if (typeof value === 'string') {
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : undefined
        }
        return undefined
      }

      // Normalise coordinates regardless of how the API encoded them (camelCase, snake_case, strings)
      const normalizedCoordinates = (() => {
        const direct = d.coordinates
        if (direct && (direct.lat ?? direct.lng ?? direct.lon) !== undefined) {
          const lat = normalizeNumeric(direct.lat)
          const lng = normalizeNumeric(direct.lng ?? direct.lon)
          if (lat !== undefined && lng !== undefined) {
            return { lat, lng }
          }
        }

        const lat = normalizeNumeric(d.coordinatesLat ?? d.coordinates_lat ?? d.geocodedLat ?? d.geocoded_lat)
        const lng = normalizeNumeric(d.coordinatesLng ?? d.coordinates_lng ?? d.geocodedLon ?? d.geocoded_lon ?? d.coordinatesLon ?? d.coordinates_lon)
        if (lat !== undefined && lng !== undefined) {
          return { lat, lng }
        }

        return undefined
      })()

      return {
        id: d.externalId || d.external_id,
        type: d.type,
        severity: d.severity,
        title: d.title,
        description: d.description,
        affectedLines: d.affectedLines || d.affected_lines || [],
        timestamp: new Date(d.createdAt || d.created_at).getTime(),
        sourceApi: d.sourceApi || d.source_api,
        sourceUrl: d.sourceUrl || d.source_url,
        rawData: d.rawData || d.raw_data,
        lastFetchedAt: d.lastFetchedAt ? new Date(d.lastFetchedAt).getTime() : (d.last_fetched_at ? new Date(d.last_fetched_at).getTime() : undefined),

        // Geographic and TCL data (camelCase from API)
        coordinates: normalizedCoordinates,
        coordinatesLat: normalizeNumeric(d.coordinatesLat ?? d.coordinates_lat),
        coordinatesLng: normalizeNumeric(d.coordinatesLng ?? d.coordinates_lng),
        geocodedLat: normalizeNumeric(d.geocodedLat ?? d.geocoded_lat),
        geocodedLon: normalizeNumeric(d.geocodedLon ?? d.geocoded_lon),
        geocodedName: d.geocodedName || d.geocoded_name || undefined,
        geocodedSource: d.geocodedSource || d.geocoded_source || undefined,
        district: d.district || undefined,
        addressFull: d.addressFull || d.address_full || undefined,
        addressRange: d.addressRange || d.address_range || undefined,
        hasTclMatch: d.hasTclMatch || d.has_tcl_match || false,
        tclMatches: d.tclMatches || d.tcl_matches || [],

        // Work categorization fields (now from database columns, not rawData)
        workType: d.workType || d.work_type || undefined,
        scheduleType: d.scheduleType || d.schedule_type || undefined,
        duration: d.duration || undefined,
        impactLevel: d.impactLevel || d.impact_level || undefined,
        onsiteHours: d.onsiteHours || d.onsite_hours || undefined,
        roadClass: d.roadClass || d.road_class || undefined,
        contractor: d.contractor || undefined,
      }
    })

  } catch (error) {
    console.error('❌ Error fetching disruption data:', error)
    
    // Return empty array on error (graceful degradation)
    return []
  }
}


/**
 * Trigger manual sync (refresh data from Toronto Open Data)
 * Background ETL already runs every 5-30s, but this allows on-demand refresh
 */
export const triggerSync = async (): Promise<{
  success: boolean
  stats?: any
  error?: string
}> => {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api/sync'
    
    if (DEBUG) console.log(`🔄 Triggering manual sync from ${apiUrl}...`)
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    
    if (DEBUG) console.log(`✅ Sync completed:`, result)
    return {
      success: true,
      stats: result.stats || { fetched: result.fetched || 0 },
    }
  } catch (error) {
    console.error('❌ Error triggering sync:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
