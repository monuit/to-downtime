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
import { existsSync } from 'fs'
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
console.log('📁 Dist folder exists:', existsSync(distPath))
if (!existsSync(distPath)) {
  console.log('⚠️  WARNING: dist folder does not exist! This will cause 404 errors.')
  console.log('   Make sure npm run build was executed before starting the server.')
}

// Middleware
app.use(cors())
app.use(express.json())

// Request logging middleware for debugging
app.use((req, res, next) => {
  if (!req.path.startsWith('/health') && !req.path.startsWith('/api/')) {
    console.log(`📍 Request: ${req.method} ${req.path}`)
  }
  next()
})

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

// Helper: Convert snake_case to camelCase for frontend
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase)
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      result[camelKey] = toCamelCase(obj[key])
      return result
    }, {} as any)
  }
  return obj
}

// API: Get all disruptions from database
app.get('/api/disruptions', async (req, res) => {
  try {
    const disruptions = await getAllDisruptions()
    
    // Transform snake_case to camelCase for frontend compatibility
    const transformedDisruptions = toCamelCase(disruptions)
    
    res.json({
      success: true,
      count: transformedDisruptions.length,
      data: transformedDisruptions,
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

// API: Get historical disruptions from archive
app.get('/api/disruptions/archive', async (req, res) => {
  try {
    const { startDate, endDate, limit = 1000, type, severity } = req.query
    
    let query = `
      SELECT 
        id,
        external_id,
        type,
        severity,
        title,
        description,
        affected_lines,
        source_api,
        source_url,
        created_at,
        updated_at,
        resolved_at,
        archived_at,
        duration_minutes
      FROM disruptions_archive
      WHERE 1=1
    `
    
    const params: any[] = []
    let paramCount = 1
    
    // Date range filtering
    if (startDate) {
      query += ` AND archived_at >= $${paramCount}`
      params.push(new Date(Number(startDate)))
      paramCount++
    }
    
    if (endDate) {
      query += ` AND archived_at <= $${paramCount}`
      params.push(new Date(Number(endDate)))
      paramCount++
    }
    
    // Type filtering
    if (type) {
      query += ` AND type = $${paramCount}`
      params.push(type)
      paramCount++
    }
    
    // Severity filtering
    if (severity) {
      query += ` AND severity = $${paramCount}`
      params.push(severity)
      paramCount++
    }
    
    query += ` ORDER BY archived_at DESC LIMIT $${paramCount}`
    params.push(Number(limit))
    
    const result = await import('./db.js').then(module => module.pool.query(query, params))
    
    const disruptions = result.rows.map((row: any) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      description: row.description,
      affectedLines: row.affected_lines,
      timestamp: new Date(row.archived_at).getTime(),
      sourceApi: row.source_api,
      sourceUrl: row.source_url,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : undefined,
      durationMinutes: row.duration_minutes,
    }))
    
    res.json({
      success: true,
      count: disruptions.length,
      data: disruptions,
      filters: {
        startDate: startDate ? new Date(Number(startDate)).toISOString() : undefined,
        endDate: endDate ? new Date(Number(endDate)).toISOString() : undefined,
        type,
        severity,
        limit,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching archived disruptions:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch archived disruptions',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// API: Get aggregated analytics data
app.get('/api/analytics/aggregate', async (req, res) => {
  try {
    const { field, groupBy, startDate, endDate, includeArchive = 'false' } = req.query
    
    if (!field || !groupBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: field and groupBy',
      })
    }
    
    let query = `
      SELECT 
        ${groupBy} as label,
        COUNT(*) as count
      FROM disruptions
      WHERE is_active = true
    `
    
    const params: any[] = []
    let paramCount = 1
    
    if (startDate) {
      query += ` AND created_at >= $${paramCount}`
      params.push(new Date(Number(startDate)))
      paramCount++
    }
    
    if (endDate) {
      query += ` AND created_at <= $${paramCount}`
      params.push(new Date(Number(endDate)))
      paramCount++
    }
    
    query += ` GROUP BY ${groupBy} ORDER BY count DESC`
    
    const result = await import('./db.js').then(module => module.pool.query(query, params))
    
    const data = result.rows.map((row: any) => ({
      label: row.label || 'Unknown',
      count: Number(row.count),
    }))
    
    res.json({
      success: true,
      field,
      groupBy,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
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

// API: Manually trigger TCL fetch and match
app.post('/api/tcl/refresh', async (req, res) => {
  try {
    console.log('📍 Manual TCL refresh triggered via API')
    
    const { fetchAndStoreTCL } = await import('./etl/tcl-fetcher.js')
    const { batchMatchDisruptions } = await import('./etl/tcl-matcher.js')
    const { getAllDisruptions } = await import('./db.js')
    
    // Fetch and store TCL data
    const tclResult = await fetchAndStoreTCL()
    
    if (!tclResult.success) {
      return res.status(500).json({
        success: false,
        error: 'TCL fetch failed',
        message: tclResult.error,
      })
    }
    
    // Match all active disruptions
    const disruptions = await getAllDisruptions()
    const matchResult = await batchMatchDisruptions(
      disruptions.map(d => ({
        external_id: d.external_id,
        title: d.title,
        description: d.description
      }))
    )
    
    res.json({
      success: true,
      tcl: {
        segmentsStored: tclResult.segmentsStored,
        fromCache: tclResult.fromCache,
      },
      matching: {
        total: disruptions.length,
        matched: matchResult.matched,
        failed: matchResult.failed,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error during TCL refresh:', error)
    res.status(500).json({
      success: false,
      error: 'TCL refresh failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

// Serve static files from React build (dist/)
console.log('📁 Setting up static file serving from:', distPath)
app.use(express.static(distPath, {
  maxAge: '1h', // Cache static assets for 1 hour
  etag: false,
}))

// All other routes serve index.html (SPA fallback) - must be last
app.get(/.*/, (req, res) => {
  console.log('📍 SPA fallback: serving index.html for', req.path)
  res.sendFile(path.join(distPath, 'index.html'))
})

// Error handling middleware (should be after all other routes)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  })
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
