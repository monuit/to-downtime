# Cityliner Implementation for TTC GTFS

This document explains the Cityliner-inspired transit visualization implementation for Toronto TTC data.

## Overview

Cityliner (https://github.com/dragoon/cityliner) is a Python-based tool that creates beautiful transit route visualizations from GTFS data. This project ports the core visualization algorithm to TypeScript/React for real-time web display.

## Architecture

### Core Components

1. **`src/server/gtfs-processor.ts`** - GTFS Segment Processing
   - Ports Cityliner's `compute_segments()` algorithm
   - Parses GTFS static files (shapes.txt, routes.txt, trips.txt)
   - Calculates trip frequency per route segment
   - Computes min/max trip counts for normalization
   - Applies logarithmic scaling for line width (Cityliner's formula)
   - Color coding by route type following Cityliner's default color scheme

2. **`src/server/gtfs-fetcher.ts`** - GTFS Data Management
   - Fetches TTC GTFS static data
   - Implements localStorage caching (24-hour TTL)
   - CSV parsing with PapaParse
   - Mock data generator for development/demo

3. **`src/components/TransitMap.tsx`** - Map Visualization
   - MapLibre GL JS integration
   - Interactive Toronto-centered map
   - Route rendering with frequency-based styling
   - Popup tooltips with route details
   - Real-time stats display

## Cityliner Algorithm Port

### Original Python Algorithm (Cityliner)

```python
def compute_segments(self, center: Point, max_dist: MaxDistance) -> SegmentsDataset:
    route_types, trips_on_a_shape = self._get_trips_and_routes()
    sequences = self._get_sequences(center, max_dist)
    segments = []
    max_trips, min_trips = 0, math.inf
    
    for shape_id, shape_sequences in sequences.items():
        route_type = get_route_type_for_shape_id(shape_id, route_types)
        if shape_id not in trips_on_a_shape:
            continue
            
        trips_n = trips_on_a_shape[shape_id]
        max_trips = max(trips_n, max_trips)
        min_trips = min(trips_n, min_trips)
        
        pts = []
        for shape in sorted(shape_sequences.values(), key=lambda s: int(s['shape_pt_sequence'])):
            pts.append({'lat': shape['shape_pt_lat'], 'lon': shape['shape_pt_lon']})
        
        segments.append({
            "trips": trips_n,
            "coordinates": pts,
            "route_type": route_type
        })
    
    return SegmentsDataset(segments, max_trips, min_trips)
```

### Our TypeScript Port

```typescript
export function computeGTFSSegments(
  shapes: GTFSShape[],
  routes: GTFSRoute[],
  trips: GTFSTrip[]
): SegmentDataset {
  // Build lookup maps
  const routeMap = new Map<string, GTFSRoute>()
  routes.forEach(route => routeMap.set(route.route_id, route))
  
  // Count trips per shape_id (frequency)
  const tripsPerShape = new Map<string, number>()
  trips.forEach(trip => {
    const count = tripsPerShape.get(trip.shape_id) || 0
    tripsPerShape.set(trip.shape_id, count + 1)
  })
  
  // Group and sort shapes
  const shapeGroups = new Map<string, GTFSShape[]>()
  shapes.forEach(shape => {
    if (!shapeGroups.has(shape.shape_id)) {
      shapeGroups.set(shape.shape_id, [])
    }
    shapeGroups.get(shape.shape_id)!.push(shape)
  })
  
  // Build segments
  const segments: RouteSegment[] = []
  let maxTrips = 0, minTrips = Infinity
  
  shapeGroups.forEach((shapePoints, shapeId) => {
    const tripCount = tripsPerShape.get(shapeId) || 0
    const sortedPoints = shapePoints.sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence)
    const coordinates = sortedPoints.map(pt => ({ lat: pt.shape_pt_lat, lon: pt.shape_pt_lon }))
    
    maxTrips = Math.max(maxTrips, tripCount)
    minTrips = Math.min(minTrips, tripCount)
    
    segments.push({ /* ... */ })
  })
  
  return { segments, max_trips: maxTrips, min_trips: minTrips }
}
```

## Visualization Algorithm

### Line Width Calculation (Cityliner's Formula)

```python
# Python (Cityliner)
factor = 1.7
stroke_weight = math.log(float(trips) * factor) * 3
if stroke_weight < 0:
    stroke_weight = 1.0 * factor
```

```typescript
// TypeScript (Our Port)
export function calculateLineWidth(tripCount: number, minTrips: number, maxTrips: number): number {
  const factor = 1.7
  let width = Math.log(tripCount * factor) * 3
  
  if (width < 0) {
    width = 1.0 * factor
  }
  
  return width
}
```

**Why logarithmic scaling?**
- Transit routes have highly variable frequencies (3 trips/hour vs 60 trips/hour)
- Linear scaling would make low-frequency routes invisible
- Logarithmic scaling compresses the range while maintaining visual hierarchy
- Formula: `width = log(trips × 1.7) × 3`

### Opacity Calculation

```python
# Python (Cityliner)
alph = 100 * (float(trips) / max_trips)
if alph < 20.0:
    alph = 20.0
```

```typescript
// TypeScript (Our Port)
export function calculateOpacity(tripCount: number, maxTrips: number): number {
  const alpha = 100 * (tripCount / maxTrips)
  return Math.max(alpha, 20.0) / 255.0 // Minimum 20% opacity
}
```

**Purpose:**
- Higher frequency routes are more opaque (clearer)
- Lower frequency routes are more transparent (fade into background)
- Minimum 20% ensures all routes remain visible

## Color Scheme

Cityliner's default color scheme (ported):

| Route Type | Color | Hex | Usage |
|------------|-------|-----|-------|
| Tram/Streetcar | Blue | `#1A75D1` | TTC Streetcars (501, 504, 505, etc.) |
| Subway/Metro | Green | `#4DAF4A` | TTC Lines 1, 2, 3, 4 |
| Rail | Gray | `#708A91` | GO Transit, UP Express |
| Bus | Red | `#E31B1C` | TTC Buses |
| Ferry | Orange | `#FF8000` | Toronto Island Ferry |
| Cable/Gondola | Pink | `#F761BF` | (Not used in Toronto) |

## GTFS Data Sources

### TTC Static GTFS Feed
- **URL:** http://opendata.toronto.ca/TTC/routes/OpenData_TTC_Schedules.zip
- **Files Required:**
  - `shapes.txt` - Route geometry (lat/lon coordinates)
  - `routes.txt` - Route metadata (names, types, colors)
  - `trips.txt` - Trip-to-route-to-shape mappings
- **Update Frequency:** Monthly (TTC publishes new schedules)

### Data Schema

**shapes.txt:**
```csv
shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
shape_line_1,43.7940,-79.5085,0
shape_line_1,43.7799,-79.5180,1
```

**routes.txt:**
```csv
route_id,route_short_name,route_long_name,route_type,route_color
route_1,1,Yonge-University,1,FDB913
route_501,501,Queen,0,DA291C
```

**trips.txt:**
```csv
trip_id,route_id,shape_id
trip_1_001,route_1,shape_line_1
trip_1_002,route_1,shape_line_1
```

## Usage

### Development (Mock Data)

```typescript
import { generateMockTTCData } from '../server/gtfs-fetcher'
import { computeGTFSSegments } from '../server/gtfs-processor'

const data = generateMockTTCData()
const dataset = computeGTFSSegments(data.shapes, data.routes, data.trips)
```

### Production (Real TTC Data)

```typescript
import { fetchAllTTCGTFS } from '../server/gtfs-fetcher'
import { computeGTFSSegments } from '../server/gtfs-processor'

const data = await fetchAllTTCGTFS()
const dataset = computeGTFSSegments(data.shapes, data.routes, data.trips)
```

## MapLibre Integration

```typescript
dataset.segments.forEach((segment, idx) => {
  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: segment.coordinates.map(coord => [coord.lon, coord.lat]),
    },
    properties: {
      route_name: segment.route_name,
      trip_count: segment.trip_count,
    },
  }
  
  const lineWidth = calculateLineWidth(segment.trip_count, minTrips, maxTrips)
  const opacity = calculateOpacity(segment.trip_count, maxTrips)
  
  map.addLayer({
    id: `route-${idx}`,
    type: 'line',
    source: { type: 'geojson', data: geojson },
    paint: {
      'line-color': segment.color,
      'line-width': lineWidth,
      'line-opacity': opacity,
    },
  })
})
```

## Features

### Interactive Elements
- **Hover:** Cursor changes to pointer on route hover
- **Click:** Popup shows route name, trip frequency, route type
- **Zoom/Pan:** Full MapLibre navigation controls
- **Stats Panel:** Live display of segment count, max/min frequency

### Performance Optimizations
- localStorage caching (24-hour TTL)
- Lazy loading of GTFS data
- Efficient segment computation (single pass)
- GeoJSON source reuse

## Future Enhancements

1. **Real-time Vehicle Positions**
   - Fetch GTFS-Realtime feed
   - Overlay moving vehicle markers
   - Animate position updates

2. **Time-based Filtering**
   - Show routes active at specific times
   - Rush hour vs off-peak visualization
   - Weekday vs weekend schedules

3. **Disruption Overlay**
   - Highlight routes with current disruptions
   - Color-code by severity
   - Click for disruption details

4. **Multi-city Support**
   - Generic GTFS processor
   - City configuration system
   - Auto-detect city from coordinates

## Credits

- **Original Algorithm:** [Cityliner](https://github.com/dragoon/cityliner) by Roman Prokofyev
- **TTC Data:** [City of Toronto Open Data](https://open.toronto.ca/)
- **Mapping:** [MapLibre GL JS](https://maplibre.org/)
- **License:** Algorithm port maintains GPL-3.0 compatibility

## References

- Cityliner Source: https://github.com/dragoon/cityliner
- GTFS Specification: https://gtfs.org/
- TTC Open Data: https://open.toronto.ca/dataset/ttc-routes-and-schedules/
- MapLibre Docs: https://maplibre.org/maplibre-gl-js/docs/
