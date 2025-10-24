/**
 * Backfill schedule_type and duration for existing disruptions
 * Run this script locally to update production database via DATABASE_URL
 * 
 * Usage: node --loader ts-node/esm scripts/backfill-schedule.ts
 */

import dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
})

async function backfillScheduleAndDuration() {
  console.log('🔧 Starting backfill of schedule_type and duration...\n')

  const client = await pool.connect()

  try {
    // Check how many records need updating
    const checkQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE schedule_type IS NULL AND raw_data->>'workPeriod' IS NOT NULL) as missing_schedule,
        COUNT(*) FILTER (WHERE duration IS NULL AND raw_data->>'startTime' IS NOT NULL) as missing_duration,
        COUNT(*) FILTER (WHERE onsite_hours IS NULL AND raw_data->>'scheduleEveryday' IS NOT NULL) as missing_hours,
        COUNT(*) as total_active
      FROM disruptions 
      WHERE is_active = TRUE
    `
    
    console.log('📊 Checking current state...')
    const checkResult = await client.query(checkQuery)
    const stats = checkResult.rows[0]
    
    console.log(`   Total active records: ${stats.total_active}`)
    console.log(`   Missing schedule_type: ${stats.missing_schedule}`)
    console.log(`   Missing duration: ${stats.missing_duration}`)
    console.log(`   Missing onsite_hours: ${stats.missing_hours}\n`)

    if (stats.missing_schedule === '0' && stats.missing_duration === '0' && stats.missing_hours === '0') {
      console.log('✅ All records already have schedule/duration data. Nothing to backfill!')
      return
    }

    // Backfill schedule_type
    console.log('🔄 Backfilling schedule_type from workPeriod...')
    const scheduleResult = await client.query(`
      UPDATE disruptions
      SET schedule_type = raw_data->>'workPeriod'
      WHERE schedule_type IS NULL
        AND raw_data IS NOT NULL
        AND raw_data->>'workPeriod' IS NOT NULL
        AND is_active = TRUE
    `)
    console.log(`   ✅ Updated ${scheduleResult.rowCount} records with schedule_type\n`)

    // Backfill duration
    console.log('🔄 Backfilling duration from timestamps...')
    const durationResult = await client.query(`
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
    console.log(`   ✅ Updated ${durationResult.rowCount} records with duration\n`)

    // Backfill onsite_hours
    console.log('🔄 Backfilling onsite_hours from scheduleEveryday...')
    const hoursResult = await client.query(`
      UPDATE disruptions
      SET onsite_hours = raw_data->>'scheduleEveryday'
      WHERE onsite_hours IS NULL
        AND raw_data IS NOT NULL
        AND raw_data->>'scheduleEveryday' IS NOT NULL
        AND is_active = TRUE
    `)
    console.log(`   ✅ Updated ${hoursResult.rowCount} records with onsite_hours\n`)

    // Verify results
    console.log('📊 Final verification...')
    const verifyResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE schedule_type IS NOT NULL) as with_schedule,
        COUNT(*) FILTER (WHERE duration IS NOT NULL) as with_duration,
        COUNT(*) FILTER (WHERE onsite_hours IS NOT NULL) as with_hours,
        COUNT(*) as total_active
      FROM disruptions 
      WHERE is_active = TRUE
    `)
    
    const final = verifyResult.rows[0]
    console.log(`   Records with schedule_type: ${final.with_schedule}/${final.total_active}`)
    console.log(`   Records with duration: ${final.with_duration}/${final.total_active}`)
    console.log(`   Records with onsite_hours: ${final.with_hours}/${final.total_active}`)
    
    console.log('\n✅ Backfill complete! Refresh your website to see the changes.')

  } catch (error) {
    console.error('❌ Error during backfill:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the backfill
backfillScheduleAndDuration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
