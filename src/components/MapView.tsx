import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import type { Disruption } from '../store/disruptions';
import { getDisruptionsWithCoordinates } from '../utils/disruption-mapper';
import './MapView.css';

// Fix Leaflet default icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  disruptions: Disruption[];
  selectedDistrict?: string;
  onDistrictSelect: (district: string | undefined) => void;
  onDisruptionSelect: (disruption: Disruption) => void;
}

// Toronto district coordinates
const DISTRICT_CENTERS: Record<string, [number, number]> = {
  'Toronto': [43.6532, -79.3832],
  'North York': [43.7615, -79.4111],
  'Scarborough': [43.7731, -79.2578],
  'Etobicoke': [43.6205, -79.5132],
  'East York': [43.6890, -79.3383],
  'York': [43.6890, -79.4872],
};

const SEVERITY_COLORS = {
  severe: '#ef4444',
  moderate: '#f59e0b',
  minor: '#10b981',
};

export function MapView({ disruptions, selectedDistrict, onDistrictSelect, onDisruptionSelect }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const districtMarkersRef = useRef<L.Layer[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Memoize filtered disruptions to prevent unnecessary recalculations
  const filteredDisruptions = useMemo(() => {
    return selectedDistrict 
      ? disruptions.filter(d => d.district === selectedDistrict)
      : disruptions;
  }, [disruptions, selectedDistrict]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on Toronto with appropriate zoom
    const map = L.map(mapContainerRef.current).setView([43.6532, -79.3832], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers based on district selection
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Clear existing markers
    if (markersRef.current) {
      map.removeLayer(markersRef.current);
      markersRef.current = null;
    }
    districtMarkersRef.current.forEach(marker => map.removeLayer(marker));
    districtMarkersRef.current = [];

    // Geocode disruptions that don't have coordinates
    const updateMarkers = async () => {
      console.log(`📍 Processing ${filteredDisruptions.length} disruptions for markers...`);
      
      // Get disruptions with coordinates (geocodes if needed)
      const disruptionsWithCoords = await getDisruptionsWithCoordinates(filteredDisruptions);
      
      console.log(`✅ ${disruptionsWithCoords.length} disruptions have coordinates`);
      
      const markers = L.markerClusterGroup({
        maxClusterRadius: 80, // Increased radius for better clustering
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: true,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16, // Show individual markers when zoomed in
        animate: true,
        animateAddingMarkers: true,
        spiderfyDistanceMultiplier: 1.5,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          const children = cluster.getAllChildMarkers();
          
          // Count severity distribution in cluster
          const severityCounts = {
            severe: 0,
            moderate: 0,
            minor: 0
          };
          
          children.forEach((marker: any) => {
            const severity = marker.options.severity;
            if (severity && severityCounts[severity as keyof typeof severityCounts] !== undefined) {
              severityCounts[severity as keyof typeof severityCounts]++;
            }
          });
          
          // Determine dominant severity for cluster color
          let dominantSeverity = 'moderate';
          let maxCount = 0;
          Object.entries(severityCounts).forEach(([severity, sCount]) => {
            if (sCount > maxCount) {
              maxCount = sCount;
              dominantSeverity = severity;
            }
          });
          
          const severityColors = {
            severe: '#ef4444',
            moderate: '#f59e0b',
            minor: '#10b981',
          };
          
          // Size based on count
          let size = 40;
          let fontSize = 14;
          if (count >= 50) {
            size = 60;
            fontSize = 18;
          } else if (count >= 20) {
            size = 50;
            fontSize = 16;
          }
          
          return L.divIcon({
            html: `
              <div class="cluster-marker ${dominantSeverity}" style="width: ${size}px; height: ${size}px; font-size: ${fontSize}px;">
                <span>${count}</span>
                <div class="cluster-pulse ${dominantSeverity}"></div>
              </div>
            `,
            className: 'custom-cluster-marker',
            iconSize: L.point(size, size),
          });
        },
      });

      disruptionsWithCoords.forEach(disruption => {
        const { coordinates } = disruption;
        const color = SEVERITY_COLORS[disruption.severity];
        
        const icon = L.divIcon({
          html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
          className: 'custom-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([coordinates.lat, coordinates.lon], { 
          icon,
          severity: disruption.severity // Pass severity for cluster coloring
        } as any);
        
        const popupContent = document.createElement('div');
        popupContent.className = 'disruption-popup';
        popupContent.innerHTML = `
          <h4 class="disruption-title">${disruption.title}</h4>
          <div class="disruption-meta">
            <span class="severity-badge ${disruption.severity}">${disruption.severity}</span>
            ${disruption.workType ? `<span class="work-type">${disruption.workType}</span>` : ''}
          </div>
          ${disruption.addressFull ? `
            <div class="disruption-address">
              <svg width="14" height="14" style="display: inline-block; vertical-align: text-top; margin-right: 4px;">
                <path d="M7 0C3.13 0 0 3.13 0 7c0 5.25 7 7 7 7s7-1.75 7-7c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#888"/>
              </svg>
              <span style="color: #888; font-size: 12px;">${disruption.addressFull}</span>
            </div>
          ` : ''}
          ${coordinates.stationName ? `
            <div class="disruption-address">
              <span style="color: #666; font-size: 12px;">📍 ${coordinates.stationName}</span>
            </div>
          ` : ''}
          <p class="disruption-desc">${disruption.description.substring(0, 100)}...</p>
        `;

        const button = document.createElement('button');
        button.className = 'view-full-btn';
        button.textContent = 'View Full Details';
        button.onclick = () => {
          onDisruptionSelect(disruption);
          map.closePopup();
        };
        popupContent.appendChild(button);

        marker.bindPopup(popupContent);
        markers.addLayer(marker);
      });

      map.addLayer(markers);
      markersRef.current = markers;

      // Zoom based on selection
      if (selectedDistrict) {
        const districtCoords = DISTRICT_CENTERS[selectedDistrict];
        if (districtCoords) {
          map.setView(districtCoords, 13);
        }
      } else {
        // Show all of Toronto
        map.setView([43.6532, -79.3832], 11);
      }
    };
    
    updateMarkers();
  }, [filteredDisruptions, selectedDistrict, onDistrictSelect, onDisruptionSelect]);

  return (
    <div className="map-view-container">
      {selectedDistrict && (
        <div className="district-header">
          <button className="back-btn" onClick={() => onDistrictSelect(undefined)}>
            ← Back to All Districts
          </button>
          <h2>{selectedDistrict}</h2>
        </div>
      )}
      <div ref={mapContainerRef} className="map-container" />
    </div>
  );
}
