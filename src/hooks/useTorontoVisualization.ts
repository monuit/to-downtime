import { useState, useEffect, useCallback } from 'react'
import { useDisruptionStore } from '../store/disruptions'

export interface RouteSegment {
  routeId: string
  routeName: string
  routeType: 'bus' | 'subway' | 'streetcar' | 'rail' | 'ferry'
  frequency: number
  coordinates: Array<{ lat: number; lon: number }>
  color: string
}

export interface RoadRestriction {
  id: string
  location: string
  type: string
  severity: 'severe' | 'moderate' | 'minor'
  coordinates: { lat: number; lon: number }
  description: string
}

export interface TransitAlert {
  id: string
  title: string
  affectedLines: string[]
  severity: 'severe' | 'moderate' | 'minor'
  timestamp: number
}

interface UseTorontoVisualizationOptions {
  enabled?: boolean
  colorScheme?: 'default' | 'pastel' | 'inferno' | 'earthy' | 'cool'
  maxDistanceKm?: number
  centerLat?: number
  centerLon?: number
}

interface UseTorontoVisualizationReturn {
  routes: RouteSegment[]
  restrictions: RoadRestriction[]
  alerts: TransitAlert[]
  loading: boolean
  error: Error | null
  refreshing: boolean
  refresh: () => void
  colorScheme: string
  updateColorScheme: (scheme: string) => void
  stats: {
    totalRoutes: number
    totalRestrictions: number
    activeAlerts: number
    averageFrequency: number
  }
}

// Color schemes matching cityliner palettes
const COLOR_SCHEMES = {
  default: {
    bus: '#3B82F6',
    subway: '#EF4444',
    streetcar: '#F59E0B',
    rail: '#8B5CF6',
    ferry: '#06B6D4',
  },
  pastel: {
    bus: '#A7D8DE',
    subway: '#F4978E',
    streetcar: '#F8E5B8',
    rail: '#D4A5D4',
    ferry: '#B4E7FF',
  },
  inferno: {
    bus: '#FCE38A',
    subway: '#F47560',
    streetcar: '#FB5607',
    rail: '#9D0208',
    ferry: '#370617',
  },
  earthy: {
    bus: '#9B7653',
    subway: '#8B4513',
    streetcar: '#CD853F',
    rail: '#654321',
    ferry: '#A0826D',
  },
  cool: {
    bus: '#0096FF',
    subway: '#0047AB',
    streetcar: '#6C8EBF',
    rail: '#4169E1',
    ferry: '#00BFFF',
  },
}

// Toronto city center
const TORONTO_CENTER_LAT = 43.6629
const TORONTO_CENTER_LON = -79.3957

// Mock route data generator (will be replaced with real GTFS-RT data)
const generateMockRoutes = (): RouteSegment[] => {
  const routes: RouteSegment[] = [
    {
      routeId: '501',
      routeName: 'King',
      routeType: 'streetcar',
      frequency: Math.floor(Math.random() * 30) + 5,
      coordinates: [
        { lat: 43.642, lon: -79.4 },
        { lat: 43.643, lon: -79.395 },
        { lat: 43.644, lon: -79.39 },
      ],
      color: COLOR_SCHEMES.default.streetcar,
    },
    {
      routeId: '505',
      routeName: 'Dundas',
      routeType: 'streetcar',
      frequency: Math.floor(Math.random() * 25) + 3,
      coordinates: [
        { lat: 43.66, lon: -79.42 },
        { lat: 43.66, lon: -79.415 },
        { lat: 43.66, lon: -79.41 },
      ],
      color: COLOR_SCHEMES.default.streetcar,
    },
    {
      routeId: '506',
      routeName: 'College',
      routeType: 'streetcar',
      frequency: Math.floor(Math.random() * 28) + 4,
      coordinates: [
        { lat: 43.663, lon: -79.425 },
        { lat: 43.663, lon: -79.42 },
        { lat: 43.663, lon: -79.415 },
      ],
      color: COLOR_SCHEMES.default.streetcar,
    },
    {
      routeId: '1',
      routeName: 'Yonge',
      routeType: 'subway',
      frequency: Math.floor(Math.random() * 15) + 2,
      coordinates: [
        { lat: 43.645, lon: -79.38 },
        { lat: 43.655, lon: -79.38 },
        { lat: 43.665, lon: -79.38 },
      ],
      color: COLOR_SCHEMES.default.subway,
    },
    {
      routeId: '2',
      routeName: 'Bloor-Danforth',
      routeType: 'subway',
      frequency: Math.floor(Math.random() * 16) + 2,
      coordinates: [
        { lat: 43.67, lon: -79.4 },
        { lat: 43.67, lon: -79.39 },
        { lat: 43.67, lon: -79.38 },
      ],
      color: COLOR_SCHEMES.default.subway,
    },
    {
      routeId: '3',
      routeName: 'Spadina',
      routeType: 'subway',
      frequency: Math.floor(Math.random() * 14) + 2,
      coordinates: [
        { lat: 43.655, lon: -79.4 },
        { lat: 43.665, lon: -79.4 },
        { lat: 43.675, lon: -79.4 },
      ],
      color: COLOR_SCHEMES.default.subway,
    },
    {
      routeId: '100',
      routeName: 'University Ave',
      routeType: 'bus',
      frequency: Math.floor(Math.random() * 20) + 3,
      coordinates: [
        { lat: 43.66, lon: -79.4 },
        { lat: 43.65, lon: -79.4 },
        { lat: 43.64, lon: -79.4 },
      ],
      color: COLOR_SCHEMES.default.bus,
    },
    {
      routeId: '101',
      routeName: 'Spadina Ave',
      routeType: 'bus',
      frequency: Math.floor(Math.random() * 18) + 2,
      coordinates: [
        { lat: 43.66, lon: -79.405 },
        { lat: 43.65, lon: -79.405 },
        { lat: 43.64, lon: -79.405 },
      ],
      color: COLOR_SCHEMES.default.bus,
    },
  ]

  return routes
}

// Mock restrictions generator
const generateMockRestrictions = (): RoadRestriction[] => {
  return [
    {
      id: 'r1',
      location: 'King & University',
      type: 'construction',
      severity: 'moderate',
      coordinates: { lat: 43.643, lon: -79.4 },
      description: 'Road resurfacing',
    },
    {
      id: 'r2',
      location: 'Bloor & Bay',
      type: 'closure',
      severity: 'severe',
      coordinates: { lat: 43.671, lon: -79.387 },
      description: 'Full closure - event',
    },
    {
      id: 'r3',
      location: 'Dundas & McCaul',
      type: 'lane_reduction',
      severity: 'minor',
      coordinates: { lat: 43.665, lon: -79.408 },
      description: 'Lane reduction for maintenance',
    },
  ]
}

// Mock alerts generator
const generateMockAlerts = (): TransitAlert[] => {
  return [
    {
      id: 'a1',
      title: 'Line 1 Northbound Delays',
      affectedLines: ['1'],
      severity: 'moderate',
      timestamp: Date.now(),
    },
    {
      id: 'a2',
      title: 'Streetcar 505 Detour',
      affectedLines: ['505'],
      severity: 'moderate',
      timestamp: Date.now() - 300000,
    },
  ]
}

export const useTorontoVisualization = (
  options: UseTorontoVisualizationOptions = {}
): UseTorontoVisualizationReturn => {
  const {
    enabled = true,
    colorScheme: initialColorScheme = 'default',
    maxDistanceKm = 25,
    centerLat = TORONTO_CENTER_LAT,
    centerLon = TORONTO_CENTER_LON,
  } = options

  const [routes, setRoutes] = useState<RouteSegment[]>([])
  const [restrictions, setRestrictions] = useState<RoadRestriction[]>([])
  const [alerts, setAlerts] = useState<TransitAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [colorScheme, setColorScheme] = useState(initialColorScheme)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      // In production, these would be actual API calls:
      // const routesRes = await fetch('/api/gtfs-routes')
      // const restrictionsRes = await fetch('/api/road-restrictions')
      // const alertsRes = await fetch('/api/transit-alerts')

      // For now, use mock data
      const mockRoutes = generateMockRoutes()
      const mockRestrictions = generateMockRestrictions()
      const mockAlerts = generateMockAlerts()

      setRoutes(mockRoutes)
      setRestrictions(mockRestrictions)
      setAlerts(mockAlerts)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  // Initial fetch
  useEffect(() => {
    fetchData()

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      setRefreshing(true)
      fetchData().finally(() => setRefreshing(false))
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchData])

  // Calculate stats
  const stats = {
    totalRoutes: routes.length,
    totalRestrictions: restrictions.length,
    activeAlerts: alerts.filter((a) => Date.now() - a.timestamp < 3600000).length,
    averageFrequency: routes.length > 0 ? Math.round(routes.reduce((sum, r) => sum + r.frequency, 0) / routes.length) : 0,
  }

  const updateColorScheme = useCallback((scheme: string) => {
    if (scheme in COLOR_SCHEMES) {
      setColorScheme(scheme as 'default' | 'pastel' | 'inferno' | 'earthy' | 'cool')
    }
  }, [])

  return {
    routes,
    restrictions,
    alerts,
    loading,
    error,
    refreshing,
    refresh: fetchData,
    colorScheme,
    updateColorScheme,
    stats,
  }
}
