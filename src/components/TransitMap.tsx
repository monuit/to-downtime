/**
 * TransitMap Component
 * Cityliner-inspired TTC route visualization using MapLibre GL JS
 * 
 * Features:
 * - Route lines with thickness based on trip frequency (Cityliner algorithm)
 * - Color coding by route type (subway, streetcar, bus, etc.)
 * - Opacity variation based on service frequency
 * - Interactive map controls (zoom, pan)
 * - Toronto-centered view
 */

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { generateMockTTCData } from '../server/gtfs-fetcher'
import { computeGTFSSegments, calculateLineWidth, calculateOpacity } from '../server/gtfs-processor'
import type { RouteSegment } from '../server/gtfs-processor'
import './TransitMap.css'

// Toronto coordinates
const TORONTO_CENTER: [number, number] = [-79.3832, 43.6532] // [lng, lat]
const TORONTO_ZOOM = 11

interface TransitMapProps {
  className?: string
}

export function TransitMap({ className = '' }: TransitMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [segmentStats, setSegmentStats] = useState<{
    total: number
    maxTrips: number
    minTrips: number
  } | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: TORONTO_CENTER,
      zoom: TORONTO_ZOOM,
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    // Load and display TTC route data
    map.current.on('load', async () => {
      if (!map.current) return

      console.log('🗺️ Map loaded, fetching TTC GTFS data...')
      
      try {
        // For now, use mock data
        // In production, replace with: const data = await fetchAllTTCGTFS()
        const data = generateMockTTCData()
        
        // Compute segments using Cityliner algorithm
        const dataset = computeGTFSSegments(data.shapes, data.routes, data.trips)
        
        console.log(`✅ Computed ${dataset.segments.length} route segments`)
        console.log(`   Max trips: ${dataset.max_trips}, Min trips: ${dataset.min_trips}`)
        console.log(`   Route types:`, dataset.route_type_counts)
        
        setSegmentStats({
          total: dataset.segments.length,
          maxTrips: dataset.max_trips,
          minTrips: dataset.min_trips,
        })
        
        // Add each segment as a layer
        dataset.segments.forEach((segment, idx) => {
          addRouteSegment(map.current!, segment, idx, dataset.max_trips, dataset.min_trips)
        })
        
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to load GTFS data:', error)
        setIsLoading(false)
      }
    })

    // Cleanup
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  return (
    <div className={`transit-map-container ${className}`}>
      <div ref={mapContainer} className="transit-map" />
      
      {isLoading && (
        <div className="transit-map-loading">
          <div className="loading-spinner"></div>
          <p>Loading TTC route data...</p>
        </div>
      )}
      
      {segmentStats && (
        <div className="transit-map-stats">
          <h3>📊 Route Visualization</h3>
          <div className="stat-item">
            <span className="stat-label">Total Segments:</span>
            <span className="stat-value">{segmentStats.total}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Max Frequency:</span>
            <span className="stat-value">{segmentStats.maxTrips} trips</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Min Frequency:</span>
            <span className="stat-value">{segmentStats.minTrips} trips</span>
          </div>
          <div className="legend">
            <h4>Line Thickness = Trip Frequency</h4>
            <p>Thicker, more opaque lines indicate higher service frequency</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Add a route segment to the map with Cityliner-style visualization
 */
function addRouteSegment(
  map: maplibregl.Map,
  segment: RouteSegment,
  index: number,
  maxTrips: number,
  minTrips: number
) {
  const sourceId = `route-${segment.shape_id}-${index}`
  const layerId = `route-layer-${segment.shape_id}-${index}`
  
  // Convert coordinates to GeoJSON LineString
  const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: segment.coordinates.map(coord => [coord.lon, coord.lat]),
    },
    properties: {
      route_name: segment.route_name,
      trip_count: segment.trip_count,
      route_type: segment.route_type,
    },
  }
  
  // Calculate line width and opacity using Cityliner algorithm
  const lineWidth = calculateLineWidth(segment.trip_count, minTrips, maxTrips)
  const opacity = calculateOpacity(segment.trip_count, maxTrips)
  
  // Add source
  map.addSource(sourceId, {
    type: 'geojson',
    data: geojson,
  })
  
  // Add layer with styling
  map.addLayer({
    id: layerId,
    type: 'line',
    source: sourceId,
    paint: {
      'line-color': segment.color,
      'line-width': Math.max(lineWidth, 2), // Minimum 2px for visibility
      'line-opacity': Math.min(opacity, 0.9), // Max 90% opacity for layering
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  })
  
  // Add hover interaction
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = ''
  })
  
  // Add click popup
  map.on('click', layerId, (e) => {
    if (!e.features || e.features.length === 0) return
    
    const feature = e.features[0]
    const props = feature.properties
    
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold;">
            Route ${props?.route_name || 'Unknown'}
          </h3>
          <p style="margin: 4px 0; font-size: 12px;">
            <strong>Trip Frequency:</strong> ${props?.trip_count || 0} trips
          </p>
          <p style="margin: 4px 0; font-size: 12px;">
            <strong>Type:</strong> ${getRouteTypeName(props?.route_type || 0)}
          </p>
        </div>
      `)
      .addTo(map)
  })
}

/**
 * Get human-readable route type name
 */
function getRouteTypeName(routeType: number): string {
  const types: Record<number, string> = {
    0: 'Streetcar/Tram',
    1: 'Subway/Metro',
    2: 'Rail',
    3: 'Bus',
    4: 'Ferry',
    5: 'Cable Car',
    6: 'Gondola',
    7: 'Funicular',
    11: 'Trolleybus',
    12: 'Monorail',
  }
  return types[routeType] || `Type ${routeType}`
}
