/**
 * Server Startup Script
 * 
 * Runs on Railway deployment:
 * 1. Initialize database schema
 * 2. Run migrations
 * 3. Start ETL scheduler (5-30 second random intervals)
 * 4. Start Express API server (serves React app + API)
 * 
 * Usage: node --loader ts-node/esm src/server/startup.ts
 */

// Load environment variables from .env file
import dotenv from 'dotenv'
dotenv.config()

import { initializeDatabase } from './db.js'
import { etlScheduler } from './etl-scheduler.js'
import { startServer } from './api-server.js'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(path.join(__dirname, '../../dist'))

async function startup() {
  console.log('🚀 Toronto Downtime - Server Starting...\n')

  // Check if dist folder exists
  if (!existsSync(distPath)) {
    console.error('❌ ERROR: dist/ folder not found!')
    console.error('   Make sure npm run build was executed during Railway build phase.')
    console.error('   Dist path:', distPath)
    process.exit(1)
  }
  console.log('✅ Frontend build found at:', distPath)

  // Verify DATABASE_URL is loaded
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set!')
    console.error('   Create a .env file with: DATABASE_URL=postgresql://...')
    process.exit(1)
  }

  try {
    // Step 1: Initialize database and run migrations
    console.log('📊 Setting up database...')
    await initializeDatabase()

    // Step 2: Start ETL scheduler
    console.log('\n⏰ Starting ETL scheduler...')
    etlScheduler.start()

    // Step 3: Start Express API server
    console.log('🌐 Starting Express server...')
    await startServer()

    console.log('\n✅ Server startup complete!')
    console.log('   Database: Ready')
    console.log('   ETL Scheduler: Running (5-30s intervals)')
    console.log('   API Server: Running')
    console.log('   Press Ctrl+C to stop\n')

  } catch (error) {
    console.error('\n❌ Server startup failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM - shutting down gracefully...')
  etlScheduler.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n📡 Received SIGINT - shutting down gracefully...')
  etlScheduler.stop()
  process.exit(0)
})

// Start the server
startup().catch((error) => {
  console.error('❌ Unhandled error in startup:', error)
  process.exit(1)
})
