import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useDisruptionStore } from '../store/disruptions'
import { getDisruptionCoordinates } from '../utils/disruption-mapper'
import './DisruptionMapView.css'

export const DisruptionMapView: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const marker = useRef<maplibregl.Marker | null>(null)
  
  const selectedDisruption = useDisruptionStore((state) => state.selectedDisruption)

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [-79.3832, 43.6532], // Downtown Toronto
      zoom: 12,
      attributionControl: false,
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update marker when selected disruption changes
  useEffect(() => {
    if (!map.current) return

    // Remove old marker
    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }

    if (!selectedDisruption) {
      // No selection - show default view
      map.current.flyTo({
        center: [-79.3832, 43.6532],
        zoom: 12,
        duration: 1000,
      })
      return
    }

    // Get coordinates asynchronously
    const loadCoordinates = async () => {
      const coordinates = await getDisruptionCoordinates(selectedDisruption)
      if (!coordinates || !map.current) return

      // Severity colors
      const severityColors: Record<string, string> = {
        severe: '#ff4444',
        moderate: '#ffaa00',
        minor: '#44ff44',
      }

      const color = severityColors[selectedDisruption.severity] || '#ffaa00'

      // Create custom marker element
      const el = document.createElement('div')
      el.className = 'map-view-marker'
      el.innerHTML = `
        <div class="marker-pulse" style="background: radial-gradient(circle, ${color}66 0%, ${color}33 50%, transparent 70%);"></div>
        <div class="marker-pin" style="background: ${color}; box-shadow: 0 0 20px ${color}, 0 0 40px ${color}80;">
          ${selectedDisruption.affectedLines?.[0] || ''}
        </div>
      `

      // Create popup
      const typeEmojis: Record<string, string> = {
        subway: '🚇',
        streetcar: '🚊',
        bus: '🚌',
        road: '🛣️',
        elevator: '🛗',
        escalator: '⬆️',
      }

      const emoji = typeEmojis[selectedDisruption.type] || '⚠️'
      
      // Add geocoding source indicator
      const sourceLabels: Record<string, string> = {
        line: 'Transit Line',
        static: 'Known Location',
        geocoded: 'Geocoded',
        fallback: 'Approximate',
      }
      const sourceLabel = sourceLabels[coordinates.source] || ''

      const popup = new maplibregl.Popup({ offset: 25 })
        .setHTML(`
          <div class="map-popup">
            <div class="popup-header">
              <span class="popup-emoji">${emoji}</span>
              <span class="popup-severity" style="background: ${color};">
                ${selectedDisruption.severity.toUpperCase()}
              </span>
            </div>
            <div class="popup-description">${selectedDisruption.description}</div>
            ${selectedDisruption.affectedLines?.length ? `
              <div class="popup-lines">Lines: ${selectedDisruption.affectedLines.join(', ')}</div>
            ` : ''}
            ${coordinates.stationName ? `
              <div class="popup-station">📍 ${coordinates.stationName}</div>
            ` : ''}
            <div class="popup-source" style="font-size: 0.7rem; color: #999; margin-top: 0.5rem;">
              ${sourceLabel}
            </div>
          </div>
        `)

      // Add marker and fly to location
      marker.current = new maplibregl.Marker({ element: el })
        .setLngLat([coordinates.lon, coordinates.lat])
        .setPopup(popup)
        .addTo(map.current)

      map.current.flyTo({
        center: [coordinates.lon, coordinates.lat],
        zoom: 14,
        duration: 1000,
      })

      // Auto-open popup
      marker.current.togglePopup()
    }

    loadCoordinates()

  }, [selectedDisruption])

  return (
    <div className="map-view-container">
      <div className="map-view-header">
        <h3>📍 Location View</h3>
        {!selectedDisruption && (
          <p className="map-hint">Click any disruption to see its location</p>
        )}
        {selectedDisruption && (
          <p className="map-hint">Showing: {selectedDisruption.description.substring(0, 50)}...</p>
        )}
      </div>
      <div ref={mapContainer} className="map-view-map" />
    </div>
  )
}
