import { useEffect, useState } from 'react'
import type { Disruption } from '../store/disruptions'

interface DataFetcherResult {
  data: Disruption[] | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

/**
 * Get random refresh interval between 5-30 seconds
 */
const getRandomRefreshInterval = (minMs: number = 5000, maxMs: number = 30000): number => {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

/**
 * Fetch disruptions from backend API
 * API fetches from multiple sources:
 * - TTC GTFS Realtime
 * - Toronto Open Data (Road Restrictions)
 * - Toronto Open Data (Transit Alerts)
 */
const fetchDisruptionData = async (): Promise<Disruption[]> => {
  try {
    const response = await fetch('/api/sync')
    if (!response.ok) throw new Error(`API error: ${response.statusText}`)
    const json = await response.json()
    return json.disruptions || []
  } catch (error) {
    console.error('Failed to fetch disruptions from API:', error)
    return []
  }
}

export const useDataFetcher = (): DataFetcherResult => {
  const [data, setData] = useState<Disruption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextInterval, setNextInterval] = useState<number>(getRandomRefreshInterval())

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await fetchDisruptionData()
        setData(result)
        setLastUpdated(new Date())
        setError(null)
        console.log(`📊 Loaded ${result.length} disruptions`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Failed to fetch disruptions:', err)
      } finally {
        setLoading(false)
      }
    }

    // Fetch immediately
    fetchData()

    // Set up interval with randomized duration
    const currentInterval = getRandomRefreshInterval()
    setNextInterval(currentInterval)

    const interval = setInterval(() => {
      fetchData()
      // Randomize next interval
      setNextInterval(getRandomRefreshInterval())
    }, currentInterval)

    return () => clearInterval(interval)
  }, [])

  return { data, loading, error, lastUpdated }
}
