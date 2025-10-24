import { useEffect, useState } from 'react'
import type { Disruption } from '../store/disruptions'
import { fetchAllDisruptionData } from '../server/api-client'

const DEBUG = import.meta.env.VITE_DEBUG === 'true'

interface DataFetcherResult {
  data: Disruption[] | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  nextRefreshTime: Date | null
}

/**
 * Get random refresh interval with weighted probability:
 * - 75% chance: 30-90 seconds (preferred range)
 * - 25% chance: 5-30 seconds (occasional faster refresh)
 */
const getRandomRefreshInterval = (): number => {
  const random = Math.random()
  
  // 75% of the time, use the preferred 30-90s range
  if (random < 0.75) {
    const minMs = 30000 // 30 seconds
    const maxMs = 90000 // 90 seconds
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  } 
  // 25% of the time, use the faster 5-30s range
  else {
    const minMs = 5000  // 5 seconds
    const maxMs = 30000 // 30 seconds
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  }
}

/**
 * Fetch disruptions from live APIs
 * Sources:
 * - TTC GTFS Realtime
 * - Toronto Open Data (Road Restrictions)
 * - Toronto Open Data (Transit Alerts)
 */
const fetchDisruptionData = async (): Promise<Disruption[]> => {
  try {
    const result = await fetchAllDisruptionData()
    return result
  } catch (error) {
    console.error('Failed to fetch disruptions:', error)
    return []
  }
}

export const useDataFetcher = (): DataFetcherResult => {
  const [data, setData] = useState<Disruption[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextRefreshTime, setNextRefreshTime] = useState<Date | null>(null)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout

    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await fetchDisruptionData()
        setData(result)
        const now = new Date()
        setLastUpdated(now)
        const nextInterval = getRandomRefreshInterval()
        setNextRefreshTime(new Date(now.getTime() + nextInterval))
        setError(null)
        if (DEBUG) console.log(`📊 Loaded ${result.length} disruptions, next refresh in ${Math.floor(nextInterval / 1000)}s`)
        
        // Schedule next fetch
        timeoutId = setTimeout(fetchData, nextInterval)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('Failed to fetch disruptions:', err)
        
        // Retry on error after a random interval
        const retryInterval = getRandomRefreshInterval()
        timeoutId = setTimeout(fetchData, retryInterval)
      } finally {
        setLoading(false)
      }
    }

    // Fetch immediately
    fetchData()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

  return { data, loading, error, lastUpdated, nextRefreshTime }
}
