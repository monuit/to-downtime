/**
 * GTFS Segment Processor
 * Port of Cityliner's core algorithm for computing route segments with trip frequency
 * Based on: https://github.com/dragoon/cityliner
 * 
 * Algorithm:
 * 1. Parse GTFS static files (shapes.txt, routes.txt, trips.txt)
 * 2. Count trips per shape_id to determine frequency
 * 3. Group coordinates by shape_id to form route segments
 * 4. Compute min/max trip counts for normalization
 * 5. Export segments with metadata for visualization
 */

export interface GTFSShape {
  shape_id: string
  shape_pt_lat: number
  shape_pt_lon: number
  shape_pt_sequence: number
}

export interface GTFSRoute {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_type: number // 0=tram, 1=subway, 2=rail, 3=bus, 4=ferry, 5=cable car, 6=gondola, 7=funicular
  route_color?: string
}

export interface GTFSTrip {
  trip_id: string
  route_id: string
  shape_id: string
}

export interface RouteSegment {
  shape_id: string
  route_type: number
  route_name: string
  trip_count: number // Number of trips using this shape (frequency indicator)
  coordinates: Array<{ lat: number; lon: number }>
  color: string
}

export interface SegmentDataset {
  segments: RouteSegment[]
  max_trips: number
  min_trips: number
  route_type_counts: Record<number, number>
}

/**
 * Simplified route type mapper (following Cityliner's to_simple_gtfs_type)
 * Maps extended GTFS route types to base types
 */
export function simplifyRouteType(routeType: number): number {
  if (routeType >= 0 && routeType <= 12) return routeType
  
  // Extended GTFS route types mapping
  if (routeType >= 100 && routeType <= 199) return 2 // Rail service
  if (routeType >= 200 && routeType <= 299) return 3 // Coach/Bus service
  if (routeType >= 400 && routeType <= 404) return 1 // Urban rail/Subway
  if (routeType === 405) return 12 // Monorail
  if (routeType >= 700 && routeType <= 799) return 3 // Bus service
  if (routeType >= 800 && routeType <= 899) return 11 // Trolleybus
  if (routeType >= 900 && routeType <= 999) return 0 // Tram
  if (routeType === 1000) return 15 // Water transport
  if (routeType >= 1300 && routeType <= 1400) return 6 // Aerial lift
  
  return routeType
}

/**
 * Get route color based on type (Cityliner default color scheme)
 */
export function getRouteColor(routeType: number): string {
  const simpleType = simplifyRouteType(routeType)
  
  const colorScheme: Record<number, string> = {
    0: '#1A75D1',   // Tram - Blue
    1: '#4DAF4A',   // Subway - Green
    2: '#708A91',   // Rail - Gray
    3: '#E31B1C',   // Bus - Red
    4: '#FF8000',   // Ferry - Orange
    5: '#F761BF',   // Cable car - Pink
    6: '#F761BF',   // Gondola - Pink
    7: '#F761BF',   // Funicular - Pink
    11: '#1A75D1',  // Trolleybus - Blue (like tram)
    12: '#4DAF4A',  // Monorail - Green (like subway)
    15: '#FF8000',  // Water - Orange (like ferry)
  }
  
  return colorScheme[simpleType] || '#999999'
}

/**
 * Process GTFS data to compute route segments with frequency
 * Following Cityliner's compute_segments algorithm
 */
export function computeGTFSSegments(
  shapes: GTFSShape[],
  routes: GTFSRoute[],
  trips: GTFSTrip[]
): SegmentDataset {
  
  // Step 1: Build lookup maps
  const routeMap = new Map<string, GTFSRoute>()
  routes.forEach(route => routeMap.set(route.route_id, route))
  
  // Step 2: Count trips per shape_id (frequency calculation)
  const tripsPerShape = new Map<string, number>()
  const shapeToRoute = new Map<string, string>()
  
  trips.forEach(trip => {
    const count = tripsPerShape.get(trip.shape_id) || 0
    tripsPerShape.set(trip.shape_id, count + 1)
    
    if (!shapeToRoute.has(trip.shape_id)) {
      shapeToRoute.set(trip.shape_id, trip.route_id)
    }
  })
  
  // Step 3: Group shapes by shape_id and sort by sequence
  const shapeGroups = new Map<string, GTFSShape[]>()
  shapes.forEach(shape => {
    if (!shapeGroups.has(shape.shape_id)) {
      shapeGroups.set(shape.shape_id, [])
    }
    shapeGroups.get(shape.shape_id)!.push(shape)
  })
  
  // Step 4: Build segments
  const segments: RouteSegment[] = []
  let maxTrips = 0
  let minTrips = Infinity
  const routeTypeCounts: Record<number, number> = {}
  
  shapeGroups.forEach((shapePoints, shapeId) => {
    const tripCount = tripsPerShape.get(shapeId) || 0
    if (tripCount === 0) return // Skip shapes with no trips
    
    const routeId = shapeToRoute.get(shapeId)
    if (!routeId) return
    
    const route = routeMap.get(routeId)
    if (!route) return
    
    // Sort by sequence
    const sortedPoints = shapePoints.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
    
    // Extract coordinates
    const coordinates = sortedPoints.map(pt => ({
      lat: pt.shape_pt_lat,
      lon: pt.shape_pt_lon,
    }))
    
    if (coordinates.length === 0) return
    
    // Update min/max
    maxTrips = Math.max(maxTrips, tripCount)
    minTrips = Math.min(minTrips, tripCount)
    
    // Count route types
    const routeType = simplifyRouteType(route.route_type)
    routeTypeCounts[routeType] = (routeTypeCounts[routeType] || 0) + 1
    
    segments.push({
      shape_id: shapeId,
      route_type: route.route_type,
      route_name: route.route_short_name || route.route_long_name,
      trip_count: tripCount,
      coordinates,
      color: route.route_color ? `#${route.route_color}` : getRouteColor(route.route_type),
    })
  })
  
  // Normalize min/max (prevent division by zero)
  if (maxTrips === minTrips) {
    if (maxTrips > 0) minTrips = maxTrips - 1
    else maxTrips = 1
  }
  
  return {
    segments,
    max_trips: maxTrips,
    min_trips: minTrips,
    route_type_counts: routeTypeCounts,
  }
}

/**
 * Calculate line width based on trip frequency (Cityliner's algorithm)
 * Uses logarithmic scaling for better visual distribution
 */
export function calculateLineWidth(tripCount: number, minTrips: number, maxTrips: number): number {
  const factor = 1.7
  let width = Math.log(tripCount * factor) * 3
  
  if (width < 0) {
    width = 1.0 * factor
  }
  
  return width
}

/**
 * Calculate opacity based on trip frequency
 * More frequent routes are more opaque
 */
export function calculateOpacity(tripCount: number, maxTrips: number): number {
  const alpha = 100 * (tripCount / maxTrips)
  return Math.max(alpha, 20.0) / 255.0 // Minimum 20% opacity
}
