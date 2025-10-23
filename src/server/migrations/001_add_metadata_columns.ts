/**
 * Migration: Add metadata columns to disruptions tables
 * 
 * Adds source tracking columns for ETL metadata:
 * - source_api: Which API the data came from
 * - source_url: Original resource URL for audit trail
 * - raw_data: Full API response stored as JSONB
 * - last_fetched_at: Timestamp of last refresh
 */

import { Pool } from 'pg'

export const up = async (pool: Pool): Promise<void> => {
  console.log('📦 Running migration: Add metadata columns...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check if columns already exist (idempotent migration)
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'disruptions' 
        AND column_name IN ('source_api', 'source_url', 'raw_data', 'last_fetched_at')
    `
    const { rows } = await client.query(checkColumnsQuery)
    
    if (rows.length === 4) {
      console.log('✅ Metadata columns already exist, skipping...')
      await client.query('COMMIT')
      return
    }

    console.log('🔧 Adding metadata columns to disruptions table...')

    // Add columns if they don't exist (safe for partial migrations)
    await client.query(`
      ALTER TABLE disruptions 
      ADD COLUMN IF NOT EXISTS source_api VARCHAR(255),
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS raw_data JSONB,
      ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP WITH TIME ZONE
    `)

    await client.query(`
      ALTER TABLE disruptions_archive 
      ADD COLUMN IF NOT EXISTS source_api VARCHAR(255),
      ADD COLUMN IF NOT EXISTS source_url TEXT,
      ADD COLUMN IF NOT EXISTS raw_data JSONB,
      ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMP WITH TIME ZONE
    `)

    console.log('📊 Creating indexes on metadata columns...')

    // Create indexes for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_source_api 
      ON disruptions(source_api)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_archive_source_api 
      ON disruptions_archive(source_api)
    `)

    // Add index on last_fetched_at for finding stale data
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_last_fetched 
      ON disruptions(last_fetched_at DESC)
    `)

    await client.query('COMMIT')
    console.log('✅ Migration completed successfully!')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

export const down = async (pool: Pool): Promise<void> => {
  console.log('📦 Rolling back migration: Remove metadata columns...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Drop indexes
    await client.query('DROP INDEX IF EXISTS idx_disruptions_source_api')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_archive_source_api')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_last_fetched')

    // Drop columns
    await client.query(`
      ALTER TABLE disruptions 
      DROP COLUMN IF EXISTS source_api,
      DROP COLUMN IF EXISTS source_url,
      DROP COLUMN IF EXISTS raw_data,
      DROP COLUMN IF EXISTS last_fetched_at
    `)

    await client.query(`
      ALTER TABLE disruptions_archive 
      DROP COLUMN IF EXISTS source_api,
      DROP COLUMN IF EXISTS source_url,
      DROP COLUMN IF EXISTS raw_data,
      DROP COLUMN IF EXISTS last_fetched_at
    `)

    await client.query('COMMIT')
    console.log('✅ Rollback completed successfully!')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Rollback failed:', error)
    throw error
  } finally {
    client.release()
  }
}
