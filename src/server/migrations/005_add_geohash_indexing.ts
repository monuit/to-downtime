/**
 * Migration: Add geohash spatial indexing
 * 
 * Adds geohash columns to tcl_segments for fast spatial queries
 * without requiring PostGIS extension.
 */

import { pool } from '../db.js'
import { logger } from '../logger.js'

const MIGRATION_NAME = '005_add_geohash_indexing'

export async function up() {
  const client = await pool.connect()

  try {
    // Add geohash columns to tcl_segments
    await client.query(`
      ALTER TABLE tcl_segments
      ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS geohash_7 TEXT,  -- Street-level precision (~76m)
      ADD COLUMN IF NOT EXISTS geohash_6 TEXT   -- Neighborhood precision (~610m)
    `)

    // Create indexes for fast geohash queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tcl_geohash_7 ON tcl_segments (geohash_7)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tcl_geohash_6 ON tcl_segments (geohash_6)
    `)

    // Create index for coordinate queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tcl_center_coords ON tcl_segments (center_lat, center_lng)
    `)

    logger.info(`✅ Migration ${MIGRATION_NAME} completed`)
  } finally {
    client.release()
  }
}

export async function down() {
  const client = await pool.connect()

  try {
    await client.query(`
      DROP INDEX IF EXISTS idx_tcl_center_coords
    `)

    await client.query(`
      DROP INDEX IF EXISTS idx_tcl_geohash_6
    `)

    await client.query(`
      DROP INDEX IF EXISTS idx_tcl_geohash_7
    `)

    await client.query(`
      ALTER TABLE tcl_segments
      DROP COLUMN IF EXISTS geohash_6,
      DROP COLUMN IF EXISTS geohash_7,
      DROP COLUMN IF EXISTS center_lng,
      DROP COLUMN IF EXISTS center_lat
    `)

    logger.info(`✅ Migration ${MIGRATION_NAME} rollback completed`)
  } finally {
    client.release()
  }
}
