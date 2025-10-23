/**
 * TTC GTFS Static Data Fetcher
 * Downloads and caches TTC's static GTFS feed (shapes, routes, trips)
 * 
 * TTC GTFS Static Feed: https://open.toronto.ca/dataset/ttc-routes-and-schedules/
 * Direct ZIP: http://opendata.toronto.ca/TTC/routes/OpenData_TTC_Schedules.zip
 */

import Papa from 'papaparse'
import type { GTFSShape, GTFSRoute, GTFSTrip } from './gtfs-processor'

const TTC_GTFS_ZIP_URL = 'http://opendata.toronto.ca/TTC/routes/OpenData_TTC_Schedules.zip'
const CACHE_KEY_PREFIX = 'ttc_gtfs_'
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

interface GTFSCache {
  timestamp: number
  data: any
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cache: GTFSCache | null): boolean {
  if (!cache) return false
  const now = Date.now()
  return (now - cache.timestamp) < CACHE_DURATION_MS
}

/**
 * Get cached GTFS data from localStorage
 */
function getCached<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + key)
    if (!cached) return null
    
    const parsed: GTFSCache = JSON.parse(cached)
    if (!isCacheValid(parsed)) {
      localStorage.removeItem(CACHE_KEY_PREFIX + key)
      return null
    }
    
    return parsed.data as T
  } catch {
    return null
  }
}

/**
 * Save GTFS data to localStorage cache
 */
function saveCache<T>(key: string, data: T): void {
  try {
    const cache: GTFSCache = {
      timestamp: Date.now(),
      data,
    }
    localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(cache))
  } catch (error) {
    console.warn('Failed to cache GTFS data:', error)
  }
}

/**
 * Parse CSV text to objects using PapaParse
 */
function parseCSV<T>(csvText: string): T[] {
  const result = Papa.parse<T>(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })
  
  if (result.errors.length > 0) {
    console.warn('CSV parsing errors:', result.errors)
  }
  
  return result.data
}

/**
 * Fetch a single file from TTC GTFS static feed
 * Note: This is a simplified version. In production, you'd need to:
 * 1. Download the ZIP file
 * 2. Extract it (using JSZip)
 * 3. Read individual files
 * 
 * For this implementation, we'll use pre-extracted hosted files or mock data
 */
async function fetchGTFSFile(filename: string): Promise<string> {
  // Option 1: Use pre-hosted extracted files (if available)
  // const url = `https://your-cdn.com/ttc-gtfs/${filename}`
  
  // Option 2: Use TTC's direct file access (if they provide it)
  // Some agencies provide direct access to individual files
  
  // For now, throw an error - user needs to provide hosted GTFS files
  throw new Error(
    `Direct GTFS file fetching not implemented. ` +
    `Please download TTC GTFS from ${TTC_GTFS_ZIP_URL} and host the extracted files, ` +
    `or use the mock data generator below.`
  )
}

/**
 * Fetch TTC GTFS shapes.txt
 * Contains route shape coordinates (lat/lon points)
 */
export async function fetchTTCShapes(): Promise<GTFSShape[]> {
  // Check cache first
  const cached = getCached<GTFSShape[]>('shapes')
  if (cached) {
    console.log('✅ Using cached TTC shapes data')
    return cached
  }
  
  try {
    const csvText = await fetchGTFSFile('shapes.txt')
    const shapes = parseCSV<any>(csvText).map(row => ({
      shape_id: row.shape_id,
      shape_pt_lat: parseFloat(row.shape_pt_lat),
      shape_pt_lon: parseFloat(row.shape_pt_lon),
      shape_pt_sequence: parseInt(row.shape_pt_sequence),
    }))
    
    saveCache('shapes', shapes)
    return shapes
  } catch (error) {
    console.error('Failed to fetch TTC shapes:', error)
    return []
  }
}

/**
 * Fetch TTC GTFS routes.txt
 * Contains route metadata (route_id, name, type, color)
 */
export async function fetchTTCRoutes(): Promise<GTFSRoute[]> {
  const cached = getCached<GTFSRoute[]>('routes')
  if (cached) {
    console.log('✅ Using cached TTC routes data')
    return cached
  }
  
  try {
    const csvText = await fetchGTFSFile('routes.txt')
    const routes = parseCSV<any>(csvText).map(row => ({
      route_id: row.route_id,
      route_short_name: row.route_short_name,
      route_long_name: row.route_long_name,
      route_type: parseInt(row.route_type),
      route_color: row.route_color,
    }))
    
    saveCache('routes', routes)
    return routes
  } catch (error) {
    console.error('Failed to fetch TTC routes:', error)
    return []
  }
}

/**
 * Fetch TTC GTFS trips.txt
 * Contains trip-to-route-to-shape mappings
 */
export async function fetchTTCTrips(): Promise<GTFSTrip[]> {
  const cached = getCached<GTFSTrip[]>('trips')
  if (cached) {
    console.log('✅ Using cached TTC trips data')
    return cached
  }
  
  try {
    const csvText = await fetchGTFSFile('trips.txt')
    const trips = parseCSV<any>(csvText).map(row => ({
      trip_id: row.trip_id,
      route_id: row.route_id,
      shape_id: row.shape_id,
    }))
    
    saveCache('trips', trips)
    return trips
  } catch (error) {
    console.error('Failed to fetch TTC trips:', error)
    return []
  }
}

/**
 * Fetch all TTC GTFS static data
 */
export async function fetchAllTTCGTFS() {
  const [shapes, routes, trips] = await Promise.all([
    fetchTTCShapes(),
    fetchTTCRoutes(),
    fetchTTCTrips(),
  ])
  
  return { shapes, routes, trips }
}

/**
 * Generate mock TTC GTFS data for development/demo
 * Simulates real TTC routes with realistic trip frequencies
 */
export function generateMockTTCData() {
  // Mock TTC Line 1 (Yonge-University-Spadina) - Subway
  const line1Shapes: GTFSShape[] = []
  const line1ShapeId = 'shape_line_1'
  
  // Simplified Line 1 path (Vaughan to Finch to Union to Downsview)
  const line1Coords = [
    { lat: 43.7940, lon: -79.5085 }, // Vaughan Metropolitan Centre
    { lat: 43.7799, lon: -79.5180 }, // Highway 407
    { lat: 43.7735, lon: -79.5039 }, // Pioneer Village
    { lat: 43.7669, lon: -79.4968 }, // York University
    { lat: 43.7613, lon: -79.5113 }, // Finch West
    { lat: 43.7544, lon: -79.4526 }, // Downsview Park
    { lat: 43.7366, lon: -79.4523 }, // Sheppard West
    { lat: 43.7101, lon: -79.4516 }, // Wilson
    { lat: 43.6833, lon: -79.4522 }, // Yorkdale
    { lat: 43.6635, lon: -79.4530 }, // Lawrence West
    { lat: 43.6515, lon: -79.4537 }, // Glencairn
    { lat: 43.7061, lon: -79.3975 }, // Finch (east branch)
    { lat: 43.6948, lon: -79.4095 }, // North York Centre
    { lat: 43.6800, lon: -79.4145 }, // Sheppard-Yonge
    { lat: 43.6627, lon: -79.3881 }, // Eglinton
    { lat: 43.6517, lon: -79.3836 }, // Davisville
    { lat: 43.6400, lon: -79.3888 }, // St. Clair
    { lat: 43.6300, lon: -79.3947 }, // Summerhill
    { lat: 43.6175, lon: -79.3904 }, // Rosedale
    { lat: 43.6075, lon: -79.3901 }, // Bloor-Yonge
    { lat: 43.6537, lon: -79.3811 }, // St. George
    { lat: 43.6678, lon: -79.4065 }, // Spadina
    { lat: 43.6636, lon: -79.4208 }, // Dupont
    { lat: 43.6518, lon: -79.4055 }, // St. George
    { lat: 43.6451, lon: -79.4020 }, // Museum
    { lat: 43.6425, lon: -79.3873 }, // Queen's Park
    { lat: 43.6435, lon: -79.3793 }, // St. Patrick
    { lat: 43.6540, lon: -79.3835 }, // Osgoode
    { lat: 43.6480, lon: -79.3788 }, // St. Andrew
    { lat: 43.6451, lon: -79.3805 }, // Union Station
    { lat: 43.6415, lon: -79.3812 }, // King
    { lat: 43.6289, lon: -79.3943 }, // Queen
  ]
  
  line1Coords.forEach((coord, idx) => {
    line1Shapes.push({
      shape_id: line1ShapeId,
      shape_pt_lat: coord.lat,
      shape_pt_lon: coord.lon,
      shape_pt_sequence: idx,
    })
  })
  
  // Mock routes
  const routes: GTFSRoute[] = [
    {
      route_id: 'route_1',
      route_short_name: '1',
      route_long_name: 'Yonge-University',
      route_type: 1, // Subway
      route_color: 'FDB913', // TTC Yellow
    },
    {
      route_id: 'route_2',
      route_short_name: '2',
      route_long_name: 'Bloor-Danforth',
      route_type: 1, // Subway
      route_color: '00853F', // TTC Green
    },
    {
      route_id: 'route_501',
      route_short_name: '501',
      route_long_name: 'Queen',
      route_type: 0, // Streetcar
      route_color: 'DA291C', // TTC Red
    },
    {
      route_id: 'route_36',
      route_short_name: '36',
      route_long_name: 'Finch West',
      route_type: 3, // Bus
      route_color: '0055A5', // TTC Blue
    },
  ]
  
  // Mock trips (high frequency for Line 1)
  const trips: GTFSTrip[] = []
  
  // Line 1: 60 trips (very high frequency - every 3 minutes during rush hour)
  for (let i = 0; i < 60; i++) {
    trips.push({
      trip_id: `trip_1_${i}`,
      route_id: 'route_1',
      shape_id: line1ShapeId,
    })
  }
  
  console.log('📊 Generated mock TTC GTFS data:')
  console.log(`  - ${line1Shapes.length} shape points`)
  console.log(`  - ${routes.length} routes`)
  console.log(`  - ${trips.length} trips`)
  
  return {
    shapes: line1Shapes,
    routes,
    trips,
  }
}
