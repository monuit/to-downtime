import * as THREE from 'three';

/**
 * GTFS Route Frequency Visualization
 * Inspired by cityliner: https://github.com/dragoon/cityliner
 * 
 * Renders transit routes on a 3D map with:
 * - Line thickness based on trip frequency
 * - Color coding by transit type
 * - Opacity representing service intensity
 */

export interface VisualizationConfig {
  canvasWidth: number;
  canvasHeight: number;
  centerLat: number;
  centerLon: number;
  maxDistKm: number;
  colorScheme: 'default' | 'pastel' | 'inferno' | 'earthy' | 'cool';
}

export interface RouteSegment {
  routeId: string;
  routeName: string;
  routeType: string;
  frequency: number;
  geometry: { lat: number; lon: number }[];
  color: string;
  maxFrequency: number;
  minFrequency: number;
}

// ============================================================================
// COLOR SCHEMES (cityliner-inspired)
// ============================================================================

export const ColorSchemes = {
  default: {
    bus: '#E31B1C',
    subway: '#4DAF4A',
    streetcar: '#1A75D1',
    rail: '#708A91',
    ferry: '#FF8000',
    text: '#ffffff',
  },
  pastel: {
    bus: '#FF9999',
    subway: '#98E2A2',
    streetcar: '#99CCFF',
    rail: '#A6A6A6',
    ferry: '#85acff',
    text: '#ffffff',
  },
  inferno: {
    bus: '#FFC300',
    subway: '#DAF7A6',
    streetcar: '#FF5733',
    rail: '#C70039',
    ferry: '#B300FF',
    text: '#ffffff',
  },
  earthy: {
    bus: '#B36500',
    subway: '#44BB44',
    streetcar: '#3377AA',
    rail: '#5D5D5D',
    ferry: '#55AA77',
    text: '#ffffff',
  },
  cool: {
    bus: '#C32BAD',
    subway: '#4DFFB3',
    streetcar: '#6761A8',
    rail: '#5D5DAA',
    ferry: '#2193B0',
    text: '#ffffff',
  },
};

// ============================================================================
// MERCATOR PROJECTION
// ============================================================================

export class MercatorProjection {
  centerLat: number;
  centerLon: number;
  canvasWidth: number;
  canvasHeight: number;
  maxDistKm: number;

  constructor(config: VisualizationConfig) {
    this.centerLat = config.centerLat;
    this.centerLon = config.centerLon;
    this.canvasWidth = config.canvasWidth;
    this.canvasHeight = config.canvasHeight;
    this.maxDistKm = config.maxDistKm;
  }

  /**
   * Convert lat/lon to canvas coordinates
   */
  project(lat: number, lon: number): { x: number; y: number } {
    // Scale factors (km to pixels)
    const scaleLat =
      (this.canvasHeight / 2) /
      this.getDistanceFromLatLon(this.centerLat, this.centerLon, lat, this.centerLon);
    const scaleLon =
      (this.canvasWidth / 2) /
      this.getDistanceFromLatLon(this.centerLat, this.centerLon, this.centerLat, lon);

    const x = (this.canvasWidth / 2) + (lon - this.centerLon) * scaleLon * 111.32 * 1000 / this.getDistanceFromLatLon(this.centerLat, this.centerLon, this.centerLat, this.centerLon);
    const y =
      this.canvasHeight / 2 + (lat - this.centerLat) * scaleLat * 110.574 * 1000 / this.getDistanceFromLatLon(this.centerLat, this.centerLon, lat, this.centerLon);

    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Haversine distance in km
   */
  private getDistanceFromLatLon(
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
}

// ============================================================================
// ROUTE VISUALIZATION
// ============================================================================

export class RouteVisualizer {
  scene: THREE.Scene;
  projection: MercatorProjection;
  colorScheme: (typeof ColorSchemes)[keyof typeof ColorSchemes];
  lineGroup: THREE.Group;

  constructor(scene: THREE.Scene, config: VisualizationConfig) {
    this.scene = scene;
    this.projection = new MercatorProjection(config);
    this.colorScheme = ColorSchemes[config.colorScheme];
    this.lineGroup = new THREE.Group();
    scene.add(this.lineGroup);
  }

  /**
   * Get color for route type
   */
  getRouteColor(routeType: string): string {
    const typeKey = routeType.toLowerCase() as keyof typeof this.colorScheme;
    return this.colorScheme[typeKey] || this.colorScheme.bus;
  }

  /**
   * Convert hex to THREE.Color
   */
  hexToThreeColor(hex: string): THREE.Color {
    return new THREE.Color(hex);
  }

  /**
   * Visualize a route segment
   * Thickness based on frequency (logarithmic scale like cityliner)
   */
  visualizeRouteSegment(segment: RouteSegment): void {
    const points: THREE.Vector3[] = [];

    // Project geometry to canvas coordinates
    segment.geometry.forEach((point) => {
      const projected = this.projection.project(point.lat, point.lon);
      points.push(new THREE.Vector3(projected.x, projected.y, 0));
    });

    if (points.length < 2) return; // Need at least 2 points for a line

    // Create tube geometry for route line
    const curve = new THREE.BufferCurve(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 8, 1, 8);

    // Calculate line width based on frequency (log scale, cityliner-inspired)
    const freqRatio = segment.frequency / segment.maxFrequency;
    const baseWidth = 0.5;
    const maxWidth = 3.0;
    const lineWidth = baseWidth + Math.log(freqRatio * 10 + 1) * (maxWidth - baseWidth);

    // Calculate opacity based on frequency
    const minOpacity = 0.3;
    const maxOpacity = 1.0;
    const opacity = minOpacity + (freqRatio * (maxOpacity - minOpacity));

    // Create material with frequency-based properties
    const color = this.hexToThreeColor(segment.color);
    const material = new THREE.MeshPhongMaterial({
      color,
      opacity,
      transparent: opacity < 1,
      wireframe: false,
      shininess: 30,
      emissive: color,
      emissiveIntensity: 0.2,
    });

    const mesh = new THREE.Mesh(tubeGeometry, material);
    this.lineGroup.add(mesh);
  }

  /**
   * Visualize multiple route segments
   */
  visualizeRoutes(segments: RouteSegment[]): void {
    // Clear previous routes
    this.lineGroup.clear();

    // Find frequency range for scaling
    const frequencies = segments.map((s) => s.frequency);
    const maxFreq = Math.max(...frequencies);
    const minFreq = Math.min(...frequencies);

    // Update segments with min/max frequency
    segments.forEach((segment) => {
      segment.maxFrequency = maxFreq;
      segment.minFrequency = minFreq;
      this.visualizeRouteSegment(segment);
    });

    console.log(
      `🚀 Visualized ${segments.length} route segments (frequency range: ${minFreq}-${maxFreq})`
    );
  }

  /**
   * Update color scheme
   */
  updateColorScheme(schemeName: keyof typeof ColorSchemes): void {
    this.colorScheme = ColorSchemes[schemeName];
    console.log(`🎨 Color scheme updated to: ${schemeName}`);
  }

  /**
   * Clear visualization
   */
  clear(): void {
    this.lineGroup.clear();
  }
}

// ============================================================================
// ROUTE FREQUENCY CALCULATOR
// ============================================================================

/**
 * Calculate route frequency from GTFS trip data
 * Counts trips per route per day
 */
export function calculateRouteFrequency(
  routes: Array<{ id: string; type: string }>,
  trips: Array<{ routeId: string; stopTimes: { arrivalTime: string; departureTime: string }[] }>
): Map<string, number> {
  const frequencyMap = new Map<string, number>();

  trips.forEach((trip) => {
    const current = frequencyMap.get(trip.routeId) || 0;
    frequencyMap.set(trip.routeId, current + 1);
  });

  return frequencyMap;
}

/**
 * Group route segments by transit type
 */
export function groupByTransitType(
  segments: RouteSegment[]
): Map<string, RouteSegment[]> {
  const grouped = new Map<string, RouteSegment[]>();

  segments.forEach((segment) => {
    const type = segment.routeType;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)?.push(segment);
  });

  return grouped;
}

/**
 * Sort segments by frequency (for rendering priority)
 */
export function sortByFrequency(segments: RouteSegment[]): RouteSegment[] {
  return [...segments].sort((a, b) => a.frequency - b.frequency);
}

/**
 * Filter segments within geographic bounds
 */
export function filterByBounds(
  segments: RouteSegment[],
  centerLat: number,
  centerLon: number,
  maxDistKm: number
): RouteSegment[] {
  return segments.filter((segment) => {
    return segment.geometry.some((point) => {
      const distance = getDistanceFromLatLon(
        centerLat,
        centerLon,
        point.lat,
        point.lon
      );
      return distance <= maxDistKm;
    });
  });
}

/**
 * Haversine distance helper
 */
function getDistanceFromLatLon(
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

// THREE.BufferCurve helper for TubeGeometry
class THREE_BufferCurve extends THREE.Curve<THREE.Vector3> {
  points: THREE.Vector3[];

  constructor(points: THREE.Vector3[]) {
    super();
    this.points = points;
  }

  getPoint(t: number, optionalTarget?: THREE.Vector3): THREE.Vector3 {
    const target = optionalTarget || new THREE.Vector3();
    const index = Math.floor(t * (this.points.length - 1));
    const nextIndex = Math.min(index + 1, this.points.length - 1);

    if (index === nextIndex) {
      target.copy(this.points[index]);
    } else {
      const fraction =
        (t * (this.points.length - 1) - index) /
        (nextIndex - index);
      target.lerpVectors(this.points[index], this.points[nextIndex], fraction);
    }

    return target;
  }
}

// Extend THREE namespace with custom curve
declare global {
  namespace THREE {
    class BufferCurve extends THREE_BufferCurve {}
  }
}

if (typeof THREE !== 'undefined' && !THREE.BufferCurve) {
  (THREE as any).BufferCurve = THREE_BufferCurve;
}
