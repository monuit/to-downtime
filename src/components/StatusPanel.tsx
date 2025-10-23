import { useDisruptionStore } from '../store/disruptions'
import './StatusPanel.css'

interface StatusPanelProps {
  error: string | null
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ error }) => {
  const disruptions = useDisruptionStore((state) => state.disruptions)

  const countByType = disruptions.reduce(
    (acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const countBySeverity = disruptions.reduce(
    (acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const typeEmojis: Record<string, string> = {
    subway: '🚇',
    streetcar: '🚊',
    bus: '🚌',
    road: '🛣️',
    elevator: '🛗',
    escalator: '⬆️',
  }

  return (
    <div className="status-panel">
      {error && <div className="error-message">⚠️ {error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Disruptions</div>
          <div className="stat-value">{disruptions.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Severe</div>
          <div className="stat-value severity-severe">{countBySeverity['severe'] || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Moderate</div>
          <div className="stat-value severity-moderate">{countBySeverity['moderate'] || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Minor</div>
          <div className="stat-value severity-minor">{countBySeverity['minor'] || 0}</div>
        </div>
      </div>

      <div className="type-breakdown">
        <div className="breakdown-title">Disruptions by Type:</div>
        <div className="type-list">
          {Object.entries(countByType).map(([type, count]) => (
            <div key={type} className="type-item">
              <span className="type-emoji">{typeEmojis[type] || '❓'}</span>
              <span className="type-name">{type}</span>
              <span className="type-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="disruptions-list">
        <div className="list-title">Active Disruptions:</div>
        {disruptions.length === 0 ? (
          <div className="no-disruptions">✨ No disruptions - Everything is running smoothly!</div>
        ) : (
          <div className="list-items">
            {disruptions.slice(0, 5).map((d) => (
              <div key={d.id} className={`disruption-item severity-${d.severity}`}>
                <div className="item-title">{d.title}</div>
                <div className="item-lines">{d.affectedLines?.join(', ')}</div>
              </div>
            ))}
            {disruptions.length > 5 && <div className="more-items">+{disruptions.length - 5} more</div>}
          </div>
        )}
      </div>
    </div>
  )
}
