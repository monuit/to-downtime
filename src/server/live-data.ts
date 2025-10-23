/**
 * Live Data Fetching Service
 * Orchestrates ETL from multiple Toronto Open Data sources
 * 
 * Data Sources:
 * 1. TTC Service Alerts (GTFS-Realtime) - via Toronto Open Data CKAN API
 * 2. Road Restrictions - via Toronto Open Data CKAN API
 * 
 * All data is fetched from Toronto Open Data CKAN API
 */

import { Disruption } from '../store/disruptions'
import { fetchTTCServiceAlerts } from './etl/ttc-service-alerts.js'
import { fetchRoadRestrictions } from './etl/road-restrictions.js'
import { logger } from './logger.js'

export interface LiveDataResult {
  disruptions: Disruption[]
  metadata: {
    totalFetched: number
    sources: {
      name: string
      count: number
      fetchedAt: string
    }[]
    fetchedAt: string
    errors: string[]
  }
}

/**
 * Fetch all live disruption data from Toronto Open Data
 */
export const fetchAllLiveData = async (): Promise<Disruption[]> => {
  logger.debug('🔄 Starting ETL from Toronto Open Data APIs...')
  const startTime = Date.now()

  const allDisruptions: Disruption[] = []
  const errors: string[] = []

  // Fetch TTC Service Alerts
  try {
    const ttcResult = await fetchTTCServiceAlerts()
    allDisruptions.push(...ttcResult.disruptions)
    logger.debug(`✅ TTC: ${ttcResult.disruptions.length} alerts`)
  } catch (error) {
    const errorMsg = `TTC Service Alerts: ${error instanceof Error ? error.message : 'Unknown error'}`
    logger.error(`❌ ${errorMsg}`)
    errors.push(errorMsg)
  }

  // Fetch Road Restrictions
  try {
    const roadResult = await fetchRoadRestrictions()
    allDisruptions.push(...roadResult.disruptions)
    logger.debug(`✅ Roads: ${roadResult.disruptions.length} restrictions`)
  } catch (error) {
    const errorMsg = `Road Restrictions: ${error instanceof Error ? error.message : 'Unknown error'}`
    logger.error(`❌ ${errorMsg}`)
    errors.push(errorMsg)
  }

  const duration = Date.now() - startTime
  logger.debug(`✅ ETL completed in ${duration}ms`)
  logger.debug(`📊 Total: ${allDisruptions.length} disruptions`)
  
  if (errors.length > 0) {
    logger.warn(`⚠️  ${errors.length} source(s) failed:`, errors)
  }

  return allDisruptions
}

/**
 * Fetch with detailed metadata
 */
export const fetchAllLiveDataWithMetadata = async (): Promise<LiveDataResult> => {
  logger.debug('🔄 Starting detailed ETL from Toronto Open Data APIs...')
  const startTime = Date.now()

  const allDisruptions: Disruption[] = []
  const sources: LiveDataResult['metadata']['sources'] = []
  const errors: string[] = []

  // Fetch TTC Service Alerts
  try {
    const ttcResult = await fetchTTCServiceAlerts()
    allDisruptions.push(...ttcResult.disruptions)
    sources.push({
      name: ttcResult.metadata.source,
      count: ttcResult.disruptions.length,
      fetchedAt: ttcResult.metadata.fetchedAt,
    })
    logger.debug(`✅ TTC: ${ttcResult.disruptions.length} alerts`)
  } catch (error) {
    const errorMsg = `TTC Service Alerts: ${error instanceof Error ? error.message : 'Unknown error'}`
    logger.error(`❌ ${errorMsg}`)
    errors.push(errorMsg)
  }

  // Fetch Road Restrictions
  try {
    const roadResult = await fetchRoadRestrictions()
    allDisruptions.push(...roadResult.disruptions)
    sources.push({
      name: roadResult.metadata.source,
      count: roadResult.disruptions.length,
      fetchedAt: roadResult.metadata.fetchedAt,
    })
    logger.debug(`✅ Roads: ${roadResult.disruptions.length} restrictions`)
  } catch (error) {
    const errorMsg = `Road Restrictions: ${error instanceof Error ? error.message : 'Unknown error'}`
    logger.error(`❌ ${errorMsg}`)
    errors.push(errorMsg)
  }

  const duration = Date.now() - startTime
  logger.debug(`✅ ETL completed in ${duration}ms`)
  logger.debug(`📊 Total: ${allDisruptions.length} disruptions from ${sources.length} sources`)
  
  if (errors.length > 0) {
    logger.warn(`⚠️  ${errors.length} source(s) failed:`, errors)
  }

  return {
    disruptions: allDisruptions,
    metadata: {
      totalFetched: allDisruptions.length,
      sources,
      fetchedAt: new Date().toISOString(),
      errors,
    },
  }
}

/**
 * Deduplicate disruptions by content hash
 */
export const deduplicateDisruptions = (disruptions: Disruption[]): Disruption[] => {
  const seen = new Set<string>()
  
  return disruptions.filter((disruption) => {
    const hash = generateContentHash(
      disruption.type,
      disruption.severity,
      disruption.title
    )
    
    if (seen.has(hash)) {
      return false
    }
    
    seen.add(hash)
    return true
  })
}

/**
 * Generate content hash for deduplication
 */
export const generateContentHash = (type: string, severity: string, title: string): string => {
  const content = `${type}-${severity}-${title.toLowerCase().trim()}`
  
  // Simple hash function (you could use crypto.createHash for production)
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36)
}
