import type { Disruption } from '../store/disruptions'

export interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
  color?: string
  metadata?: any
}

export interface TimeSeriesPoint {
  x: Date | number
  y: number
  label?: string
  group?: string
}

export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max'
export type DisruptionField = keyof Disruption

/**
 * Aggregate disruptions by a specific field
 */
export function aggregateByField(
  disruptions: Disruption[],
  field: DisruptionField,
  aggregationType: AggregationType = 'count',
  valueField?: DisruptionField
): ChartDataPoint[] {
  const grouped: Record<string, number[]> = {}

  disruptions.forEach((disruption) => {
    const key = String(disruption[field] || 'Unknown')
    
    if (!grouped[key]) {
      grouped[key] = []
    }

    if (aggregationType === 'count') {
      grouped[key].push(1)
    } else if (valueField) {
      const value = disruption[valueField]
      if (typeof value === 'number') {
        grouped[key].push(value)
      }
    }
  })

  return Object.entries(grouped).map(([key, values]) => {
    let yValue: number

    switch (aggregationType) {
      case 'count':
        yValue = values.length
        break
      case 'sum':
        yValue = values.reduce((a, b) => a + b, 0)
        break
      case 'avg':
        yValue = values.reduce((a, b) => a + b, 0) / values.length
        break
      case 'min':
        yValue = Math.min(...values)
        break
      case 'max':
        yValue = Math.max(...values)
        break
      default:
        yValue = values.length
    }

    return {
      x: key,
      y: yValue,
      label: `${key}: ${yValue}`,
    }
  }).sort((a, b) => b.y - a.y)
}

/**
 * Aggregate by multiple fields (for stacked/grouped charts)
 */
export function aggregateByMultipleFields(
  disruptions: Disruption[],
  primaryField: DisruptionField,
  secondaryField: DisruptionField,
  aggregationType: AggregationType = 'count'
): Record<string, ChartDataPoint[]> {
  const grouped: Record<string, Record<string, number>> = {}

  disruptions.forEach((disruption) => {
    const primaryKey = String(disruption[primaryField] || 'Unknown')
    const secondaryKey = String(disruption[secondaryField] || 'Unknown')

    if (!grouped[primaryKey]) {
      grouped[primaryKey] = {}
    }
    if (!grouped[primaryKey][secondaryKey]) {
      grouped[primaryKey][secondaryKey] = 0
    }

    grouped[primaryKey][secondaryKey]++
  })

  const result: Record<string, ChartDataPoint[]> = {}

  Object.entries(grouped).forEach(([primaryKey, secondaryData]) => {
    result[primaryKey] = Object.entries(secondaryData).map(([secondaryKey, count]) => ({
      x: secondaryKey,
      y: count,
      label: `${primaryKey} - ${secondaryKey}: ${count}`,
    }))
  })

  return result
}

/**
 * Generate time series data with configurable intervals
 */
export function generateTimeSeries(
  disruptions: Disruption[],
  interval: 'hour' | 'day' | 'week' | 'month' = 'hour',
  hours: number = 24,
  groupBy?: DisruptionField
): TimeSeriesPoint[] | Record<string, TimeSeriesPoint[]> {
  const now = Date.now()
  const intervalMs = getIntervalMs(interval)
  const totalIntervals = interval === 'hour' ? hours : getIntervalsForRange(interval, hours)

  if (groupBy) {
    // Group by field (e.g., severity)
    const groups: Record<string, Record<number, number>> = {}

    disruptions.forEach((d) => {
      const group = String(d[groupBy] || 'Unknown')
      const intervalsSince = Math.floor((now - d.timestamp) / intervalMs)
      
      if (intervalsSince < totalIntervals && intervalsSince >= 0) {
        if (!groups[group]) {
          groups[group] = {}
        }
        const bucket = totalIntervals - intervalsSince - 1
        groups[group][bucket] = (groups[group][bucket] || 0) + 1
      }
    })

    // Convert to time series format
    const result: Record<string, TimeSeriesPoint[]> = {}

    Object.entries(groups).forEach(([group, buckets]) => {
      result[group] = Array.from({ length: totalIntervals }, (_, i) => ({
        x: now - (totalIntervals - i - 1) * intervalMs,
        y: buckets[i] || 0,
        label: formatIntervalLabel(i, totalIntervals, interval),
        group,
      }))
    })

    return result
  } else {
    // Simple time series
    const buckets: Record<number, number> = {}

    disruptions.forEach((d) => {
      const intervalsSince = Math.floor((now - d.timestamp) / intervalMs)
      
      if (intervalsSince < totalIntervals && intervalsSince >= 0) {
        const bucket = totalIntervals - intervalsSince - 1
        buckets[bucket] = (buckets[bucket] || 0) + 1
      }
    })

    return Array.from({ length: totalIntervals }, (_, i) => ({
      x: now - (totalIntervals - i - 1) * intervalMs,
      y: buckets[i] || 0,
      label: formatIntervalLabel(i, totalIntervals, interval),
    }))
  }
}

/**
 * Generate heatmap data (e.g., day of week vs hour of day)
 */
export function generateHeatmapData(
  disruptions: Disruption[]
): { x: string; y: string; value: number }[] {
  const heatmap: Record<string, Record<string, number>> = {}

  // Days of week
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  disruptions.forEach((d) => {
    const date = new Date(d.timestamp)
    const day = days[date.getDay()]
    const hour = date.getHours()

    if (!heatmap[day]) {
      heatmap[day] = {}
    }
    if (!heatmap[day][hour]) {
      heatmap[day][hour] = 0
    }

    heatmap[day][hour]++
  })

  const result: { x: string; y: string; value: number }[] = []

  days.forEach((day) => {
    for (let hour = 0; hour < 24; hour++) {
      result.push({
        x: `${hour}:00`,
        y: day,
        value: heatmap[day]?.[hour] || 0,
      })
    }
  })

  return result
}

/**
 * Calculate distribution percentages
 */
export function calculateDistribution(
  disruptions: Disruption[],
  field: DisruptionField
): { label: string; percentage: number; count: number; color?: string }[] {
  const total = disruptions.length
  if (total === 0) return []

  const counts: Record<string, number> = {}

  disruptions.forEach((d) => {
    const key = String(d[field] || 'Unknown')
    counts[key] = (counts[key] || 0) + 1
  })

  // Color mapping for common fields
  const colorMap: Record<string, Record<string, string>> = {
    severity: {
      severe: '#ff4444',
      moderate: '#ffaa00',
      minor: '#44ff44',
    },
    impactLevel: {
      High: '#ff4444',
      Medium: '#ffaa00',
      Low: '#44ff44',
    },
  }

  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      percentage: (count / total) * 100,
      color: colorMap[String(field)]?.[label],
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Get top N items by field
 */
export function getTopN(
  disruptions: Disruption[],
  field: DisruptionField,
  n: number = 10
): ChartDataPoint[] {
  const data = aggregateByField(disruptions, field, 'count')
  return data.slice(0, n)
}

/**
 * Calculate statistics for a numeric field
 */
export function calculateStats(
  disruptions: Disruption[],
  field: DisruptionField
): {
  count: number
  sum: number
  avg: number
  min: number
  max: number
  median: number
} {
  const values = disruptions
    .map((d) => d[field])
    .filter((v): v is number => typeof v === 'number')

  if (values.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0, median: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((a, b) => a + b, 0)

  return {
    count: values.length,
    sum,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    median: sorted[Math.floor(sorted.length / 2)],
  }
}

/**
 * Filter disruptions by date range
 */
export function filterByDateRange(
  disruptions: Disruption[],
  startDate: Date | number,
  endDate: Date | number
): Disruption[] {
  const start = typeof startDate === 'number' ? startDate : startDate.getTime()
  const end = typeof endDate === 'number' ? endDate : endDate.getTime()

  return disruptions.filter((d) => d.timestamp >= start && d.timestamp <= end)
}

/**
 * Get comparison data (current vs previous period)
 */
export function getComparisonData(
  disruptions: Disruption[],
  field: DisruptionField,
  periodMs: number = 24 * 60 * 60 * 1000 // 24 hours
): {
  current: ChartDataPoint[]
  previous: ChartDataPoint[]
  change: number
} {
  const now = Date.now()
  
  const currentPeriod = disruptions.filter(
    (d) => d.timestamp >= now - periodMs && d.timestamp <= now
  )
  const previousPeriod = disruptions.filter(
    (d) => d.timestamp >= now - periodMs * 2 && d.timestamp < now - periodMs
  )

  const currentData = aggregateByField(currentPeriod, field)
  const previousData = aggregateByField(previousPeriod, field)

  const currentTotal = currentPeriod.length
  const previousTotal = previousPeriod.length
  const change = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : 0

  return {
    current: currentData,
    previous: previousData,
    change,
  }
}

// Helper functions

function getIntervalMs(interval: 'hour' | 'day' | 'week' | 'month'): number {
  switch (interval) {
    case 'hour':
      return 3600000
    case 'day':
      return 86400000
    case 'week':
      return 604800000
    case 'month':
      return 2592000000 // Approximate 30 days
  }
}

function getIntervalsForRange(interval: 'hour' | 'day' | 'week' | 'month', hours: number): number {
  switch (interval) {
    case 'hour':
      return hours
    case 'day':
      return Math.ceil(hours / 24)
    case 'week':
      return Math.ceil(hours / 168)
    case 'month':
      return Math.ceil(hours / 720)
  }
}

function formatIntervalLabel(
  index: number,
  total: number,
  interval: 'hour' | 'day' | 'week' | 'month'
): string {
  const ago = total - index - 1

  switch (interval) {
    case 'hour':
      return ago === 0 ? 'Now' : `${ago}h ago`
    case 'day':
      return ago === 0 ? 'Today' : `${ago}d ago`
    case 'week':
      return ago === 0 ? 'This week' : `${ago}w ago`
    case 'month':
      return ago === 0 ? 'This month' : `${ago}m ago`
  }
}

/**
 * Export data to CSV format
 */
export function exportToCSV(
  disruptions: Disruption[],
  filename: string = 'disruptions.csv'
): void {
  if (disruptions.length === 0) return

  // Get all unique keys
  const keys = Array.from(
    new Set(disruptions.flatMap((d) => Object.keys(d)))
  ).filter(key => typeof disruptions[0][key as keyof Disruption] !== 'object')

  // Create CSV header
  const header = keys.join(',')

  // Create CSV rows
  const rows = disruptions.map((d) =>
    keys
      .map((key) => {
        const value = d[key as keyof Disruption]
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`
        }
        return value
      })
      .join(',')
  )

  const csv = [header, ...rows].join('\n')

  // Download
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Generate Sankey diagram data showing flow between fields
 * Example: Type → Severity → Impact
 */
export const generateSankeyData = (
  disruptions: Disruption[],
  sourceField: DisruptionField,
  targetField: DisruptionField,
  valueField?: DisruptionField
): { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] } => {
  // Collect unique values for both fields
  const sourceValues = new Set<string>()
  const targetValues = new Set<string>()
  const flowMap = new Map<string, number>()

  disruptions.forEach((d) => {
    const source = String(d[sourceField] || 'Unknown')
    const target = String(d[targetField] || 'Unknown')
    const value = valueField ? Number(d[valueField]) || 1 : 1

    sourceValues.add(source)
    targetValues.add(target)

    const key = `${source}→${target}`
    flowMap.set(key, (flowMap.get(key) || 0) + value)
  })

  // Create nodes array
  const nodes: { name: string }[] = [
    ...Array.from(sourceValues).map((name) => ({ name })),
    ...Array.from(targetValues).map((name) => ({ name })),
  ]

  // Remove duplicate nodes
  const uniqueNodes = Array.from(
    new Map(nodes.map((node) => [node.name, node])).values()
  )

  // Create links with node indices
  const links = Array.from(flowMap.entries()).map(([key, value]) => {
    const [source, target] = key.split('→')
    return {
      source: uniqueNodes.findIndex((n) => n.name === source),
      target: uniqueNodes.findIndex((n) => n.name === target),
      value,
    }
  })

  return { nodes: uniqueNodes, links }
}

/**
 * Generate multi-level Sankey data (3+ fields)
 * Example: Type → Severity → Impact → Duration
 */
export const generateMultiLevelSankeyData = (
  disruptions: Disruption[],
  fields: DisruptionField[]
): { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] } => {
  if (fields.length < 2) {
    throw new Error('Need at least 2 fields for Sankey diagram')
  }

  const nodeSet = new Set<string>()
  const flowMap = new Map<string, number>()

  disruptions.forEach((d) => {
    const values = fields.map((field) => String(d[field] || 'Unknown'))
    values.forEach((value) => nodeSet.add(value))

    // Create links between consecutive fields
    for (let i = 0; i < values.length - 1; i++) {
      const source = values[i]
      const target = values[i + 1]
      const key = `${source}→${target}`
      flowMap.set(key, (flowMap.get(key) || 0) + 1)
    }
  })

  // Create nodes
  const nodes = Array.from(nodeSet).map((name) => ({ name }))

  // Create links
  const links = Array.from(flowMap.entries()).map(([key, value]) => {
    const [source, target] = key.split('→')
    return {
      source: nodes.findIndex((n) => n.name === source),
      target: nodes.findIndex((n) => n.name === target),
      value,
    }
  })

  return { nodes, links }
}
