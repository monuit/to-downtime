import crypto from 'crypto'
import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Local Data Loader - Node.js Version
 * Fetches disruption data and loads it into Neon Postgres (one-time bulk load)
 * Run with: node --loader ts-node/esm src/server/load-data-node.mjs
 * Or compile: npm run build && node dist/server/load-data-node.js
 */

// Mock disruption data
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
 * Generate deterministic hash
 */
function generateContentHash(disruption) {
  const content = `${disruption.type}|${disruption.severity}|${disruption.title}|${disruption.description}`
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Main loader
 */
async function loadData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('🔄 Starting Toronto Downtime data loader...')
    console.log(`📦 DATABASE_URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`)

    // Connect
    await client.connect()
    console.log('✓ Connected to Neon Postgres\n')

    // Initialize schema
    console.log('📋 Step 1: Initializing database schema...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS disruptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        affected_lines TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN DEFAULT TRUE
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS disruptions_archive (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_id VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        affected_lines TEXT[],
        created_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        duration_minutes INT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS disruption_hashes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        disruption_id UUID NOT NULL REFERENCES disruptions(id) ON DELETE CASCADE,
        content_hash VARCHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disruptions_type ON disruptions(type)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disruptions_severity ON disruptions(severity)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disruptions_active ON disruptions(is_active)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_disruptions_created ON disruptions(created_at DESC)`)

    console.log('✓ Database schema initialized\n')

    // Load data
    console.log('💾 Step 2: Loading data into Postgres...')
    let loaded = 0
    let duplicates = 0
    let errors = 0

    for (const disruption of MOCK_DISRUPTIONS) {
      try {
        const contentHash = generateContentHash(disruption)

        // Upsert
        const result = await client.query(
          `INSERT INTO disruptions (external_id, type, severity, title, description, affected_lines, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE)
           ON CONFLICT (external_id)
           DO UPDATE SET
             type = $2,
             severity = $3,
             title = $4,
             description = $5,
             affected_lines = $6,
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [disruption.id, disruption.type, disruption.severity, disruption.title, disruption.description, disruption.lines || null]
        )

        const disruptionId = result.rows[0].id

        // Record hash
        await client.query(
          `INSERT INTO disruption_hashes (disruption_id, content_hash)
           VALUES ($1, $2)
           ON CONFLICT (content_hash) DO NOTHING`,
          [disruptionId, contentHash]
        )

        loaded++
        console.log(`   ✓ ${disruption.id}: ${disruption.title}`)
      } catch (error) {
        if (error.message?.includes('duplicate')) {
          duplicates++
          console.log(`   ⊘ ${disruption.id}: Already exists (duplicate)`)
        } else {
          errors++
          console.error(`   ✗ ${disruption.id}: ${error.message}`)
        }
      }
    }

    // Summary
    console.log('\n📊 Load Summary:')
    console.log(`   ✓ Successfully loaded: ${loaded}`)
    console.log(`   ⊘ Duplicates skipped: ${duplicates}`)
    console.log(`   ✗ Errors: ${errors}`)
    console.log(`   ℹ Total disruptions: ${loaded + duplicates}`)

    console.log('\n✅ Data load complete!')
    console.log('🚀 You can now run "npm run dev" to see the data in the UI')
  } catch (error) {
    console.error('\n❌ Load failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

// Run
loadData()
