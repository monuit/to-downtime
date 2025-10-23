import { useState } from 'react'
import { useDisruptionStore } from '../store/disruptions'
import { StatusBar } from './StatusBar'
import { Legend } from './Legend'
import '../styles/Canvas.css'

export const Canvas: React.FC = () => {
  const disruptions = useDisruptionStore((state) => state.disruptions)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'time' | 'severity'>('severity')
  const [filterSeverity, setFilterSeverity] = useState<string[]>(['severe', 'moderate', 'minor'])
  const [filterType, setFilterType] = useState<string[]>([])

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

  // Filter disruptions
  let filtered = disruptions.filter(d => {
    const severityMatch = filterSeverity.includes(d.severity)
    const typeMatch = filterType.length === 0 || filterType.includes(d.type)
    return severityMatch && typeMatch
  })

  // Sort disruptions
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') {
      const severityOrder = { severe: 0, moderate: 1, minor: 2 }
      const aSev = severityOrder[a.severity as keyof typeof severityOrder]
      const bSev = severityOrder[b.severity as keyof typeof severityOrder]
      if (aSev !== bSev) return aSev - bSev
      return b.timestamp - a.timestamp
    } else {
      return b.timestamp - a.timestamp
    }
  })

  const formatTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'NOW'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }

  const getLineDisplay = (disruption: any): string => {
    if (disruption.affectedLines && disruption.affectedLines.length > 0) {
      return disruption.affectedLines[0]
    }
    return disruption.type.substring(0, 3).toUpperCase()
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const allTypes = Array.from(new Set(disruptions.map(d => d.type)))

  const toggleSeverityFilter = (severity: string) => {
    setFilterSeverity(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    )
  }

  const toggleTypeFilter = (type: string) => {
    setFilterType(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  return (
    <div className="canvas-container">
      <StatusBar disruptions={disruptions} />
      
      <Legend />

      {/* Filter and Sort Controls */}
      <div className="controls">
        <div className="control-group">
          <span className="control-label">Sort:</span>
          <button
            className={`control-btn ${sortBy === 'severity' ? 'active' : ''}`}
            onClick={() => setSortBy('severity')}
          >
            Severity
          </button>
          <button
            className={`control-btn ${sortBy === 'time' ? 'active' : ''}`}
            onClick={() => setSortBy('time')}
          >
            Time
          </button>
        </div>

        <div className="control-group">
          <span className="control-label">Filter:</span>
          <button
            className={`control-btn severity-btn severe ${filterSeverity.includes('severe') ? 'active' : ''}`}
            onClick={() => toggleSeverityFilter('severe')}
          >
            🔴
          </button>
          <button
            className={`control-btn severity-btn moderate ${filterSeverity.includes('moderate') ? 'active' : ''}`}
            onClick={() => toggleSeverityFilter('moderate')}
          >
            🟡
          </button>
          <button
            className={`control-btn severity-btn minor ${filterSeverity.includes('minor') ? 'active' : ''}`}
            onClick={() => toggleSeverityFilter('minor')}
          >
            🟢
          </button>
        </div>

        {allTypes.length > 1 && (
          <div className="control-group type-filters">
            {allTypes.map(type => (
              <button
                key={type}
                className={`control-btn type-btn ${filterType.includes(type) ? 'active' : ''}`}
                onClick={() => toggleTypeFilter(type)}
                title={type}
              >
                {typeEmojis[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compact Timeline Feed */}
      <div className="disruptions-feed">
        {sorted.map((disruption) => {
          const emoji = typeEmojis[disruption.type] || '⚠️'
          const timeStr = formatTime(disruption.timestamp)
          const lineDisplay = getLineDisplay(disruption)
          const isExpanded = expandedId === disruption.id
          const color = severityColors[disruption.severity]

          return (
            <div
              key={disruption.id}
              className={`disruption-item ${disruption.severity} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpand(disruption.id)}
            >
              <div className="item-main">
                <div className="item-indicator" style={{ background: color }}></div>
                <div className="item-time" style={{ color }}>{timeStr}</div>
                <div className="item-divider"></div>
                <div className="item-icon">{emoji}</div>
                <div className="item-line">{lineDisplay}</div>
                <div className="item-divider"></div>
                <div className="item-description">{disruption.description}</div>
              </div>

              {isExpanded && (
                <div className="item-details">
                  <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{disruption.type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Severity:</span>
                    <span className="detail-value" style={{ color }}>{disruption.severity}</span>
                  </div>
                  {disruption.affectedLines && disruption.affectedLines.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Lines:</span>
                      <span className="detail-value">{disruption.affectedLines.join(', ')}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Reported:</span>
                    <span className="detail-value">
                      {new Date(disruption.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sorted.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✨</div>
            <div className="empty-text">No disruptions found</div>
            <div className="empty-subtext">
              {disruptions.length === 0
                ? 'Toronto transit is running smoothly'
                : 'Try adjusting your filters'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

