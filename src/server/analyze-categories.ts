/**
 * Road Restrictions Deep Dive Analysis
 * 
 * Analyzes disruption data to identify useful categories and filters
 */

import { pool, closePool } from './db.js'

const main = async () => {
  console.log('🔍 Road Restrictions Deep Dive Analysis')
  console.log('='.repeat(70))
  console.log('')

  try {
    // 1. Analyze by work type
    console.log('📋 1. DISRUPTIONS BY WORK TYPE')
    console.log('-'.repeat(70))
    const workTypeResult = await pool.query(`
      SELECT 
        raw_data->>'workEventType' as work_type,
        severity,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM disruptions
      WHERE external_id LIKE 'road-%'
      GROUP BY raw_data->>'workEventType', severity
      ORDER BY COUNT(*) DESC
    `)

    if (workTypeResult.rows.length > 0) {
      const workTypes = new Set<string>()
      workTypeResult.rows.forEach(row => {
        workTypes.add(row.work_type || 'Unknown')
      })
      console.log(`Found ${workTypes.size} work types:`)
      workTypeResult.rows.forEach(row => {
        console.log(`  ${(row.work_type || 'Unknown').padEnd(25)} | ${row.severity.padEnd(8)} | ${String(row.count).padStart(4)} (${String(row.percentage).padStart(5)}%)`)
      })
    }
    console.log('')

    // 2. Analyze by impact level
    console.log('📊 2. DISRUPTIONS BY IMPACT LEVEL')
    console.log('-'.repeat(70))
    const impactResult = await pool.query(`
      SELECT 
        raw_data->>'maxImpact' as max_impact,
        raw_data->>'currImpact' as current_impact,
        severity,
        COUNT(*) as count
      FROM disruptions
      WHERE external_id LIKE 'road-%'
      GROUP BY raw_data->>'maxImpact', raw_data->>'currImpact', severity
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `)

    if (impactResult.rows.length > 0) {
      impactResult.rows.forEach(row => {
        console.log(`  Max: ${(row.max_impact || 'N/A').padEnd(8)} | Current: ${(row.current_impact || 'N/A').padEnd(8)} | Severity: ${row.severity.padEnd(8)} | Count: ${row.count}`)
      })
    }
    console.log('')

    // 3. Analyze by road type
    console.log('🛣️  3. DISRUPTIONS BY ROAD CLASS')
    console.log('-'.repeat(70))
    const roadClassResult = await pool.query(`
      SELECT 
        raw_data->>'roadClass' as road_class,
        severity,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM disruptions
      WHERE external_id LIKE 'road-%'
      GROUP BY raw_data->>'roadClass', severity
      ORDER BY COUNT(*) DESC
    `)

    if (roadClassResult.rows.length > 0) {
      console.log(`Found ${new Set(roadClassResult.rows.map(r => r.road_class)).size} road classes:`)
      roadClassResult.rows.forEach(row => {
        console.log(`  ${(row.road_class || 'Unknown').padEnd(30)} | ${row.severity.padEnd(8)} | ${String(row.count).padStart(4)} (${String(row.percentage).padStart(5)}%)`)
      })
    }
    console.log('')

    // 4. Analyze by directions affected
    console.log('🔄 4. DISRUPTIONS BY DIRECTIONS AFFECTED')
    console.log('-'.repeat(70))
    const directionResult = await pool.query(`
      SELECT 
        raw_data->>'directionsAffected' as directions_affected,
        severity,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM disruptions
      WHERE external_id LIKE 'road-%'
      GROUP BY raw_data->>'directionsAffected', severity
      ORDER BY COUNT(*) DESC
    `)

    if (directionResult.rows.length > 0) {
      directionResult.rows.forEach(row => {
        console.log(`  ${(row.directions_affected || 'Unknown').padEnd(20)} | ${row.severity.padEnd(8)} | ${String(row.count).padStart(4)} (${String(row.percentage).padStart(5)}%)`)
      })
    }
    console.log('')

    // 5. Analyze by schedule type
    console.log('⏰ 5. DISRUPTIONS BY SCHEDULE TYPE')
    console.log('-'.repeat(70))
    const scheduleResult = await pool.query(`
      SELECT 
        CASE 
          WHEN raw_data->>'scheduleMonday' IS NOT NULL AND 
               raw_data->>'scheduleTuesday' IS NOT NULL AND
               raw_data->>'scheduleWednesday' IS NOT NULL AND
               raw_data->>'scheduleThursday' IS NOT NULL AND
               raw_data->>'scheduleFriday' IS NOT NULL AND
               raw_data->>'scheduleSaturday' IS NULL AND
               raw_data->>'scheduleSunday' IS NULL THEN 'Weekdays Only'
          WHEN raw_data->>'scheduleEveryday' IS NOT NULL THEN '24/7'
          WHEN raw_data->>'scheduleSaturday' IS NOT NULL OR 
               raw_data->>'scheduleSunday' IS NOT NULL THEN 'Weekends Included'
          ELSE 'Mixed/Custom'
        END as schedule_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM disruptions
      WHERE external_id LIKE 'road-%'
      GROUP BY schedule_type
      ORDER BY COUNT(*) DESC
    `)

    if (scheduleResult.rows.length > 0) {
      scheduleResult.rows.forEach(row => {
        console.log(`  ${row.schedule_type.padEnd(25)} | ${String(row.count).padStart(4)} (${String(row.percentage).padStart(5)}%)`)
      })
    }
    console.log('')

    // 6. Analyze by contractor
    console.log('🏢 6. TOP 15 CONTRACTORS')
    console.log('-'.repeat(70))
    const contractorResult = await pool.query(`
      SELECT 
        raw_data->>'contractor' as contractor,
        COUNT(*) as count
      FROM disruptions
      WHERE external_id LIKE 'road-%' AND raw_data->>'contractor' IS NOT NULL
      GROUP BY raw_data->>'contractor'
      ORDER BY COUNT(*) DESC
      LIMIT 15
    `)

    if (contractorResult.rows.length > 0) {
      contractorResult.rows.forEach((row, idx) => {
        console.log(`  ${(idx + 1).toString().padStart(2)}. ${(row.contractor || 'Unknown').substring(0, 55).padEnd(55)} | ${row.count}`)
      })
    }
    console.log('')

    // 7. Analyze by district
    console.log('🗺️  7. DISRUPTIONS BY DISTRICT')
    console.log('-'.repeat(70))
    const districtResult = await pool.query(`
      SELECT 
        raw_data->>'district' as district,
        severity,
        COUNT(*) as count
      FROM disruptions
      WHERE external_id LIKE 'road-%' AND raw_data->>'district' IS NOT NULL
      GROUP BY raw_data->>'district', severity
      ORDER BY COUNT(*) DESC
    `)

    if (districtResult.rows.length > 0) {
      const districts = new Set<string>()
      districtResult.rows.forEach(row => {
        districts.add(row.district)
      })
      console.log(`Found ${districts.size} districts:`)
      districtResult.rows.forEach(row => {
        console.log(`  ${(row.district || 'Unknown').padEnd(20)} | ${row.severity.padEnd(8)} | ${row.count}`)
      })
    }
    console.log('')

    // 8. Analyze duration (start to end time)
    console.log('⏱️  8. DISRUPTION DURATION ANALYSIS')
    console.log('-'.repeat(70))
    const durationResult = await pool.query(`
      SELECT 
        CASE 
          WHEN EXTRACT(DAY FROM 
            (to_timestamp(CAST(raw_data->>'endTime' AS BIGINT)/1000.0) - 
             to_timestamp(CAST(raw_data->>'startTime' AS BIGINT)/1000.0))) < 1 THEN 'Less than 1 day'
          WHEN EXTRACT(DAY FROM 
            (to_timestamp(CAST(raw_data->>'endTime' AS BIGINT)/1000.0) - 
             to_timestamp(CAST(raw_data->>'startTime' AS BIGINT)/1000.0))) BETWEEN 1 AND 7 THEN '1-7 days'
          WHEN EXTRACT(DAY FROM 
            (to_timestamp(CAST(raw_data->>'endTime' AS BIGINT)/1000.0) - 
             to_timestamp(CAST(raw_data->>'startTime' AS BIGINT)/1000.0))) BETWEEN 8 AND 30 THEN '1-4 weeks'
          WHEN EXTRACT(DAY FROM 
            (to_timestamp(CAST(raw_data->>'endTime' AS BIGINT)/1000.0) - 
             to_timestamp(CAST(raw_data->>'startTime' AS BIGINT)/1000.0))) BETWEEN 31 AND 90 THEN '1-3 months'
          ELSE '3+ months'
        END as duration_category,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM disruptions
      WHERE external_id LIKE 'road-%' 
            AND raw_data->>'startTime' IS NOT NULL 
            AND raw_data->>'endTime' IS NOT NULL
      GROUP BY duration_category
      ORDER BY COUNT(*) DESC
    `)

    if (durationResult.rows.length > 0) {
      durationResult.rows.forEach(row => {
        console.log(`  ${row.duration_category.padEnd(20)} | ${String(row.count).padStart(4)} (${String(row.percentage).padStart(5)}%)`)
      })
    }
    console.log('')

    // 9. Key statistics
    console.log('📈 9. KEY STATISTICS')
    console.log('-'.repeat(70))
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT raw_data->>'contractor') as unique_contractors,
        COUNT(DISTINCT raw_data->>'district') as unique_districts,
        COUNT(DISTINCT raw_data->>'road') as unique_roads,
        COUNT(DISTINCT raw_data->>'workEventType') as work_types,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM disruptions WHERE external_id LIKE 'road-%'), 2) as road_percentage
      FROM disruptions
      WHERE external_id LIKE 'road-%'
    `)

    if (statsResult.rows.length > 0) {
      const stats = statsResult.rows[0]
      console.log(`  Total Road Disruptions: ${stats.total}`)
      console.log(`  Unique Contractors: ${stats.unique_contractors}`)
      console.log(`  Unique Districts: ${stats.unique_districts}`)
      console.log(`  Unique Roads: ${stats.unique_roads}`)
      console.log(`  Work Type Categories: ${stats.work_types}`)
      console.log(`  % of Total Disruptions: ${stats.road_percentage}%`)
    }
    console.log('')

    // 10. Recommendations
    console.log('💡 10. RECOMMENDED FILTER CATEGORIES')
    console.log('-'.repeat(70))
    console.log(`
  1. WORK TYPE FILTER
     Most common types found above. Recommend dropdown with:
     - All
     - Construction
     - Watermain Work
     - Road Closed
     - (others with >50 occurrences)

  2. IMPACT LEVEL FILTER
     - Low
     - Medium
     - High
     - Road Closed

  3. DISTRICT/AREA FILTER
     Support geographic filtering by:
     - Toronto Districts (Toronto, Etobicoke, York, etc.)
     - User's current location (geolocation)

  4. SCHEDULE TYPE FILTER
     - Weekdays Only
     - Weekends Included
     - 24/7 (24 hours)

  5. DURATION FILTER
     - Quick fixes (< 1 day)
     - Short-term (1-7 days)
     - Medium (1-4 weeks)
     - Long-term (1-3 months)
     - Extended (3+ months)

  6. SEVERITY FILTER (Already have this)
     - Severe (High Impact / Road Closed)
     - Moderate
     - Minor

  7. SEARCH / LOCATION FILTER
     - Search by street name
     - Search by contractor name
     - Geospatial filter (e.g., "within 2km of me")

  8. TIME-BASED FILTERS
     - Active now
     - Starting soon (next 7 days)
     - Planned ahead (future)
     - Recently resolved
    `)
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await closePool()
  }
}

main()
