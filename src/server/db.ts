import dotenv from 'dotenv'
dotenv.config() // Load .env BEFORE anything else

import { Pool, QueryResult } from 'pg'
import { runMigrations } from './migrations/index.js'

/**
 * Postgres Database Connection & Utilities
 * Uses Railway/Neon Postgres with connection pooling
 */

// Parse DATABASE_URL to avoid SASL password encoding issues
const databaseUrl = process.env.DATABASE_URL || ''
const urlPattern = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/
const match = databaseUrl.match(urlPattern)

// Quiet mode - only log if there's an issue
if (!match && databaseUrl) {
  console.error('⚠️  Failed to parse DATABASE_URL')
}

const pool = new Pool(
  match
    ? {
        user: match[1],
        password: match[2],
        host: match[3],
        port: parseInt(match[4], 10),
        database: match[5],
        ssl: false,
      }
    : {
        connectionString: databaseUrl,
        ssl: false,
      }
)

// Export pool for migrations
export { pool }

/**
 * Initialize database schema and run migrations
 * Creates tables if they don't exist and applies pending migrations
 */
export const initializeDatabase = async (): Promise<void> => {
  const client = await pool.connect()

  try {
    // Disruptions table (current active disruptions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS disruptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        affected_lines TEXT[],
        source_api VARCHAR(255),
        source_url TEXT,
        raw_data JSONB,
        last_fetched_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE
      )
    `)

    // Create indexes for disruptions table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_type ON disruptions(type);
      CREATE INDEX IF NOT EXISTS idx_disruptions_severity ON disruptions(severity);
      CREATE INDEX IF NOT EXISTS idx_disruptions_is_active ON disruptions(is_active);
      CREATE INDEX IF NOT EXISTS idx_disruptions_created_at ON disruptions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_disruptions_source_api ON disruptions(source_api);
      CREATE INDEX IF NOT EXISTS idx_disruptions_external_id ON disruptions(external_id);
      CREATE INDEX IF NOT EXISTS idx_disruptions_last_fetched ON disruptions(last_fetched_at DESC);
      CREATE INDEX IF NOT EXISTS idx_disruptions_active_fetched ON disruptions(is_active, last_fetched_at DESC);
    `)

    // Archive table (historical records)
    await client.query(`
      CREATE TABLE IF NOT EXISTS disruptions_archive (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        affected_lines TEXT[],
        source_api VARCHAR(255),
        source_url TEXT,
        raw_data JSONB,
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration_minutes INT
      )
    `)

    // Create indexes for archive table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_type ON disruptions_archive(type);
      CREATE INDEX IF NOT EXISTS idx_archive_severity ON disruptions_archive(severity);
      CREATE INDEX IF NOT EXISTS idx_archive_archived_at ON disruptions_archive(archived_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_source_api ON disruptions_archive(source_api);
      CREATE INDEX IF NOT EXISTS idx_archive_external_id ON disruptions_archive(external_id);
      CREATE INDEX IF NOT EXISTS idx_archive_created_at ON disruptions_archive(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_resolved_at ON disruptions_archive(resolved_at DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_duration ON disruptions_archive(duration_minutes DESC);
      CREATE INDEX IF NOT EXISTS idx_archive_affected_lines ON disruptions_archive USING GIN(affected_lines);
    `)

    // Deduplication tracking (to prevent duplicates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS disruption_hashes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        disruption_id UUID NOT NULL REFERENCES disruptions(id) ON DELETE CASCADE,
        content_hash VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes for hashes table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hashes_disruption_id ON disruption_hashes(disruption_id);
      CREATE INDEX IF NOT EXISTS idx_hashes_content_hash ON disruption_hashes(content_hash);
    `)

    // Silent in quiet mode
  } finally {
    client.release()
  }

  // Run pending migrations (silent in quiet mode)
  await runMigrations(pool)
}

/**
 * Insert or update a disruption with metadata tracking
 */
export const upsertDisruption = async (
  externalId: string,
  data: {
    type: string
    severity: string
    title: string
    description?: string
    affectedLines?: string[]
    sourceApi?: string
    sourceUrl?: string
    rawData?: any
    coordinates?: { lat: number; lng: number }
    district?: string
  }
): Promise<any> => {
  // Try with coordinates columns first (post-migration)
  // If that fails, fall back to columns without coordinates
  try {
    const query = `
      INSERT INTO disruptions (
        external_id, type, severity, title, description, affected_lines, 
        source_api, source_url, raw_data, coordinates_lat, coordinates_lng, district, last_fetched_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, TRUE)
      ON CONFLICT (external_id) 
      DO UPDATE SET
        type = $2,
        severity = $3,
        title = $4,
        description = $5,
        affected_lines = $6,
        source_api = $7,
        source_url = $8,
        raw_data = $9,
        coordinates_lat = $10,
        coordinates_lng = $11,
        district = $12,
        last_fetched_at = CURRENT_TIMESTAMP,
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    const result = await pool.query(query, [
      externalId,
      data.type,
      data.severity,
      data.title,
      data.description || null,
      data.affectedLines || null,
      data.sourceApi || null,
      data.sourceUrl || null,
      data.rawData ? JSON.stringify(data.rawData) : null,
      data.coordinates?.lat || null,
      data.coordinates?.lng || null,
      data.district || null,
    ])

    return result.rows[0]
  } catch (coordinatesError) {
    // Fallback: Try without coordinates columns (pre-migration)
    if ((coordinatesError as any)?.message?.includes('column')) {
      console.debug('⚠️  Coordinates columns not yet available, using fallback')
      const fallbackQuery = `
        INSERT INTO disruptions (
          external_id, type, severity, title, description, affected_lines, 
          source_api, source_url, raw_data, last_fetched_at, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, TRUE)
        ON CONFLICT (external_id) 
        DO UPDATE SET
          type = $2,
          severity = $3,
          title = $4,
          description = $5,
          affected_lines = $6,
          source_api = $7,
          source_url = $8,
          raw_data = $9,
          last_fetched_at = CURRENT_TIMESTAMP,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `

      const result = await pool.query(fallbackQuery, [
        externalId,
        data.type,
        data.severity,
        data.title,
        data.description || null,
        data.affectedLines || null,
        data.sourceApi || null,
        data.sourceUrl || null,
        data.rawData ? JSON.stringify(data.rawData) : null,
      ])

      return result.rows[0]
    }
    
    // If it's a different error, re-throw it
    throw coordinatesError
  }
}

/**
 * Get all active disruptions
 */
export const getActiveDisruptions = async (): Promise<any[]> => {
  const query = `
    SELECT id, external_id, type, severity, title, description, affected_lines, created_at, updated_at
    FROM disruptions
    WHERE is_active = TRUE
    ORDER BY severity DESC, updated_at DESC
  `

  const result = await pool.query(query)
  return result.rows
}

/**
 * Resolve a disruption (mark as resolved and archive it)
 */
export const resolveDisruption = async (externalId: string): Promise<void> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Get the disruption
    const disruption = await client.query(
      'SELECT * FROM disruptions WHERE external_id = $1 AND is_active = TRUE',
      [externalId]
    )

    if (disruption.rows.length === 0) {
      throw new Error(`Disruption ${externalId} not found or already resolved`)
    }

    const row = disruption.rows[0]
    const resolvedAt = new Date()
    const durationMinutes = row.resolved_at
      ? 0
      : Math.floor((resolvedAt.getTime() - row.created_at.getTime()) / 60000)

    // Archive it
    await client.query(
      `INSERT INTO disruptions_archive (
        external_id, type, severity, title, description, affected_lines,
        created_at, updated_at, resolved_at, duration_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        row.external_id,
        row.type,
        row.severity,
        row.title,
        row.description,
        row.affected_lines,
        row.created_at,
        row.updated_at,
        resolvedAt,
        durationMinutes,
      ]
    )

    // Mark as resolved
    await client.query(
      'UPDATE disruptions SET is_active = FALSE, resolved_at = $1 WHERE external_id = $2',
      [resolvedAt, externalId]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Check for duplicate using content hash
 */
export const isDuplicate = async (disruptionId: string, contentHash: string): Promise<boolean> => {
  const query = 'SELECT id FROM disruption_hashes WHERE content_hash = $1'
  const result = await pool.query(query, [contentHash])
  return result.rows.length > 0
}

/**
 * Record content hash to prevent duplicates
 */
export const recordContentHash = async (disruptionId: string, contentHash: string): Promise<void> => {
  const query = `
    INSERT INTO disruption_hashes (disruption_id, content_hash)
    VALUES ($1, $2)
    ON CONFLICT (content_hash) DO NOTHING
  `
  await pool.query(query, [disruptionId, contentHash])
}

/**
 * Get archive stats
 */
export const getArchiveStats = async (): Promise<any> => {
  const query = `
    SELECT
      COUNT(*) as total_archived,
      COUNT(CASE WHEN severity = 'severe' THEN 1 END) as severe_count,
      COUNT(CASE WHEN severity = 'moderate' THEN 1 END) as moderate_count,
      COUNT(CASE WHEN severity = 'minor' THEN 1 END) as minor_count,
      AVG(duration_minutes) as avg_duration_minutes,
      MAX(resolved_at) as most_recent_resolution
    FROM disruptions_archive
    WHERE archived_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
  `

  const result = await pool.query(query)
  return result.rows[0]
}

/**
 * Get all active disruptions (with address data from TCL and coordinates)
 */
export const getAllDisruptions = async (): Promise<any[]> => {
  try {
    // Try with coordinates columns first (post-migration)
    const query = `
      SELECT 
        d.id,
        d.external_id,
        d.type,
        d.severity,
        d.title,
        d.description,
        d.affected_lines,
        d.source_api,
        d.source_url,
        d.raw_data,
        d.created_at,
        d.updated_at,
        d.resolved_at,
        d.is_active,
        d.address_full,
        d.address_range,
        d.has_tcl_match,
        d.coordinates_lat,
        d.coordinates_lng,
        d.district,
        CASE 
          WHEN d.coordinates_lat IS NOT NULL AND d.coordinates_lng IS NOT NULL
          THEN jsonb_build_object('lat', d.coordinates_lat, 'lng', d.coordinates_lng)
          ELSE NULL
        END as coordinates,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'street_name', s.street_name,
              'address_range', CONCAT_WS('-', 
                LEAST(NULLIF(s.address_left_from, 0), NULLIF(s.address_right_from, 0)),
                GREATEST(NULLIF(s.address_left_to, 0), NULLIF(s.address_right_to, 0))
              ),
              'match_type', m.match_type,
              'confidence', m.match_confidence
            )
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'::json
        ) as tcl_matches
      FROM disruptions d
      LEFT JOIN disruption_tcl_mapping m ON d.external_id = m.disruption_external_id
      LEFT JOIN tcl_segments s ON m.tcl_segment_id = s.id
      WHERE d.is_active = TRUE
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `

    const result = await pool.query(query)
    return result.rows
  } catch (coordinatesError) {
    // Fallback: Try without coordinates columns (pre-migration)
    if ((coordinatesError as any)?.message?.includes('column')) {
      console.debug('⚠️  Coordinates columns not yet available, using fallback')
      const fallbackQuery = `
        SELECT 
          d.id,
          d.external_id,
          d.type,
          d.severity,
          d.title,
          d.description,
          d.affected_lines,
          d.source_api,
          d.source_url,
          d.raw_data,
          d.created_at,
          d.updated_at,
          d.resolved_at,
          d.is_active,
          d.address_full,
          d.address_range,
          d.has_tcl_match,
          NULL::decimal as coordinates_lat,
          NULL::decimal as coordinates_lng,
          NULL::varchar as district,
          NULL as coordinates,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'street_name', s.street_name,
                'address_range', CONCAT_WS('-', 
                  LEAST(NULLIF(s.address_left_from, 0), NULLIF(s.address_right_from, 0)),
                  GREATEST(NULLIF(s.address_left_to, 0), NULLIF(s.address_right_to, 0))
                ),
                'match_type', m.match_type,
                'confidence', m.match_confidence
              )
            ) FILTER (WHERE m.id IS NOT NULL),
            '[]'::json
          ) as tcl_matches
        FROM disruptions d
        LEFT JOIN disruption_tcl_mapping m ON d.external_id = m.disruption_external_id
        LEFT JOIN tcl_segments s ON m.tcl_segment_id = s.id
        WHERE d.is_active = TRUE
        GROUP BY d.id
        ORDER BY d.created_at DESC
      `

      const result = await pool.query(fallbackQuery)
      return result.rows
    }
    
    // If it's a different error, re-throw it
    throw coordinatesError
  }
}

/**
 * Clean up resolved disruptions older than X days
 */
export const cleanupOldResolved = async (daysOld: number = 30): Promise<number> => {
  const query = `
    DELETE FROM disruptions
    WHERE is_active = FALSE
    AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
  `

  const result = await pool.query(query)
  return result.rowCount || 0
}

/**
 * Close pool connection
 */
export const closePool = async (): Promise<void> => {
  await pool.end()
}

export default pool
