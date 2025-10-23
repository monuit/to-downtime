import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  RouteVisualizer,
  MercatorProjection,
  RouteSegment,
  ColorSchemes,
  VisualizationConfig,
  sortByFrequency,
  filterByBounds,
} from '../server/route-visualizer';
import {
  parseGTFSRouteFrequency,
  fetchTorontoTransitData,
  isInTorontoBounds,
  mercatorProject,
} from '../server/data-parsers';

interface UseRouteVisualizationProps {
  scene: THREE.Scene | null;
  enabled?: boolean;
  colorScheme?: 'default' | 'pastel' | 'inferno' | 'earthy' | 'cool';
}

/**
 * Hook for managing route visualization
 * Fetches GTFS data, parses routes, and renders with cityliner-inspired styling
 */
export function useRouteVisualization({
  scene,
  enabled = true,
  colorScheme = 'default',
}: UseRouteVisualizationProps) {
  const visualizerRef = useRef<RouteVisualizer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routeCount, setRouteCount] = useState(0);
  const [segmentCount, setSegmentCount] = useState(0);
  const [averageFrequency, setAverageFrequency] = useState(0);

  // Toronto center coordinates
  const TORONTO_CENTER = { lat: 43.6629, lon: -79.3957 };
  const MAX_DIST_KM = 25;

  const config: VisualizationConfig = {
    canvasWidth: 1920,
    canvasHeight: 1080,
    centerLat: TORONTO_CENTER.lat,
    centerLon: TORONTO_CENTER.lon,
    maxDistKm: MAX_DIST_KM,
    colorScheme,
  };

  useEffect(() => {
    if (!scene || !enabled) return;

    let isMounted = true;

    async function loadAndVisualizeRoutes() {
      try {
        setLoading(true);
        setError(null);

        // Initialize visualizer
        visualizerRef.current = new RouteVisualizer(scene as THREE.Scene, config);

        // Fetch route frequency data
        console.log('📡 Fetching GTFS route frequency data...');
        const routes = await parseGTFSRouteFrequency();

        if (!isMounted) return;

        if (routes.length === 0) {
          setError('No route data available');
          setLoading(false);
          return;
        }

        // Filter routes within Toronto bounds
        const filteredRoutes = routes.filter((route) => {
          return route.geometry.some((point) =>
            isInTorontoBounds(point.lat, point.lon, MAX_DIST_KM)
          );
        });

        if (!isMounted) return;

        // Convert to segments with color assignment
        const segments: RouteSegment[] = filteredRoutes.map((route) => {
          const color = visualizerRef.current?.getRouteColor(route.routeType) || '#FF0000';

          return {
            routeId: route.routeId,
            routeName: route.routeName,
            routeType: route.routeType,
            frequency: route.frequency,
            geometry: route.geometry,
            color,
            maxFrequency: Math.max(...filteredRoutes.map((r) => r.frequency)),
            minFrequency: Math.min(...filteredRoutes.map((r) => r.frequency)),
          };
        });

        // Sort by frequency (low to high, for proper rendering order)
        const sortedSegments = sortByFrequency(segments);

        if (!isMounted) return;

        // Visualize routes
        visualizerRef.current.visualizeRoutes(sortedSegments);

        // Calculate statistics
        const totalFrequency = segments.reduce((sum, s) => sum + s.frequency, 0);
        const avgFrequency = totalFrequency / segments.length;

        if (isMounted) {
          setRouteCount(filteredRoutes.length);
          setSegmentCount(segments.length);
          setAverageFrequency(Math.round(avgFrequency));
          setLoading(false);
        }

        console.log(`✅ Route visualization complete:
          - Routes: ${filteredRoutes.length}
          - Segments: ${segments.length}
          - Avg frequency: ${Math.round(avgFrequency)} trips/day
        `);
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMessage);
          console.error('❌ Route visualization error:', err);
          setLoading(false);
        }
      }
    }

    loadAndVisualizeRoutes();

    return () => {
      isMounted = false;
    };
  }, [scene, enabled, colorScheme]);

  // Update color scheme when it changes
  useEffect(() => {
    if (visualizerRef.current) {
      visualizerRef.current.updateColorScheme(colorScheme);
    }
  }, [colorScheme]);

  return {
    loading,
    error,
    routeCount,
    segmentCount,
    averageFrequency,
    visualizer: visualizerRef.current,
  };
}

/**
 * Hook for managing data parsers (road restrictions, transit alerts)
 */
export function useTorontoDataParsers() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  async function fetchAndParseData() {
    try {
      setLoading(true);
      setError(null);

      console.log('📍 Fetching Toronto transit & restriction data...');
      const transitData = await fetchTorontoTransitData();

      if (!transitData) {
        setError('No data returned');
        setLoading(false);
        return;
      }

      setData(transitData);
      setLoading(false);

      console.log(`✅ Data parsed:
        - Road restrictions: ${transitData.restrictions.length}
        - Transit alerts: ${transitData.alerts.length}
        - Routes: ${transitData.routes.length}
      `);

      return transitData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('❌ Data parsing error:', err);
      setLoading(false);
    }
  }

  return {
    loading,
    error,
    data,
    fetchAndParseData,
  };
}

/**
 * Hook for managing visualization config updates
 */
export function useVisualizationConfig() {
  const [config, setConfig] = useState<Partial<VisualizationConfig>>({
    colorScheme: 'default',
    maxDistKm: 25,
  });

  const updateColorScheme = (scheme: VisualizationConfig['colorScheme']) => {
    setConfig((prev) => ({ ...prev, colorScheme: scheme }));
  };

  const updateMaxDist = (maxDist: number) => {
    setConfig((prev) => ({ ...prev, maxDistKm: maxDist }));
  };

  return {
    config,
    updateColorScheme,
    updateMaxDist,
    availableSchemes: Object.keys(ColorSchemes) as Array<keyof typeof ColorSchemes>,
  };
}
