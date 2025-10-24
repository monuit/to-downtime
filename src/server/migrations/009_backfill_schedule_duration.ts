/**
 * Migration: Backfill schedule_type and duration for existing records
 * 
 * Extracts schedule and duration from raw_data JSONB for records that don't have these fields
 */

import { Pool } from 'pg'

export const up = async (pool: Pool): Promise<void> => {
  console.log('📦 Running migration: Backfill schedule_type and duration...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Check if we need to run this migration
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM disruptions 
      WHERE schedule_type IS NULL 
        AND raw_data IS NOT NULL 
        AND raw_data->>'workPeriod' IS NOT NULL
    `
    const { rows } = await client.query(checkQuery)
    const recordsToUpdate = parseInt(rows[0].count)

    if (recordsToUpdate === 0) {
      console.log('✅ No records need backfilling, skipping...')
      await client.query('COMMIT')
      return
    }

    console.log(`🔧 Backfilling ${recordsToUpdate} records with schedule_type and duration...`)

    // Backfill schedule_type from raw_data->>'workPeriod'
    await client.query(`
      UPDATE disruptions
      SET schedule_type = raw_data->>'workPeriod'
      WHERE schedule_type IS NULL
        AND raw_data IS NOT NULL
        AND raw_data->>'workPeriod' IS NOT NULL
        AND is_active = TRUE
    `)

    // Backfill duration by calculating from startTime and endTime
    await client.query(`
      UPDATE disruptions
      SET duration = CASE
        WHEN (raw_data->>'endTime')::BIGINT IS NULL THEN '< 1 day'
        WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 86400000 THEN '< 1 day'
        WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 604800000 THEN '1-7 days'
        WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 2419200000 THEN '1-4 weeks'
        WHEN ((raw_data->>'endTime')::BIGINT - (raw_data->>'startTime')::BIGINT) < 7776000000 THEN '1-3 months'
        ELSE '3+ months'
      END
      WHERE duration IS NULL
        AND raw_data IS NOT NULL
        AND raw_data->>'startTime' IS NOT NULL
        AND is_active = TRUE
    `)

    // Backfill onsite_hours from raw_data->>'scheduleEveryday'
    await client.query(`
      UPDATE disruptions
      SET onsite_hours = raw_data->>'scheduleEveryday'
      WHERE onsite_hours IS NULL
        AND raw_data IS NOT NULL
        AND raw_data->>'scheduleEveryday' IS NOT NULL
        AND is_active = TRUE
    `)

    const updatedQuery = `
      SELECT COUNT(*) as count 
      FROM disruptions 
      WHERE schedule_type IS NOT NULL 
        OR duration IS NOT NULL
        OR onsite_hours IS NOT NULL
    `
    const { rows: updatedRows } = await client.query(updatedQuery)
    const recordsUpdated = parseInt(updatedRows[0].count)

    await client.query('COMMIT')
    console.log(`✅ Migration 009 completed! ${recordsUpdated} records now have schedule/duration data`)

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

export const down = async (pool: Pool): Promise<void> => {
  console.log('⏪ Rolling back migration: Backfill schedule_type and duration...')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Clear the backfilled data
    await client.query(`
      UPDATE disruptions
      SET schedule_type = NULL,
          duration = NULL,
          onsite_hours = NULL
      WHERE raw_data IS NOT NULL
    `)

    await client.query('COMMIT')
    console.log('✅ Rollback completed')

  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Rollback failed:', error)
    throw error
  } finally {
    client.release()
  }
}
