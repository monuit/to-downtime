import { create } from 'zustand'
import type { DisruptionField, AggregationType } from '../utils/chartDataTransformers'
import type { Layout } from 'react-grid-layout'

export type ChartType = 'bar' | 'pie' | 'line' | 'area' | 'scatter' | 'heatmap' | 'stats' | 'sankey'

export interface FieldConfig {
  field: DisruptionField
  label?: string
  aggregation?: AggregationType
}

export interface FilterConfig {
  field: DisruptionField
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'in'
  value: any
}

export interface ChartConfig {
  id: string
  type: ChartType
  title: string
  xAxis?: FieldConfig
  yAxis?: FieldConfig
  groupBy?: DisruptionField
  filters?: FilterConfig[]
  colorScheme?: 'default' | 'severity' | 'impact' | 'warm' | 'cool'
  showLegend?: boolean
  showTooltip?: boolean
  dateRange?: {
    start: number
    end: number
  }
}

export interface DashboardConfig {
  id: string
  name: string
  description?: string
  charts: ChartConfig[]
  layouts: {
    lg: Layout[]
    md: Layout[]
    sm: Layout[]
    xs: Layout[]
  }
  createdAt: number
  updatedAt: number
}

interface ChartBuilderStore {
  // Current dashboard state
  currentDashboard: DashboardConfig | null
  savedDashboards: DashboardConfig[]
  
  // Date range filter (global)
  globalDateRange: {
    start: number
    end: number
  } | null
  
  // Historical data toggle
  showHistorical: boolean
  
  // Actions
  setCurrentDashboard: (dashboard: DashboardConfig | null) => void
  updateChart: (chartId: string, updates: Partial<ChartConfig>) => void
  addChart: (chart: ChartConfig, layout: Layout) => void
  removeChart: (chartId: string) => void
  updateLayouts: (layouts: DashboardConfig['layouts']) => void
  saveDashboard: (name: string, description?: string) => void
  loadDashboard: (dashboardId: string) => void
  deleteDashboard: (dashboardId: string) => void
  setGlobalDateRange: (range: { start: number; end: number } | null) => void
  setShowHistorical: (show: boolean) => void
  duplicateChart: (chartId: string) => void
  resetToDefault: () => void
  importDashboard: (config: DashboardConfig) => void
  exportDashboard: (dashboardId: string) => string | null
}

// Default dashboard configuration
const createDefaultDashboard = (): DashboardConfig => ({
  id: 'default',
  name: 'Overview Dashboard',
  description: 'Default dashboard with key metrics',
  charts: [
    {
      id: 'chart-severity',
      type: 'pie',
      title: 'Disruptions by Severity',
      xAxis: { field: 'severity', aggregation: 'count' },
      colorScheme: 'severity',
      showLegend: true,
      showTooltip: true,
    },
    {
      id: 'chart-type',
      type: 'bar',
      title: 'Disruptions by Type',
      xAxis: { field: 'type', aggregation: 'count' },
      colorScheme: 'default',
      showLegend: false,
      showTooltip: true,
    },
    {
      id: 'chart-timeline',
      type: 'line',
      title: '24-Hour Timeline',
      xAxis: { field: 'timestamp', label: 'Time' },
      yAxis: { field: 'id', aggregation: 'count', label: 'Count' },
      groupBy: 'severity',
      colorScheme: 'severity',
      showLegend: true,
      showTooltip: true,
    },
    {
      id: 'chart-worktype',
      type: 'bar',
      title: 'Top Work Types',
      xAxis: { field: 'workType', aggregation: 'count' },
      colorScheme: 'default',
      showLegend: false,
      showTooltip: true,
    },
    {
      id: 'chart-duration',
      type: 'pie',
      title: 'Duration Distribution',
      xAxis: { field: 'duration', aggregation: 'count' },
      colorScheme: 'warm',
      showLegend: true,
      showTooltip: true,
    },
    {
      id: 'chart-impact',
      type: 'bar',
      title: 'Impact Level Breakdown',
      xAxis: { field: 'impactLevel', aggregation: 'count' },
      colorScheme: 'impact',
      showLegend: false,
      showTooltip: true,
    },
    {
      id: 'chart-flow',
      type: 'sankey',
      title: 'Disruption Flow (Type → Severity)',
      xAxis: { field: 'type', label: 'Type' },
      yAxis: { field: 'severity', label: 'Severity' },
      colorScheme: 'default',
      showTooltip: true,
    },
  ],
  layouts: {
    lg: [
      { i: 'chart-severity', x: 0, y: 0, w: 4, h: 6 },
      { i: 'chart-type', x: 4, y: 0, w: 4, h: 6 },
      { i: 'chart-timeline', x: 8, y: 0, w: 4, h: 6 },
      { i: 'chart-worktype', x: 0, y: 6, w: 4, h: 6 },
      { i: 'chart-duration', x: 4, y: 6, w: 4, h: 6 },
      { i: 'chart-impact', x: 8, y: 6, w: 4, h: 6 },
      { i: 'chart-flow', x: 0, y: 12, w: 12, h: 6 },
    ],
    md: [
      { i: 'chart-severity', x: 0, y: 0, w: 5, h: 6 },
      { i: 'chart-type', x: 5, y: 0, w: 5, h: 6 },
      { i: 'chart-timeline', x: 0, y: 6, w: 10, h: 6 },
      { i: 'chart-worktype', x: 0, y: 12, w: 5, h: 6 },
      { i: 'chart-duration', x: 5, y: 12, w: 5, h: 6 },
      { i: 'chart-impact', x: 0, y: 18, w: 10, h: 6 },
      { i: 'chart-flow', x: 0, y: 24, w: 10, h: 6 },
    ],
    sm: [
      { i: 'chart-severity', x: 0, y: 0, w: 6, h: 5 },
      { i: 'chart-type', x: 0, y: 5, w: 6, h: 5 },
      { i: 'chart-timeline', x: 0, y: 10, w: 6, h: 5 },
      { i: 'chart-worktype', x: 0, y: 15, w: 6, h: 5 },
      { i: 'chart-duration', x: 0, y: 20, w: 6, h: 5 },
      { i: 'chart-impact', x: 0, y: 25, w: 6, h: 5 },
      { i: 'chart-flow', x: 0, y: 30, w: 6, h: 6 },
    ],
    xs: [
      { i: 'chart-severity', x: 0, y: 0, w: 4, h: 5 },
      { i: 'chart-type', x: 0, y: 5, w: 4, h: 5 },
      { i: 'chart-timeline', x: 0, y: 10, w: 4, h: 5 },
      { i: 'chart-worktype', x: 0, y: 15, w: 4, h: 5 },
      { i: 'chart-duration', x: 0, y: 20, w: 4, h: 5 },
      { i: 'chart-impact', x: 0, y: 25, w: 4, h: 5 },
      { i: 'chart-flow', x: 0, y: 30, w: 4, h: 6 },
    ],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

// LocalStorage keys
const STORAGE_KEYS = {
  CURRENT_DASHBOARD: 'chartbuilder_current_dashboard',
  SAVED_DASHBOARDS: 'chartbuilder_saved_dashboards',
  SHOW_HISTORICAL: 'chartbuilder_show_historical',
}

// Load from localStorage
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : defaultValue
  } catch (error) {
    console.error('Error loading from localStorage:', error)
    return defaultValue
  }
}

// Save to localStorage
const saveToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

export const useChartBuilderStore = create<ChartBuilderStore>((set, get) => ({
  currentDashboard: loadFromStorage(STORAGE_KEYS.CURRENT_DASHBOARD, createDefaultDashboard()),
  savedDashboards: loadFromStorage(STORAGE_KEYS.SAVED_DASHBOARDS, []),
  globalDateRange: null,
  showHistorical: loadFromStorage(STORAGE_KEYS.SHOW_HISTORICAL, false),

  setCurrentDashboard: (dashboard) => {
    set({ currentDashboard: dashboard })
    if (dashboard) {
      saveToStorage(STORAGE_KEYS.CURRENT_DASHBOARD, dashboard)
    }
  },

  updateChart: (chartId, updates) => {
    const { currentDashboard } = get()
    if (!currentDashboard) return

    const updatedCharts = currentDashboard.charts.map((chart) =>
      chart.id === chartId ? { ...chart, ...updates } : chart
    )

    const updatedDashboard = {
      ...currentDashboard,
      charts: updatedCharts,
      updatedAt: Date.now(),
    }

    get().setCurrentDashboard(updatedDashboard)
  },

  addChart: (chart, layout) => {
    const { currentDashboard } = get()
    if (!currentDashboard) return

    const updatedDashboard = {
      ...currentDashboard,
      charts: [...currentDashboard.charts, chart],
      layouts: {
        lg: [...currentDashboard.layouts.lg, layout],
        md: [...currentDashboard.layouts.md, { ...layout, w: Math.min(layout.w, 10) }],
        sm: [...currentDashboard.layouts.sm, { ...layout, w: 6, x: 0 }],
        xs: [...currentDashboard.layouts.xs, { ...layout, w: 4, x: 0 }],
      },
      updatedAt: Date.now(),
    }

    get().setCurrentDashboard(updatedDashboard)
  },

  removeChart: (chartId) => {
    const { currentDashboard } = get()
    if (!currentDashboard) return

    const updatedDashboard = {
      ...currentDashboard,
      charts: currentDashboard.charts.filter((chart) => chart.id !== chartId),
      layouts: {
        lg: currentDashboard.layouts.lg.filter((l) => l.i !== chartId),
        md: currentDashboard.layouts.md.filter((l) => l.i !== chartId),
        sm: currentDashboard.layouts.sm.filter((l) => l.i !== chartId),
        xs: currentDashboard.layouts.xs.filter((l) => l.i !== chartId),
      },
      updatedAt: Date.now(),
    }

    get().setCurrentDashboard(updatedDashboard)
  },

  updateLayouts: (layouts) => {
    const { currentDashboard } = get()
    if (!currentDashboard) return

    const updatedDashboard = {
      ...currentDashboard,
      layouts,
      updatedAt: Date.now(),
    }

    get().setCurrentDashboard(updatedDashboard)
  },

  saveDashboard: (name, description) => {
    const { currentDashboard, savedDashboards } = get()
    if (!currentDashboard) return

    const newDashboard: DashboardConfig = {
      ...currentDashboard,
      id: `dashboard-${Date.now()}`,
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const updatedSaved = [...savedDashboards, newDashboard]
    set({ savedDashboards: updatedSaved })
    saveToStorage(STORAGE_KEYS.SAVED_DASHBOARDS, updatedSaved)
  },

  loadDashboard: (dashboardId) => {
    const { savedDashboards } = get()
    const dashboard = savedDashboards.find((d) => d.id === dashboardId)
    
    if (dashboard) {
      get().setCurrentDashboard(dashboard)
    }
  },

  deleteDashboard: (dashboardId) => {
    const { savedDashboards } = get()
    const updatedSaved = savedDashboards.filter((d) => d.id !== dashboardId)
    set({ savedDashboards: updatedSaved })
    saveToStorage(STORAGE_KEYS.SAVED_DASHBOARDS, updatedSaved)
  },

  setGlobalDateRange: (range) => {
    set({ globalDateRange: range })
  },

  setShowHistorical: (show) => {
    set({ showHistorical: show })
    saveToStorage(STORAGE_KEYS.SHOW_HISTORICAL, show)
  },

  duplicateChart: (chartId) => {
    const { currentDashboard } = get()
    if (!currentDashboard) return

    const chartToDuplicate = currentDashboard.charts.find((c) => c.id === chartId)
    if (!chartToDuplicate) return

    const newChart: ChartConfig = {
      ...chartToDuplicate,
      id: `chart-${Date.now()}`,
      title: `${chartToDuplicate.title} (Copy)`,
    }

    const layoutToDuplicate = currentDashboard.layouts.lg.find((l) => l.i === chartId)
    if (!layoutToDuplicate) return

    const newLayout: Layout = {
      ...layoutToDuplicate,
      i: newChart.id,
      x: 0,
      y: Infinity, // Add to bottom
    }

    get().addChart(newChart, newLayout)
  },

  resetToDefault: () => {
    const defaultDashboard = createDefaultDashboard()
    get().setCurrentDashboard(defaultDashboard)
  },

  importDashboard: (config) => {
    const { savedDashboards } = get()
    const importedDashboard: DashboardConfig = {
      ...config,
      id: `dashboard-${Date.now()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const updatedSaved = [...savedDashboards, importedDashboard]
    set({ savedDashboards: updatedSaved })
    saveToStorage(STORAGE_KEYS.SAVED_DASHBOARDS, updatedSaved)
    get().setCurrentDashboard(importedDashboard)
  },

  exportDashboard: (dashboardId) => {
    const { savedDashboards, currentDashboard } = get()
    
    let dashboard: DashboardConfig | undefined
    
    if (dashboardId === 'current' && currentDashboard) {
      dashboard = currentDashboard
    } else {
      dashboard = savedDashboards.find((d) => d.id === dashboardId)
    }

    if (!dashboard) return null

    try {
      return JSON.stringify(dashboard, null, 2)
    } catch (error) {
      console.error('Error exporting dashboard:', error)
      return null
    }
  },
}))
