/**
 * Migration: Add TCL fuzzy matching cache
 * 
 * Adds columns to cache fuzzy matching results:
 * - tcl_matched_street: The street name that was matched
 * - tcl_match_confidence: Confidence score of the match (0-100)
 * - tcl_match_type: Type of match (exact/fuzzy/none)
 * - tcl_last_matched_at: When matching was last performed
 * - tcl_match_hash: Hash of title+description to detect changes
 * 
 * This prevents re-running expensive fuzzy matching on every ETL run
 */

import { Pool } from 'pg'
import crypto from 'crypto'

export const up = async (pool: Pool): Promise<void> => {
  console.log('📦 Running migration: Add TCL fuzzy matching cache...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check if columns already exist (idempotent migration)
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'disruptions' 
        AND column_name IN ('tcl_matched_street', 'tcl_match_confidence', 'tcl_match_type', 'tcl_last_matched_at', 'tcl_match_hash')
    `
    const { rows } = await client.query(checkColumnsQuery)

    if (rows.length === 0) {
      console.log('  ➕ Adding TCL matching cache columns to disruptions table...')
      
      await client.query(`
        ALTER TABLE disruptions 
        ADD COLUMN tcl_matched_street VARCHAR(255),
        ADD COLUMN tcl_match_confidence NUMERIC(5, 2),
        ADD COLUMN tcl_match_type VARCHAR(20),
        ADD COLUMN tcl_last_matched_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN tcl_match_hash VARCHAR(64);
      `)

      await client.query(`
        ALTER TABLE disruptions_archive 
        ADD COLUMN tcl_matched_street VARCHAR(255),
        ADD COLUMN tcl_match_confidence NUMERIC(5, 2),
        ADD COLUMN tcl_match_type VARCHAR(20),
        ADD COLUMN tcl_last_matched_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN tcl_match_hash VARCHAR(64);
      `)

      // Add indexes for faster cache lookups
      await client.query(`
        CREATE INDEX idx_disruptions_tcl_match_hash 
        ON disruptions(tcl_match_hash) 
        WHERE tcl_match_hash IS NOT NULL;
      `)

      await client.query(`
        CREATE INDEX idx_disruptions_tcl_matched_street 
        ON disruptions(tcl_matched_street) 
        WHERE tcl_matched_street IS NOT NULL;
      `)

      // Add index for finding stale matches
      await client.query(`
        CREATE INDEX idx_disruptions_tcl_last_matched 
        ON disruptions(tcl_last_matched_at) 
        WHERE tcl_last_matched_at IS NOT NULL;
      `)

      console.log('  ✅ TCL matching cache columns added')
    } else {
      console.log('  ⏭️  TCL matching cache columns already exist, skipping...')
    }

    await client.query('COMMIT')
    console.log('✅ Migration complete: TCL fuzzy matching cache')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

export const down = async (pool: Pool): Promise<void> => {
  console.log('♻️  Rolling back migration: TCL fuzzy matching cache...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Drop indexes
    await client.query(`DROP INDEX IF EXISTS idx_disruptions_tcl_match_hash;`)
    await client.query(`DROP INDEX IF EXISTS idx_disruptions_tcl_matched_street;`)
    await client.query(`DROP INDEX IF EXISTS idx_disruptions_tcl_last_matched;`)

    // Drop columns from disruptions
    await client.query(`
      ALTER TABLE disruptions 
      DROP COLUMN IF EXISTS tcl_matched_street,
      DROP COLUMN IF EXISTS tcl_match_confidence,
      DROP COLUMN IF EXISTS tcl_match_type,
      DROP COLUMN IF EXISTS tcl_last_matched_at,
      DROP COLUMN IF EXISTS tcl_match_hash;
    `)

    // Drop columns from archive
    await client.query(`
      ALTER TABLE disruptions_archive 
      DROP COLUMN IF EXISTS tcl_matched_street,
      DROP COLUMN IF EXISTS tcl_match_confidence,
      DROP COLUMN IF EXISTS tcl_match_type,
      DROP COLUMN IF EXISTS tcl_last_matched_at,
      DROP COLUMN IF EXISTS tcl_match_hash;
    `)

    await client.query('COMMIT')
    console.log('✅ Rollback complete')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Rollback failed:', error)
    throw error
  } finally {
    client.release()
  }
}
