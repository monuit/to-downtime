import { useState } from 'react'
import { useDisruptionStore, type Disruption } from '../store/disruptions'
import { StatusBar } from './StatusBar'
import { Legend } from './Legend'
import type { FilterOptions } from './FilterPanel'
import '../styles/Canvas.css'

interface CanvasProps {
  disruptions?: Disruption[]
  filters?: FilterOptions
  onFiltersChange?: (filters: FilterOptions) => void
}

export const Canvas: React.FC<CanvasProps> = ({ disruptions: propDisruptions, filters, onFiltersChange }) => {
  const storeDisruptions = useDisruptionStore((state) => state.disruptions)
  const disruptions = propDisruptions || storeDisruptions
  const setSelectedDisruption = useDisruptionStore((state) => state.setSelectedDisruption)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'time' | 'severity'>('severity')
  
  // Use local filters if no parent filters provided (backward compatibility)
  const [localFilterSeverity, setLocalFilterSeverity] = useState<string[]>(['severe', 'moderate', 'minor'])
  const [localFilterType, setLocalFilterType] = useState<string[]>([])
  
  const filterSeverity = localFilterSeverity
  const filterType = localFilterType

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
    const newExpandedId = expandedId === id ? null : id
    setExpandedId(newExpandedId)
    
    // Update selected disruption in store for map
    if (newExpandedId) {
      const disruption = sorted.find(d => d.id === newExpandedId)
      setSelectedDisruption(disruption || null)
    } else {
      setSelectedDisruption(null)
    }
  }

  const allTypes = Array.from(new Set(disruptions.map(d => d.type)))

  const toggleSeverityFilter = (severity: string) => {
    setLocalFilterSeverity(prev =>
      prev.includes(severity)
        ? prev.filter(s => s !== severity)
        : [...prev, severity]
    )
  }

  const toggleTypeFilter = (type: string) => {
    setLocalFilterType(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  // Handler to apply filter from detail badges
  const handleFilterClick = (filterType: 'workType' | 'impactLevel' | 'scheduleType' | 'duration', value: string) => {
    if (!filters || !onFiltersChange) return
    
    const updatedFilters = { ...filters }
    
    switch (filterType) {
      case 'workType':
        updatedFilters.workTypes = [value]
        break
      case 'impactLevel':
        updatedFilters.impactLevels = [value as 'Low' | 'Medium' | 'High']
        break
      case 'scheduleType':
        updatedFilters.scheduleTypes = value ? [value] : []
        break
      case 'duration':
        updatedFilters.durations = [value]
        break
    }
    
    onFiltersChange(updatedFilters)
  }

  return (
    <div className="canvas-container">
      <StatusBar disruptions={disruptions} />

      {/* Filter and Sort Controls */}
      <div className="controls">
        <div className="control-group sort-filter-group">
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
          
          <span className="control-divider">|</span>
          
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
        {sorted.map((disruption, index) => {
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
              style={{
                animationDelay: `${Math.min(index * 0.03, 0.6)}s`
              }}
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
                  {disruption.workType && (
                    <div className="detail-row">
                      <span className="detail-label">Work Type:</span>
                      <span 
                        className="detail-value clickable-badge" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFilterClick('workType', disruption.workType!)
                        }}
                        title="Click to filter by this work type"
                      >
                        {disruption.workType}
                      </span>
                    </div>
                  )}
                  {disruption.impactLevel && (
                    <div className="detail-row">
                      <span className="detail-label">Impact:</span>
                      <span 
                        className="detail-value clickable-badge" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFilterClick('impactLevel', disruption.impactLevel!)
                        }}
                        title="Click to filter by this impact level"
                      >
                        {disruption.impactLevel}
                      </span>
                    </div>
                  )}
                  {disruption.scheduleType && (
                    <div className="detail-row">
                      <span className="detail-label">Schedule:</span>
                      <span 
                        className="detail-value clickable-badge" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFilterClick('scheduleType', disruption.scheduleType!)
                        }}
                        title="Click to filter by this schedule"
                      >
                        {disruption.scheduleType}
                      </span>
                    </div>
                  )}
                  {disruption.duration && (
                    <div className="detail-row">
                      <span className="detail-label">Duration:</span>
                      <span 
                        className="detail-value clickable-badge" 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFilterClick('duration', disruption.duration!)
                        }}
                        title="Click to filter by this duration"
                      >
                        {disruption.duration}
                      </span>
                    </div>
                  )}
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
                  {disruption.cause && (
                    <div className="detail-row">
                      <span className="detail-label">Cause:</span>
                      <span className="detail-value">
                        {disruption.cause === 'maintenance' && '🔧 Maintenance'}
                        {disruption.cause === 'weather' && '⛈️ Weather'}
                        {disruption.cause === 'medical' && '🚑 Medical Emergency'}
                        {disruption.cause === 'mechanical' && '⚙️ Mechanical Issue'}
                        {disruption.cause === 'investigation' && '🔍 Investigation'}
                        {disruption.cause === 'other' && '❓ Other'}
                      </span>
                    </div>
                  )}
                  {disruption.direction && (
                    <div className="detail-row">
                      <span className="detail-label">Direction:</span>
                      <span className="detail-value">
                        {disruption.direction === 'eastbound' && '→ Eastbound'}
                        {disruption.direction === 'westbound' && '← Westbound'}
                        {disruption.direction === 'northbound' && '↑ Northbound'}
                        {disruption.direction === 'southbound' && '↓ Southbound'}
                        {disruption.direction === 'bidirectional' && '↔ Both Directions'}
                      </span>
                    </div>
                  )}
                  {disruption.stopIds && disruption.stopIds.length > 0 && (
                    <div className="detail-row">
                      <span className="detail-label">Stations:</span>
                      <span className="detail-value">{disruption.stopIds.length} affected</span>
                    </div>
                  )}
                  {disruption.activePeriod?.end && (
                    <div className="detail-row">
                      <span className="detail-label">Expires:</span>
                      <span className="detail-value">
                        {new Date(disruption.activePeriod.end).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Reported:</span>
                    <span className="detail-value">
                      {new Date(disruption.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {disruption.url && (
                    <div className="detail-row">
                      <a
                        href={disruption.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="detail-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        More Info ↗
                      </a>
                    </div>
                  )}
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

