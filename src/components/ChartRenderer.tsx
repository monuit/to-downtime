import React, { useMemo } from 'react'
import {
  VictoryChart,
  VictoryBar,
  VictoryPie,
  VictoryLine,
  VictoryArea,
  VictoryScatter,
  VictoryAxis,
  VictoryTheme,
  VictoryTooltip,
  VictoryLegend,
  VictoryStack,
} from 'victory'
import { Sankey, Tooltip, Rectangle, Layer } from 'recharts'
import type { ChartConfig } from '../store/chartBuilder'
import type { Disruption } from '../store/disruptions'
import {
  aggregateByField,
  aggregateByMultipleFields,
  generateTimeSeries,
  calculateDistribution,
  getTopN,
  generateSankeyData,
} from '../utils/chartDataTransformers'

interface ChartRendererProps {
  config: ChartConfig
  disruptions: Disruption[]
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({ config, disruptions }) => {
  // Apply filters if any
  const filteredDisruptions = useMemo(() => {
    if (!config.filters || config.filters.length === 0) {
      return disruptions
    }

    return disruptions.filter((d) => {
      return config.filters!.every((filter) => {
        const value = d[filter.field]
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
          case 'greaterThan':
            return Number(value) > Number(filter.value)
          case 'lessThan':
            return Number(value) < Number(filter.value)
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value)
          default:
            return true
        }
      })
    })
  }, [disruptions, config.filters])

  // Apply date range if specified
  const dateFilteredDisruptions = useMemo(() => {
    if (!config.dateRange) {
      return filteredDisruptions
    }

    return filteredDisruptions.filter(
      (d) => d.timestamp >= config.dateRange!.start && d.timestamp <= config.dateRange!.end
    )
  }, [filteredDisruptions, config.dateRange])

  // Get color scheme - Matching live view colors
  const getColorScheme = (): string[] => {
    switch (config.colorScheme) {
      case 'severity':
        return ['#ff3333', '#ffaa00', '#ffdd00'] // Severe, Moderate, Minor from live view
      case 'impact':
        return ['#ff3333', '#ffaa00', '#ffdd00']
      case 'warm':
        return ['#ff6b6b', '#ee5a6f', '#f06595', '#cc5de8', '#845ef7']
      case 'cool':
        return ['#667eea', '#764ba2', '#8b5cf6', '#a78bfa', '#c4b5fd']
      default:
        // Neutral dark theme colors
        return ['#667eea', '#764ba2', '#8b5cf6', '#a78bfa', '#c4b5fd', '#e9d5ff']
    }
  }

  // Chart theme - Matching live view dark theme
  const chartTheme = {
    ...VictoryTheme.material,
    axis: {
      style: {
        axisLabel: { fill: '#999', fontSize: 12 },
        tickLabels: { fill: '#999', fontSize: 10 },
        axis: { stroke: '#222' },
        grid: { stroke: 'rgba(34, 34, 34, 0.5)' },
      },
    },
  }

  const renderChart = () => {
    if (dateFilteredDisruptions.length === 0) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: '#a0aec0',
          fontSize: '14px'
        }}>
          No data available
        </div>
      )
    }

    switch (config.type) {
      case 'bar':
        return renderBarChart()
      case 'pie':
        return renderPieChart()
      case 'line':
        return renderLineChart()
      case 'area':
        return renderAreaChart()
      case 'scatter':
        return renderScatterChart()
      case 'stats':
        return renderStatsCard()
      case 'sankey':
        return renderSankeyChart()
      default:
        return <div>Unsupported chart type</div>
    }
  }

  const renderBarChart = () => {
    if (!config.xAxis) return null

    let data
    
    if (config.groupBy) {
      // Grouped/stacked bar chart
      const groupedData = aggregateByMultipleFields(
        dateFilteredDisruptions,
        config.xAxis.field,
        config.groupBy,
        config.xAxis.aggregation || 'count'
      )

      const allGroups = Array.from(
        new Set(dateFilteredDisruptions.map(d => String(d[config.groupBy!])))
      ).filter(g => g !== 'undefined')

      return (
        <VictoryChart theme={chartTheme} domainPadding={20} height={280}>
          {config.showLegend && (
            <VictoryLegend
              x={50}
              y={10}
              orientation="horizontal"
              gutter={20}
              style={{ labels: { fill: '#e2e8f0', fontSize: 10 } }}
              data={allGroups.map((group, i) => ({
                name: group,
                symbol: { fill: getColorScheme()[i % getColorScheme().length] }
              }))}
            />
          )}
          <VictoryAxis
            label={config.xAxis.label || String(config.xAxis.field)}
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 30, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9, angle: -45, textAnchor: 'end' },
            }}
          />
          <VictoryAxis
            dependentAxis
            label={config.yAxis?.label || 'Count'}
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 40, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
          />
          <VictoryStack colorScale={getColorScheme()}>
            {allGroups.map((group) => {
              const groupData = Object.entries(groupedData).flatMap(([key, values]) => {
                const match = values.find(v => v.x === group)
                return match ? [{ x: key, y: match.y }] : []
              })

              return (
                <VictoryBar
                  key={group}
                  data={groupData}
                  labels={({ datum }) => `${datum.y}`}
                  labelComponent={
                    config.showTooltip ? (
                      <VictoryTooltip
                        style={{ fill: '#fff', fontSize: 10 }}
                        flyoutStyle={{ fill: '#2d3748', stroke: '#4a5568' }}
                      />
                    ) : undefined
                  }
                />
              )
            })}
          </VictoryStack>
        </VictoryChart>
      )
    } else {
      // Simple bar chart
      data = getTopN(dateFilteredDisruptions, config.xAxis.field, 10)

      return (
        <VictoryChart theme={chartTheme} domainPadding={20} height={280}>
          <VictoryAxis
            label={config.xAxis.label || String(config.xAxis.field)}
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 30, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9, angle: -45, textAnchor: 'end' },
            }}
          />
          <VictoryAxis
            dependentAxis
            label="Count"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 40, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
          />
          <VictoryBar
            data={data}
            colorScale={getColorScheme()}
            labels={({ datum }) => `${datum.y}`}
            labelComponent={
              config.showTooltip ? (
                <VictoryTooltip
                  style={{ fill: '#fff', fontSize: 10 }}
                  flyoutStyle={{ fill: '#2d3748', stroke: '#4a5568' }}
                />
              ) : undefined
            }
          />
        </VictoryChart>
      )
    }
  }

  const renderPieChart = () => {
    if (!config.xAxis) return null

    const distribution = calculateDistribution(dateFilteredDisruptions, config.xAxis.field)

    const data = distribution.map((item, index) => ({
      x: item.label,
      y: item.count,
      label: `${item.label}: ${item.count} (${item.percentage.toFixed(1)}%)`,
      color: item.color || getColorScheme()[index % getColorScheme().length],
    }))

    return (
      <VictoryPie
        data={data}
        colorScale={data.map(d => d.color)}
        labelRadius={({ innerRadius }) => (innerRadius as number) + 35}
        labels={({ datum }) => `${datum.x}\n${datum.y}`}
        style={{
          labels: { fill: '#e2e8f0', fontSize: 11, fontWeight: 600 },
          parent: { filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' },
        }}
        height={280}
      />
    )
  }

  const renderLineChart = () => {
    const timeSeriesData = generateTimeSeries(
      dateFilteredDisruptions,
      'hour',
      24,
      config.groupBy
    )

    if (config.groupBy && typeof timeSeriesData === 'object' && !Array.isArray(timeSeriesData)) {
      // Multi-line chart
      const groups = Object.keys(timeSeriesData)

      return (
        <VictoryChart theme={chartTheme} height={280} scale={{ x: 'time' }}>
          {config.showLegend && (
            <VictoryLegend
              x={50}
              y={10}
              orientation="horizontal"
              gutter={20}
              style={{ labels: { fill: '#e2e8f0', fontSize: 10 } }}
              data={groups.map((group, i) => ({
                name: group,
                symbol: { fill: getColorScheme()[i % getColorScheme().length], type: 'minus' }
              }))}
            />
          )}
          <VictoryAxis
            label="Time"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 30, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
            tickFormat={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit' })}
          />
          <VictoryAxis
            dependentAxis
            label="Count"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 40, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
          />
          {groups.map((group, i) => (
            <VictoryLine
              key={group}
              data={timeSeriesData[group]}
              style={{
                data: {
                  stroke: getColorScheme()[i % getColorScheme().length],
                  strokeWidth: 2,
                },
              }}
              labels={config.showTooltip ? ({ datum }) => `${datum.y}` : undefined}
              labelComponent={
                config.showTooltip ? (
                  <VictoryTooltip
                    style={{ fill: '#fff', fontSize: 10 }}
                    flyoutStyle={{ fill: '#2d3748', stroke: '#4a5568' }}
                  />
                ) : undefined
              }
            />
          ))}
        </VictoryChart>
      )
    } else if (Array.isArray(timeSeriesData)) {
      // Single line chart
      return (
        <VictoryChart theme={chartTheme} height={280} scale={{ x: 'time' }}>
          <VictoryAxis
            label="Time"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 30, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
            tickFormat={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit' })}
          />
          <VictoryAxis
            dependentAxis
            label="Count"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 40, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
          />
          <VictoryLine
            data={timeSeriesData}
            style={{
              data: {
                stroke: getColorScheme()[0],
                strokeWidth: 2,
              },
            }}
            labels={config.showTooltip ? ({ datum }) => `${datum.y}` : undefined}
            labelComponent={
              config.showTooltip ? (
                <VictoryTooltip
                  style={{ fill: '#fff', fontSize: 10 }}
                  flyoutStyle={{ fill: '#2d3748', stroke: '#4a5568' }}
                />
              ) : undefined
            }
          />
        </VictoryChart>
      )
    }

    return null
  }

  const renderAreaChart = () => {
    const timeSeriesData = generateTimeSeries(
      dateFilteredDisruptions,
      'hour',
      24,
      config.groupBy
    )

    if (Array.isArray(timeSeriesData)) {
      return (
        <VictoryChart theme={chartTheme} height={280} scale={{ x: 'time' }}>
          <VictoryAxis
            label="Time"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 30, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
            tickFormat={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit' })}
          />
          <VictoryAxis
            dependentAxis
            label="Count"
            style={{
              axisLabel: { fill: '#e2e8f0', padding: 40, fontSize: 11 },
              tickLabels: { fill: '#cbd5e0', fontSize: 9 },
            }}
          />
          <VictoryArea
            data={timeSeriesData}
            style={{
              data: {
                fill: getColorScheme()[0],
                fillOpacity: 0.4,
                stroke: getColorScheme()[0],
                strokeWidth: 2,
              },
            }}
          />
        </VictoryChart>
      )
    }

    return null
  }

  const renderScatterChart = () => {
    if (!config.xAxis || !config.yAxis) return null

    const data = dateFilteredDisruptions
      .filter(d => d[config.xAxis!.field] !== undefined && d[config.yAxis!.field] !== undefined)
      .map(d => ({
        x: d[config.xAxis!.field],
        y: d[config.yAxis!.field],
        label: d.title,
      }))

    return (
      <VictoryChart theme={chartTheme} height={280}>
        <VictoryAxis
          label={config.xAxis.label || String(config.xAxis.field)}
          style={{
            axisLabel: { fill: '#e2e8f0', padding: 30, fontSize: 11 },
            tickLabels: { fill: '#cbd5e0', fontSize: 9 },
          }}
        />
        <VictoryAxis
          dependentAxis
          label={config.yAxis.label || String(config.yAxis.field)}
          style={{
            axisLabel: { fill: '#e2e8f0', padding: 40, fontSize: 11 },
            tickLabels: { fill: '#cbd5e0', fontSize: 9 },
          }}
        />
        <VictoryScatter
          data={data}
          size={5}
          style={{
            data: {
              fill: getColorScheme()[0],
            },
          }}
          labels={config.showTooltip ? ({ datum }) => datum.label : undefined}
          labelComponent={
            config.showTooltip ? (
              <VictoryTooltip
                style={{ fill: '#fff', fontSize: 10 }}
                flyoutStyle={{ fill: '#2d3748', stroke: '#4a5568' }}
              />
            ) : undefined
          }
        />
      </VictoryChart>
    )
  }

  const renderStatsCard = () => {
    const total = dateFilteredDisruptions.length
    const severeCounts = dateFilteredDisruptions.filter(d => d.severity === 'severe').length
    const moderateCounts = dateFilteredDisruptions.filter(d => d.severity === 'moderate').length
    const minorCounts = dateFilteredDisruptions.filter(d => d.severity === 'minor').length

    return (
      <div style={{
        padding: '20px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px',
        height: '100%',
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: '8px',
          padding: '15px',
          border: '1px solid #222',
        }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Total</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>{total}</div>
        </div>
        <div style={{
          background: 'rgba(255, 51, 51, 0.1)',
          borderRadius: '8px',
          padding: '15px',
          border: '1px solid rgba(255, 51, 51, 0.3)',
        }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Severe</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff3333' }}>{severeCounts}</div>
        </div>
        <div style={{
          background: 'rgba(255, 170, 0, 0.1)',
          borderRadius: '8px',
          padding: '15px',
          border: '1px solid rgba(255, 170, 0, 0.3)',
        }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Moderate</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffaa00' }}>{moderateCounts}</div>
        </div>
        <div style={{
          background: 'rgba(255, 221, 0, 0.1)',
          borderRadius: '8px',
          padding: '15px',
          border: '1px solid rgba(255, 221, 0, 0.3)',
        }}>
          <div style={{ fontSize: '12px', color: '#999', marginBottom: '5px' }}>Minor</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffdd00' }}>{minorCounts}</div>
        </div>
      </div>
    )
  }

  const renderSankeyChart = () => {
    if (!config.xAxis || !config.yAxis) return null

    // Generate Sankey data from source to target field
    const sankeyData = generateSankeyData(
      dateFilteredDisruptions,
      config.xAxis.field,
      config.yAxis.field
    )

    if (!sankeyData.nodes.length || !sankeyData.links.length) {
      return (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: '#a0aec0',
          fontSize: '14px'
        }}>
          No flow data available
        </div>
      )
    }

    const colors = getColorScheme()

    // Custom node component with dark theme
    const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
      const color = colors[index % colors.length]
      return (
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          fillOpacity={0.8}
        />
      )
    }

    // Custom link component with dark theme
    const SankeyLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index }: any) => {
      const color = colors[index % colors.length]
      return (
        <Layer key={`CustomLink${index}`}>
          <path
            d={`
              M${sourceX},${sourceY}
              C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
            `}
            fill="none"
            stroke={color}
            strokeWidth={linkWidth}
            strokeOpacity={0.3}
          />
        </Layer>
      )
    }

    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sankey
          width={600}
          height={400}
          data={sankeyData}
          node={<SankeyNode />}
          link={<SankeyLink />}
          nodePadding={50}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <Tooltip
            contentStyle={{
              backgroundColor: '#111',
              border: '1px solid #333',
              borderRadius: '4px',
              color: '#e2e8f0',
            }}
          />
        </Sankey>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {renderChart()}
    </div>
  )
}
