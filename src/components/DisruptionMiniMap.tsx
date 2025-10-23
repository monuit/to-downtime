import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getDisruptionCoordinates } from '../utils/disruption-mapper'
import type { Disruption } from '../store/disruptions'
import './DisruptionMiniMap.css'

interface DisruptionMiniMapProps {
  disruption: Disruption
}

export const DisruptionMiniMap: React.FC<DisruptionMiniMapProps> = ({ disruption }) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const initMap = async () => {
      const coordinates = await getDisruptionCoordinates(disruption)
      if (!coordinates) return

      // Initialize map centered on disruption
      map.current = new maplibregl.Map({
        container: mapContainer.current!,
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
        center: [coordinates.lon, coordinates.lat],
        zoom: 13,
        interactive: false, // Disable pan/zoom to prevent stealing clicks
        attributionControl: false,
      })

      // Add marker with severity color
      const severityColors: Record<string, string> = {
        severe: '#ff4444',
        moderate: '#ffaa00',
        minor: '#44ff44',
      }

      const color = severityColors[disruption.severity] || '#ffaa00'

      // Create custom marker
      const el = document.createElement('div')
      el.className = 'mini-map-marker'
      el.style.backgroundColor = color
      el.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}80`

      // Add line number if available
      if (disruption.affectedLines && disruption.affectedLines.length > 0) {
        const label = document.createElement('div')
        label.className = 'marker-label'
        label.textContent = disruption.affectedLines[0]
        label.style.backgroundColor = color
        el.appendChild(label)
      }

      new maplibregl.Marker({ element: el })
        .setLngLat([coordinates.lon, coordinates.lat])
        .addTo(map.current)
    }

    initMap()

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [disruption])

  return (
    <div className="mini-map-wrapper">
      <div ref={mapContainer} className="mini-map-container" />
    </div>
  )
}
