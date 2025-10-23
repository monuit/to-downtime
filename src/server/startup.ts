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
import { tclScheduler } from './tcl-scheduler.js'
import { startServer } from './api-server.js'
import { logger, isQuiet } from './logger.js'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.resolve(path.join(__dirname, '../../dist'))

async function startup() {
  if (!isQuiet()) {
    console.log('🚀 Toronto Downtime - Server Starting...\n')
  }

  // Check if dist folder exists
  if (!existsSync(distPath)) {
    console.error('❌ ERROR: dist/ folder not found!')
    console.error('   Make sure npm run build was executed during Railway build phase.')
    console.error('   Dist path:', distPath)
    logger.error('❌ ERROR: dist/ folder not found!')
    process.exit(1)
  }
  
  console.log(`[${new Date().toISOString()}] ✅ Frontend build found at:`, distPath)
  logger.info('✅ Frontend build found at:', distPath)

  // Verify DATABASE_URL is loaded
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set!')
    console.error('   Create a .env file with: DATABASE_URL=postgresql://...')
    logger.error('❌ DATABASE_URL environment variable not set!')
    process.exit(1)
  }

  try {
    // Step 1: Initialize database and run migrations
    console.log(`[${new Date().toISOString()}] ⏳ Setting up database...`)
    logger.debug('📊 Setting up database...')
    await initializeDatabase()

    // Step 2: Start TCL scheduler (daily at 7 AM)
    console.log(`[${new Date().toISOString()}] ⏳ Starting TCL scheduler (daily at 7 AM)...`)
    logger.debug('\n📍 Starting TCL scheduler (daily at 7 AM)...')
    tclScheduler.start()

    // Step 3: Start ETL scheduler (5-30 second intervals)
    console.log(`[${new Date().toISOString()}] ⏳ Starting ETL scheduler...`)
    logger.debug('\n⏰ Starting ETL scheduler...')
    etlScheduler.start()

    // Step 4: Start Express API server
    console.log(`[${new Date().toISOString()}] ⏳ Starting Express server...`)
    logger.debug('🌐 Starting Express server...')
    await startServer()

    // Clean summary in quiet mode
    console.log('\n🌐 Express server listening on port 8080')
    console.log('   Health check: http://localhost:8080/health')
    console.log('   API: http://localhost:8080/api/disruptions')
    if (existsSync(distPath)) {
      console.log('   Frontend: http://localhost:8080')
    }
    console.log('\n✅ Server ready - Database connected, ETL running')
    console.log('   (Set LOG_LEVEL=verbose for detailed ETL logging)\n')

  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Server startup failed:`, error)
    logger.error('\n❌ Server startup failed:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM - shutting down gracefully...')
  tclScheduler.stop()
  etlScheduler.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n📡 Received SIGINT - shutting down gracefully...')
  tclScheduler.stop()
  etlScheduler.stop()
  process.exit(0)
})

// Start the server
startup().catch((error) => {
  console.error('❌ Unhandled error in startup:', error)
  process.exit(1)
})
