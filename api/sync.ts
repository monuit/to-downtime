import type { VercelRequest, VercelResponse } from '@vercel/node'
import { syncDisruptions } from '../src/server/sync'

/**
 * Vercel API Route: /api/sync
 * Handles manual sync triggers and serves synced disruptions
 * 
 * Endpoints:
 * - POST /api/sync - Trigger sync, optionally with raw data
 * - GET /api/sync - Get current active disruptions
 */

export default async (req: VercelRequest, res: VercelResponse) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    if (req.method === 'POST') {
      // Manual sync trigger
      const stats = await syncDisruptions(req.body?.data)
      res.status(200).json({
        success: true,
        message: 'Disruption sync completed',
        stats,
        timestamp: new Date().toISOString(),
      })
    } else if (req.method === 'GET') {
      // Get current active disruptions
      res.status(200).json({
        success: true,
        message: 'Get active disruptions endpoint',
        note: 'Implement by calling getActiveDisruptions from db.ts',
        timestamp: new Date().toISOString(),
      })
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
