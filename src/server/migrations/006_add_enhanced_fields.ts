/**
 * Migration: Add enhanced filter fields to disruptions tables
 * 
 * Adds columns for enhanced filtering:
 * - work_type: Type of work being performed
 * - schedule_type: When the work is happening (24/7, Weekdays Only, etc.)
 * - duration: Duration category (< 1 day, 1-7 days, etc.)
 * - impact_level: Level of impact (Low, Medium, High)
 * - onsite_hours: When workers are on-site
 * - road_class: Classification of the road
 * - contractor: Company performing the work
 */

import { Pool } from 'pg'

export const up = async (pool: Pool): Promise<void> => {
  console.log('📦 Running migration: Add enhanced filter fields...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check if columns already exist (idempotent migration)
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'disruptions' 
        AND column_name IN ('work_type', 'schedule_type', 'duration', 'impact_level', 'onsite_hours', 'road_class', 'contractor')
    `
    const { rows } = await client.query(checkColumnsQuery)
    
    if (rows.length === 7) {
      console.log('✅ Enhanced fields already exist, skipping...')
      await client.query('COMMIT')
      return
    }

    console.log('🔧 Adding enhanced fields to disruptions table...')

    // Add columns to disruptions table
    await client.query(`
      ALTER TABLE disruptions 
      ADD COLUMN IF NOT EXISTS work_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS duration VARCHAR(50),
      ADD COLUMN IF NOT EXISTS impact_level VARCHAR(20),
      ADD COLUMN IF NOT EXISTS onsite_hours VARCHAR(255),
      ADD COLUMN IF NOT EXISTS road_class VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contractor VARCHAR(255)
    `)

    // Add columns to archive table
    await client.query(`
      ALTER TABLE disruptions_archive 
      ADD COLUMN IF NOT EXISTS work_type VARCHAR(255),
      ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS duration VARCHAR(50),
      ADD COLUMN IF NOT EXISTS impact_level VARCHAR(20),
      ADD COLUMN IF NOT EXISTS onsite_hours VARCHAR(255),
      ADD COLUMN IF NOT EXISTS road_class VARCHAR(100),
      ADD COLUMN IF NOT EXISTS contractor VARCHAR(255)
    `)

    console.log('📊 Creating indexes on enhanced fields...')

    // Create indexes for efficient filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_work_type 
      ON disruptions(work_type) WHERE work_type IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_schedule_type 
      ON disruptions(schedule_type) WHERE schedule_type IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_duration 
      ON disruptions(duration) WHERE duration IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_impact_level 
      ON disruptions(impact_level) WHERE impact_level IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_road_class 
      ON disruptions(road_class) WHERE road_class IS NOT NULL
    `)

    await client.query('COMMIT')
    console.log('✅ Migration 006 completed successfully!')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

export const down = async (pool: Pool): Promise<void> => {
  console.log('📦 Rolling back migration: Remove enhanced filter fields...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Drop indexes
    await client.query('DROP INDEX IF EXISTS idx_disruptions_work_type')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_schedule_type')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_duration')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_impact_level')
    await client.query('DROP INDEX IF EXISTS idx_disruptions_road_class')

    // Drop columns from disruptions table
    await client.query(`
      ALTER TABLE disruptions 
      DROP COLUMN IF EXISTS work_type,
      DROP COLUMN IF EXISTS schedule_type,
      DROP COLUMN IF EXISTS duration,
      DROP COLUMN IF EXISTS impact_level,
      DROP COLUMN IF EXISTS onsite_hours,
      DROP COLUMN IF EXISTS road_class,
      DROP COLUMN IF EXISTS contractor
    `)

    // Drop columns from archive table
    await client.query(`
      ALTER TABLE disruptions_archive 
      DROP COLUMN IF EXISTS work_type,
      DROP COLUMN IF EXISTS schedule_type,
      DROP COLUMN IF EXISTS duration,
      DROP COLUMN IF EXISTS impact_level,
      DROP COLUMN IF EXISTS onsite_hours,
      DROP COLUMN IF EXISTS road_class,
      DROP COLUMN IF EXISTS contractor
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

export const id = '006_add_enhanced_fields'
export const name = 'Add enhanced filter fields to disruptions tables'
