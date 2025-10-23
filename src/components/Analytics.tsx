import { useMemo } from 'react'
import { useDisruptionStore } from '../store/disruptions'
import { VictoryChart, VictoryBar, VictoryPie, VictoryAxis, VictoryTheme, VictoryTooltip } from 'victory'
import '../styles/Analytics.css'

export const Analytics: React.FC = () => {
  const disruptions = useDisruptionStore((state) => state.disruptions)

  // Calculate severity breakdown
  const severityData = useMemo(() => {
    const counts = {
      severe: disruptions.filter((d) => d.severity === 'severe').length,
      moderate: disruptions.filter((d) => d.severity === 'moderate').length,
      minor: disruptions.filter((d) => d.severity === 'minor').length,
    }

    return [
      { x: 'Severe', y: counts.severe, color: '#ff4444' },
      { x: 'Moderate', y: counts.moderate, color: '#ffaa00' },
      { x: 'Minor', y: counts.minor, color: '#44ff44' },
    ].filter((d) => d.y > 0) // Only show non-zero
  }, [disruptions])

  // Calculate type breakdown
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {}
    disruptions.forEach((d) => {
      counts[d.type] = (counts[d.type] || 0) + 1
    })

    return Object.entries(counts)
      .map(([type, count]) => ({
        x: type.charAt(0).toUpperCase() + type.slice(1),
        y: count,
      }))
      .sort((a, b) => b.y - a.y)
  }, [disruptions])

  // Timeline data (last 24 hours grouped by hour)
  const timelineData = useMemo(() => {
    const now = Date.now()
    const hoursInPast = 24
    const hourMs = 3600000

    // Create array for last 24 hours
    const hours: Record<number, number> = {}

    for (let i = 0; i < hoursInPast; i++) {
      const hourStart = Math.floor((now - i * hourMs) / hourMs) * hourMs
      hours[i] = 0
    }

    // Count disruptions in each hour
    disruptions.forEach((d) => {
      const hoursSince = Math.floor((now - d.timestamp) / hourMs)
      if (hoursSince < hoursInPast && hoursSince >= 0) {
        hours[hoursSince]++
      }
    })

    // Format for chart (reverse to show oldest first)
    return Object.entries(hours)
      .reverse()
      .map(([hoursAgo, count], idx) => ({
        x: `${23 - idx}h ago`,
        y: count,
      }))
  }, [disruptions])

  const chartTheme = {
    ...VictoryTheme.material,
    axis: {
      style: {
        axisLabel: { fill: '#a0aec0', fontSize: 12 },
        tickLabels: { fill: '#cbd5e0', fontSize: 11 },
        axis: { stroke: 'rgba(100, 150, 200, 0.2)' },
        grid: { stroke: 'rgba(100, 150, 200, 0.1)' },
      },
    },
  }

  return (
    <div className="analytics-container">
      <h2 className="analytics-title">Disruption Analytics</h2>

      <div className="charts-grid">
        {/* Severity Distribution - Pie Chart */}
        <div className="chart-panel">
          <h3>By Severity</h3>
          {severityData.length > 0 ? (
            <VictoryPie
              data={severityData}
              colorScale={severityData.map((d) => d.color)}
              labelRadius={({ innerRadius }) => (innerRadius as number) + 30}
              labels={({ datum }) => `${datum.x}: ${datum.y}`}
              style={{
                labels: { fill: '#e2e8f0', fontSize: 12, fontWeight: 600 },
                parent: { filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' },
              }}
              height={280}
            />
          ) : (
            <div className="empty-chart">No disruptions</div>
          )}
        </div>

        {/* Type Breakdown - Bar Chart */}
        <div className="chart-panel">
          <h3>By Type</h3>
          {typeData.length > 0 ? (
            <VictoryChart theme={chartTheme} height={280}>
              <VictoryAxis
                tickValues={typeData.map((_, i) => i)}
                tickFormat={(x) => typeData[x as number]?.x}
              />
              <VictoryAxis dependentAxis domain={{ y: [0, Math.max(...typeData.map((d) => d.y))] }} />
              <VictoryBar
                data={typeData}
                barWidth={40}
                style={{
                  data: { fill: '#5a9fd4', opacity: 0.8 },
                }}
                labelComponent={<VictoryTooltip style={{ fill: '#e2e8f0' }} />}
              />
            </VictoryChart>
          ) : (
            <div className="empty-chart">No data</div>
          )}
        </div>

        {/* Timeline - Last 24 Hours */}
        <div className="chart-panel full-width">
          <h3>Timeline (Last 24 Hours)</h3>
          {timelineData.some((d) => d.y > 0) ? (
            <VictoryChart theme={chartTheme} height={250}>
              <VictoryAxis
                tickValues={timelineData.map((_, i) => i).filter((i) => i % 3 === 0)}
                tickFormat={(x) => timelineData[x as number]?.x}
              />
              <VictoryAxis dependentAxis domain={{ y: [0, Math.max(...timelineData.map((d) => d.y), 1)] }} />
              <VictoryBar
                data={timelineData}
                barWidth={({ index }) => (index as number) === timelineData.length - 1 ? 25 : 20}
                style={{
                  data: {
                    fill: ({ index }) =>
                      (index as number) === timelineData.length - 1 ? '#ff6666' : '#5a9fd4',
                    opacity: 0.8,
                  },
                }}
              />
            </VictoryChart>
          ) : (
            <div className="empty-chart">No disruptions in past 24 hours</div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="analytics-stats">
        <div className="stat">
          <div className="stat-number">{disruptions.length}</div>
          <div className="stat-label">Total Disruptions</div>
        </div>
        <div className="stat">
          <div className="stat-number" style={{ color: '#ff6666' }}>
            {severityData.find((d) => d.x === 'Severe')?.y || 0}
          </div>
          <div className="stat-label">Severe</div>
        </div>
        <div className="stat">
          <div className="stat-number" style={{ color: '#ffb833' }}>
            {severityData.find((d) => d.x === 'Moderate')?.y || 0}
          </div>
          <div className="stat-label">Moderate</div>
        </div>
        <div className="stat">
          <div className="stat-number" style={{ color: '#66ff66' }}>
            {severityData.find((d) => d.x === 'Minor')?.y || 0}
          </div>
          <div className="stat-label">Minor</div>
        </div>
      </div>
    </div>
  )
}
