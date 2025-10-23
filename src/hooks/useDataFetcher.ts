import { useEffect, useState } from 'react'
import type { Disruption } from '../store/disruptions'

interface DataFetcherResult {
  data: Disruption[] | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

// Simulated ETL data fetcher - in production, this would call your API
const fetchDisruptionData = async (): Promise<Disruption[]> => {
  // This would call your backend API that fetches from GTFS-RT
  try {
    const response = await fetch('/api/disruptions')
    if (!response.ok) throw new Error('Failed to fetch disruptions')
    return await response.json()
  } catch {
    // Return mock data for demo
    return generateMockData()
  }
}

const generateMockData = (): Disruption[] => {
  const types: Array<'subway' | 'streetcar' | 'bus' | 'road' | 'elevator' | 'escalator'> = [
    'subway',
    'streetcar',
    'bus',
    'road',
    'elevator',
    'escalator',
  ]
  const severities: Array<'severe' | 'moderate' | 'minor'> = ['severe', 'moderate', 'minor']
  const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Spadina', 'Bloor-Danforth']

  return Array.from({ length: Math.floor(Math.random() * 15) + 3 }).map((_, i) => ({
    id: `disruption-${i}`,
    type: types[Math.floor(Math.random() * types.length)],
    severity: severities[Math.floor(Math.random() * severities.length)],
    title: [
      'Service Suspended',
      'Delays Expected',
      'Bypass Operation',
      'Road Closure',
      'Early Closure',
      'Reduced Speed',
    ][Math.floor(Math.random() * 6)],
    description: 'This is a sample disruption for demo purposes',
    affectedLines: [
      lines[Math.floor(Math.random() * lines.length)],
      lines[Math.floor(Math.random() * lines.length)],
    ],
    timestamp: Date.now(),
  }))
}

export const useDataFetcher = (intervalMs: number = 30000): DataFetcherResult => {
  const [data, setData] = useState<Disruption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await fetchDisruptionData()
        setData(result)
        setLastUpdated(new Date())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Failed to fetch disruptions:', err)
      } finally {
        setLoading(false)
      }
    }

    // Fetch immediately
    fetchData()

    // Set up interval
    const interval = setInterval(fetchData, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs])

  return { data, loading, error, lastUpdated }
}
