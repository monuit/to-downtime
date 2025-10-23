/**
 * Toronto Centreline (TCL) ETL Service
 * 
 * Fetches Toronto Centreline GeoJSON data from City of Toronto Open Data API
 * - Runs ONCE DAILY at 7 AM (not more frequent)
 * - Downloads 89.78 MB GeoJSON with 65,071 street segments
 * - Parses and stores in tcl_segments table with PostGIS geometry
 * - Caches data to avoid redundant downloads
 */

import https from 'https'
import { pool } from '../db.js'
import { normalizeStreetName } from '../utils/street-name-utils.js'
import { logger } from '../logger.js'
import * as geohash from '../utils/geohash.js'

// Toronto Open Data CKAN API
const CKAN_BASE_URL = 'https://ckan0.cf.opendata.inter.prod-toronto.ca'
const TCL_PACKAGE_ID = '1d079757-377b-4564-82df-eb5638583bfb'
const TCL_DATASTORE_RESOURCE_ID = 'ad296ebf-fca6-4e67-b3ce-48040a20e6cd'
const DATASTORE_PAGE_SIZE = 5000

interface TCLGeometry {
  type: 'LineString' | 'MultiLineString'
  coordinates: number[][] | number[][][]
}

interface TCLFeature {
  type: 'Feature'
  geometry: TCLGeometry
  properties: {
    CENTRELINE_ID: number
    LINEAR_NAME_FULL: string
    FEATURE_CODE?: string
    FEATURE_CODE_DESC?: string
    LO_NUM_L?: number | null
    HI_NUM_L?: number | null
    LO_NUM_R?: number | null
    HI_NUM_R?: number | null
    [key: string]: any
  }
}

interface TCLGeoJSON {
  type: 'FeatureCollection'
  features: TCLFeature[]
}

interface TCLDatastoreRecord {
  CENTRELINE_ID: number
  LINEAR_NAME_FULL: string
  FEATURE_CODE?: string
  FEATURE_CODE_DESC?: string
  LO_NUM_L?: number | null
  HI_NUM_L?: number | null
  LO_NUM_R?: number | null
  HI_NUM_R?: number | null
  geometry?: string | null
  [key: string]: any
}

let cachedPostgisAvailable: boolean | null = null

/**
 * Check if PostGIS extension is available
 */
async function checkPostGISAvailable(client: any): Promise<boolean> {
  try {
    const result = await client.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'postgis'
      ) as has_postgis
    `)
    const hasPostgis = result.rows[0]?.has_postgis || false
    cachedPostgisAvailable = hasPostgis
    return hasPostgis
  } catch (error) {
    cachedPostgisAvailable = false
    return false
  }
}

export async function isPostGISAvailable(): Promise<boolean> {
  if (cachedPostgisAvailable !== null) {
    return cachedPostgisAvailable
  }

  const client = await pool.connect()

  try {
    return await checkPostGISAvailable(client)
  } finally {
    client.release()
  }
}

/**
 * Check if TCL data needs refresh (>24 hours old or missing)
 */
async function needsRefresh(): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT last_fetched_at 
      FROM tcl_metadata 
      ORDER BY last_fetched_at DESC 
      LIMIT 1
    `)

    if (result.rows.length === 0) {
      logger.debug('📍 No TCL data found - initial fetch required')
      return true
    }

    const lastFetched = new Date(result.rows[0].last_fetched_at)
    const hoursSinceLastFetch = (Date.now() - lastFetched.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastFetch >= 24) {
      logger.debug(`📍 TCL data is ${hoursSinceLastFetch.toFixed(1)} hours old - refresh needed`)
      return true
    }

    logger.debug(`📍 TCL data is ${hoursSinceLastFetch.toFixed(1)} hours old - using cache`)
    return false
  } catch (error) {
    logger.error('❌ Error checking TCL refresh status:', error)
    return true // Refresh on error to be safe
  }
}

/**
 * Fetch CKAN package metadata
 */
function fetchPackageMetadata(): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${CKAN_BASE_URL}/api/3/action/package_show?id=${TCL_PACKAGE_ID}`
    
    https.get(url, (response) => {
      let data = ''
      response.on('data', (chunk) => { data += chunk })
      response.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.result)
        } catch (error) {
          reject(error)
        }
      })
      response.on('error', reject)
    }).on('error', reject)
  })
}

async function fetchTCLFeaturesFromDatastore(): Promise<TCLGeoJSON> {
  logger.debug(`📍 Fetching TCL data from CKAN datastore (resource ${TCL_DATASTORE_RESOURCE_ID})...`)

  let offset = 0
  let total = Number.POSITIVE_INFINITY
  const features: TCLFeature[] = []
  const start = Date.now()

  while (offset < total) {
    const params = new URLSearchParams({
      resource_id: TCL_DATASTORE_RESOURCE_ID,
      limit: DATASTORE_PAGE_SIZE.toString(),
      offset: offset.toString(),
    })

    const url = `${CKAN_BASE_URL}/api/3/action/datastore_search?${params.toString()}`
    const page = await new Promise<any>((resolve, reject) => {
      https.get(url, (response) => {
        let data = ''
        response.on('data', (chunk) => {
          data += chunk
        })
        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (error) {
            reject(error)
          }
        })
        response.on('error', reject)
      }).on('error', reject)
    })

    if (!page.success) {
      throw new Error(`CKAN datastore_search failed at offset ${offset}`)
    }

    const result = page.result
    total = result.total
    const records: TCLDatastoreRecord[] = result.records || []

    logger.debug(`   Received ${records.length} records (offset ${offset})`)

    for (const record of records) {
      const { geometry: geometryText, ...props } = record

      if (!geometryText) continue

      try {
        const geometry = JSON.parse(geometryText) as TCLGeometry
        features.push({
          type: 'Feature',
          geometry,
          properties: props,
        })
      } catch (error) {
        logger.warn(`   ⚠️  Skipping record ${record.CENTRELINE_ID} due to invalid geometry`)
      }
    }

    offset += DATASTORE_PAGE_SIZE

    if (offset >= total) {
      break
    }
  }

  logger.debug(`   ✅ Fetched ${features.length} TCL segments in ${(Date.now() - start) / 1000}s`)

  return {
    type: 'FeatureCollection',
    features,
  }
}

async function storeTCLSegments(geojson: TCLGeoJSON): Promise<number> {
  const client = await pool.connect()
  let stored = 0

  try {
    console.log(`[${new Date().toISOString()}] ⏳ Clearing existing TCL data...`)
    logger.debug('   Clearing existing TCL data...')
    await client.query('DELETE FROM tcl_segments')

    console.log(`[${new Date().toISOString()}] ⏳ Preparing batch insert (${geojson.features.length} segments)...`)
    logger.debug(`   Preparing batch insert (${geojson.features.length} segments)...`)
    
    const features = geojson.features
    const BATCH_SIZE = 500 // Optimize for network latency + memory
    
    // Begin transaction for all inserts
    await client.query('BEGIN')
    
    try {
      // Process in batches to balance memory usage and network round-trips
      for (let batchStart = 0; batchStart < features.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, features.length)
        const batch = features.slice(batchStart, batchEnd)
        
        // Build multi-row INSERT statement
        const values: any[] = []
        const placeholders: string[] = []
        let paramIndex = 1
        
        for (const feature of batch) {
          const props = feature.properties
          const center = geohash.extractCenterFromGeometry(feature.geometry)
          
          if (center) {
            const hash7 = geohash.encode(center.lat, center.lon, 7)
            const hash6 = geohash.encode(center.lat, center.lon, 6)
            
            values.push(
              props.CENTRELINE_ID,
              props.LINEAR_NAME_FULL,
              normalizeStreetName(props.LINEAR_NAME_FULL),
              props.FEATURE_CODE,
              props.FEATURE_CODE_DESC,
              props.LO_NUM_L ?? null,
              props.HI_NUM_L ?? null,
              props.LO_NUM_R ?? null,
              props.HI_NUM_R ?? null,
              center.lat,
              center.lon,
              hash7,
              hash6
            )
            
            placeholders.push(`($${paramIndex},$${paramIndex+1},$${paramIndex+2},$${paramIndex+3},$${paramIndex+4},$${paramIndex+5},$${paramIndex+6},$${paramIndex+7},$${paramIndex+8},$${paramIndex+9},$${paramIndex+10},$${paramIndex+11},$${paramIndex+12})`)
            paramIndex += 13
          } else {
            // Insert without spatial data
            values.push(
              props.CENTRELINE_ID,
              props.LINEAR_NAME_FULL,
              normalizeStreetName(props.LINEAR_NAME_FULL),
              props.FEATURE_CODE,
              props.FEATURE_CODE_DESC,
              props.LO_NUM_L ?? null,
              props.HI_NUM_L ?? null,
              props.LO_NUM_R ?? null,
              props.HI_NUM_R ?? null,
              null, null, null, null
            )
            
            placeholders.push(`($${paramIndex},$${paramIndex+1},$${paramIndex+2},$${paramIndex+3},$${paramIndex+4},$${paramIndex+5},$${paramIndex+6},$${paramIndex+7},$${paramIndex+8},$${paramIndex+9},$${paramIndex+10},$${paramIndex+11},$${paramIndex+12})`)
            paramIndex += 13
          }
        }
        
        if (placeholders.length > 0) {
          const sql = `
            INSERT INTO tcl_segments (
              centreline_id,
              street_name,
              street_name_normalized,
              feature_code,
              feature_code_desc,
              address_left_from,
              address_left_to,
              address_right_from,
              address_right_to,
              center_lat,
              center_lng,
              geohash_7,
              geohash_6
            ) VALUES ${placeholders.join(',')}
          `
          
          await client.query(sql, values)
          stored = batchEnd
          
          const pct = ((stored / features.length) * 100).toFixed(1)
          console.log(`[${new Date().toISOString()}] ⏳ Inserted ${stored} / ${features.length} segments (${pct}%)`)
          if (stored % 5000 === 0 || stored === features.length) {
            logger.debug(`   Batch progress: ${stored} / ${features.length} (${pct}%)`)
          }
        }
      }
      
      await client.query('COMMIT')
      console.log(`[${new Date().toISOString()}] ✅ Transaction committed - ${stored} segments inserted`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    // Record metadata
    console.log(`[${new Date().toISOString()}] ⏳ Recording metadata...`)
    await client.query(`
      INSERT INTO tcl_metadata (
        last_fetched_at,
        total_segments,
        file_size_bytes,
        fetch_duration_ms
      ) VALUES (NOW(), $1, $2, $3)
    `, [geojson.features.length, 0, 0])

    console.log(`[${new Date().toISOString()}] ✅ Stored ${stored} TCL segments with geohash spatial indexing`)
    logger.debug(`   ✅ Stored ${stored} TCL segments with geohash spatial indexing`)
    
    return stored
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Error storing TCL segments:`, error)
    logger.error(`   ❌ Error storing TCL segments:`, error)
    throw error
  } finally {
    client.release()
  }
}

/**
 * Main TCL fetch and store function
 * Should be called ONCE DAILY at 7 AM
 */
export async function fetchAndStoreTCL(): Promise<{
  success: boolean
  segmentsStored: number
  fromCache: boolean
  error?: string
}> {
  const startTime = Date.now()

  try {
    console.log(`[${new Date().toISOString()}] 📍 [TCL ETL] Starting Toronto Centreline data fetch...`)
    logger.debug('\n📍 [TCL ETL] Starting Toronto Centreline data fetch...')

    // Check if refresh needed
    const shouldRefresh = await needsRefresh()
    if (!shouldRefresh) {
      console.log(`[${new Date().toISOString()}] 📍 [TCL ETL] Using cached TCL data`)
      const count = await pool.query('SELECT COUNT(*) FROM tcl_segments')
      return {
        success: true,
        segmentsStored: parseInt(count.rows[0].count),
        fromCache: true
      }
    }

    // Fetch from datastore to avoid raw GeoJSON download issues
    console.log(`[${new Date().toISOString()}] ⏳ Fetching from CKAN datastore...`)
    const geojson = await fetchTCLFeaturesFromDatastore()
    
    console.log(`[${new Date().toISOString()}] ⏳ Parsed ${geojson.features.length} features`)
    logger.debug(`   Parsed ${geojson.features.length} features`)

    // Store in database
    console.log(`[${new Date().toISOString()}] ⏳ Starting database storage (this may take a few minutes)...`)
    const stored = await storeTCLSegments(geojson)

    const duration = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] ✅ [TCL ETL] Completed in ${(duration / 1000).toFixed(1)}s`)
    console.log(`[${new Date().toISOString()}] ✅ Segments stored: ${stored}`)
    logger.debug(`\n✅ [TCL ETL] Completed in ${(duration / 1000).toFixed(1)}s`)
    logger.debug(`   Segments stored: ${stored}`)

    return {
      success: true,
      segmentsStored: stored,
      fromCache: false
    }
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${new Date().toISOString()}] ❌ [TCL ETL] Failed after ${(duration / 1000).toFixed(1)}s:`, error)
    logger.error(`\n❌ [TCL ETL] Failed after ${(duration / 1000).toFixed(1)}s:`, error)
    
    return {
      success: false,
      segmentsStored: 0,
      fromCache: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Get all TCL street names for matching (cached in memory)
 */
let tclStreetNamesCache: string[] | null = null

export async function getTCLStreetNames(): Promise<string[]> {
  if (tclStreetNamesCache) {
    return tclStreetNamesCache
  }

  const result = await pool.query(`
    SELECT DISTINCT street_name 
    FROM tcl_segments 
    ORDER BY street_name
  `)

  tclStreetNamesCache = result.rows.map(row => row.street_name)
  logger.debug(`📍 Loaded ${tclStreetNamesCache.length} unique TCL street names into cache`)
  
  return tclStreetNamesCache
}

/**
 * Clear street names cache (call after TCL data refresh)
 */
export function clearTCLCache(): void {
  tclStreetNamesCache = null
  logger.debug('📍 TCL street names cache cleared')
}

/**
 * Get TCL segments for a specific street name
 */
export async function getTCLSegmentsByStreet(streetName: string): Promise<any[]> {
  const normalized = normalizeStreetName(streetName)
  const hasPostGIS = await isPostGISAvailable()
  const geometrySelect = hasPostGIS
    ? 'ST_AsGeoJSON(geometry) as geometry_geojson'
    : 'geometry as geometry_geojson'

  const result = await pool.query(`
    SELECT 
      id,
      centreline_id,
      street_name,
      address_left_from,
      address_left_to,
      address_right_from,
      address_right_to,
      ${geometrySelect}
    FROM tcl_segments
    WHERE street_name_normalized = $1
    ORDER BY centreline_id
  `, [normalized])

  return result.rows
}
