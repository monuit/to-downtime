/**
 * Street Matching Service
 * 
 * Matches disruption street names to Toronto Centreline (TCL) segments
 * Uses fuzzy string matching and stores mappings in database
 */

import { pool } from '../db.js'
import { getTCLStreetNames, getTCLSegmentsByStreet, isPostGISAvailable } from './tcl-fetcher.js'
import { 
  extractStreetNames, 
  findBestMatch, 
  normalizeStreetName,
  type StreetMatch 
} from '../utils/street-name-utils.js'
import { computeMatchHash, canUseCachedMatch } from '../utils/tcl-cache-utils.js'
import { logger } from '../logger.js'

export interface DisruptionTCLMatch {
  disruptionExternalId: string
  streetName: string
  matchType: 'exact' | 'fuzzy' | 'none'
  confidence: number
  tclSegments: any[]
  addressFull?: string
  addressRange?: string
}

/**
 * Match a single disruption to TCL segments
 * Returns all matching segments and address information
 * 
 * OPTIMIZATION: Checks database cache first to avoid expensive fuzzy matching
 */
export async function matchDisruptionToTCL(
  disruptionExternalId: string,
  title: string,
  description: string = ''
): Promise<DisruptionTCLMatch[]> {
  try {
    // STEP 1: Check if we have a valid cached match
    const cachedMatch = await getCachedMatch(disruptionExternalId)
    
    if (cachedMatch && canUseCachedMatch(cachedMatch, { title, description })) {
      logger.debug(`   💾 Using cached match for: "${title}"`)
      
      // Return cached match - fetch segments for cached street
      if (cachedMatch.tcl_matched_street) {
        const segments = await getTCLSegmentsByStreet(cachedMatch.tcl_matched_street)
        
        if (segments.length > 0) {
          const addressFull = buildAddressString(cachedMatch.tcl_matched_street, segments)
          const addressRange = buildAddressRange(segments)
          
          return [{
            disruptionExternalId,
            streetName: cachedMatch.tcl_matched_street,
            matchType: (cachedMatch.tcl_match_type as 'exact' | 'fuzzy' | 'none') || 'fuzzy',
            confidence: cachedMatch.tcl_match_confidence || 0,
            tclSegments: segments,
            addressFull,
            addressRange
          }]
        }
      }
    }
    
    // STEP 2: No valid cache - perform fuzzy matching
    logger.debug(`   🔍 Performing fuzzy match for: "${title}"`)
    
    // Extract street names from disruption text
    const text = `${title} ${description}`
    const streetNames = extractStreetNames(text)

    if (streetNames.length === 0) {
      logger.debug(`   No streets found in: "${title}"`)
      
      // Cache the "no match" result to avoid re-processing
      await updateMatchCache(disruptionExternalId, title, description, null)
      return []
    }

    logger.debug(`   Extracted streets: ${streetNames.join(', ')}`)

    // Get TCL street names for matching
    const tclStreetNames = await getTCLStreetNames()

    const matches: DisruptionTCLMatch[] = []

    // Match each extracted street name
    for (const streetName of streetNames) {
      const match = findBestMatch(streetName, tclStreetNames, 3)

      if (match.matchType !== 'none' && match.matchedName) {
        // Get TCL segments for matched street
        const segments = await getTCLSegmentsByStreet(match.matchedName)

        if (segments.length > 0) {
          // Build address string
          const addressFull = buildAddressString(match.matchedName, segments)
          const addressRange = buildAddressRange(segments)

          matches.push({
            disruptionExternalId,
            streetName: match.matchedName,
            matchType: match.matchType,
            confidence: match.confidence,
            tclSegments: segments,
            addressFull,
            addressRange
          })

          logger.debug(`   ✅ ${match.matchType.toUpperCase()} MATCH: "${streetName}" → "${match.matchedName}" (${segments.length} segments, confidence: ${match.confidence.toFixed(2)})`)
          
          // STEP 3: Cache the successful match (use first/best match)
          if (matches.length === 1) {
            await updateMatchCache(
              disruptionExternalId, 
              title, 
              description,
              {
                streetName: match.matchedName,
                matchType: match.matchType,
                confidence: match.confidence
              }
            )
          }
        }
      } else {
        logger.debug(`   ❌ No match for: "${streetName}"`)
      }
    }
    
    // If no matches found, cache the "no match" result
    if (matches.length === 0) {
      await updateMatchCache(disruptionExternalId, title, description, null)
    }

    return matches
  } catch (error) {
    logger.error(`❌ Error matching disruption ${disruptionExternalId}:`, error)
    return []
  }
}

/**
 * Store TCL mappings in database
 * Clears existing mappings for disruption first
 */
export async function storeTCLMappings(matches: DisruptionTCLMatch[]): Promise<number> {
  if (matches.length === 0) return 0

  const client = await pool.connect()
  let stored = 0

  try {
    await client.query('BEGIN')

    const disruptionId = matches[0].disruptionExternalId

    // Clear existing mappings
    await client.query(
      'DELETE FROM disruption_tcl_mapping WHERE disruption_external_id = $1',
      [disruptionId]
    )

    // Insert new mappings
    for (const match of matches) {
      for (const segment of match.tclSegments) {
        await client.query(`
          INSERT INTO disruption_tcl_mapping (
            disruption_external_id,
            tcl_segment_id,
            match_type,
            match_confidence,
            matched_street_name
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          match.disruptionExternalId,
          segment.id,
          match.matchType,
          match.confidence,
          match.streetName
        ])
        stored++
      }
    }

    // Update disruption with address info
    if (matches.length > 0) {
      const addressFull = matches.map(m => m.addressFull).filter(Boolean).join('; ')
      const addressRange = matches.map(m => m.addressRange).filter(Boolean).join('; ')

      await client.query(`
        UPDATE disruptions 
        SET 
          address_full = $1,
          address_range = $2,
          has_tcl_match = TRUE
        WHERE external_id = $3
      `, [addressFull, addressRange, disruptionId])
    }

    await client.query('COMMIT')
    return stored
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Build human-readable address string
 */
function buildAddressString(streetName: string, segments: any[]): string {
  // Find min/max address ranges across all segments
  const addresses = segments
    .flatMap(s => [
      s.address_left_from,
      s.address_left_to,
      s.address_right_from,
      s.address_right_to
    ])
    .filter(a => a != null && a > 0)

  if (addresses.length === 0) {
    return streetName
  }

  const min = Math.min(...addresses)
  const max = Math.max(...addresses)

  if (min === max) {
    return `${min} ${streetName}`
  }

  return `${min}-${max} ${streetName}`
}

/**
 * Build concise address range string
 */
function buildAddressRange(segments: any[]): string {
  const addresses = segments
    .flatMap(s => [
      s.address_left_from,
      s.address_left_to,
      s.address_right_from,
      s.address_right_to
    ])
    .filter(a => a != null && a > 0)

  if (addresses.length === 0) {
    return ''
  }

  const min = Math.min(...addresses)
  const max = Math.max(...addresses)

  if (min === max) {
    return `${min}`
  }

  return `${min}-${max}`
}

/**
 * Get cached match from database
 */
async function getCachedMatch(disruptionExternalId: string): Promise<{
  tcl_matched_street?: string | null
  tcl_match_confidence?: number | null
  tcl_match_type?: string | null
  tcl_match_hash?: string | null
  tcl_last_matched_at?: Date | null
} | null> {
  try {
    const result = await pool.query(
      `SELECT 
        tcl_matched_street, 
        tcl_match_confidence, 
        tcl_match_type, 
        tcl_match_hash,
        tcl_last_matched_at
      FROM disruptions 
      WHERE external_id = $1`,
      [disruptionExternalId]
    )
    
    return result.rows[0] || null
  } catch (error) {
    logger.error(`Error fetching cached match for ${disruptionExternalId}:`, error)
    return null
  }
}

/**
 * Update match cache in database
 */
async function updateMatchCache(
  disruptionExternalId: string,
  title: string,
  description: string,
  matchResult: {
    streetName: string
    matchType: 'exact' | 'fuzzy' | 'none'
    confidence: number
  } | null
): Promise<void> {
  try {
    const matchHash = computeMatchHash(title, description)
    
    await pool.query(
      `UPDATE disruptions 
      SET 
        tcl_matched_street = $1,
        tcl_match_confidence = $2,
        tcl_match_type = $3,
        tcl_match_hash = $4,
        tcl_last_matched_at = CURRENT_TIMESTAMP
      WHERE external_id = $5`,
      [
        matchResult?.streetName || null,
        matchResult?.confidence || null,
        matchResult?.matchType || 'none',
        matchHash,
        disruptionExternalId
      ]
    )
    
    logger.debug(`   💾 Cached match result for: ${disruptionExternalId}`)
  } catch (error) {
    // Log but don't fail - caching is optional optimization
    logger.error(`Error updating match cache for ${disruptionExternalId}:`, error)
  }
}

/**
 * Get TCL mappings for a disruption
 */
export async function getTCLMappingsForDisruption(disruptionExternalId: string): Promise<any[]> {
  const hasPostGIS = await isPostGISAvailable()
  const geometrySelect = hasPostGIS
    ? 'ST_AsGeoJSON(s.geometry) as geometry_geojson'
    : 's.geometry as geometry_geojson'

  const result = await pool.query(`
    SELECT 
      m.id,
      m.match_type,
      m.match_confidence,
      m.matched_street_name,
      s.centreline_id,
      s.street_name,
      s.address_left_from,
      s.address_left_to,
      s.address_right_from,
      s.address_right_to,
      ${geometrySelect}
    FROM disruption_tcl_mapping m
    JOIN tcl_segments s ON m.tcl_segment_id = s.id
    WHERE m.disruption_external_id = $1
    ORDER BY m.matched_street_name, s.centreline_id
  `, [disruptionExternalId])

  return result.rows
}

/**
 * Batch match multiple disruptions
 */
export async function batchMatchDisruptions(disruptions: Array<{
  external_id: string
  title: string
  description?: string
}>): Promise<{ matched: number; failed: number }> {
  let matched = 0
  let failed = 0

  logger.debug(`\n📍 Batch matching ${disruptions.length} disruptions to TCL...`)

  for (const disruption of disruptions) {
    try {
      const matches = await matchDisruptionToTCL(
        disruption.external_id,
        disruption.title,
        disruption.description || ''
      )

      if (matches.length > 0) {
        await storeTCLMappings(matches)
        matched++
      }
    } catch (error) {
      logger.error(`❌ Failed to match disruption ${disruption.external_id}:`, error)
      failed++
    }
  }

  logger.debug(`✅ Batch matching complete: ${matched} matched, ${failed} failed`)

  return { matched, failed }
}
