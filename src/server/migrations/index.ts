/**
 * Migration Runner
 * 
 * Executes database migrations on application startup
 * Designed to run safely on Railway deployment to Neon Postgres
 */

import { Pool } from 'pg'
import * as migration001 from './001_add_metadata_columns.js'
import * as migration002 from './002_add_performance_indexes.js'
import * as migration003 from './003_add_tcl_tables.js'
import * as migration004 from './004_add_coordinates_geometry.js'
import * as migration005 from './005_add_geohash_indexing.js'
import * as migration006 from './006_add_enhanced_fields.js'
import * as migration007 from './007_add_geocoding_cache.js'
import * as migration008 from './008_add_tcl_matching_cache.js'
import { logger } from '../logger.js'

interface Migration {
  id: string
  name: string
  up: (pool: Pool) => Promise<void>
  down: (pool: Pool) => Promise<void>
}

const migrations: Migration[] = [
  {
    id: '001',
    name: 'add_metadata_columns',
    up: migration001.up,
    down: migration001.down,
  },
  {
    id: '002',
    name: 'add_performance_indexes',
    up: migration002.up,
    down: migration002.down,
  },
  {
    id: '003',
    name: 'add_tcl_tables',
    up: migration003.up,
    down: migration003.down,
  },
  {
    id: '004',
    name: 'add_coordinates_geometry',
    up: migration004.up,
    down: migration004.down,
  },
  {
    id: '005',
    name: 'add_geohash_indexing',
    up: migration005.up,
    down: migration005.down,
  },
  {
    id: '006',
    name: 'add_enhanced_fields',
    up: migration006.up,
    down: migration006.down,
  },
  {
    id: '007',
    name: 'add_geocoding_cache',
    up: migration007.up,
    down: migration007.down,
  },
  {
    id: '008',
    name: 'add_tcl_matching_cache',
    up: migration008.up,
    down: migration008.down,
  },
]

/**
 * Ensures migrations tracking table exists
 */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

/**
 * Checks if a migration has already been executed
 */
async function isMigrationExecuted(pool: Pool, migrationId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT id FROM migrations WHERE id = $1',
    [migrationId]
  )
  return result.rows.length > 0
}

/**
 * Records that a migration has been executed
 */
async function recordMigration(pool: Pool, migration: Migration): Promise<void> {
  await pool.query(
    'INSERT INTO migrations (id, name) VALUES ($1, $2)',
    [migration.id, migration.name]
  )
}

/**
 * Runs all pending migrations
 */
export async function runMigrations(pool: Pool): Promise<void> {
  console.log(`[${new Date().toISOString()}] 🚀 Starting database migrations...`)
  logger.debug('🚀 Starting database migrations...')

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(pool)

    let executedCount = 0
    let skippedCount = 0

    // Run each migration in order
    for (const migration of migrations) {
      const alreadyExecuted = await isMigrationExecuted(pool, migration.id)

      if (alreadyExecuted) {
        console.log(`[${new Date().toISOString()}] ⏭️  Skipping migration ${migration.id} (${migration.name}) - already executed`)
        logger.debug(`⏭️  Migration ${migration.id} (${migration.name}) already executed, skipping...`)
        skippedCount++
        continue
      }

      console.log(`[${new Date().toISOString()}] ⏳ Running migration ${migration.id} (${migration.name})...`)
      logger.info(`▶️  Running migration ${migration.id} (${migration.name})...`)
      
      const startTime = Date.now()
      await migration.up(pool)
      await recordMigration(pool, migration)
      executedCount++
      
      const duration = Date.now() - startTime
      console.log(`[${new Date().toISOString()}] ✅ Migration ${migration.id} completed in ${duration}ms`)
      logger.info(`✅ Migration ${migration.id} completed`)
    }

    console.log(`[${new Date().toISOString()}] ✨ Migrations complete! Executed: ${executedCount}, Skipped: ${skippedCount}`)
    logger.debug(`\n✨ Migrations complete! Executed: ${executedCount}, Skipped: ${skippedCount}`)

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Migration failed:`, error)
    logger.error('❌ Migration failed:', error)
    throw error
  }
}

/**
 * Rolls back the last migration (for development/testing)
 */
export async function rollbackLastMigration(pool: Pool): Promise<void> {
  console.log('⏪ Rolling back last migration...')

  try {
    await ensureMigrationsTable(pool)

    // Get the last executed migration
    const result = await pool.query(
      'SELECT id, name FROM migrations ORDER BY executed_at DESC LIMIT 1'
    )

    if (result.rows.length === 0) {
      console.log('ℹ️  No migrations to rollback')
      return
    }

    const lastMigration = result.rows[0]
    const migration = migrations.find(m => m.id === lastMigration.id)

    if (!migration) {
      throw new Error(`Migration ${lastMigration.id} not found in migration list`)
    }

    console.log(`▶️  Rolling back migration ${migration.id} (${migration.name})...`)
    await migration.down(pool)

    // Remove from migrations table
    await pool.query('DELETE FROM migrations WHERE id = $1', [migration.id])

    console.log(`✅ Migration ${migration.id} rolled back successfully`)

  } catch (error) {
    console.error('❌ Rollback failed:', error)
    throw error
  }
}
