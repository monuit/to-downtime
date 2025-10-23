/**
 * Migration: Add Toronto Centreline (TCL) Tables
 * 
 * Creates:
 * - tcl_segments: Stores street segment data with geometry
 * - disruption_tcl_mapping: Links disruptions to street segments
 * - Spatial indexes for fast geographic queries
 */

import { Pool } from 'pg'

export const up = async (pool: Pool): Promise<void> => {
  const client = await pool.connect()

  try {
    console.log('   📍 Checking for PostGIS extension...')
    // Try to enable PostGIS extension BEFORE starting transaction
    // This must be done outside transaction because extension creation uses DDL
    let hasPostGIS = false
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS postgis;`)
      hasPostGIS = true
      console.log('   ✅ PostGIS extension enabled')
    } catch (postgisError) {
      console.log('   ⚠️  PostGIS not available - using TEXT geometry fallback')
      console.log('      (Install PostGIS for production: https://postgis.net/install/)')
    }

    // Now start transaction for table creation
    await client.query('BEGIN')

    console.log('   📍 Creating tcl_segments table...')
    // TCL Segments table - stores Toronto Centreline street data
    await client.query(`
      CREATE TABLE IF NOT EXISTS tcl_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        centreline_id INTEGER UNIQUE NOT NULL,
        street_name VARCHAR(255) NOT NULL,
        street_name_normalized VARCHAR(255) NOT NULL,
        feature_code VARCHAR(50),
        feature_code_desc VARCHAR(255),
        address_left_from INTEGER,
        address_left_to INTEGER,
        address_right_from INTEGER,
        address_right_to INTEGER,
        geometry ${hasPostGIS ? 'GEOMETRY(MultiLineString, 4326)' : 'TEXT'},
        raw_properties JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    console.log('   📍 Creating indexes...')
    // Spatial index for fast geographic queries (only if PostGIS available)
    if (hasPostGIS) {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_tcl_segments_geometry 
        ON tcl_segments USING GIST(geometry);
      `)
    }

    // Standard indexes for lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tcl_segments_street_name 
      ON tcl_segments(street_name);
      
      CREATE INDEX IF NOT EXISTS idx_tcl_segments_street_name_normalized 
      ON tcl_segments(street_name_normalized);
      
      CREATE INDEX IF NOT EXISTS idx_tcl_segments_centreline_id 
      ON tcl_segments(centreline_id);
    `)

    console.log('   📍 Creating disruption_tcl_mapping table...')
    // Junction table - links disruptions to TCL segments
    await client.query(`
      CREATE TABLE IF NOT EXISTS disruption_tcl_mapping (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        disruption_external_id VARCHAR(255) NOT NULL,
        tcl_segment_id UUID NOT NULL REFERENCES tcl_segments(id) ON DELETE CASCADE,
        match_type VARCHAR(20) NOT NULL, -- 'exact', 'fuzzy', 'manual'
        match_confidence DECIMAL(3, 2), -- 0.00 to 1.00
        matched_street_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_disruption 
          FOREIGN KEY (disruption_external_id) 
          REFERENCES disruptions(external_id) 
          ON DELETE CASCADE
      )
    `)

    // Indexes for disruption-segment mapping lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruption_tcl_mapping_disruption 
      ON disruption_tcl_mapping(disruption_external_id);
      
      CREATE INDEX IF NOT EXISTS idx_disruption_tcl_mapping_segment 
      ON disruption_tcl_mapping(tcl_segment_id);
    `)

    console.log('   📍 Adding address columns to disruptions table...')
    // Add address-related columns to existing disruptions table
    await client.query(`
      ALTER TABLE disruptions 
      ADD COLUMN IF NOT EXISTS address_full VARCHAR(500),
      ADD COLUMN IF NOT EXISTS address_range VARCHAR(255),
      ADD COLUMN IF NOT EXISTS has_tcl_match BOOLEAN DEFAULT FALSE;
    `)

    // Index for quick filtering by address match status
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_disruptions_has_tcl_match 
      ON disruptions(has_tcl_match);
    `)

    console.log('   📍 Creating tcl_metadata table for ETL tracking...')
    // Metadata table - tracks TCL data updates
    await client.query(`
      CREATE TABLE IF NOT EXISTS tcl_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        last_fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
        total_segments INTEGER NOT NULL,
        data_version VARCHAR(100),
        file_size_bytes BIGINT,
        fetch_duration_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query('COMMIT')
    console.log('   ✅ TCL tables and indexes created successfully')
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

    console.log('   📍 Dropping TCL tables...')
    
    await client.query('DROP TABLE IF EXISTS disruption_tcl_mapping CASCADE')
    await client.query('DROP TABLE IF EXISTS tcl_segments CASCADE')
    await client.query('DROP TABLE IF EXISTS tcl_metadata CASCADE')

    await client.query(`
      ALTER TABLE disruptions 
      DROP COLUMN IF EXISTS address_full,
      DROP COLUMN IF EXISTS address_range,
      DROP COLUMN IF EXISTS has_tcl_match
    `)

    await client.query('COMMIT')
    console.log('   ✅ TCL tables dropped successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
