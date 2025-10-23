# Cityliner-Inspired Toronto Transit Visualization

This document describes the integration of **cityliner-style** transit network visualization into Toronto Downtime, following the architecture of [dragoon/cityliner](https://github.com/dragoon/cityliner).

## Overview

### What is Cityliner?

Cityliner visualizes public transport routes from GTFS data with:
- **Line thickness** representing route frequency (trips per day)
- **Opacity** indicating service intensity
- **Color coding** by transit mode (subway, bus, streetcar, etc.)
- **Multiple color schemes** for aesthetic variety
- **Geographic rendering** with Mercator projection

### Toronto Downtime Integration

We've adapted cityliner's principles to create an **interactive 3D visualization** that:
1. Fetches real transit data from TTC GTFS-Realtime API
2. Parses CSV/JSON from Toronto Open Data
3. Renders routes on a 3D Mercator map with frequency-based styling
4. Updates dynamically with live data

## Architecture

### Data Flow

```
TTC GTFS-RT API
      ↓
[GTFS-RT Protobuf Parser]
      ↓
Route Frequency Calculation
      ↓
Toronto Open Data
(Road Restrictions)
      ↓
[CSV/JSON Parser]
      ↓
Geocoding + Disruption Classification
      ↓
[Route Visualizer]
      ↓
Three.js 3D Rendering
      ↓
Mercator Projection
      ↓
Dashboard Canvas
```

## Modules

### 1. `src/server/data-parsers.ts` (350+ lines)

**Handles parsing of Toronto Open Data**

#### CSV Parsing from CKAN API

```typescript
// Fetch resource from CKAN API
fetchCkanResource(packageId, resourceName): Promise<string>

// Parse CSV into objects
parseCSV(csvContent): Record<string, string>[]
```

#### Road Restrictions Parser

```typescript
parseRoadRestrictions(): Promise<RoadRestriction[]>
```

Extracts:
- Location and description
- Severity classification (low/moderate/severe)
- Type categorization (closure/lane_reduction/construction/event)
- Geographic coordinates
- Duration (start/end dates)

#### Transit Alerts Parser

```typescript
parseTransitAlerts(): Promise<TransitAlert[]>
```

Extracts:
- Alert title and description
- Affected TTC lines
- Severity levels
- Alert types

#### Route Frequency Parser (Stub)

```typescript
parseGTFSRouteFrequency(): Promise<RouteFrequency[]>
```

**TODO**: Implement actual GTFS parsing (see GTFS section)

#### Geospatial Helpers

```typescript
// Calculate distance between two coordinates
getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2): number

// Check if point is within Toronto bounds
isInTorontoBounds(lat, lon, marginKm): boolean

// Project lat/lon to Mercator plane
mercatorProject(lat, lon, centerLat, centerLon, scaleFactorLat, scaleFactorLon)
```

### 2. `src/server/gtfs-protobuf-parser.ts` (500+ lines)

**Parses GTFS-Realtime Protocol Buffers**

#### GTFS-RT API Integration

```typescript
parseGTFSRealtimeProtobuf(): Promise<{
  alerts: AlertEntity[];
  tripUpdates: TripUpdate[];
  timestamp: number;
}>
```

Fetches from: `https://api.ttc.ca/gtfs-realtime/alerts`

#### Protobuf Decoding

```typescript
// Decode varint encoding
decodeVarint(buffer, offset): [number, number]

// Decode protobuf field key
decodeKey(key): [fieldNumber, wireType]

// Parse GTFS-RT message types
parseGTFSRealtimeBuffer(buffer): GTFSRealtimeFeed
parseProtobufHeader(buffer)
parseProtobufEntity(buffer)
parseProtobufTripUpdate(buffer)
parseProtobufAlert(buffer)
```

#### Route Frequency Analysis

```typescript
// Count trips per route
calculateFrequencyFromTrips(tripUpdates): Map<routeId, count>

// Extract segments with metadata
extractRouteSegments(tripUpdates, routeMetadata)
```

**Wire Types**:
- `0`: Varint (unsigned int)
- `2`: Length-delimited (strings, nested messages)
- Others: 64-bit, 32-bit, group boundaries

### 3. `src/server/route-visualizer.ts` (400+ lines)

**Three.js-based route visualization (cityliner-inspired)**

#### Color Schemes

5 color palettes matching cityliner:

```typescript
ColorSchemes = {
  default: { bus, subway, streetcar, rail, ferry },
  pastel: { ... lighter colors ... },
  inferno: { ... bright/dark high-contrast ... },
  earthy: { ... brown/green tones ... },
  cool: { ... blue/purple tones ... }
}
```

#### Mercator Projection

```typescript
class MercatorProjection {
  project(lat, lon): { x, y }
  getDistanceFromLatLon(lat1, lon1, lat2, lon2): km
}
```

Converts geographic coordinates to canvas pixels.

#### Route Visualization

```typescript
class RouteVisualizer {
  visualizeRouteSegment(segment)
  visualizeRoutes(segments)
  updateColorScheme(schemeName)
  clear()
}
```

**Features**:

1. **Frequency-Based Thickness**
   ```
   lineWidth = log(frequency * factor) * 3
   ```

2. **Frequency-Based Opacity**
   ```
   opacity = 0.3 + (freqRatio * 0.7)
   ```

3. **Tube Geometry**
   - Uses THREE.TubeGeometry for 3D routes
   - Smooth curves with custom BufferCurve
   - Phong material for lighting

4. **Sorting by Frequency**
   - Low frequency routes rendered first
   - High frequency routes on top
   - Prevents occlusion issues

#### Helper Functions

```typescript
groupByTransitType(segments): Map<type, segments>
sortByFrequency(segments): sorted segments
filterByBounds(segments, centerLat, centerLon, maxDistKm): filtered
```

### 4. `src/hooks/useRouteVisualization.ts` (230+ lines)

**React hooks for integration**

#### Main Hook

```typescript
useRouteVisualization({
  scene,           // THREE.Scene
  enabled,         // boolean
  colorScheme      // 'default' | 'pastel' | 'inferno' | 'earthy' | 'cool'
})

Returns: {
  loading,         // boolean
  error,           // string | null
  routeCount,      // number
  segmentCount,    // number
  averageFrequency, // number
  visualizer       // RouteVisualizer instance
}
```

#### Data Parsing Hook

```typescript
useTorontoDataParsers()

Returns: {
  loading,
  error,
  data: { restrictions, alerts, routes, timestamp },
  fetchAndParseData()
}
```

#### Config Management Hook

```typescript
useVisualizationConfig()

Returns: {
  config,
  updateColorScheme(scheme),
  updateMaxDist(km),
  availableSchemes: ['default', 'pastel', 'inferno', 'earthy', 'cool']
}
```

## Usage Example

### Basic Integration

```typescript
import { useRouteVisualization } from './hooks/useRouteVisualization';

function Dashboard({ scene }) {
  const {
    loading,
    routeCount,
    segmentCount,
    averageFrequency,
    error
  } = useRouteVisualization({
    scene,
    enabled: true,
    colorScheme: 'default'
  });

  if (loading) return <div>Loading routes...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Transit Routes</h3>
      <p>Routes: {routeCount}</p>
      <p>Segments: {segmentCount}</p>
      <p>Avg Frequency: {averageFrequency} trips/day</p>
    </div>
  );
}
```

### With Color Scheme Selection

```typescript
import { useVisualizationConfig } from './hooks/useRouteVisualization';

function VisualizationControls() {
  const { config, updateColorScheme, availableSchemes } = useVisualizationConfig();

  return (
    <select onChange={(e) => updateColorScheme(e.target.value)}>
      {availableSchemes.map(scheme => (
        <option key={scheme} value={scheme}>{scheme}</option>
      ))}
    </select>
  );
}
```

## Data Sources

### TTC GTFS-Realtime
- **Endpoint**: `https://api.ttc.ca/gtfs-realtime/alerts`
- **Format**: Protocol Buffer (GTFS-RT spec)
- **Content**: Real-time alerts, trip updates, vehicle positions
- **Update Frequency**: Live (continuous)

### Toronto Open Data - Road Restrictions
- **Package**: `road-restrictions`
- **Format**: CSV via CKAN API
- **Content**: Active road closures, lane reductions, construction
- **URL**: https://ckan0.cf.opendata.inter.prod-toronto.ca

### Toronto Open Data - Transit Alerts
- **Package**: `9ab4c9af-652f-4a84-abac-afcf40aae882`
- **Format**: CSV via CKAN API
- **Content**: Service advisories, schedule changes
- **Attribution**: [Open Data Toronto](https://opendata.toronto.ca)

## Technical Details

### Protobuf Parsing Strategy

The GTFS-RT parser implements **minimal protobuf decoding**:

1. **Varint Decoding**: Interprets variable-length integers
2. **Field Key Parsing**: Extracts field number and wire type
3. **Selective Parsing**: Only extracts needed fields
   - Trip IDs and route IDs (for frequency counting)
   - Alert header/description text
   - Timestamps

**Wire Types Supported**:
- `0`: Varint (integers, booleans)
- `2`: Delimited (strings, nested messages)
- `1` & `5`: Fixed-size (64-bit, 32-bit)

### Mercator Projection

Converts lat/lon to 2D canvas coordinates:

```
x = (lon - centerLon) * scaleFactorLon
y = (lat - centerLat) * scaleFactorLat

Scale factors calculated from:
- Canvas dimensions
- Max distance from center (km)
- Earth radius (6371 km)
```

Uses Haversine formula for distance calculations:

```
d = 2R * arcsin(√(sin²(Δlat/2) + cos(lat1)cos(lat2)sin²(Δlon/2)))
```

### Frequency Visualization (Cityliner-Inspired)

**Line Thickness**:
```
strokeWeight = log(frequency * factor) * 3
```

**Opacity**:
```
opacity = 0.3 + (frequency / maxFrequency) * 0.7
```

**Rendering Order**:
- Sort segments by frequency (ascending)
- Render low-frequency routes first
- High-frequency routes rendered last (on top)

### Three.js Implementation

**Geometry**: TubeGeometry with custom curve
- Smooth interpolation between points
- 8 segments per curve, 8 radial segments
- Proper normal vectors for lighting

**Material**: MeshPhongMaterial
- Color from scheme
- Transparency support
- Emissive glow for emphasis
- Shininess for depth

**Group Management**:
- All routes in a single THREE.Group
- Easy clearing and updating
- Single scene.add() call

## TODO: Future Enhancements

1. **Static Route Data (shapes.txt)**
   - Parse TTC GTFS static shapes
   - Extract route geometry instead of mock data
   - Combine with frequency for complete visualization

2. **Road Restriction Visualization**
   - Render restrictions as segments
   - Color by severity or type
   - Opacity by recency
   - Overlay on route network

3. **Interactive Controls**
   - Filter by transit type
   - Adjust time of day (rush hour, night)
   - Toggle specific routes
   - Frequency threshold slider

4. **Export/Rendering Pipeline**
   - Static high-res render (like cityliner PDF)
   - Poster generation
   - Share-ready images
   - Print-optimized layouts

5. **Performance Optimization**
   - LOD (Level of Detail) for routes
   - Instanced rendering for similar routes
   - Frustum culling
   - Dynamic chunk size management

6. **Historical Analysis**
   - Archive frequency data over time
   - Show trends (rush hour vs. off-peak)
   - Seasonal variations
   - Service changes tracking

## References

- **Cityliner**: https://github.com/dragoon/cityliner
- **GTFS Specification**: https://gtfs.org
- **GTFS-Realtime**: https://developers.google.com/transit/gtfs-realtime
- **CKAN API**: https://ckan.readthedocs.io/en/latest/api/
- **Three.js Documentation**: https://threejs.org/docs/
- **Toronto Open Data**: https://www.toronto.ca/home/311-toronto/toronto-311-service-requests/toronto-open-data/
- **TTC GTFS Data**: https://www.ttc.ca/Developers

## Attribution

- Built on: **cityliner** (Roman Prokofyev, GNU GPLv3)
- Data from: **Open Data Toronto**
- Real-time data: **TTC GTFS-Realtime API**
- Visualization: **Three.js**
