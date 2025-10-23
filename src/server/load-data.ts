import crypto from 'crypto'
import { initializeDatabase, upsertDisruption, recordContentHash, closePool } from './db.ts'
import { transformData } from './etl.ts'

/**
 * Local Data Loader Script
 * Fetches disruption data and loads it into Neon Postgres (one-time bulk load)
 * Run with: bun src/server/load-data.ts
 */

// Mock disruption data (in production, this comes from ETL)
const MOCK_DISRUPTIONS = [
  {
    id: 'disruption-01',
    type: 'subway',
    severity: 'severe',
    title: 'Line 1 Service Disruption - Kipling to Dundas West',
    description: 'Major signal failure affecting service. Expect delays of 15-20 minutes.',
    lines: ['Line 1 Bloor-Danforth'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-02',
    type: 'streetcar',
    severity: 'moderate',
    title: 'King West Streetcar - Reduced Service',
    description: 'Vehicle malfunction. Running at reduced capacity.',
    lines: ['King'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-03',
    type: 'bus',
    severity: 'minor',
    title: 'Route 505 - Temporary Detour',
    description: 'Road construction on Dundas St. Using alternate route.',
    lines: ['505 Dundas'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-04',
    type: 'elevator',
    severity: 'minor',
    title: 'Bloor Station - Out of Service',
    description: 'Elevator maintenance. Please use stairs or alternate entrance.',
    lines: ['Bloor Station'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-05',
    type: 'road',
    severity: 'moderate',
    title: 'Gardiner Expressway - Lane Closure',
    description: 'Active construction. Single lane closure eastbound.',
    lines: ['Gardiner Expressway'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-06',
    type: 'subway',
    severity: 'moderate',
    title: 'Line 2 - Minor Service Delay',
    description: 'Switched points requiring operator inspection.',
    lines: ['Line 2 Bloor-Yonge'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-07',
    type: 'bus',
    severity: 'severe',
    title: 'Route 29 - Full Service Suspension',
    description: 'Vehicle shortage due to mechanical issues.',
    lines: ['29 Dufferin'],
    timestamp: Date.now(),
  },
  {
    id: 'disruption-08',
    type: 'streetcar',
    severity: 'minor',
    title: 'Queen West Streetcar - Slight Delay',
    description: 'Traffic congestion at Queen & University.',
    lines: ['Queen'],
    timestamp: Date.now(),
  },
]

/**
 * Generate deterministic hash of disruption content
 * Used for deduplication
 */
const generateContentHash = (disruption: any): string => {
  const content = `${disruption.type}|${disruption.severity}|${disruption.title}|${disruption.description}`
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Main loader function
 */
const loadData = async (): Promise<void> => {
  console.log('🔄 Starting Toronto Downtime data loader...')
  console.log(`📦 DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`)

  try {
    // Step 1: Initialize schema
    console.log('\n📋 Step 1: Initializing database schema...')
    await initializeDatabase()

    // Step 2: Transform data
    console.log('\n🔄 Step 2: Transforming disruption data...')
    const transformed = transformData(MOCK_DISRUPTIONS)
    console.log(`   ✓ Transformed ${transformed.length} disruptions`)

    // Step 3: Load data and check for duplicates
    console.log('\n💾 Step 3: Loading data into Postgres...')
    let loaded = 0
    let duplicates = 0
    let errors = 0

    for (const disruption of transformed) {
      try {
        const contentHash = generateContentHash(disruption)

        const result = await upsertDisruption(disruption.id, {
          type: disruption.type,
          severity: disruption.severity,
          title: disruption.title,
          description: disruption.description,
          affectedLines: disruption.affectedLines,
        })

        // Record the hash for duplicate prevention
        await recordContentHash(result.id, contentHash)

        loaded++
        console.log(`   ✓ ${disruption.id}: ${disruption.title}`)
      } catch (error: any) {
        if (error.message?.includes('duplicate')) {
          duplicates++
          console.log(`   ⊘ ${disruption.id}: Already exists (duplicate)`)
        } else {
          errors++
          console.error(`   ✗ ${disruption.id}: ${error.message}`)
        }
      }
    }

    // Step 4: Summary
    console.log('\n📊 Load Summary:')
    console.log(`   ✓ Successfully loaded: ${loaded}`)
    console.log(`   ⊘ Duplicates skipped: ${duplicates}`)
    console.log(`   ✗ Errors: ${errors}`)
    console.log(`   ℹ Total disruptions: ${loaded + duplicates}`)

    console.log('\n✅ Data load complete!')
    console.log('🚀 You can now run "npm run dev" to see the data in the UI')
    console.log('📡 Production: Vercel will sync updates via scheduled functions')
  } catch (error) {
    console.error('\n❌ Load failed:', error)
    process.exit(1)
  } finally {
    await closePool()
  }
}

// Run if called directly
if (import.meta.main) {
  loadData()
}

export { loadData }
