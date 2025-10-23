import https from 'https';

/**
 * Toronto Open Data Parser
 * Handles CSV and JSON parsing from CKAN API responses
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RoadRestriction {
  id: string;
  location: string;
  description: string;
  lat: number;
  lon: number;
  startDate?: string;
  endDate?: string;
  severity: 'low' | 'moderate' | 'severe';
  type: 'closure' | 'lane_reduction' | 'construction' | 'event';
}

export interface TransitAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'moderate' | 'severe';
  type: string;
  affectedLines?: string[];
  coordinates?: { lat: number; lon: number }[];
}

export interface RouteFrequency {
  routeId: string;
  routeName: string;
  routeType: 'bus' | 'subway' | 'streetcar' | 'rail';
  frequency: number; // trips per day
  geometry: { lat: number; lon: number }[];
  color: string;
}

// ============================================================================
// CKAN API HELPERS
// ============================================================================

/**
 * Fetch resource data from CKAN API (CSV, JSON, or raw download)
 */
async function fetchCkanResource(
  packageId: string,
  resourceName: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/package_show?id=${packageId}`;

    https
      .get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);

            if (!response.success) {
              reject(new Error(`CKAN API error: ${response.error}`));
              return;
            }

            // Find resource matching the name
            const resource = response.result.resources.find(
              (r: any) =>
                r.name.toLowerCase().includes(resourceName.toLowerCase()) ||
                r.url.toLowerCase().includes(resourceName.toLowerCase())
            );

            if (!resource) {
              reject(new Error(`Resource "${resourceName}" not found in package ${packageId}`));
              return;
            }

            // Download resource content
            https
              .get(resource.url, (resContent) => {
                let content = '';
                resContent.on('data', (chunk) => (content += chunk));
                resContent.on('end', () => resolve(content));
                resContent.on('error', reject);
              })
              .on('error', reject);
          } catch (err) {
            reject(err);
          }
        });
        res.on('error', reject);
      })
      .on('error', reject)
      .setTimeout(10000); // 10 second timeout
  });
}

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parse CSV string into objects
 */
function parseCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const obj: Record<string, string> = {};

    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });

    return obj;
  });
}

// ============================================================================
// ROAD RESTRICTIONS PARSER
// ============================================================================

/**
 * Parse Toronto Open Data road restrictions
 * Extracts location, description, duration, and severity
 */
export async function parseRoadRestrictions(): Promise<RoadRestriction[]> {
  try {
    // Road Restrictions package
    const packageId = 'road-restrictions';
    const content = await fetchCkanResource(packageId, 'restrictions');

    const records = parseCSV(content);
    const restrictions: RoadRestriction[] = [];

    records.forEach((record, index) => {
      if (!record.location) return; // Skip empty rows

      // Parse severity from description keywords
      let severity: 'low' | 'moderate' | 'severe' = 'moderate';
      const desc = record.description?.toLowerCase() || '';

      if (desc.includes('closure') || desc.includes('closed')) severity = 'severe';
      else if (desc.includes('lane') || desc.includes('reduction')) severity = 'moderate';
      else severity = 'low';

      // Determine restriction type
      let type: 'closure' | 'lane_reduction' | 'construction' | 'event' = 'construction';
      if (desc.includes('closure')) type = 'closure';
      else if (desc.includes('lane')) type = 'lane_reduction';
      else if (desc.includes('event')) type = 'event';

      // Extract coordinates if available (look for lat/lon fields or in description)
      let lat = 43.6629; // Toronto center fallback
      let lon = -79.3957;

      if (record.latitude && record.longitude) {
        lat = parseFloat(record.latitude);
        lon = parseFloat(record.longitude);
      } else if (record.lat && record.lon) {
        lat = parseFloat(record.lat);
        lon = parseFloat(record.lon);
      }

      restrictions.push({
        id: `restriction-${index}`,
        location: record.location,
        description: record.description || '',
        lat,
        lon,
        startDate: record.start_date || record.start || undefined,
        endDate: record.end_date || record.end || undefined,
        severity,
        type,
      });
    });

    console.log(`📍 Parsed ${restrictions.length} road restrictions from Toronto Open Data`);
    return restrictions;
  } catch (err) {
    console.error('❌ Error parsing road restrictions:', err);
    return [];
  }
}

// ============================================================================
// TRANSIT ALERTS PARSER
// ============================================================================

/**
 * Parse Toronto Open Data transit alerts
 * Extracts line information, descriptions, and coordinates
 */
export async function parseTransitAlerts(): Promise<TransitAlert[]> {
  try {
    // Transit Alerts package
    const packageId = '9ab4c9af-652f-4a84-abac-afcf40aae882';
    const content = await fetchCkanResource(packageId, 'alerts');

    const records = parseCSV(content);
    const alerts: TransitAlert[] = [];

    records.forEach((record, index) => {
      if (!record.title && !record.description) return; // Skip empty rows

      // Determine severity
      let severity: 'low' | 'moderate' | 'severe' = 'moderate';
      const desc = (record.description || record.title || '').toLowerCase();

      if (
        desc.includes('delay') ||
        desc.includes('detour') ||
        desc.includes('diversion')
      ) {
        severity = 'moderate';
      } else if (desc.includes('suspended') || desc.includes('closed')) {
        severity = 'severe';
      } else if (desc.includes('notice') || desc.includes('reminder')) {
        severity = 'low';
      }

      // Extract affected lines (comma-separated)
      const affectedLines = record.affected_lines
        ? record.affected_lines
            .split(',')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        : [];

      alerts.push({
        id: `alert-${index}`,
        title: record.title || 'Transit Alert',
        description: record.description || '',
        severity,
        type: record.type || 'service_advisory',
        affectedLines,
        coordinates: undefined, // Could be enhanced with location data
      });
    });

    console.log(`🚌 Parsed ${alerts.length} transit alerts from Toronto Open Data`);
    return alerts;
  } catch (err) {
    console.error('❌ Error parsing transit alerts:', err);
    return [];
  }
}

// ============================================================================
// GTFS-RT ROUTE FREQUENCY PARSER (STUB)
// ============================================================================

/**
 * Parse TTC GTFS Realtime for route frequency
 * This is a stub that would parse actual GTFS-RT protobuf data
 * and extract route frequency information for visualization
 */
export async function parseGTFSRouteFrequency(): Promise<RouteFrequency[]> {
  try {
    // TODO: Implement actual GTFS-RT protobuf parsing
    // For now, return mock data for visualization
    // Real implementation would:
    // 1. Fetch from https://api.ttc.ca/gtfs-realtime/alerts
    // 2. Parse protobuf message format
    // 3. Extract shapes.txt equivalents
    // 4. Count trip frequency per route segment
    // 5. Build geometry arrays for rendering

    console.log('📊 GTFS-RT frequency parsing: TODO - protobuf decoding required');

    return [
      {
        routeId: 'Line1',
        routeName: 'Bloor-Danforth (Line 1)',
        routeType: 'subway',
        frequency: 45, // trips per day (example)
        geometry: [
          // Simplified route geometry (west to east)
          { lat: 43.666, lon: -79.46 },
          { lat: 43.666, lon: -79.41 },
          { lat: 43.666, lon: -79.36 },
          { lat: 43.665, lon: -79.31 },
        ],
        color: '#FFA500', // Subway default
      },
      {
        routeId: 'Line2',
        routeName: 'Yonge-University (Line 2)',
        routeType: 'subway',
        frequency: 42,
        geometry: [
          { lat: 43.76, lon: -79.417 },
          { lat: 43.74, lon: -79.417 },
          { lat: 43.72, lon: -79.417 },
          { lat: 43.64, lon: -79.417 },
        ],
        color: '#FFA500',
      },
    ];
  } catch (err) {
    console.error('❌ Error parsing GTFS route frequency:', err);
    return [];
  }
}

// ============================================================================
// COMBINED DATA FETCHER
// ============================================================================

/**
 * Fetch all Toronto transit/restriction data
 */
export async function fetchTorontoTransitData() {
  console.log('🌍 Fetching Toronto transit & restriction data...');

  const [restrictions, alerts, routes] = await Promise.all([
    parseRoadRestrictions(),
    parseTransitAlerts(),
    parseGTFSRouteFrequency(),
  ]);

  return {
    restrictions,
    alerts,
    routes,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// GEOSPATIAL HELPERS
// ============================================================================

/**
 * Calculate distance between two points in km
 */
export function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if point is within Toronto bounds (with margin)
 */
export function isInTorontoBounds(
  lat: number,
  lon: number,
  marginKm: number = 30
): boolean {
  const torontoCenter = { lat: 43.6629, lon: -79.3957 };
  const distance = getDistanceFromLatLonInKm(
    lat,
    lon,
    torontoCenter.lat,
    torontoCenter.lon
  );
  return distance <= marginKm;
}

/**
 * Convert lat/lon to 3D position on Mercator plane
 */
export function mercatorProject(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  scaleFactorLat: number,
  scaleFactorLon: number
): { x: number; y: number } {
  const x = (lon - centerLon) * scaleFactorLon;
  const y = (lat - centerLat) * scaleFactorLat;
  return { x: Math.round(x), y: Math.round(y) };
}
