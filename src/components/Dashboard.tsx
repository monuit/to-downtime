import { useState, useMemo, useEffect } from 'react'
import { useDisruptionStore, type Disruption } from '../store/disruptions'
import '../styles/Dashboard.css'

type TimeFilter = 'active' | 'upcoming' | 'all'

interface DashboardProps {
  disruptions?: Disruption[]
}

export const Dashboard: React.FC<DashboardProps> = ({ disruptions: propDisruptions }) => {
  const storeDisruptions = useDisruptionStore((state) => state.disruptions)
  const disruptions = propDisruptions || storeDisruptions
  const removeDisruption = useDisruptionStore((state) => state.removeDisruption)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('active')
  const [showCauseIcons, setShowCauseIcons] = useState(true)
  const [showCountdown, setShowCountdown] = useState(true) // true = countdown, false = end time
  const [now, setNow] = useState(Date.now())

  // Update timer every minute for live countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [])

  // Auto-remove expired disruptions
  useEffect(() => {
    disruptions.forEach(d => {
      if (d.activePeriod?.end && d.activePeriod.end < now) {
        console.log(`🗑️ Auto-removing expired disruption: ${d.id}`)
        removeDisruption(d.id)
      }
    })
  }, [disruptions, now, removeDisruption])

  // Categorize disruptions by time
  const categorized = useMemo(() => {
    const active: typeof disruptions = []
    const upcoming: typeof disruptions = []
    
    disruptions.forEach(disruption => {
      const start = disruption.activePeriod?.start
      const end = disruption.activePeriod?.end
      
      // Skip expired
      if (end && end < now) return
      
      // Active: started (or no start time) and not ended
      if ((!start || start <= now) && (!end || end > now)) {
        active.push(disruption)
      }
      // Upcoming: has start time in the future
      else if (start && start > now) {
        upcoming.push(disruption)
      }
      // Otherwise active by default
      else {
        active.push(disruption)
      }
    })
    
    return { active, upcoming, all: disruptions }
  }, [disruptions, now])

  const filtered = categorized[timeFilter]

  const causeIcons: Record<string, string> = {
    maintenance: '🔧',
    weather: '⛈️',
    medical: '🚑',
    mechanical: '⚙️',
    investigation: '🔍',
    other: '❓',
  }

  const directionIcons: Record<string, string> = {
    eastbound: '→',
    westbound: '←',
    northbound: '↑',
    southbound: '↓',
    bidirectional: '↔',
  }

  const formatTimeRemaining = (endTime: number) => {
    const diff = endTime - now
    if (diff <= 0) return 'Expired'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `🕐 ${hours}h ${minutes}m left`
    }
    return `🕐 ${minutes}m left`
  }

  const formatEndTime = (endTime: number) => {
    const date = new Date(endTime)
    return `Ends at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
  }

  return (
    <div className="dashboard">
      {/* Time-based filter chips */}
      <div className="time-filters">
        <button
          className={`filter-chip ${timeFilter === 'active' ? 'active' : ''}`}
          onClick={() => setTimeFilter('active')}
        >
          🔴 Active Now ({categorized.active.length})
        </button>
        <button
          className={`filter-chip ${timeFilter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setTimeFilter('upcoming')}
        >
          🟡 Upcoming ({categorized.upcoming.length})
        </button>
        <button
          className={`filter-chip ${timeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setTimeFilter('all')}
        >
          ⚪ All ({categorized.all.length})
        </button>
      </div>

      {/* Toggle options */}
      <div className="display-toggles">
        <label className="toggle-option">
          <input
            type="checkbox"
            checked={showCauseIcons}
            onChange={(e) => setShowCauseIcons(e.target.checked)}
          />
          <span>Show Cause Icons</span>
        </label>
        <label className="toggle-option">
          <input
            type="checkbox"
            checked={showCountdown}
            onChange={(e) => setShowCountdown(e.target.checked)}
          />
          <span>Show Countdown</span>
        </label>
      </div>

      {/* Disruptions list */}
      <div className="disruptions-list">
        {filtered.length === 0 ? (
          <div className="no-disruptions">
            ✨ No {timeFilter === 'all' ? '' : timeFilter} disruptions - Everything is running smoothly!
          </div>
        ) : (
          filtered.map((d) => (
            <div key={d.id} className={`disruption-card severity-${d.severity}`}>
              <div className="disruption-header">
                <div className="disruption-title-row">
                  {showCauseIcons && d.cause && (
                    <span className="cause-icon" title={d.cause}>
                      {causeIcons[d.cause]}
                    </span>
                  )}
                  <h3 className="disruption-title">{d.title}</h3>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="external-link"
                      title="More info"
                    >
                      ↗
                    </a>
                  )}
                </div>
                {d.affectedLines && d.affectedLines.length > 0 && (
                  <div className="affected-lines">
                    {d.affectedLines.map((line, idx) => (
                      <span key={idx} className="line-badge">
                        {line}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="disruption-description">{d.description}</p>

              <div className="disruption-meta">
                {d.direction && (
                  <span className="direction-badge">
                    {directionIcons[d.direction]} {d.direction.charAt(0).toUpperCase() + d.direction.slice(1)}
                  </span>
                )}
                
                {d.stopIds && d.stopIds.length > 0 && (
                  <span className="station-range">
                    {d.stopIds.length} station{d.stopIds.length !== 1 ? 's' : ''} affected
                  </span>
                )}
                
                {d.activePeriod?.end && (
                  <span className="expiry-info">
                    {showCountdown ? formatTimeRemaining(d.activePeriod.end) : formatEndTime(d.activePeriod.end)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

