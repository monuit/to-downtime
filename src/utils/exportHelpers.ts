import type { Disruption } from '../store/disruptions'

/**
 * Export disruptions data to CSV file
 */
export function exportDisruptionsToCSV(disruptions: Disruption[], filename: string = 'disruptions.csv'): void {
  if (disruptions.length === 0) {
    alert('No data to export')
    return
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Type',
    'Severity',
    'Title',
    'Description',
    'Affected Lines',
    'Work Type',
    'Schedule Type',
    'Duration',
    'Impact Level',
    'Road Class',
    'Contractor',
    'District',
    'Latitude',
    'Longitude',
    'Address',
    'Timestamp',
    'Source API',
    'Source URL',
  ]

  // Convert disruptions to CSV rows
  const rows = disruptions.map((d) => [
    d.id,
    d.type,
    d.severity,
    escapeCSV(d.title),
    escapeCSV(d.description),
    d.affectedLines ? d.affectedLines.join('; ') : '',
    d.workType || '',
    d.scheduleType || '',
    d.duration || '',
    d.impactLevel || '',
    d.roadClass || '',
    d.contractor || '',
    d.district || '',
    d.coordinates?.lat || '',
    d.coordinates?.lng || '',
    escapeCSV(d.addressFull || ''),
    new Date(d.timestamp).toISOString(),
    d.sourceApi || '',
    d.sourceUrl || '',
  ])

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  // Download file
  downloadFile(csvContent, filename, 'text/csv')
}

/**
 * Export chart data to CSV
 */
export function exportChartDataToCSV(
  data: Array<{ x: string | number; y: number; label?: string }>,
  filename: string = 'chart-data.csv'
): void {
  if (data.length === 0) {
    alert('No data to export')
    return
  }

  const headers = ['X', 'Y', 'Label']
  const rows = data.map((point) => [point.x, point.y, point.label || ''])

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n')

  downloadFile(csvContent, filename, 'text/csv')
}

/**
 * Export dashboard configuration to JSON
 */
export function exportDashboardToJSON(dashboardConfig: any, filename: string = 'dashboard.json'): void {
  const json = JSON.stringify(dashboardConfig, null, 2)
  downloadFile(json, filename, 'application/json')
}

/**
 * Import dashboard configuration from JSON file
 */
export function importDashboardFromJSON(callback: (config: any) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'

  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target?.result as string)
        callback(config)
      } catch (error) {
        console.error('Error parsing JSON file:', error)
        alert('Invalid JSON file')
      }
    }
    reader.readAsText(file)
  }

  input.click()
}

/**
 * Export chart as PNG image (requires Victory's built-in export)
 */
export function exportChartAsPNG(chartElement: HTMLElement, filename: string = 'chart.png'): void {
  // Use html2canvas or similar library for chart export
  // For now, just copy to clipboard functionality
  alert('PNG export requires additional setup. Use browser\'s built-in screenshot or print to PDF.')
}

/**
 * Generate shareable URL with dashboard configuration
 */
export function generateShareableURL(dashboardConfig: any): string {
  try {
    const compressed = btoa(JSON.stringify(dashboardConfig))
    const baseUrl = window.location.origin + window.location.pathname
    return `${baseUrl}?config=${compressed}`
  } catch (error) {
    console.error('Error generating shareable URL:', error)
    return window.location.href
  }
}

/**
 * Load dashboard from URL parameter
 */
export function loadDashboardFromURL(): any | null {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const configParam = urlParams.get('config')
    
    if (configParam) {
      const decoded = atob(configParam)
      return JSON.parse(decoded)
    }
  } catch (error) {
    console.error('Error loading dashboard from URL:', error)
  }
  
  return null
}

// Helper functions

function escapeCSV(value: string): string {
  if (!value) return ''
  
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  
  return value
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Copy text to clipboard
 */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

/**
 * Format data for analytics summary report
 */
export function generateAnalyticsReport(disruptions: Disruption[]): string {
  const total = disruptions.length
  const bySeverity = {
    severe: disruptions.filter(d => d.severity === 'severe').length,
    moderate: disruptions.filter(d => d.severity === 'moderate').length,
    minor: disruptions.filter(d => d.severity === 'minor').length,
  }
  const byType = disruptions.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const report = `
Toronto Downtime Analytics Report
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Disruptions: ${total}

=== BY SEVERITY ===
Severe: ${bySeverity.severe} (${((bySeverity.severe / total) * 100).toFixed(1)}%)
Moderate: ${bySeverity.moderate} (${((bySeverity.moderate / total) * 100).toFixed(1)}%)
Minor: ${bySeverity.minor} (${((bySeverity.minor / total) * 100).toFixed(1)}%)

=== BY TYPE ===
${Object.entries(byType)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `${type}: ${count} (${((count / total) * 100).toFixed(1)}%)`)
  .join('\n')}

=== DATA RANGE ===
Oldest: ${new Date(Math.min(...disruptions.map(d => d.timestamp))).toLocaleString()}
Newest: ${new Date(Math.max(...disruptions.map(d => d.timestamp))).toLocaleString()}
`.trim()

  return report
}
