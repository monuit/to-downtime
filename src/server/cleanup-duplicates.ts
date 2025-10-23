/**
 * Cleanup Script: Remove Duplicate Disruptions
 * 
 * This script identifies and removes duplicate disruptions caused by the
 * double-prefix bug in road restrictions and TTC alerts ETL.
 * 
 * Duplicates occur when:
 * - Road restrictions: external_id was "road-road-Tor-RD012025-279" instead of "road-Tor-RD012025-279"
 * - TTC alerts: external_id was "ttc-ttc-123" instead of "ttc-123"
 * - Random IDs: New random IDs generated every ETL run instead of using stable API IDs
 * 
 * Strategy:
 * 1. Find disruptions with duplicate titles/descriptions (likely same event)
 * 2. Keep the one with the earliest created_at (original)
 * 3. Delete the duplicates
 * 4. Archive duplicates for audit trail
 */

import { pool, closePool } from './db.js'

interface DuplicateGroup {
  title: string
  count: number
  ids: string[]
  external_ids: string[]
  created_ats: Date[]
}

const findDuplicates = async (): Promise<DuplicateGroup[]> => {
  const query = `
    SELECT 
      title,
      COUNT(*) as count,
      ARRAY_AGG(id ORDER BY created_at) as ids,
      ARRAY_AGG(external_id ORDER BY created_at) as external_ids,
      ARRAY_AGG(created_at ORDER BY created_at) as created_ats
    FROM disruptions
    WHERE is_active = TRUE
    GROUP BY title
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `

  const result = await pool.query(query)
  return result.rows
}

const removeDuplicates = async (dryRun = true): Promise<void> => {
  console.log('🔍 Finding duplicate disruptions...')
  
  const duplicates = await findDuplicates()
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicates found!')
    return
  }

  console.log(`\n📊 Found ${duplicates.length} sets of duplicates:`)
  
  let totalDuplicates = 0
  let idsToDelete: string[] = []

  for (const group of duplicates) {
    const duplicateCount = group.count - 1 // Keep one, delete the rest
    totalDuplicates += duplicateCount
    
    console.log(`\n📍 "${group.title.substring(0, 80)}..."`)
    console.log(`   Total copies: ${group.count}`)
    console.log(`   External IDs:`)
    
    group.external_ids.forEach((extId, idx) => {
      const status = idx === 0 ? '✅ KEEP' : '❌ DELETE'
      console.log(`     ${status} - ${extId} (created: ${group.created_ats[idx]})`)
    })

    // Add all but the first (oldest) to deletion list
    idsToDelete.push(...group.ids.slice(1))
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Duplicate groups: ${duplicates.length}`)
  console.log(`   Total duplicates to remove: ${totalDuplicates}`)
  console.log(`   Records to keep: ${duplicates.length}`)

  if (dryRun) {
    console.log(`\n🔍 DRY RUN MODE - No changes made`)
    console.log(`   Run with --execute flag to actually delete duplicates`)
    return
  }

  console.log(`\n🗑️  Deleting ${totalDuplicates} duplicate records...`)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Archive duplicates before deleting
    const archiveQuery = `
      INSERT INTO disruptions_archive (
        external_id, type, severity, title, description, affected_lines,
        source_api, source_url, raw_data, created_at, resolved_at, archived_at, archived_reason
      )
      SELECT 
        external_id, type, severity, title, description, affected_lines,
        source_api, source_url, raw_data, created_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
        'Removed as duplicate during cleanup'
      FROM disruptions
      WHERE id = ANY($1::uuid[])
    `
    
    await client.query(archiveQuery, [idsToDelete])
    
    // Delete duplicates
    const deleteQuery = `
      DELETE FROM disruptions
      WHERE id = ANY($1::uuid[])
    `
    
    const deleteResult = await client.query(deleteQuery, [idsToDelete])
    
    await client.query('COMMIT')
    
    console.log(`✅ Successfully removed ${deleteResult.rowCount} duplicate disruptions`)
    console.log(`📦 Archived duplicates to disruptions_archive table`)
    
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    client.release()
  }
}

const showStats = async (): Promise<void> => {
  const statsQuery = `
    SELECT 
      type,
      severity,
      COUNT(*) as count,
      COUNT(DISTINCT title) as unique_titles
    FROM disruptions
    WHERE is_active = TRUE
    GROUP BY type, severity
    ORDER BY type, severity
  `

  const result = await pool.query(statsQuery)
  
  console.log('\n📊 Current Disruption Stats:')
  console.log('┌─────────┬──────────┬───────┬──────────────┐')
  console.log('│ Type    │ Severity │ Count │ Unique Titles│')
  console.log('├─────────┼──────────┼───────┼──────────────┤')
  
  for (const row of result.rows) {
    console.log(
      `│ ${row.type.padEnd(7)} │ ${row.severity.padEnd(8)} │ ${String(row.count).padStart(5)} │ ${String(row.unique_titles).padStart(13)} │`
    )
  }
  
  console.log('└─────────┴──────────┴───────┴──────────────┘')
}

// Main execution
const main = async () => {
  const executeMode = process.argv.includes('--execute')
  
  console.log('🧹 Disruption Cleanup Script')
  console.log('=' .repeat(50))
  
  await showStats()
  
  console.log('\n')
  await removeDuplicates(!executeMode)
  
  if (executeMode) {
    console.log('\n')
    await showStats()
  }
  
  await closePool()
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
