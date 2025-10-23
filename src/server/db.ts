import { Pool, QueryResult } from 'pg'

/**
 * Postgres Database Connection & Utilities
 * Uses Neon serverless Postgres with connection pooling
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL is required for Neon
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
})

/**
 * Initialize database schema
 * Creates tables if they don't exist
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE,
        INDEX (type),
        INDEX (severity),
        INDEX (is_active),
        INDEX (created_at DESC)
      )
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
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration_minutes INT,
        INDEX (type),
        INDEX (severity),
        INDEX (archived_at DESC)
      )
    `)

    // Deduplication tracking (to prevent duplicates)
    await client.query(`
      CREATE TABLE IF NOT EXISTS disruption_hashes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        disruption_id UUID NOT NULL REFERENCES disruptions(id) ON DELETE CASCADE,
        content_hash VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        INDEX (disruption_id),
        INDEX (content_hash)
      )
    `)

    console.log('✓ Database schema initialized')
  } finally {
    client.release()
  }
}

/**
 * Insert or update a disruption
 */
export const upsertDisruption = async (
  externalId: string,
  data: {
    type: string
    severity: string
    title: string
    description?: string
    affectedLines?: string[]
  }
): Promise<any> => {
  const query = `
    INSERT INTO disruptions (
      external_id, type, severity, title, description, affected_lines, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
    ON CONFLICT (external_id) 
    DO UPDATE SET
      type = $2,
      severity = $3,
      title = $4,
      description = $5,
      affected_lines = $6,
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
  ])

  return result.rows[0]
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
