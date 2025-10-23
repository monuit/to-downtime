/**
 * ETL Test Script
 * 
 * Tests the complete ETL pipeline:
 * 1. Fetch from Toronto Open Data CKAN APIs
 * 2. Parse and transform data
 * 3. Store in Postgres with metadata
 * 4. Verify data retrieval
 * 
 * Run: node --loader ts-node/esm src/server/test-sync.ts
 */

import { initializeDatabase, upsertDisruption, getAllDisruptions } from './db'
import { fetchAllLiveDataWithMetadata } from './live-data'

async function testSync() {
  console.log('🧪 Testing ETL Pipeline\n')

  try {
    // Step 1: Initialize database
    console.log('📊 Initializing database...')
    await initializeDatabase()

    // Step 2: Fetch live data
    console.log('\n🔄 Fetching live data from Toronto Open Data...')
    const result = await fetchAllLiveDataWithMetadata()

    console.log(`\n📊 Fetch Results:`)
    console.log(`   Total Disruptions: ${result.disruptions.length}`)
    console.log(`   Sources:`)
    result.metadata.sources.forEach(source => {
      console.log(`      - ${source.name}: ${source.count} disruptions`)
    })

    if (result.metadata.errors.length > 0) {
      console.log(`   ⚠️  Errors:`)
      result.metadata.errors.forEach(error => {
        console.log(`      - ${error}`)
      })
    }

    // Step 3: Store in database
    console.log(`\n💾 Storing ${result.disruptions.length} disruptions in database...`)
    let stored = 0
    let failed = 0

    for (const disruption of result.disruptions) {
      try {
        await upsertDisruption(disruption.id, {
          type: disruption.type,
          severity: disruption.severity,
          title: disruption.title,
          description: disruption.description,
          affectedLines: disruption.affectedLines,
          sourceApi: disruption.sourceApi,
          sourceUrl: disruption.sourceUrl,
          rawData: disruption.rawData,
        })
        stored++

        // Log first few for inspection
        if (stored <= 3) {
          console.log(`   ✓ Stored: ${disruption.title.substring(0, 50)}...`)
        }
      } catch (error) {
        failed++
        console.error(`   ✗ Failed to store ${disruption.id}:`, error)
      }
    }

    console.log(`\n📈 Storage Results:`)
    console.log(`   Stored: ${stored}`)
    console.log(`   Failed: ${failed}`)

    // Step 4: Verify retrieval
    console.log(`\n🔍 Retrieving all disruptions from database...`)
    const allDisruptions = await getAllDisruptions()
    
    console.log(`\n📊 Database Contents:`)
    console.log(`   Total Disruptions: ${allDisruptions.length}`)
    
    // Group by source
    const bySource: Record<string, number> = {}
    allDisruptions.forEach(d => {
      const source = d.source_api || 'Unknown'
      bySource[source] = (bySource[source] || 0) + 1
    })

    console.log(`   By Source:`)
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`      - ${source}: ${count}`)
    })

    // Group by type
    const byType: Record<string, number> = {}
    allDisruptions.forEach(d => {
      byType[d.type] = (byType[d.type] || 0) + 1
    })

    console.log(`   By Type:`)
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`      - ${type}: ${count}`)
    })

    // Show sample disruptions
    console.log(`\n📄 Sample Disruptions:`)
    allDisruptions.slice(0, 3).forEach((d, i) => {
      console.log(`   ${i + 1}. [${d.type}/${d.severity}] ${d.title}`)
      console.log(`      Source: ${d.source_api || 'N/A'}`)
      console.log(`      Lines: ${d.affected_lines?.join(', ') || 'None'}`)
    })

    console.log(`\n✅ Test Complete!`)
    console.log(`   ✓ Database initialized`)
    console.log(`   ✓ Data fetched from Toronto Open Data`)
    console.log(`   ✓ ${stored} disruptions stored`)
    console.log(`   ✓ ${allDisruptions.length} disruptions retrieved`)

    process.exit(0)

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testSync()
