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

/**
 * Fetch all disruptions from database
 * Returns data stored by background ETL process
 */
export const fetchAllDisruptionData = async (): Promise<Disruption[]> => {
  try {
    // Use relative path in production (same Railway domain)
    // Override with VITE_API_URL in development if needed
    const apiUrl = import.meta.env.VITE_API_URL || '/api/disruptions'
    
    console.log(`📡 Fetching disruptions from ${apiUrl}...`)
    
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

    console.log(`✅ Fetched ${result.count} disruptions from database`)
    
    // Map database format to frontend Disruption type
    return result.data.map((d: any) => ({
      id: d.external_id,
      type: d.type,
      severity: d.severity,
      title: d.title,
      description: d.description,
      affectedLines: d.affected_lines || [],
      timestamp: new Date(d.created_at).getTime(),
      sourceApi: d.source_api,
      sourceUrl: d.source_url,
      rawData: d.raw_data,
      lastFetchedAt: d.last_fetched_at ? new Date(d.last_fetched_at).getTime() : undefined,
    }))

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
    
    console.log(`🔄 Triggering manual sync from ${apiUrl}...`)
    
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
    
    console.log(`✅ Sync completed:`, result)
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
