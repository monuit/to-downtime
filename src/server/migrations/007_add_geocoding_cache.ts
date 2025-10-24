/**
 * Migration: Add geocoding cache columns
 * 
 * Adds columns to cache geocoded coordinates:
 * - geocoded_lat: Latitude coordinate
 * - geocoded_lon: Longitude coordinate
 * - geocoded_source: How the coordinate was determined (line/static/geocoded/fallback)
 * - geocoded_name: Name of the location (station/intersection)
 * 
 * This prevents repeated external API calls to OpenStreetMap Nominatim
 */

import { Pool } from 'pg'

export const up = async (pool: Pool): Promise<void> => {
  console.log('📦 Running migration: Add geocoding cache columns...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check if columns already exist (idempotent migration)
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'disruptions' 
        AND column_name IN ('geocoded_lat', 'geocoded_lon', 'geocoded_source', 'geocoded_name')
    `
    const { rows } = await client.query(checkColumnsQuery)

    if (rows.length === 0) {
      console.log('  ➕ Adding geocoding cache columns to disruptions table...')
      
      await client.query(`
        ALTER TABLE disruptions 
        ADD COLUMN geocoded_lat NUMERIC(10, 7),
        ADD COLUMN geocoded_lon NUMERIC(10, 7),
        ADD COLUMN geocoded_source VARCHAR(20),
        ADD COLUMN geocoded_name VARCHAR(255);
      `)

      await client.query(`
        ALTER TABLE disruptions_archive 
        ADD COLUMN geocoded_lat NUMERIC(10, 7),
        ADD COLUMN geocoded_lon NUMERIC(10, 7),
        ADD COLUMN geocoded_source VARCHAR(20),
        ADD COLUMN geocoded_name VARCHAR(255);
      `)

      console.log('  ✅ Geocoding cache columns added')
    } else {
      console.log('  ⏭️  Geocoding cache columns already exist, skipping...')
    }

    // Add index for faster spatial queries (check if it exists first)
    const checkIndexQuery = `
      SELECT 1 
      FROM pg_indexes 
      WHERE indexname = 'idx_disruptions_coordinates'
    `
    const { rows: indexRows } = await client.query(checkIndexQuery)

    if (indexRows.length === 0) {
      console.log('  ➕ Creating spatial index...')
      await client.query(`
        CREATE INDEX idx_disruptions_coordinates 
        ON disruptions(geocoded_lat, geocoded_lon) 
        WHERE geocoded_lat IS NOT NULL AND geocoded_lon IS NOT NULL;
      `)
      console.log('  ✅ Spatial index created')
    } else {
      console.log('  ⏭️  Spatial index already exists, skipping...')
    }

    await client.query('COMMIT')
    console.log('✅ Migration complete: Geocoding cache')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

export const down = async (pool: Pool): Promise<void> => {
  console.log('♻️  Rolling back migration: Geocoding cache columns...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Drop index
    await client.query(`DROP INDEX IF EXISTS idx_disruptions_coordinates;`)

    // Drop columns from disruptions
    await client.query(`
      ALTER TABLE disruptions 
      DROP COLUMN IF EXISTS geocoded_lat,
      DROP COLUMN IF EXISTS geocoded_lon,
      DROP COLUMN IF EXISTS geocoded_source,
      DROP COLUMN IF EXISTS geocoded_name;
    `)

    // Drop columns from archive
    await client.query(`
      ALTER TABLE disruptions_archive 
      DROP COLUMN IF EXISTS geocoded_lat,
      DROP COLUMN IF EXISTS geocoded_lon,
      DROP COLUMN IF EXISTS geocoded_source,
      DROP COLUMN IF EXISTS geocoded_name;
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

