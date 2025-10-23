/**
 * Migration: Add Performance Indexes
 * 
 * Adds critical indexes for:
 * 1. Inactivity detection (last_fetched_at, is_active composite)
 * 2. Historical analytics (archive table indexes)
 * 3. GIN index for array queries (affected_lines)
 */

import { Pool } from 'pg'

export const id = '002'
export const name = 'add_performance_indexes'

export async function up(pool: Pool): Promise<void> {
  console.log('📦 Running migration: Add performance indexes...')

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Disruptions table indexes for inactivity detection
    console.log('  → Adding disruptions table indexes...')
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_external_id 
        ON disruptions(external_id);
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_last_fetched 
        ON disruptions(last_fetched_at DESC);
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_active_fetched 
        ON disruptions(is_active, last_fetched_at DESC);
    `)

    // Archive table indexes for analytics
    console.log('  → Adding archive table indexes...')
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_external_id 
        ON disruptions_archive(external_id);
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_created_at 
        ON disruptions_archive(created_at DESC);
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_resolved_at 
        ON disruptions_archive(resolved_at DESC);
    `)
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_duration 
        ON disruptions_archive(duration_minutes DESC);
    `)
    
    // GIN index for array searches (e.g., find all disruptions affecting Line 1)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_archive_affected_lines 
        ON disruptions_archive USING GIN(affected_lines);
    `)

    await client.query('COMMIT')
    console.log('✓ Performance indexes added successfully')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

export async function down(pool: Pool): Promise<void> {
  console.log('📦 Rolling back migration: Remove performance indexes...')

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Drop disruptions indexes
    await client.query('DROP INDEX IF EXISTS idx_disruptions_external_id')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_last_fetched')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_active_fetched')

    // Drop archive indexes
    await client.query('DROP INDEX IF EXISTS idx_archive_external_id')
    await client.query('DROP INDEX IF EXISTS idx_archive_created_at')
    await client.query('DROP INDEX IF EXISTS idx_archive_resolved_at')
    await client.query('DROP INDEX IF EXISTS idx_archive_duration')
    await client.query('DROP INDEX IF EXISTS idx_archive_affected_lines')

    await client.query('COMMIT')
    console.log('✓ Performance indexes removed')

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
