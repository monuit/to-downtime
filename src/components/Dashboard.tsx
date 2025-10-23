import { useState, useMemo } from 'react'
import { useDisruptionStore } from '../store/disruptions'
import '../styles/Dashboard.css'

interface DashboardProps {
  onFilterChange?: (filter: 'all' | 'live') => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onFilterChange }) => {
  const disruptions = useDisruptionStore((state) => state.disruptions)
  const [filterMode, setFilterMode] = useState<'all' | 'live'>('live')
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)

  // Filter disruptions
  const filteredDisruptions = useMemo(() => {
    let filtered = [...disruptions]

    if (filterMode === 'live') {
      filtered = filtered.filter((d) => Date.now() - d.timestamp < 60000) // Last 60 seconds
    }

    if (selectedSeverity) {
      filtered = filtered.filter((d) => d.severity === selectedSeverity)
    }

    return filtered.sort((a, b) => {
      // Sort by severity first
      const severityOrder = { severe: 0, moderate: 1, minor: 2 }
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder]
    })
  }, [disruptions, filterMode, selectedSeverity])

  // Calculate stats
  const stats = useMemo(() => {
    const byType = disruptions.reduce(
      (acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const bySeverity = disruptions.reduce(
      (acc, d) => {
        acc[d.severity] = (acc[d.severity] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total: disruptions.length,
      active: filteredDisruptions.length,
      byType,
      bySeverity,
    }
  }, [disruptions, filteredDisruptions])

  // Recent events (last 5)
  const recentEvents = useMemo(() => {
    return [...disruptions]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
  }, [disruptions])

  const typeEmojis: Record<string, string> = {
    subway: '🚇',
    streetcar: '🚊',
    bus: '🚌',
    road: '🛣️',
    elevator: '🛗',
    escalator: '⬆️',
  }

  const severityColors: Record<string, string> = {
    severe: '#ff4444',
    moderate: '#ffaa00',
    minor: '#44ff44',
  }

  return (
    <div className="dashboard-container">
      {/* LEFT PANEL - System Status */}
      <div className="panel left-panel">
        <div className="panel-header">
          <h2>System Status</h2>
          <div className="status-indicator live"></div>
        </div>

        <div className="status-metrics">
          <div className="metric">
            <div className="metric-label">Total Disruptions</div>
            <div className="metric-value">{stats.total}</div>
          </div>

          <div className="metric">
            <div className="metric-label">Active Now</div>
            <div className="metric-value">{stats.active}</div>
          </div>

          <div className="metric">
            <div className="metric-label">Severe</div>
            <div className="metric-value" style={{ color: '#ff4444' }}>{stats.bySeverity.severe || 0}</div>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="analyzer-section">
          <h3>By Severity</h3>
          <div className="severity-breakdown">
            <div className="severity-item severe">
              <span>Severe</span>
              <span className="count">{stats.bySeverity.severe || 0}</span>
            </div>
            <div className="severity-item moderate">
              <span>Moderate</span>
              <span className="count">{stats.bySeverity.moderate || 0}</span>
            </div>
            <div className="severity-item minor">
              <span>Minor</span>
              <span className="count">{stats.bySeverity.minor || 0}</span>
            </div>
          </div>
        </div>

        {/* Detection Zones */}
        <div className="zones-section">
          <h3>Detection Zones</h3>
          <div className="zones-chart">
            <div className="zone-circle">
              <div className="zone-marker north"></div>
              <div className="zone-marker south"></div>
              <div className="zone-marker east"></div>
              <div className="zone-marker west"></div>
              <div className="zone-center"></div>
            </div>
          </div>
          <div className="zones-list">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="zone-item">
                <span className="zone-name">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span className="zone-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER - 3D Map (Canvas handles this) */}
      {/* Map is behind these panels */}

      {/* RIGHT PANEL - Active Disruptions */}
      <div className="panel right-panel">
        <div className="panel-header">
          <h2>Active Disruptions</h2>
          <span className="count-badge">{stats.active}</span>
        </div>

        {/* Filter Bar */}
        <div className="filter-bar">
          <button
            className={`filter-btn ${filterMode === 'live' ? 'active' : ''}`}
            onClick={() => {
              setFilterMode('live')
              onFilterChange?.('live')
            }}
          >
            🔴 Live
          </button>
          <button
            className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterMode('all')
              onFilterChange?.('all')
            }}
          >
            📋 All
          </button>
        </div>

        {/* Severity Filter */}
        <div className="severity-filter">
          {['severe', 'moderate', 'minor'].map((sev) => (
            <button
              key={sev}
              className={`severity-btn ${selectedSeverity === sev ? 'active' : ''} ${selectedSeverity === sev || !selectedSeverity ? '' : 'disabled'}`}
              style={{ borderColor: severityColors[sev] }}
              onClick={() => setSelectedSeverity(selectedSeverity === sev ? null : sev)}
              title={`${sev.charAt(0).toUpperCase() + sev.slice(1)}`}
            >
              <span className="dot" style={{ backgroundColor: severityColors[sev] }}></span>
              {sev.charAt(0).toUpperCase()}
            </button>
          ))}
        </div>

        {/* Disruptions List */}
        <div className="disruptions-list">
          {filteredDisruptions.length === 0 ? (
            <div className="empty-state">
              <p>No disruptions detected</p>
              <span>🎉 All systems nominal</span>
            </div>
          ) : (
            filteredDisruptions.map((disruption) => (
              <div
                key={disruption.id}
                className="disruption-item"
                style={{ borderLeftColor: severityColors[disruption.severity] }}
              >
                <div className="disruption-header">
                  <div className="disruption-type">
                    <span className="emoji">{typeEmojis[disruption.type] || '⚠️'}</span>
                    <span className="type">{disruption.type}</span>
                  </div>
                  <div className={`severity-badge ${disruption.severity}`}>{disruption.severity.toUpperCase()}</div>
                </div>

                <div className="disruption-title">{disruption.title}</div>

                <div className="disruption-description">{disruption.description}</div>

                {disruption.affectedLines && disruption.affectedLines.length > 0 && (
                  <div className="affected-lines">
                    {disruption.affectedLines.map((line, idx) => (
                      <span key={idx} className="line-tag">
                        {line}
                      </span>
                    ))}
                  </div>
                )}

                <div className="disruption-time">
                  {new Date(disruption.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* BOTTOM PANEL - Timeline Events */}
      <div className="panel bottom-panel">
        <div className="panel-header">
          <h2>Timeline Events</h2>
          <span className="time">{new Date().toLocaleTimeString()}</span>
        </div>

        <div className="timeline">
          {recentEvents.length === 0 ? (
            <div className="empty-timeline">No events yet</div>
          ) : (
            recentEvents.map((event, idx) => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-marker" style={{ backgroundColor: severityColors[event.severity] }}></div>
                <div className="timeline-content">
                  <div className="timeline-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="timeline-event">
                    <span className="emoji">{typeEmojis[event.type] || '⚠️'}</span>
                    <span className="text">
                      {event.title}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
