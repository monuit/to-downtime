/**
 * Migration Runner
 * 
 * Executes database migrations on application startup
 * Designed to run safely on Railway deployment to Neon Postgres
 */

import { Pool } from 'pg'
import * as migration001 from './001_add_metadata_columns.js'
import * as migration002 from './002_add_performance_indexes.js'

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
  console.log('🚀 Starting database migrations...')

  try {
    // Ensure migrations table exists
    await ensureMigrationsTable(pool)

    let executedCount = 0
    let skippedCount = 0

    // Run each migration in order
    for (const migration of migrations) {
      const alreadyExecuted = await isMigrationExecuted(pool, migration.id)

      if (alreadyExecuted) {
        console.log(`⏭️  Migration ${migration.id} (${migration.name}) already executed, skipping...`)
        skippedCount++
        continue
      }

      console.log(`▶️  Running migration ${migration.id} (${migration.name})...`)
      await migration.up(pool)
      await recordMigration(pool, migration)
      executedCount++
      console.log(`✅ Migration ${migration.id} completed`)
    }

    console.log(`\n✨ Migrations complete! Executed: ${executedCount}, Skipped: ${skippedCount}`)

  } catch (error) {
    console.error('❌ Migration failed:', error)
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
