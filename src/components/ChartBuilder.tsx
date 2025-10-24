import React, { useState, useEffect, useMemo } from 'react'
import { Responsive, WidthProvider, Layout } from 'react-grid-layout'
import { useDisruptionStore } from '../store/disruptions'
import { useChartBuilderStore } from '../store/chartBuilder'
import { ChartRenderer } from './ChartRenderer'
import type { ChartConfig } from '../store/chartBuilder'
import { 
  exportDisruptionsToCSV, 
  exportDashboardToJSON,
  importDashboardFromJSON,
  generateAnalyticsReport,
  copyToClipboard,
  generateShareableURL
} from '../utils/exportHelpers'
import 'react-grid-layout/css/styles.css'
import '../styles/ChartBuilder.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface ChartBuilderProps {
  onClose?: () => void
}

export const ChartBuilder: React.FC<ChartBuilderProps> = ({ onClose }) => {
  const [historicalData, setHistoricalData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })
  const [hiddenCharts, setHiddenCharts] = useState<Set<string>>(new Set())
  const [showHiddenDropdown, setShowHiddenDropdown] = useState(false)
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const [chartBuilder, setChartBuilder] = useState<{
    type: string
    title: string
    xAxis: string[]
    yAxis: string[]
  }>({
    type: 'bar',
    title: '',
    xAxis: [],
    yAxis: [],
  })

  const currentDisruptions = useDisruptionStore((state) => state.disruptions)
  const {
    currentDashboard,
    showHistorical,
    savedDashboards,
    setShowHistorical,
    updateLayouts,
    removeChart,
    saveDashboard,
    loadDashboard,
    resetToDefault,
    exportDashboard,
  } = useChartBuilderStore()

  // Clear hidden charts when dashboard changes
  useEffect(() => {
    setHiddenCharts(new Set())
  }, [currentDashboard?.id])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.hidden-charts-dropdown')) {
        setShowHiddenDropdown(false)
      }
    }

    if (showHiddenDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showHiddenDropdown])

  // Fetch historical data when toggled
  useEffect(() => {
    if (showHistorical) {
      fetchHistoricalData()
    }
  }, [showHistorical, dateRange])

  const fetchHistoricalData = async () => {
    setLoading(true)
    try {
      const startTs = new Date(dateRange.start).getTime()
      const endTs = new Date(dateRange.end).getTime()

      const response = await fetch(
        `/api/disruptions/archive?startDate=${startTs}&endDate=${endTs}&limit=5000`
      )
      const result = await response.json()

      if (result.success) {
        setHistoricalData(result.data)
      }
    } catch (error) {
      console.error('Error fetching historical data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Combine current + historical data
  const allDisruptions = useMemo(() => {
    if (showHistorical) {
      return [...currentDisruptions, ...historicalData]
    }
    return currentDisruptions
  }, [currentDisruptions, historicalData, showHistorical])

  // Available fields for chart building
  const availableFields = [
    { field: 'type', label: 'Type', icon: '📋' },
    { field: 'severity', label: 'Severity', icon: '⚠️' },
    { field: 'impactLevel', label: 'Impact Level', icon: '💥' },
    { field: 'workType', label: 'Work Type', icon: '🔧' },
    { field: 'scheduleType', label: 'Schedule Type', icon: '📅' },
    { field: 'duration', label: 'Duration', icon: '⏱️' },
    { field: 'roadClass', label: 'Road Class', icon: '🛣️' },
    { field: 'contractor', label: 'Contractor', icon: '👷' },
    { field: 'district', label: 'District', icon: '📍' },
    { field: 'timestamp', label: 'Time', icon: '🕒' },
    { field: 'affectedLines', label: 'Affected Lines', icon: '🚇' },
  ]

  const handleLayoutChange = (layout: Layout[], layouts: any) => {
    updateLayouts(layouts)
  }

  const handleSaveDashboard = () => {
    const name = prompt('Enter dashboard name:')
    if (name) {
      const description = prompt('Enter description (optional):')
      saveDashboard(name, description || undefined)
      alert('Dashboard saved successfully!')
    }
  }

  const handleLoadDashboard = () => {
    if (savedDashboards.length === 0) {
      alert('No saved dashboards found')
      return
    }

    const dashboardList = savedDashboards
      .map((d, i) => `${i + 1}. ${d.name} (${new Date(d.createdAt).toLocaleDateString()})`)
      .join('\n')

    const selection = prompt(`Select dashboard:\n\n${dashboardList}\n\nEnter number:`)
    
    if (selection) {
      const index = parseInt(selection) - 1
      if (index >= 0 && index < savedDashboards.length) {
        loadDashboard(savedDashboards[index].id)
        alert('Dashboard loaded successfully!')
      }
    }
  }

  const handleExportDashboard = () => {
    if (currentDashboard) {
      exportDashboardToJSON(currentDashboard, `dashboard-${Date.now()}.json`)
    }
  }

  const handleImportDashboard = () => {
    importDashboardFromJSON((config) => {
      const { importDashboard } = useChartBuilderStore.getState()
      importDashboard(config)
      alert('Dashboard imported successfully!')
    })
  }

  const handleExportCSV = () => {
    exportDisruptionsToCSV(allDisruptions, `disruptions-${Date.now()}.csv`)
  }

  const handleGenerateReport = () => {
    const report = generateAnalyticsReport(allDisruptions)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-report-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShareDashboard = async () => {
    if (currentDashboard) {
      const url = generateShareableURL(currentDashboard)
      try {
        await copyToClipboard(url)
        alert('Dashboard URL copied to clipboard!')
      } catch (error) {
        prompt('Copy this URL to share:', url)
      }
    }
  }

  const handleRemoveChart = (chartId: string) => {
    setHiddenCharts(prev => {
      if (prev.has(chartId)) return prev
      const newSet = new Set(prev)
      newSet.add(chartId)
      return newSet
    })
  }

  const handleRestoreChart = (chartId: string) => {
    setHiddenCharts(prev => {
      const newSet = new Set(prev)
      newSet.delete(chartId)
      return newSet
    })
  }

  const handleCreateChart = () => {
    if (chartBuilder.xAxis.length > 0 && chartBuilder.type) {
      const title = chartBuilder.title || `${chartBuilder.type.charAt(0).toUpperCase() + chartBuilder.type.slice(1)} Chart`
      
      const newChart: ChartConfig = {
        id: `chart-${Date.now()}`,
        type: chartBuilder.type as any,
        title: title,
        xAxis: { field: chartBuilder.xAxis[0] as any, aggregation: 'count' },
        yAxis: chartBuilder.yAxis.length > 0 ? { field: chartBuilder.yAxis[0] as any, aggregation: 'count' } : undefined,
        groupBy: chartBuilder.xAxis.length > 1 ? chartBuilder.xAxis[1] as any : undefined,
        colorScheme: 'default',
        showTooltip: true,
      }
      
      // Add to dashboard via store
      useChartBuilderStore.getState().addChart(newChart, {
        i: newChart.id,
        x: 0,
        y: 0,
        w: 4,
        h: 6,
      })
      
      // Reset builder
      setChartBuilder({
        type: 'bar',
        title: '',
        xAxis: [],
        yAxis: [],
      })
    }
  }

  const handleRemoveFieldFromAxis = (axis: 'xAxis' | 'yAxis', field: string) => {
    setChartBuilder(prev => ({
      ...prev,
      [axis]: prev[axis].filter(f => f !== field),
    }))
  }

  if (!currentDashboard) {
    return (
      <div className="chart-builder-empty">
        <p>No dashboard loaded</p>
        <button onClick={resetToDefault}>Load Default Dashboard</button>
      </div>
    )
  }

  return (
    <div className="chart-builder-container">
      {/* Header */}
      <div className="chart-builder-header">
        <div className="header-left">
          <h2>{currentDashboard.name}</h2>
          {currentDashboard.description && (
            <p className="dashboard-description">{currentDashboard.description}</p>
          )}
        </div>
        
        <div className="header-actions">
          {/* Historical Data Toggle */}
          <div className="historical-toggle">
            <label>
              <input
                type="checkbox"
                checked={showHistorical}
                onChange={(e) => setShowHistorical(e.target.checked)}
              />
              <span>Include Historical Data</span>
            </label>
            {showHistorical && (
              <div className="date-range-picker">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                />
                <span>to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                />
                <button onClick={fetchHistoricalData} disabled={loading}>
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            )}
          </div>

          {/* Hidden Charts Dropdown */}
          {hiddenCharts.size > 0 && (
            <div className="hidden-charts-dropdown">
              <button 
                className="hidden-charts-toggle"
                onClick={() => setShowHiddenDropdown(!showHiddenDropdown)}
              >
                👁️ Hidden Charts ({hiddenCharts.size})
              </button>
              {showHiddenDropdown && (
                <div className="hidden-charts-menu">
                  {Array.from(hiddenCharts).map(chartId => {
                    const chart = currentDashboard.charts.find(c => c.id === chartId)
                    return chart ? (
                      <div key={chartId} className="hidden-chart-item">
                        <span className="chart-name">{chart.title}</span>
                        <button 
                          className="restore-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            handleRestoreChart(chartId)
                          }}
                          title="Restore chart"
                        >
                          Restore
                        </button>
                      </div>
                    ) : null
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-summary">
        <div className="stat-item">
          <span className="stat-label">Current:</span>
          <span className="stat-value">{currentDisruptions.length}</span>
        </div>
        {showHistorical && (
          <>
            <div className="stat-item">
              <span className="stat-label">Historical:</span>
              <span className="stat-value">{historicalData.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{allDisruptions.length}</span>
            </div>
          </>
        )}
        <div className="stat-item">
          <span className="stat-label">Charts:</span>
          <span className="stat-value">{currentDashboard.charts.length}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="chart-builder-main">
        {/* Sidebar */}
        <div className="chart-builder-sidebar">
          <h3>📊 Chart Builder</h3>
          
          {/* Available Fields */}
          <div className="field-list">
            <h4>Available Fields</h4>
            {availableFields.map(({ field, label, icon }) => (
              <div
                key={field}
                className="field-item"
                draggable
                onDragStart={() => setDraggedField(field)}
                onDragEnd={() => setDraggedField(null)}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Chart Type Selector */}
          <div className="chart-type-selector">
            <h4>Chart Type</h4>
            <select
              value={chartBuilder?.type || ''}
              onChange={(e) => setChartBuilder(prev => ({ ...prev!, type: e.target.value }))}
            >
              <option value="">Select type...</option>
              <option value="bar">📊 Bar Chart</option>
              <option value="pie">🥧 Pie Chart</option>
              <option value="line">📈 Line Chart</option>
              <option value="area">📉 Area Chart</option>
              <option value="scatter">⚫ Scatter Plot</option>
              <option value="sankey">🌊 Sankey Flow</option>
            </select>
          </div>

          {/* Title Input */}
          <div className="title-input-container">
            <label>Chart Title (optional)</label>
            <input
              type="text"
              className="title-input"
              placeholder="Custom chart title"
              value={chartBuilder.title}
              onChange={(e) => setChartBuilder(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          {/* Drop Zones */}
          <div className="drop-zones">
            <div
              className={`drop-zone ${chartBuilder.xAxis.length > 0 ? 'has-field' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedField && !chartBuilder.xAxis.includes(draggedField)) {
                  setChartBuilder(prev => ({
                    ...prev,
                    xAxis: [...prev.xAxis, draggedField],
                  }))
                }
              }}
            >
              <label>X-Axis</label>
              {chartBuilder.xAxis.length > 0 ? (
                <div className="field-badges">
                  {chartBuilder.xAxis.map(field => (
                    <div key={field} className="field-badge">
                      {availableFields.find(f => f.field === field)?.label}
                      <button onClick={() => handleRemoveFieldFromAxis('xAxis', field)}>✖</button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="drop-hint">Drop field here</span>
              )}
            </div>

            <div
              className={`drop-zone ${chartBuilder.yAxis.length > 0 ? 'has-field' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedField && !chartBuilder.yAxis.includes(draggedField)) {
                  setChartBuilder(prev => ({
                    ...prev,
                    yAxis: [...prev.yAxis, draggedField],
                  }))
                }
              }}
            >
              <label>Y-Axis (optional)</label>
              {chartBuilder.yAxis.length > 0 ? (
                <div className="field-badges">
                  {chartBuilder.yAxis.map(field => (
                    <div key={field} className="field-badge">
                      {availableFields.find(f => f.field === field)?.label}
                      <button onClick={() => handleRemoveFieldFromAxis('yAxis', field)}>✖</button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="drop-hint">Drop field here</span>
              )}
            </div>
          </div>

          {/* Create Chart Button */}
          {chartBuilder.xAxis.length > 0 && chartBuilder.type && (
            <button className="create-chart-btn" onClick={handleCreateChart}>
              ➕ Create Chart
            </button>
          )}

        </div>

        {/* Grid Layout */}
        <div className="chart-grid">
          <ResponsiveGridLayout
            className="layout"
            layouts={currentDashboard.layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
            rowHeight={100}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".chart-header"
            useCSSTransforms={true}
          >
            {currentDashboard.charts
              .filter(chart => !hiddenCharts.has(chart.id))
              .map((chart) => (
                <div key={chart.id} className="chart-card">
                  <div className="chart-header">
                    <h3 className="chart-title">{chart.title}</h3>
                    <div className="chart-actions">
                      <button
                        className="chart-action-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleRemoveChart(chart.id)
                        }}
                        title="Hide chart"
                      >
                        👁️‍🗨️
                      </button>
                    </div>
                  </div>
                  <div className="chart-body">
                    <ChartRenderer config={chart} disruptions={allDisruptions} />
                  </div>
                </div>
              ))}
          </ResponsiveGridLayout>
        </div>
      </div>
    </div>
  )
}
