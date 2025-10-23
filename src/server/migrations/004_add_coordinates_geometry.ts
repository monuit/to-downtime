/**
 * Migration: Add Coordinates Geometry to Disruptions
 * 
 * Adds support for storing and retrieving geographic coordinates for all disruption types:
 * - Road restrictions with geocoded coordinates
 * - Transit disruptions with calculated centroids
 * - Enables map visualization and geographic filtering
 */

import { Pool } from 'pg'

export const up = async (pool: Pool): Promise<void> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    console.log('   📍 Adding coordinates columns to disruptions table...')
    
    // Add coordinate columns for geographic data
    await client.query(`
      ALTER TABLE disruptions 
      ADD COLUMN IF NOT EXISTS coordinates_lat DECIMAL(10, 6),
      ADD COLUMN IF NOT EXISTS coordinates_lng DECIMAL(10, 6),
      ADD COLUMN IF NOT EXISTS district VARCHAR(100);
    `)

    // Create indexes for geographic queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_coordinates 
      ON disruptions(coordinates_lat, coordinates_lng) 
      WHERE coordinates_lat IS NOT NULL AND coordinates_lng IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_disruptions_district 
      ON disruptions(district) 
      WHERE district IS NOT NULL;
    `)

    await client.query('COMMIT')
    console.log('   ✅ Coordinates columns and indexes created successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const down = async (pool: Pool): Promise<void> => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    console.log('   📍 Removing coordinates columns from disruptions table...')
    
    await client.query(`
      ALTER TABLE disruptions 
      DROP COLUMN IF EXISTS coordinates_lat,
      DROP COLUMN IF EXISTS coordinates_lng,
      DROP COLUMN IF EXISTS district
    `)

    await client.query('COMMIT')
    console.log('   ✅ Coordinates columns removed successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
