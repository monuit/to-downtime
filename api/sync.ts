import type { VercelRequest, VercelResponse } from '@vercel/node'
import { syncDisruptions } from '../src/server/sync'
import { fetchAllLiveData, deduplicateDisruptions, generateContentHash } from '../src/server/live-data'
import { getActiveDisruptions } from '../src/server/db'

/**
 * Vercel API Route: /api/sync
 * Handles live data fetching and serves disruptions with deduplication
 * 
 * Endpoints:
 * - POST /api/sync - Trigger sync from live APIs, store in DB
 * - GET /api/sync - Get current active disruptions (deduplicated)
 */

export default async (req: VercelRequest, res: VercelResponse) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    if (req.method === 'POST') {
      // Trigger sync from live APIs
      console.log('🔄 Starting live data sync...')
      const liveData = await fetchAllLiveData()
      console.log(`📊 Fetched ${liveData.length} disruptions from live APIs`)

      const stats = await syncDisruptions(liveData)
      res.status(200).json({
        success: true,
        message: 'Live data sync completed',
        stats,
        timestamp: new Date().toISOString(),
      })
    } else if (req.method === 'GET') {
      // Get current active disruptions (deduplicated)
      try {
        const activeDisruptions = await getActiveDisruptions()

        // Remove duplicates on response
        const contentHashes = new Set<string>()
        const dedupedDisruptions = activeDisruptions.filter((disruption: any) => {
          const hash = generateContentHash(
            disruption.type,
            disruption.severity,
            disruption.title,
            disruption.description || ''
          )

          if (contentHashes.has(hash)) {
            return false
          }

          contentHashes.add(hash)
          return true
        })

        res.status(200).json({
          success: true,
          disruptions: dedupedDisruptions.map((d: any) => ({
            id: d.id,
            type: d.type,
            severity: d.severity,
            title: d.title,
            description: d.description,
            affectedLines: d.affected_lines || [],
            timestamp: new Date(d.created_at).getTime(),
          })),
          count: dedupedDisruptions.length,
          timestamp: new Date().toISOString(),
        })
      } catch (dbError) {
        console.log('ℹ️  Database not yet initialized, returning empty array')
        res.status(200).json({
          success: true,
          disruptions: [],
          count: 0,
          timestamp: new Date().toISOString(),
        })
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (error: any) {
    console.error('Sync API error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Sync failed',
      timestamp: new Date().toISOString(),
    })
  }
}
