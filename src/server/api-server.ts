/**
 * Express API Server
 * 
 * Serves both:
 * 1. React frontend (static files from dist/)
 * 2. API endpoints for disruption data
 * 
 * Runs alongside ETL scheduler in same Railway container
 */

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { getAllDisruptions } from './db.js'
import { fetchAllLiveDataWithMetadata } from './live-data.js'
import { etlScheduler } from './etl-scheduler.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Resolve dist path - works correctly whether running from src or dist directory
const distPath = process.env.NODE_ENV === 'production'
  ? path.resolve('/app/dist') // Railway production path
  : path.resolve(path.join(__dirname, '../../dist')) // Local development path

console.log('📁 Using dist path:', distPath)

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = etlScheduler.getStats()
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    etl: {
      totalRuns: stats.totalRuns,
      successfulRuns: stats.successfulRuns,
      failedRuns: stats.failedRuns,
      lastRunAt: stats.lastRunAt,
      lastSuccessAt: stats.lastSuccessAt,
      disruptionsProcessed: stats.disruptionsProcessed,
    },
  })
})

// API: Get all disruptions from database
app.get('/api/disruptions', async (req, res) => {
  try {
    const disruptions = await getAllDisruptions()
    
    res.json({
      success: true,
      count: disruptions.length,
      data: disruptions,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching disruptions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disruptions',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// API: Trigger manual ETL sync
app.post('/api/sync', async (req, res) => {
  try {
    console.log('📡 Manual sync triggered via API')
    
    const result = await fetchAllLiveDataWithMetadata()
    
    res.json({
      success: true,
      fetched: result.disruptions.length,
      sources: result.metadata.sources,
      errors: result.metadata.errors,
      timestamp: result.metadata.fetchedAt,
    })
  } catch (error) {
    console.error('Error during manual sync:', error)
    res.status(500).json({
      success: false,
      error: 'Sync failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// API: Get ETL scheduler statistics
app.get('/api/stats', (req, res) => {
  const stats = etlScheduler.getStats()
  res.json({
    success: true,
    stats,
  })
})

// Serve static files from React build (dist/)
app.use(express.static(distPath))

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  })
})

// All other routes serve index.html (SPA fallback) - must be last
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

// Start server
export function startServer() {
  return new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      console.log(`\n🌐 Express server listening on port ${PORT}`)
      console.log(`   Health check: http://localhost:${PORT}/health`)
      console.log(`   API: http://localhost:${PORT}/api/disruptions`)
      console.log(`   Frontend: http://localhost:${PORT}\n`)
      resolve()
    })
  })
}
