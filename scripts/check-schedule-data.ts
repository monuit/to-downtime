/**
 * Check a sample of disruptions to see what data they have
 * Run: node --loader ts-node/esm scripts/check-schedule-data.ts
 */

import dotenv from 'dotenv'
dotenv.config()

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
})

async function checkScheduleData() {
  console.log('🔍 Checking sample disruption records...\n')

  const client = await pool.connect()

  try {
    // Get 5 sample records
    const result = await client.query(`
      SELECT 
        external_id,
        title,
        schedule_type,
        duration,
        onsite_hours,
        work_type,
        raw_data->>'workPeriod' as raw_work_period,
        raw_data->>'scheduleEveryday' as raw_schedule_everyday
      FROM disruptions 
      WHERE is_active = TRUE
        AND type = 'road'
      LIMIT 5
    `)

    console.log(`Found ${result.rows.length} sample records:\n`)
    
    result.rows.forEach((row, i) => {
      console.log(`📋 Record ${i + 1}:`)
      console.log(`   ID: ${row.external_id}`)
      console.log(`   Title: ${row.title?.substring(0, 50)}...`)
      console.log(`   schedule_type: ${row.schedule_type || 'NULL'}`)
      console.log(`   duration: ${row.duration || 'NULL'}`)
      console.log(`   onsite_hours: ${row.onsite_hours || 'NULL'}`)
      console.log(`   work_type: ${row.work_type || 'NULL'}`)
      console.log(`   raw workPeriod: ${row.raw_work_period || 'NULL'}`)
      console.log(`   raw scheduleEveryday: ${row.raw_schedule_everyday || 'NULL'}`)
      console.log('')
    })

    // Overall stats
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE schedule_type IS NOT NULL) as with_schedule,
        COUNT(*) FILTER (WHERE duration IS NOT NULL) as with_duration,
        COUNT(*) FILTER (WHERE onsite_hours IS NOT NULL) as with_hours,
        COUNT(*) FILTER (WHERE work_type IS NOT NULL) as with_work_type
      FROM disruptions 
      WHERE is_active = TRUE AND type = 'road'
    `)

    const stats = statsResult.rows[0]
    console.log('📊 Overall Stats:')
    console.log(`   Total road disruptions: ${stats.total}`)
    console.log(`   With schedule_type: ${stats.with_schedule} (${Math.round(stats.with_schedule/stats.total*100)}%)`)
    console.log(`   With duration: ${stats.with_duration} (${Math.round(stats.with_duration/stats.total*100)}%)`)
    console.log(`   With onsite_hours: ${stats.with_hours} (${Math.round(stats.with_hours/stats.total*100)}%)`)
    console.log(`   With work_type: ${stats.with_work_type} (${Math.round(stats.with_work_type/stats.total*100)}%)`)

  } catch (error) {
    console.error('❌ Error checking data:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

checkScheduleData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
